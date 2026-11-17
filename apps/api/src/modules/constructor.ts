/**
 * Constructor de formularios dinámicos — exclusivo del Administrador.
 * CRUD + versionado + regla «un solo formulario ACTIVO por campaña» + BD por
 * formulario (cargas CSV/XLSX). Los formularios de banca no se tocan.
 */
import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  CARGA_LOTE_FILAS_FORMULARIO, CARGA_MAX_BYTES_FORMULARIO, FLUJO, REGISTRO, aplicarColumnas, etiquetaCampana, indexarExpresiones,
  inputEnum, inputInt, inputIntArray, inputString, normalizarColumnas, validarDefinicion,
} from '@bulkapp/shared';
import { parsearArchivo, subida, validarArchivo } from '../lib/archivos.ts';
import { flujosCampana, listarCampanas } from '../lib/campanas.ts';
import { HttpError, invalido, logger, noEncontrado, prisma } from '../lib/core.ts';
import { comoDefinicion, comoMapping, filasDeCarga } from '../lib/formularios.ts';
import { sesionDe } from '../middleware/auth.ts';

export const constructorRouter = Router();

const EXTENSIONES = ['csv', 'txt', 'xlsx'] as const;
const subirArchivo = subida(CARGA_MAX_BYTES_FORMULARIO);

function idDe(req: Request, nombre = 'id'): number {
  const id = inputInt(req.params[nombre], 1);
  if (id === null) throw noEncontrado('Formulario no encontrado.');
  return id;
}

const expresiones = () => prisma.formularioExpresion.findMany({
  where: { status_id: REGISTRO.ACTIVO },
  orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  select: { clave: true, nombre: true, descripcion: true, patron: true, transformacion: true, tipos: true, ejemplo_valido: true, ejemplo_invalido: true },
});

/** Etiquetas «Empresa › Campaña» por id de campaña. */
async function etiquetas(): Promise<Map<number, string>> {
  const filas = await prisma.servicio.findMany({ select: { id: true, descripcion: true, empresa: { select: { nombre: true } } } });
  return new Map(filas.map((s) => [s.id, etiquetaCampana(s.empresa.nombre, s.descripcion)]));
}

/** Formularios ACTIVOS (distintos de `formId`) que ocupan alguna de las campañas. */
async function conflictosDeServicios(formId: number, servicioIds: number[]) {
  if (servicioIds.length === 0) return [];
  const [filas, nombres] = await Promise.all([
    prisma.formularioServicio.findMany({
      where: { servicio_id: { in: servicioIds }, formulario: { id: { not: formId }, eliminado: false, status_id: REGISTRO.ACTIVO } },
      select: { servicio_id: true, formulario: { select: { id: true, nombre: true } } },
    }),
    etiquetas(),
  ]);
  return filas.map((f) => ({
    servicio_id: f.servicio_id, servicio: nombres.get(f.servicio_id) ?? '', formulario_id: f.formulario.id, formulario: f.formulario.nombre,
  }));
}

async function obtenerFormulario(id: number) {
  const f = await prisma.formulario.findFirst({
    where: { id, eliminado: false },
    select: {
      id: true, nombre: true, status_id: true, btn_texto: true, fecha: true, actualizado: true,
      versiones: { where: { vigente: true }, take: 1, select: { id: true, version: true, definicion: true } },
      servicios: { select: { servicio_id: true } },
    },
  });
  if (!f) return null;
  const v = f.versiones[0];
  return {
    id: f.id, nombre: f.nombre, status_id: f.status_id, btn_texto: f.btn_texto, fecha: f.fecha, actualizado: f.actualizado,
    version_id: v?.id ?? null, version: v?.version ?? 0, definicion: comoDefinicion(v?.definicion),
    servicios: f.servicios.map((s) => s.servicio_id),
  };
}

/** Carga vigente con la definición de la card y una fila de muestra. */
async function cargaVigenteDetalle(formId: number) {
  const c = await prisma.formularioCarga.findFirst({
    where: { formulario_id: formId, vigente: true }, select: { id: true, archivo: true, filas: true, fecha: true, mapping: true },
  });
  if (!c) return null;
  const mapping = comoMapping(c.mapping);
  const muestra = await filasDeCarga(c.id, 1);
  return {
    id: c.id, archivo: c.archivo, filas: c.filas, fecha: c.fecha,
    busqueda: mapping?.busqueda ?? null, columnas: mapping?.columnas ?? [], muestra: muestra[0] ?? null,
  };
}

