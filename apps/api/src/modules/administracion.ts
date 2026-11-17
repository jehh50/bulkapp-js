/**
 * Administración operativa (Supervisor y Administrador): usuarios, productos,
 * corrección de ventas, desbloqueo de clientes y carga masiva de clientes.
 */
import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  CARGA_COLUMNAS_CLIENTES, CARGA_LOTE_CLIENTES, CARGA_MAX_BYTES_CLIENTES, ESTADO_SIN_CONTACTAR, FLUJO, GENEROS, PASSWORD_MIN, REGISTRO, ROLES,
  etiquetaCampana, inputAmount, inputDate, inputDigits, inputEmail, inputEnum, inputInt, inputLetters, inputPan, inputPhone, inputString,
  normalizarFechaNacimiento,
} from '@bulkapp/shared';
import { parsearCsv, subida, validarArchivo } from '../lib/archivos.ts';
import { flujoDe } from '../lib/campanas.ts';
import { aFechaDb, deFechaDb, hoy, invalido, logger, noEncontrado, prisma } from '../lib/core.ts';
import { hashPassword, passwordAleatoria } from '../lib/seguridad.ts';
import { sesionDe } from '../middleware/auth.ts';

export const administracionRouter = Router();

function idDe(req: Request): number {
  const id = inputInt(req.params.id, 1);
  if (id === null) throw noEncontrado();
  return id;
}

const recortar = (valor: string, max: number): string => Array.from(valor).slice(0, max).join('');

// --- Usuarios -------------------------------------------------------------------

/** Usuarios: activos primero. `campanas_extra` = campañas asignadas además de la principal. */
administracionRouter.get('/usuarios', async (_req, res) => {
  const usuarios = await prisma.user.findMany({
    select: {
      id: true, nombre: true, apellido: true, username: true, usertype_id: true, status_id: true, servicio_id: true,
      usertype: { select: { name: true } }, status: { select: { name: true } },
      servicio: { select: { descripcion: true, empresa: { select: { nombre: true } } } },
      _count: { select: { campanas: true } },
    },
    orderBy: { id: 'asc' },
  });
  res.json(usuarios
    .map((u) => ({
      id: u.id, nombre: u.nombre, apellido: u.apellido, username: u.username, usertype_id: u.usertype_id, rol: u.usertype.name,
      status_id: u.status_id, status: u.status.name, servicio_id: u.servicio_id,
      campana: etiquetaCampana(u.servicio.empresa.nombre, u.servicio.descripcion),
      campanas_extra: Math.max(0, u._count.campanas - 1),
    }))
    .sort((a, b) => Number(b.status_id === REGISTRO.ACTIVO) - Number(a.status_id === REGISTRO.ACTIVO) || a.id - b.id));
});

/** La campaña principal siempre forma parte de las campañas asignadas (N:M). */
const asegurarAsignacion = (tx: Prisma.TransactionClient, userId: number, servicioId: number) =>
  tx.usuarioServicio.createMany({ data: [{ user_id: userId, servicio_id: servicioId }], skipDuplicates: true });

