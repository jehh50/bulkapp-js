/**
 * Clientes (empresas), campañas y usuarios asignados — exclusivo del Administrador.
 *
 * - Inactivar una empresa inactiva también sus campañas; una campaña no puede
 *   activarse si su empresa está inactiva.
 * - El tipo de flujo se fija al crear la campaña y no se modifica.
 * - users.servicio_id es la campaña PRINCIPAL y siempre está en usuario_servicios:
 *   al quitar a un usuario de su principal se le asigna otra; si no tiene, no se quita.
 */
import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import { REGISTRO, inputInt, inputIntArray, inputString, validarCampana, validarEmpresa, type Flujo } from '@bulkapp/shared';
import { aFechaDb, deFechaDb, invalido, logger, noEncontrado, prisma } from '../lib/core.ts';
import { sesionDe } from '../middleware/auth.ts';

export const empresasRouter = Router();

function idDe(req: Request, nombre = 'id'): number {
  const id = inputInt(req.params[nombre], 1);
  if (id === null) throw noEncontrado();
  return id;
}

const obtenerEmpresa = (id: number) => prisma.empresa.findUnique({ where: { id }, select: { id: true, nombre: true, identificacion: true, status_id: true } });

const obtenerCampana = (id: number) => prisma.servicio.findUnique({
  where: { id }, select: { id: true, empresa_id: true, descripcion: true, tipo_flujo: true, status_id: true, empresa: { select: { nombre: true } } },
});