/** Campañas no bancarias (cualquier estado) y catálogo de validaciones del editor. */
constructorRouter.get('/catalogos', async (_req, res) => {
  const [servicios, exprs] = await Promise.all([listarCampanas({ flujo: FLUJO.DINAMICO }), expresiones()]);
  res.json({ servicios: servicios.map((s) => ({ id: s.id, descripcion: s.etiqueta, status_id: s.status_id })), expresiones: exprs });
});

constructorRouter.get('/formularios', async (req, res) => {
  const estado = inputInt(req.query.estado, 1);
  const [forms, nombres] = await Promise.all([
    prisma.formulario.findMany({
      where: { eliminado: false, ...(estado !== null ? { status_id: estado } : {}) },
      orderBy: { actualizado: 'desc' },
      select: {
        id: true, nombre: true, status_id: true, btn_texto: true, fecha: true, actualizado: true,
        versiones: { where: { vigente: true }, take: 1, select: { version: true, definicion: true } },
        servicios: { select: { servicio_id: true } },
        cargas: { where: { vigente: true }, take: 1, select: { filas: true } },
      },
    }),
    etiquetas(),
  ]);
  res.json(forms.map((f) => ({
    id: f.id, nombre: f.nombre, status_id: f.status_id, btn_texto: f.btn_texto, fecha: f.fecha, actualizado: f.actualizado,
    version_vigente: f.versiones[0]?.version ?? null,
    num_campos: comoDefinicion(f.versiones[0]?.definicion).campos.length,
    filas_bd: f.cargas[0]?.filas ?? null,
    servicios: f.servicios
      .map((s) => ({ id: s.servicio_id, descripcion: nombres.get(s.servicio_id) ?? '' }))
      .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es')),
  })));
});

constructorRouter.get('/formularios/:id', async (req, res) => {
  const id = idDe(req);
  const formulario = await obtenerFormulario(id);
  if (!formulario) throw noEncontrado('Formulario no encontrado.');
  res.json({ formulario, bd: await cargaVigenteDetalle(id) });
});

constructorRouter.get('/formularios/:id/historial', async (req, res) => {
  const filas = await prisma.formularioVersion.findMany({
    where: { formulario_id: idDe(req) }, orderBy: { version: 'desc' },
    select: { id: true, version: true, nota: true, vigente: true, fecha: true, user_id: true },
  });
  res.json(filas);
});

/**
 * Crea o actualiza un formulario. Cada guardado crea una versión nueva (vigente).
 * Si se guarda ACTIVO y otra campaña ya tiene formulario activo responde 409 con
 * los conflictos; con `reasignar` libera esas campañas de los otros formularios.
 */
async function guardar(req: Request, id: number | null) {
  const { userId } = sesionDe(req);
  const cuerpo = req.body ?? {};
  const nombre = inputString(cuerpo.nombre, 150);
  const statusId = inputEnum(cuerpo.status_id, [REGISTRO.INACTIVO, REGISTRO.ACTIVO]) ?? REGISTRO.INACTIVO;
  const btnTexto = inputString(cuerpo.btn_texto, 80) || 'Guardar';
  const nota = inputString(cuerpo.nota, 255) || null;
  const reasignar = cuerpo.reasignar === true;

  if (nombre === '') throw invalido('El nombre del formulario es obligatorio.');
  if (id !== null && !(await prisma.formulario.findFirst({ where: { id, eliminado: false }, select: { id: true } }))) {
    throw noEncontrado('Formulario no encontrado.');
  }

  // Banca conserva su formulario fijo: se descartan campañas bancarias o inexistentes.
  const flujos = await flujosCampana();
  const servicios = [...new Set(inputIntArray(cuerpo.servicios))].filter((s) => flujos.get(s) === FLUJO.DINAMICO);

  const validacion = validarDefinicion(cuerpo.definicion, indexarExpresiones(await expresiones()));
  if (!validacion.ok) throw invalido('Hay errores en los campos del formulario.', { errores: validacion.errores });

  if (statusId === REGISTRO.ACTIVO && servicios.length > 0) {
    const conflictos = await conflictosDeServicios(id ?? 0, servicios);
    if (conflictos.length > 0 && !reasignar) throw new HttpError(409, 'Otra campaña ya tiene un formulario activo.', { code: 'conflicto', conflictos });
  }

  return prisma.$transaction(async (tx) => {
    const form = id === null
      ? await tx.formulario.create({ data: { nombre, status_id: statusId, btn_texto: btnTexto, user_id: userId }, select: { id: true } })
      : await tx.formulario.update({ where: { id }, data: { nombre, status_id: statusId, btn_texto: btnTexto }, select: { id: true } });

    const max = await tx.formularioVersion.aggregate({ where: { formulario_id: form.id }, _max: { version: true } });
    const version = (max._max.version ?? 0) + 1;
    await tx.formularioVersion.updateMany({ where: { formulario_id: form.id }, data: { vigente: false } });
    await tx.formularioVersion.create({
      data: { formulario_id: form.id, version, definicion: validacion.definicion as unknown as Prisma.InputJsonObject, nota, vigente: true, user_id: userId },
    });

    if (reasignar && statusId === REGISTRO.ACTIVO && servicios.length > 0) {
      await tx.formularioServicio.deleteMany({ where: { servicio_id: { in: servicios }, formulario_id: { not: form.id } } });
    }
    await tx.formularioServicio.deleteMany({ where: { formulario_id: form.id } });
    if (servicios.length > 0) {
      await tx.formularioServicio.createMany({ data: servicios.map((servicio_id) => ({ formulario_id: form.id, servicio_id })) });
    }
    return { id: form.id, version };
  });
}