administracionRouter.post('/usuarios', async (req, res) => {
  const c = req.body ?? {};
  const nombre = inputLetters(c.nombre, 50);
  const apellido = inputLetters(c.apellido, 50);
  const username = inputString(c.username, 50).replace(/[^A-Za-z0-9._-]/g, '');
  const password = typeof c.password === 'string' ? c.password : '';
  const rol = inputEnum(c.usertype_id, ROLES);
  const servicioId = inputInt(c.servicio_id, 1);

  if (nombre === '' || apellido === '' || username === '' || password.length < PASSWORD_MIN || rol === null || servicioId === null) {
    throw invalido(`Datos inválidos. La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);
  }
  if ((await flujoDe(servicioId)) === null) throw invalido('La campaña seleccionada no existe.');
  if (await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { id: true } })) {
    throw invalido('El usuario ya existe.');
  }

  const hash = await hashPassword(password);
  const id = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { nombre, apellido, username, password: hash, usertype_id: rol, status_id: REGISTRO.ACTIVO, servicio_id: servicioId }, select: { id: true },
    });
    await asegurarAsignacion(tx, u.id, servicioId);
    return u.id;
  });
  logger.info({ event: 'usuarios.creado', usuario_id: id, usertype_id: rol, user_id: sesionDe(req).userId }, 'Usuario creado');
  res.status(201).json({ id });
});

/** Edita nombre, rol, estado y campaña principal. El nombre de usuario no es editable. */
administracionRouter.put('/usuarios/:id', async (req, res) => {
  const id = idDe(req);
  const c = req.body ?? {};
  const nombre = inputLetters(c.nombre, 50);
  const apellido = inputLetters(c.apellido, 50);
  const rol = inputEnum(c.usertype_id, ROLES);
  const status = inputEnum(c.status_id, [REGISTRO.ACTIVO, REGISTRO.INACTIVO]);
  const servicioId = inputInt(c.servicio_id, 1);
  if (nombre === '' || apellido === '' || rol === null || status === null || servicioId === null) throw invalido('Datos inválidos.');
  if ((await flujoDe(servicioId)) === null) throw invalido('La campaña seleccionada no existe.');
  if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw noEncontrado('Usuario no encontrado.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { nombre, apellido, usertype_id: rol, status_id: status, servicio_id: servicioId } });
    await asegurarAsignacion(tx, id, servicioId);
  });
  res.status(204).end();
});

/** Genera una contraseña temporal; se muestra una sola vez. */
administracionRouter.post('/usuarios/:id/password', async (req, res) => {
  const id = idDe(req);
  if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) throw noEncontrado('Usuario no encontrado.');
  const temporal = passwordAleatoria(14);
  await prisma.user.update({ where: { id }, data: { password: await hashPassword(temporal) } });
  logger.info({ event: 'usuarios.password_reiniciada', usuario_id: id, user_id: sesionDe(req).userId }, 'Contraseña reiniciada');
  res.json({ password: temporal });
});

/** Borrado lógico: el usuario queda INACTIVO y conserva su historial de gestiones. */
administracionRouter.delete('/usuarios/:id', async (req, res) => {
  const id = idDe(req);
  if (id === sesionDe(req).userId) throw invalido('No puedes inactivar tu propio usuario.');
  const r = await prisma.user.updateMany({ where: { id }, data: { status_id: REGISTRO.INACTIVO } });
  if (r.count === 0) throw noEncontrado('Usuario no encontrado.');
  res.status(204).end();
});

// --- Productos -------------------------------------------------------------------

administracionRouter.get('/productos', async (_req, res) => {
  const [productos, servicios] = await Promise.all([
    prisma.producto.findMany({
      where: { status_id: REGISTRO.ACTIVO }, orderBy: [{ servicio_id: 'asc' }, { id: 'asc' }],
      select: { id: true, descripcion: true, codigo_producto: true, costo_prod: true, fecha: true, codplan: true, servicio_id: true },
    }),
    prisma.servicio.findMany({ select: { id: true, descripcion: true } }),
  ]);
  const nombres = new Map(servicios.map((s) => [s.id, s.descripcion.trim()]));
  res.json(productos.map((p) => ({ ...p, servicio: nombres.get(p.servicio_id) ?? '' })));
});

interface ProductoEntrada { descripcion: string; codigo_producto: string; costo_prod: string; codplan: string }

function leerProducto(p: unknown): ProductoEntrada | null {
  if (typeof p !== 'object' || p === null) return null;
  const o = p as Record<string, unknown>;
  const descripcion = recortar(inputString(o.descripcion, 255), 100);
  if (descripcion === '') return null;
  return {
    descripcion,
    codigo_producto: recortar(inputString(o.codigo_producto, 100), 11),
    costo_prod: recortar(inputAmount(o.costo_prod) ?? '0', 11),
    codplan: recortar(inputString(o.codplan, 50), 10),
  };
}

/**
 * Registra el catálogo de productos de una campaña: los productos activos
 * anteriores pasan a inactivos y se insertan los nuevos (mismo comportamiento que PHP).
 */
administracionRouter.post('/productos', async (req, res) => {
  const servicioId = inputInt(req.body?.servicio_id, 1);
  if (servicioId === null || (await flujoDe(servicioId)) === null) throw invalido('Selecciona una campaña.');
  const nuevos = (Array.isArray(req.body?.productos) ? (req.body.productos as unknown[]) : []).map(leerProducto).filter((p) => p !== null);
  if (nuevos.length === 0) throw invalido('Agrega al menos un producto con nombre.');

  const fecha = hoy();
  await prisma.$transaction([
    prisma.producto.updateMany({ where: { servicio_id: servicioId, status_id: REGISTRO.ACTIVO }, data: { status_id: REGISTRO.INACTIVO } }),
    prisma.producto.createMany({ data: nuevos.map((p) => ({ ...p, status_id: REGISTRO.ACTIVO, servicio_id: servicioId, fecha })) }),
  ]);
  logger.info({ event: 'productos.catalogo', servicio_id: servicioId, productos: nuevos.length, user_id: sesionDe(req).userId }, 'Catálogo de productos registrado');
  res.status(201).json({ productos: nuevos.length });
});

/** Edición (una o varias filas): nombre, código, costo y plan. */
administracionRouter.put('/productos', async (req, res) => {
  const filas = Array.isArray(req.body?.productos) ? (req.body.productos as unknown[]) : [];
  const cambios: Array<{ id: number; datos: ProductoEntrada }> = [];
  for (const f of filas.slice(0, 1000)) {
    const id = inputInt((f as Record<string, unknown> | null)?.id, 1);
    const datos = leerProducto(f);
    if (id === null || datos === null) throw invalido('Hay productos con datos inválidos (el nombre es obligatorio).');
    cambios.push({ id, datos });
  }
  if (cambios.length === 0) throw invalido('No hay cambios para guardar.');
  await prisma.$transaction(cambios.map((c) => prisma.producto.updateMany({ where: { id: c.id }, data: c.datos })));
  res.json({ actualizados: cambios.length });
});

// --- Corrección de ventas ---------------------------------------------------------

administracionRouter.get('/ventas', async (req, res) => {
  const cedula = inputDigits(req.query.cedula, 10);
  if (cedula === '') throw invalido('Ingresa una cédula para buscar.');
  const filas = await prisma.$queryRaw<Array<Record<string, unknown> & { fecha_nacimiento: Date | null; fecha_venta: Date }>>(Prisma.sql`
    SELECT a.id, a.gestion_id, a.nombre, a.apellido, a.genero, a.fecha_nacimiento, a.cedula, a.telf_hab, a.telf_celular, a.correo,
           a.cuenta, b.descripcion AS servicio, a.servicio_id, a.producto_id, p.descripcion AS producto, a.fecha_venta
      FROM resultados a
      JOIN servicios b ON a.servicio_id = b.id
      JOIN productos p ON a.producto_id = p.id
     WHERE a.cedula = ${cedula}
     ORDER BY a.fecha_venta DESC, a.id DESC`);
  res.json(filas.map((f) => ({ ...f, fecha_nacimiento: deFechaDb(f.fecha_nacimiento), fecha_venta: deFechaDb(f.fecha_venta) })));
});

administracionRouter.put('/ventas/:id', async (req, res) => {
  const id = idDe(req);
  const c = req.body ?? {};
  const nombre = recortar(inputString(c.nombre, 100), 60);
  const apellido = recortar(inputString(c.apellido, 100), 60);
  const cedula = inputDigits(c.cedula, 10);
  const genero = inputEnum(c.genero, GENEROS);
  const nacimiento = normalizarFechaNacimiento(c.fecha_nacimiento);
  const hab = inputPhone(c.telf_hab);
  const cel = inputPhone(c.telf_celular);
  const correo = inputEmail(c.correo, 150);
  const fechaVenta = inputDate(c.fecha_venta);
  const productoId = inputInt(c.producto_id, 1);
  const cuenta = inputPan(c.cuenta);

  const errores: Record<string, string> = {};
  if (nombre === '') errores.nombre = 'Obligatorio.';
  if (apellido === '') errores.apellido = 'Obligatorio.';
  if (cedula === '') errores.cedula = 'Solo dígitos.';
  if (genero === null) errores.genero = 'Selecciona el género.';
  if (nacimiento === null) errores.fecha_nacimiento = 'Fecha inválida.';
  if (hab === null) errores.telf_hab = 'Teléfono inválido.';
  if (cel === null) errores.telf_celular = 'Teléfono inválido.';
  if (correo === null) errores.correo = 'Correo inválido.';
  if (fechaVenta === null) errores.fecha_venta = 'Fecha inválida.';
  if (productoId === null) errores.producto_id = 'Selecciona el producto.';
  if (cuenta === null) errores.cuenta = 'Hasta 20 dígitos.';
  if (Object.keys(errores).length > 0) throw invalido('Revisa los campos marcados.', { errores });

  const r = await prisma.resultado.updateMany({
    where: { id },
    data: {
      nombre, apellido, cedula, genero: genero!, fecha_nacimiento: aFechaDb(nacimiento!), telf_hab: hab!, telf_celular: cel!, correo: correo!,
      fecha_venta: aFechaDb(fechaVenta!), producto_id: productoId!, cuenta: cuenta!,
    },
  });
  if (r.count === 0) throw noEncontrado('Venta no encontrada.');
  logger.info({ event: 'ventas.corregida', resultado_id: id, user_id: sesionDe(req).userId }, 'Venta corregida');
  res.status(204).end();
});

administracionRouter.delete('/ventas/:id', async (req, res) => {
  const id = idDe(req);
  const r = await prisma.resultado.deleteMany({ where: { id } });
  if (r.count === 0) throw noEncontrado('Venta no encontrada.');
  logger.warn({ event: 'ventas.eliminada', resultado_id: id, user_id: sesionDe(req).userId }, 'Venta eliminada');
  res.status(204).end();
});

// --- Desbloqueo de clientes --------------------------------------------------------

const buscarClientes = (q: string) => prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
  SELECT a.id, a.nombre_legal, a.telf_hab, a.telf_ofi, a.telf_cel, a.identificacion, a.status_id, c.name AS status, b.descripcion AS servicio
    FROM clientes a
    JOIN servicios b ON a.servicio_id = b.id
    LEFT JOIN status c ON a.status_id = c.id
   WHERE a.identificacion = ${q} OR a.telf_ofi = ${q}
   ORDER BY a.id
   LIMIT 20`);

administracionRouter.get('/clientes', async (req, res) => {
  const q = inputString(req.query.q, 30);
  if (q === '') throw invalido('Ingresa una cédula para buscar.');
  res.json(await buscarClientes(q));
});

/** Libera a un cliente (vuelve a «sin contactar») para que pueda gestionarse de nuevo. */
administracionRouter.post('/clientes/liberar', async (req, res) => {
  const identificacion = inputString(req.body?.identificacion, 30);
  if (identificacion === '') throw invalido('Cédula inválida.');
  const r = await prisma.cliente.updateMany({ where: { identificacion }, data: { status_id: ESTADO_SIN_CONTACTAR } });
  if (r.count === 0) throw noEncontrado('Cliente no encontrado.');
  logger.info({ event: 'clientes.liberado', identificacion, clientes: r.count, user_id: sesionDe(req).userId }, 'Cliente liberado');
  res.json({ liberados: r.count });
});

// --- Carga masiva de clientes (solo campañas bancarias) ------------------------------

const subirCsv = subida(CARGA_MAX_BYTES_CLIENTES);

administracionRouter.get('/cargas-clientes/modelo', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modelo_bbdd.csv"');
  res.send(`﻿${CARGA_COLUMNAS_CLIENTES.join(';')}\r\n`);
});

/**
 * Importa clientes desde un CSV separado por `;` (primera fila = encabezados; las
 * 9 primeras columnas en el orden del modelo). Inserta en lotes de 1 000.
 */
administracionRouter.post('/cargas-clientes', subirCsv, async (req, res) => {
  validarArchivo(req.file, ['csv', 'txt']);
  const servicioId = inputInt(req.body?.servicio_id, 1);
  if (servicioId === null || (await flujoDe(servicioId)) !== FLUJO.BANCARIO) throw invalido('Selecciona una campaña bancaria.');

  const tabla = parsearCsv(req.file!.buffer, ';');
  if (!tabla || tabla.headers.length <= 1) throw invalido('El archivo no tiene el formato esperado (CSV separado por punto y coma).');

  const n = CARGA_COLUMNAS_CLIENTES.length;
  const validas = tabla.filas.filter((f) => f.length >= n);
  const omitidas = tabla.filas.length - validas.length;
  if (validas.length === 0) throw invalido('El archivo no contiene filas válidas.');

  let insertadas = 0;
  for (let i = 0; i < validas.length; i += CARGA_LOTE_CLIENTES) {
    const r = await prisma.cliente.createMany({
      data: validas.slice(i, i + CARGA_LOTE_CLIENTES).map((f) => ({
        identificacion: f[0]!.trim(), nombre_legal: f[1]!.trim(), telf_hab: f[2]!.trim(), telf_ofi: f[3]!.trim(), telf_cel: f[4]!.trim(),
        correo: f[5]!.trim(), direccion: f[6]!.trim(), cuenta: f[7]!.trim(), oferta: f[8]!.trim(), servicio_id: servicioId,
      })),
    });
    insertadas += r.count;
  }
  logger.info({ event: 'clientes.carga', servicio_id: servicioId, insertadas, omitidas, user_id: sesionDe(req).userId }, 'Carga masiva de clientes');
  res.status(201).json({ insertadas, omitidas });
});