/** Empresas con su conteo de campañas (total / activas) y usuarios asignados. */
empresasRouter.get('/empresas', async (_req, res) => {
  const filas = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT e.id, e.nombre, e.identificacion, e.status_id, e.updated_at,
           COUNT(DISTINCT s.id)::int AS campanas,
           COUNT(DISTINCT CASE WHEN s.status_id = ${REGISTRO.ACTIVO} THEN s.id END)::int AS campanas_activas,
           COUNT(DISTINCT us.user_id)::int AS usuarios
      FROM empresas e
      LEFT JOIN servicios s ON s.empresa_id = e.id
      LEFT JOIN usuario_servicios us ON us.servicio_id = s.id
     GROUP BY e.id, e.nombre, e.identificacion, e.status_id, e.updated_at
     ORDER BY (e.status_id = ${REGISTRO.ACTIVO}) DESC, e.nombre`);
  res.json(filas);
});

/** Empresa con sus campañas (nº de usuarios asignados y productos activos). */
empresasRouter.get('/empresas/:id', async (req, res) => {
  const id = idDe(req);
  const empresa = await obtenerEmpresa(id);
  if (!empresa) throw noEncontrado('Cliente no encontrado.');
  const campanas = await prisma.$queryRaw<Array<Record<string, unknown> & { fecha_inicio: Date }>>(Prisma.sql`
    SELECT s.id, s.descripcion AS nombre, s.detalle, s.fecha_inicio, s.meta, s.tipo_flujo::text AS tipo_flujo, s.codigo, s.status_id,
           (SELECT COUNT(*)::int FROM usuario_servicios us WHERE us.servicio_id = s.id) AS usuarios,
           (SELECT COUNT(*)::int FROM productos p WHERE p.servicio_id = s.id AND p.status_id = ${REGISTRO.ACTIVO}) AS productos
      FROM servicios s
     WHERE s.empresa_id = ${id}
     ORDER BY (s.status_id = ${REGISTRO.ACTIVO}) DESC, s.fecha_inicio DESC, s.descripcion`);
  res.json({ empresa, campanas: campanas.map((c) => ({ ...c, fecha_inicio: deFechaDb(c.fecha_inicio) })) });
});

async function guardarEmpresa(req: Request, id: number | null) {
  const cuerpo = req.body ?? {};
  const val = validarEmpresa({
    nombre: inputString(cuerpo.nombre, 150), identificacion: inputString(cuerpo.identificacion, 30), status_id: cuerpo.status_id,
  });
  if (!val.ok) throw invalido(val.errores.join(' '));
  const datos = val.datos;

  if (id !== null && !(await obtenerEmpresa(id))) throw noEncontrado('Cliente no encontrado.');
  const duplicada = await prisma.empresa.findFirst({
    where: { nombre: { equals: datos.nombre, mode: 'insensitive' }, ...(id !== null ? { id: { not: id } } : {}) }, select: { id: true },
  });
  if (duplicada) throw invalido('Ya existe un cliente con ese nombre.');

  const resultado = await prisma.$transaction(async (tx) => {
    if (id === null) {
      const nueva = await tx.empresa.create({ data: datos, select: { id: true } });
      return { id: nueva.id, campanas_inactivadas: 0 };
    }
    await tx.empresa.update({ where: { id }, data: datos });
    let inactivadas = 0;
    if (datos.status_id === REGISTRO.INACTIVO) {
      const r = await tx.servicio.updateMany({ where: { empresa_id: id, status_id: REGISTRO.ACTIVO }, data: { status_id: REGISTRO.INACTIVO } });
      inactivadas = r.count;
    }
    return { id, campanas_inactivadas: inactivadas };
  });

  logger.info({
    event: id === null ? 'empresas.creada' : 'empresas.actualizada', empresa_id: resultado.id, status_id: datos.status_id,
    campanas_inactivadas: resultado.campanas_inactivadas, user_id: sesionDe(req).userId,
  }, id === null ? 'Cliente creado' : 'Cliente actualizado');
  return resultado;
}

empresasRouter.post('/empresas', async (req, res) => {
  res.status(201).json(await guardarEmpresa(req, null));
});
empresasRouter.put('/empresas/:id', async (req, res) => {
  res.json(await guardarEmpresa(req, idDe(req)));
});

async function guardarCampana(req: Request, empresaId: number, id: number | null) {
  const cuerpo = req.body ?? {};
  const val = validarCampana({
    nombre: inputString(cuerpo.nombre, 100), detalle: inputString(cuerpo.detalle, 1000), fecha_inicio: cuerpo.fecha_inicio,
    meta: inputString(cuerpo.meta, 20), tipo_flujo: cuerpo.tipo_flujo, codigo: inputString(cuerpo.codigo, 20), status_id: cuerpo.status_id,
  }, id === null);
  if (!val.ok) throw invalido(val.errores.join(' '));
  const d = val.datos;

  const empresa = await obtenerEmpresa(empresaId);
  if (!empresa) throw noEncontrado('Cliente no encontrado.');
  if (d.status_id === REGISTRO.ACTIVO && empresa.status_id !== REGISTRO.ACTIVO) throw invalido('No se puede activar una campaña de un cliente inactivo.');
  if (id !== null) {
    const actual = await obtenerCampana(id);
    if (!actual || actual.empresa_id !== empresaId) throw noEncontrado('Campaña no encontrada.');
  }
  const duplicada = await prisma.servicio.findFirst({
    where: { empresa_id: empresaId, descripcion: { equals: d.nombre, mode: 'insensitive' }, ...(id !== null ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (duplicada) throw invalido('El cliente ya tiene una campaña con ese nombre.');

  const comunes = {
    descripcion: d.nombre, detalle: d.detalle, fecha_inicio: aFechaDb(d.fecha_inicio!), meta: d.meta, codigo: d.codigo, status_id: d.status_id,
  };
  // tipo_flujo no se toca al editar: cambiarlo re-enrutaría el historial de la campaña.
  const campana = id === null
    ? await prisma.servicio.create({ data: { ...comunes, empresa_id: empresaId, tipo_flujo: d.tipo_flujo as Flujo }, select: { id: true } })
    : await prisma.servicio.update({ where: { id }, data: comunes, select: { id: true } });

  logger.info({
    event: id === null ? 'campanas.creada' : 'campanas.actualizada', servicio_id: campana.id, empresa_id: empresaId,
    tipo_flujo: d.tipo_flujo ?? null, status_id: d.status_id, user_id: sesionDe(req).userId,
  }, id === null ? 'Campaña creada' : 'Campaña actualizada');
  return campana;
}

empresasRouter.post('/empresas/:id/campanas', async (req, res) => {
  res.status(201).json(await guardarCampana(req, idDe(req), null));
});
empresasRouter.put('/empresas/:id/campanas/:campanaId', async (req, res) => {
  res.json(await guardarCampana(req, idDe(req), idDe(req, 'campanaId')));
});

/** Usuarios activos con su marca de asignación a la campaña y si es su principal. */
empresasRouter.get('/campanas/:id/usuarios', async (req, res) => {
  const id = idDe(req);
  const campana = await obtenerCampana(id);
  if (!campana) throw noEncontrado('Campaña no encontrada.');
  const usuarios = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT u.id, u.username, u.nombre, u.apellido, u.usertype_id, ut.name AS rol,
           (us.user_id IS NOT NULL) AS asignado, (u.servicio_id = ${id}) AS principal
      FROM users u
      JOIN usertypes ut ON ut.id = u.usertype_id
      LEFT JOIN usuario_servicios us ON us.user_id = u.id AND us.servicio_id = ${id}
     WHERE u.status_id = ${REGISTRO.ACTIVO}
     ORDER BY asignado DESC, u.usertype_id DESC, u.nombre, u.apellido`);
  res.json({
    campana: { id: campana.id, nombre: campana.descripcion, empresa: campana.empresa.nombre, tipo_flujo: campana.tipo_flujo, status_id: campana.status_id },
    usuarios,
  });
});

