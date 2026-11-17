/**
 * Captura bancaria: catálogos, búsqueda de cliente y registro de gestión / venta.
 * Reglas en docs/nodejs-react.md §4.1. Todo opera sobre la campaña
 * activa del usuario (nunca sobre un servicio enviado por el cliente).
 */
import { Router } from 'express';
import { Prisma } from '@prisma/client';
import {
  EFECTIVO_VENTA_DESCRIPCION, ESTADO, FLUJO, REGISTRO, SERVICIO_BANCARIO_BASE, TIPO_GESTION_POR_DEFECTO,
  inputInt, inputString, validarGestion,
} from '@bulkapp/shared';
import { aFechaDb, aHoraDb, horaActual, hoy, invalido, logger, prisma } from '../lib/core.ts';
import { requireFlujo, sesionDe } from '../middleware/auth.ts';

export const bancarioRouter = Router();

bancarioRouter.use(requireFlujo(FLUJO.BANCARIO));

/** Catálogos del formulario: los de la campaña base, salvo productos (por campaña). */
bancarioRouter.get('/catalogos', async (req, res) => {
  const { servicioId } = sesionDe(req);
  const base = SERVICIO_BANCARIO_BASE;
  const [efectivo, noefectivo, estados, productos, tiposCuenta] = await Promise.all([
    prisma.efectivo.findMany({ where: { servicio_id: base }, select: { id: true, descripcion: true }, orderBy: { id: 'asc' } }),
    prisma.noefectivo.findMany({ where: { servicio_id: base }, select: { id: true, descripcion: true }, orderBy: { id: 'asc' } }),
    prisma.estado.findMany({ where: { servicio_id: base }, select: { id: true, estado: true }, orderBy: { estado: 'asc' } }),
    prisma.producto.findMany({ where: { servicio_id: servicioId, status_id: REGISTRO.ACTIVO }, select: { id: true, descripcion: true }, orderBy: { id: 'asc' } }),
    prisma.tipoCuenta.findMany({ where: { status_id: REGISTRO.ACTIVO }, select: { id: true, nombre: true }, orderBy: { id: 'asc' } }),
  ]);
  res.json({ efectivo, noefectivo, estados, productos, tiposCuenta });
});

bancarioRouter.get('/catalogos/ciudades', async (req, res) => {
  const estadoId = inputInt(req.query.estado_id, 1);
  const filas = estadoId === null ? [] : await prisma.ciudad.findMany({
    where: { estado_id: estadoId, servicio_id: SERVICIO_BANCARIO_BASE }, select: { id: true, ciudad: true }, orderBy: { ciudad: 'asc' },
  });
  res.json(filas.map((c) => ({ id: c.id, nombre: c.ciudad.toUpperCase() })));
});

bancarioRouter.get('/catalogos/municipios', async (req, res) => {
  const estadoId = inputInt(req.query.estado_id, 1);
  const filas = estadoId === null ? [] : await prisma.municipio.findMany({
    where: { estado_id: estadoId, servicio_id: SERVICIO_BANCARIO_BASE }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
  });
  res.json(filas.map((m) => ({ id: m.id, nombre: m.nombre.toUpperCase() })));
});

bancarioRouter.get('/catalogos/subcontactos', async (req, res) => {
  const efectivoId = inputInt(req.query.efectivo_id, 1);
  const filas = efectivoId === null ? [] : await prisma.subcontacto.findMany({
    where: { efectivo_id: efectivoId }, select: { id: true, descripcion: true }, orderBy: { descripcion: 'asc' },
  });
  res.json(filas.map((s) => ({ id: s.id, nombre: s.descripcion.toUpperCase() })));
});

/**
 * Busca un cliente de la campaña activa por cédula exacta o por los últimos
 * dígitos de un teléfono. Un cliente con venta (estado 7) no se vuelve a ofrecer.
 */
bancarioRouter.get('/clientes', async (req, res) => {
  const { servicioId } = sesionDe(req);
  const q = inputString(req.query.q, 30);
  if (q === '') throw invalido('Ingresa una cédula o un teléfono para buscar.');

  const final = `%${q.replace(/[\\%_]/g, '\\$&')}`;
  const filas = await prisma.$queryRaw<Array<{
    id: number; identificacion: string | null; nombre_legal: string | null; telf_hab: string | null; telf_ofi: string | null;
    telf_cel: string | null; correo: string | null; direccion: string | null; cuenta: string | null; oferta: string; status_id: number | null;
  }>>(Prisma.sql`
    SELECT id, identificacion, nombre_legal, telf_hab, telf_ofi, telf_cel, correo, direccion, cuenta, oferta, status_id
      FROM clientes
     WHERE servicio_id = ${servicioId}
       AND (identificacion = ${q} OR telf_hab ILIKE ${final} OR telf_ofi ILIKE ${final} OR telf_cel ILIKE ${final})
     ORDER BY (status_id = ${ESTADO.ATENDIDO}) ASC, id ASC
     LIMIT 1`);

  const c = filas[0];
  if (!c) {
    res.json({ estado: 'no_encontrado' });
    return;
  }
  if (c.status_id === ESTADO.ATENDIDO) {
    res.json({ estado: 'atendido' });
    return;
  }
  res.json({
    estado: 'encontrado',
    cliente: {
      id: c.id, nombre: c.nombre_legal, identificacion: c.identificacion, telf_hab: c.telf_hab, telf_ofi: c.telf_ofi,
      telf_cel: c.telf_cel, correo: c.correo, direccion: c.direccion, cuenta: c.cuenta, oferta: c.oferta,
    },
  });
});

