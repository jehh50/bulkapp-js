/**
 * Captura de formularios dinámicos (runtime del operador). Solo campañas de flujo
 * dinámico. Con BD vigente, cada registro admite un solo envío (queda atendido).
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { FLUJO, inputInt, inputString, validarValores } from '@bulkapp/shared';
import { invalido, prisma } from '../lib/core.ts';
import { buscarRegistro, cargaVigente, formularioActivoDeServicio } from '../lib/formularios.ts';
import { requireFlujo, sesionDe } from '../middleware/auth.ts';

export const capturaRouter = Router();

capturaRouter.use(requireFlujo(FLUJO.DINAMICO));

/** Formulario activo de la campaña y definición de la card de búsqueda (si hay BD). */
capturaRouter.get('/formulario', async (req, res) => {
  const form = await formularioActivoDeServicio(sesionDe(req).servicioId);
  const bd = form ? await cargaVigente(form.id) : null;
  res.json({ formulario: form, bd });
});

capturaRouter.get('/buscar', async (req, res) => {
  const form = await formularioActivoDeServicio(sesionDe(req).servicioId);
  const bd = form ? await cargaVigente(form.id) : null;
  if (!bd) throw invalido('No hay base de datos para buscar.');

  const clave = inputString(req.query.clave, 191);
  if (clave === '') throw invalido('Ingresa un valor para buscar.');

  const registro = await buscarRegistro(bd.id, { clave });
  if (!registro) res.json({ estado: 'no_encontrado' });
  else if (registro.atendido) res.json({ estado: 'atendido' });
  else res.json({ estado: 'encontrado', registro: { id: registro.id, datos: registro.datos } });
});

capturaRouter.post('/envios', async (req, res) => {
  const { userId, servicioId } = sesionDe(req);
  const form = await formularioActivoDeServicio(servicioId);
  if (!form) throw invalido('Tu campaña no tiene un formulario activo.');

  const validacion = validarValores(form.definicion, req.body?.valores);
  if (!validacion.ok) throw invalido('Revisa los campos marcados.', { errores: validacion.errores });

  const datos: Prisma.FormularioEnvioUncheckedCreateInput = {
    formulario_id: form.id,
    version_id: form.version_id,
    servicio_id: servicioId,
    valores: validacion.valores as Prisma.InputJsonObject,
    user_id: userId,
  };

  const bd = await cargaVigente(form.id);
  if (bd) {
    const filaId = inputInt(req.body?.fila_id, 1);
    const registro = filaId === null ? null : await buscarRegistro(bd.id, { filaId });
    if (!registro) throw invalido('Busca un registro antes de guardar.');
    if (registro.atendido) {
      res.status(409).json({ message: 'Este registro ya fue atendido.', code: 'registro_atendido' });
      return;
    }
    datos.carga_id = bd.id;
    datos.fila_id = BigInt(registro.id);
    datos.registro = registro.datos as Prisma.InputJsonObject;
  }

  try {
    const envio = await prisma.formularioEnvio.create({ data: datos, select: { id: true } });
    res.status(201).json({ id: envio.id });
  } catch (e) {
    // Clave única sobre fila_id: dos operadores guardando el mismo registro a la vez.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      res.status(409).json({ message: 'Este registro ya fue atendido.', code: 'registro_atendido' });
      return;
    }
    throw e;
  }
});