constructorRouter.post('/formularios', async (req, res) => {
  res.status(201).json(await guardar(req, null));
});

constructorRouter.put('/formularios/:id', async (req, res) => {
  res.json(await guardar(req, idDe(req)));
});

/** Borrado lógico. Solo formularios INACTIVOS: uno activo hay que desactivarlo antes. */
constructorRouter.delete('/formularios/:id', async (req, res) => {
  const id = idDe(req);
  const f = await prisma.formulario.findFirst({ where: { id, eliminado: false }, select: { status_id: true } });
  if (!f) throw noEncontrado('Formulario no encontrado.');
  if (f.status_id === REGISTRO.ACTIVO) throw new HttpError(409, 'Un formulario activo no se puede eliminar: desactívalo primero.');
  // La condición de estado se repite por si se activó entre ambas consultas.
  await prisma.formulario.updateMany({ where: { id, status_id: REGISTRO.INACTIVO }, data: { eliminado: true, eliminado_en: new Date() } });
  res.status(204).end();
});

/** Cambia solo el estado, sin crear versión. Al activar aplica la regla 1-activo-por-campaña. */
constructorRouter.patch('/formularios/:id/estado', async (req, res) => {
  const id = idDe(req);
  const statusId = inputEnum(req.body?.status_id, [REGISTRO.INACTIVO, REGISTRO.ACTIVO]);
  const reasignar = req.body?.reasignar === true;
  if (statusId === null) throw invalido('Datos inválidos.');
  if (!(await prisma.formulario.findFirst({ where: { id, eliminado: false }, select: { id: true } }))) throw noEncontrado('Formulario no encontrado.');

  let servicios: number[] = [];
  if (statusId === REGISTRO.ACTIVO) {
    servicios = (await prisma.formularioServicio.findMany({ where: { formulario_id: id }, select: { servicio_id: true } })).map((s) => s.servicio_id);
    const conflictos = await conflictosDeServicios(id, servicios);
    if (conflictos.length > 0 && !reasignar) throw new HttpError(409, 'Otra campaña ya tiene un formulario activo.', { code: 'conflicto', conflictos });
  }

  await prisma.$transaction(async (tx) => {
    if (reasignar && servicios.length > 0) {
      await tx.formularioServicio.deleteMany({ where: { servicio_id: { in: servicios }, formulario_id: { not: id } } });
    }
    await tx.formulario.update({ where: { id }, data: { status_id: statusId } });
  });
  logger.info({ event: 'constructor.estado', formulario_id: id, status_id: statusId, user_id: sesionDe(req).userId }, 'Constructor: cambio de estado');
  res.status(204).end();
});

/** Marca una versión del historial como vigente (rollback). */
constructorRouter.post('/formularios/:id/versiones/:versionId/vigente', async (req, res) => {
  const id = idDe(req);
  const versionId = idDe(req, 'versionId');
  if (!(await prisma.formularioVersion.findFirst({ where: { id: versionId, formulario_id: id }, select: { id: true } }))) throw noEncontrado('Versión no encontrada.');
  await prisma.$transaction([
    prisma.formularioVersion.updateMany({ where: { formulario_id: id }, data: { vigente: false } }),
    prisma.formularioVersion.update({ where: { id: versionId }, data: { vigente: true } }),
  ]);
  res.status(204).end();
});