/** Indicadores del operador en su campaña (día de hoy): efectivos y ventas por producto. */
bancarioRouter.get('/indicadores', async (req, res) => {
  const { userId, servicioId } = sesionDe(req);
  const fecha = aFechaDb(hoy());
  const efectivos = await prisma.gestion.count({ where: { user_id: userId, servicio_id: servicioId, fecha, efectivo_id: { not: null } } });

  const venta = await prisma.efectivo.findFirst({
    where: { servicio_id: SERVICIO_BANCARIO_BASE, descripcion: { equals: EFECTIVO_VENTA_DESCRIPCION, mode: 'insensitive' } },
    select: { id: true },
  });
  const porProducto = venta === null ? [] : await prisma.$queryRaw<Array<{ producto: string | null; vendidos: number }>>(Prisma.sql`
    SELECT p.descripcion AS producto, COUNT(g.producto_id)::int AS vendidos
      FROM gestion g JOIN productos p ON p.id = g.producto_id
     WHERE g.user_id = ${userId} AND g.servicio_id = ${servicioId} AND g.efectivo_id = ${venta.id} AND g.fecha = ${hoy()}::date
     GROUP BY p.id, p.descripcion
     ORDER BY vendidos DESC, p.descripcion`);

  res.json({ efectivos, ventas: porProducto.reduce((t, p) => t + p.vendidos, 0), porProducto });
});

/**
 * Registra el resultado de una llamada. En una sola transacción:
 *  1. marca al cliente con el nuevo estado SOLO si aún no está vendido (guardia de
 *     idempotencia frente a doble clic o reenvío);
 *  2. inserta la gestión;
 *  3. si es venta, inserta el resultado con los datos del cliente.
 */
bancarioRouter.post('/gestiones', async (req, res) => {
  const { userId, servicioId } = sesionDe(req);
  const validacion = validarGestion(req.body ?? {});
  if (!validacion.ok) throw invalido('Revisa los campos marcados.', { errores: validacion.errores });
  const d = validacion.datos;

  const fecha = hoy();
  const resultado = await prisma.$transaction(async (tx) => {
    const marcado = await tx.cliente.updateMany({
      where: { id: d.id_cliente, servicio_id: servicioId, NOT: { status_id: ESTADO.ATENDIDO } },
      data: { status_id: d.status },
    });
    if (marcado.count < 1) return null;

    const gestion = await tx.gestion.create({
      data: {
        contacto_id: d.contacto,
        efectivo_id: d.efectivo,
        producto_id: d.producto,
        noefectivo_id: d.noefectivo,
        subcontacto_id: d.sub_contacto,
        user_id: userId,
        fecha: aFechaDb(fecha),
        hora: aHoraDb(horaActual()),
        cliente_id: d.id_cliente,
        status_id: d.status,
        servicio_id: servicioId,
        tipo_gestion: TIPO_GESTION_POR_DEFECTO,
      },
      select: { id: true },
    });

    if (d.esVenta && d.venta && d.producto !== null) {
      const v = d.venta;
      await tx.resultado.create({
        data: {
          gestion_id: gestion.id,
          nombre: v.nombre,
          apellido: v.apellido,
          genero: v.genero,
          fecha_nacimiento: aFechaDb(v.fecha_nac),
          nacionalidad: String(v.nacionalidad),
          cedula: v.cedula,
          telf_hab: v.telf_hab,
          telf_celular: v.telf_cel,
          correo: v.correo,
          estado_id: v.estado,
          ciudad_id: v.ciudad,
          municipio_id: v.municipio,
          cuenta: v.cuenta,
          tipo_cuenta_id: v.tipo_cuenta,
          producto_id: d.producto,
          observaciones: v.observaciones,
          fecha_venta: aFechaDb(fecha),
          servicio_id: servicioId,
          status_id: ESTADO.ATENDIDO,
        },
      });
    }
    return gestion.id;
  });

  if (resultado === null) {
    logger.warn({ event: 'gestion.no_registrada', cliente_id: d.id_cliente, servicio_id: servicioId, user_id: userId }, 'No se pudo registrar la gestión: cliente ya atendido o inexistente');
    res.status(409).json({ message: 'Este cliente ya fue atendido o no pertenece a tu campaña.', code: 'cliente_atendido' });
    return;
  }
  res.status(201).json({ id: resultado, venta: d.esVenta });
});