/** Fija los usuarios (activos) asignados a una campaña. Los inactivos conservan sus asignaciones. */
empresasRouter.put('/campanas/:id/usuarios', async (req, res) => {
  const servicioId = idDe(req);
  if (!(await obtenerCampana(servicioId))) throw noEncontrado('Campaña no encontrada.');

  const activos = new Set((await prisma.user.findMany({ where: { status_id: REGISTRO.ACTIVO }, select: { id: true } })).map((u) => u.id));
  const deseados = new Set(inputIntArray(req.body?.usuarios, 5000).filter((id) => activos.has(id)));
  const actuales = await prisma.user.findMany({
    where: { status_id: REGISTRO.ACTIVO, campanas: { some: { servicio_id: servicioId } } }, select: { id: true, username: true, servicio_id: true },
  });
  const idsActuales = new Set(actuales.map((u) => u.id));

  const resultado = { agregados: 0, quitados: 0, principal_movida: 0, bloqueados: [] as Array<{ id: number; username: string }> };
  await prisma.$transaction(async (tx) => {
    const agregar = [...deseados].filter((id) => !idsActuales.has(id));
    if (agregar.length > 0) {
      const r = await tx.usuarioServicio.createMany({ data: agregar.map((user_id) => ({ user_id, servicio_id: servicioId })), skipDuplicates: true });
      resultado.agregados = r.count;
    }

    for (const u of actuales) {
      if (deseados.has(u.id)) continue;
      if (u.servicio_id === servicioId) {
        // Es su campaña principal: se mueve a otra asignada (preferible activa).
        const otras = await tx.usuarioServicio.findMany({
          where: { user_id: u.id, servicio_id: { not: servicioId } }, select: { servicio_id: true, servicio: { select: { status_id: true } } },
          orderBy: { servicio_id: 'asc' },
        });
        const otra = otras.find((o) => o.servicio.status_id === REGISTRO.ACTIVO) ?? otras[0];
        if (!otra) {
          resultado.bloqueados.push({ id: u.id, username: u.username });
          continue;
        }
        await tx.user.update({ where: { id: u.id }, data: { servicio_id: otra.servicio_id } });
        resultado.principal_movida++;
      }
      await tx.usuarioServicio.delete({ where: { user_id_servicio_id: { user_id: u.id, servicio_id: servicioId } } });
      resultado.quitados++;
    }
  });

  logger.info({
    event: 'campanas.usuarios_asignados', servicio_id: servicioId, agregados: resultado.agregados, quitados: resultado.quitados,
    principal_movida: resultado.principal_movida, bloqueados: resultado.bloqueados.length, user_id: sesionDe(req).userId,
  }, 'Usuarios asignados a campaña');
  res.json(resultado);
});