// --- BD por formulario (cargas) ----------------------------------------------

/** Lee el archivo y devuelve encabezados, total de filas y una muestra. */
constructorRouter.post('/cargas/analizar', subirArchivo, async (req, res) => {
  const ext = validarArchivo(req.file, EXTENSIONES);
  const tabla = await parsearArchivo(req.file!, ext);
  if (!tabla) throw invalido('No se pudo leer el archivo.');
  if (tabla.headers.length === 0) throw invalido('El archivo no tiene encabezados.');
  res.json({ headers: tabla.headers, filas_total: tabla.filas.length, muestra: tabla.filas.slice(0, 5) });
});

/** Confirma la carga: persiste el registro (vigente) y sus filas en lotes. */
constructorRouter.post('/formularios/:id/cargas', subirArchivo, async (req, res) => {
  const id = idDe(req);
  if (!(await prisma.formulario.findFirst({ where: { id, eliminado: false }, select: { id: true } }))) throw noEncontrado('Formulario no encontrado.');

  const ext = validarArchivo(req.file, EXTENSIONES);
  const tabla = await parsearArchivo(req.file!, ext);
  if (!tabla) throw invalido('No se pudo leer el archivo.');

  let defCruda: unknown = null;
  try {
    defCruda = JSON.parse(typeof req.body?.columnas === 'string' ? req.body.columnas : 'null');
  } catch {
    defCruda = null;
  }
  const norm = normalizarColumnas(defCruda, tabla.headers);
  if (!norm.ok || !norm.columnas) throw invalido(norm.errores.join(' '));
  const mapping = norm.columnas;

  const filas = aplicarColumnas(tabla.headers, tabla.filas, mapping);
  if (filas.length === 0) throw invalido('Ninguna fila tiene valor en la columna de búsqueda.');

  const archivo = inputString(req.file!.originalname, 255) || 'carga';
  const cargaId = await prisma.$transaction(async (tx) => {
    await tx.formularioCarga.updateMany({ where: { formulario_id: id }, data: { vigente: false } });
    const carga = await tx.formularioCarga.create({
      data: { formulario_id: id, archivo, filas: filas.length, mapping: mapping as unknown as Prisma.InputJsonObject, vigente: true, user_id: sesionDe(req).userId },
      select: { id: true },
    });
    for (let i = 0; i < filas.length; i += CARGA_LOTE_FILAS_FORMULARIO) {
      await tx.formularioCargaFila.createMany({
        data: filas.slice(i, i + CARGA_LOTE_FILAS_FORMULARIO).map((f) => ({
          carga_id: carga.id, clave: Array.from(f[mapping.busqueda] ?? '').slice(0, 191).join(''), fila: f,
        })),
      });
    }
    return carga.id;
  }, { timeout: 120_000, maxWait: 10_000 });

  res.status(201).json({ carga_id: cargaId, filas: filas.length, omitidas: tabla.filas.length - filas.length });
});

constructorRouter.get('/formularios/:id/cargas', async (req, res) => {
  const id = idDe(req);
  const [cargas, vigente] = await Promise.all([
    prisma.formularioCarga.findMany({
      where: { formulario_id: id }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      select: { id: true, archivo: true, filas: true, vigente: true, fecha: true, user_id: true },
    }),
    cargaVigenteDetalle(id),
  ]);
  res.json({ cargas, vigente });
});

constructorRouter.get('/cargas/:cargaId/filas', async (req, res) => {
  res.json(await filasDeCarga(idDe(req, 'cargaId'), 10));
});

constructorRouter.post('/formularios/:id/cargas/:cargaId/vigente', async (req, res) => {
  const id = idDe(req);
  const cargaId = idDe(req, 'cargaId');
  if (!(await prisma.formularioCarga.findFirst({ where: { id: cargaId, formulario_id: id }, select: { id: true } }))) throw noEncontrado('Carga no encontrada.');
  await prisma.$transaction([
    prisma.formularioCarga.updateMany({ where: { formulario_id: id }, data: { vigente: false } }),
    prisma.formularioCarga.update({ where: { id: cargaId }, data: { vigente: true } }),
  ]);
  res.status(204).end();
});
