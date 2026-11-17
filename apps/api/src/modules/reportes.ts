/**
 * Reportes y dashboard (Supervisor y Administrador). Reglas en
 * docs/nodejs-react.md §4.3. Una «venta» es una gestión con el contacto
 * efectivo «gestión efectiva» en la campaña consultada.
 */
import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  EFECTIVO_VENTA_DESCRIPCION, FLUJO, REGISTRO, REPORTE_FILAS_POR_DEFECTO, REPORTE_FILAS_POR_PAGINA, REPORTE_TANDA_EXPORTACION,
  esNumerico, etiquetaCampana, inputDate, inputEnum, inputInt, slug, valorComoTexto,
} from '@bulkapp/shared';
import { env } from '../config/env.ts';
import { ESTILO_ENCABEZADO, ExcelJS, XLSX_MIME, anchoColumna, aplicarEstilo } from '../lib/archivos.ts';
import { flujosCampana, listarCampanas, serviciosBancarios } from '../lib/campanas.ts';
import { aFechaDb, deFechaDb, fechaLarga, finDeMes, hoy, invalido, logger, prisma } from '../lib/core.ts';
import { comoDefinicion, comoMapping, comoRegistro } from '../lib/formularios.ts';
import { sesionDe } from '../middleware/auth.ts';

export const reportesRouter = Router();

/**
 * Fecha como parámetro `date` en SQL crudo. Sin la conversión explícita el valor
 * viajaría como timestamp y la comparación dependería de la zona horaria de la sesión.
 */
const dia = (fecha: string) => Prisma.sql`${fecha}::date`;

/** Rango `desde`–`hasta` de la consulta; por defecto hoy. Se ordena si llega invertido. */
function rango(req: Request, porDefecto?: { desde: string; hasta: string }): { desde: string; hasta: string } {
  let desde = inputDate(req.query.desde);
  let hasta = inputDate(req.query.hasta);
  if (desde === null || hasta === null) {
    desde = porDefecto?.desde ?? hoy();
    hasta = porDefecto?.hasta ?? hoy();
  }
  return desde > hasta ? { desde: hasta, hasta: desde } : { desde, hasta };
}

/** Campaña de la consulta: debe existir. */
async function campanaDe(req: Request, obligatoria = true): Promise<number | null> {
  const id = inputInt(req.query.servicio_id, 1);
  if (id !== null && (await flujosCampana()).has(id)) return id;
  if (obligatoria) throw invalido('Selecciona una campaña.');
  return null;
}

/** Id del contacto efectivo que marca la venta en las campañas bancarias. */
async function idEfectivoVenta(): Promise<number> {
  const e = await prisma.efectivo.findFirst({
    where: { servicio_id: { in: await serviciosBancarios() }, descripcion: { equals: EFECTIVO_VENTA_DESCRIPCION, mode: 'insensitive' } },
    orderBy: { id: 'asc' }, select: { id: true },
  });
  return e?.id ?? 0;
}

/** Campañas para los selectores: `?flujo=bancario|dinamico&activas=1`. */
reportesRouter.get('/campanas', async (req, res) => {
  const flujo = inputEnum(req.query.flujo, [FLUJO.BANCARIO, FLUJO.DINAMICO]);
  res.json(await listarCampanas({ activas: req.query.activas === '1', ...(flujo ? { flujo } : {}) }));
});

reportesRouter.get('/productos', async (req, res) => {
  const servicioId = await campanaDe(req, false);
  res.json(servicioId === null ? [] : await prisma.producto.findMany({
    where: { servicio_id: servicioId, status_id: REGISTRO.ACTIVO }, select: { id: true, descripcion: true }, orderBy: { id: 'asc' },
  }));
});

/**
 * Acumulado de gestión por operador + ventas por producto + motivos de contacto.
 * El producto NO acota la gestión (las no efectivas no tienen producto): solo las ventas.
 */
reportesRouter.get('/acumulado', async (req, res) => {
  const { desde, hasta } = rango(req);
  const servicioId = (await campanaDe(req))!;
  const productoId = inputInt(req.query.producto_id, 1);
  const d = dia(desde);
  const h = dia(hasta);
  const idVenta = await idEfectivoVenta();
  const filtroProducto = productoId === null ? Prisma.empty : Prisma.sql`AND g.producto_id = ${productoId}`;

  const [gestion, ventasProducto, motivosNoEfectivo, motivosEfectivo] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT u.id, u.nombre || ' ' || u.apellido AS nombre,
             COUNT(g.contacto_id)::int AS gestion, COUNT(g.noefectivo_id)::int AS noefectivos, COUNT(g.efectivo_id)::int AS efectivos,
             (COUNT(g.producto_id) FILTER (WHERE g.efectivo_id = ${idVenta} ${filtroProducto}))::int AS ventas
        FROM users u JOIN gestion g ON g.user_id = u.id
       WHERE g.fecha BETWEEN ${d} AND ${h} AND g.servicio_id = ${servicioId}
       GROUP BY u.id, u.nombre, u.apellido
       ORDER BY COUNT(g.producto_id) DESC, nombre`),
    prisma.$queryRaw(Prisma.sql`
      SELECT p.id, p.descripcion AS producto, COUNT(g.producto_id)::int AS vendidos
        FROM gestion g JOIN productos p ON p.id = g.producto_id
       WHERE g.fecha BETWEEN ${d} AND ${h} AND g.servicio_id = ${servicioId} AND g.efectivo_id = ${idVenta} ${filtroProducto}
       GROUP BY p.id, p.descripcion
       ORDER BY vendidos DESC`),
    prisma.$queryRaw(Prisma.sql`
      SELECT n.descripcion, COUNT(g.noefectivo_id)::int AS total
        FROM gestion g JOIN noefectivo n ON g.noefectivo_id = n.id
       WHERE g.fecha BETWEEN ${d} AND ${h} AND g.servicio_id = ${servicioId}
       GROUP BY n.descripcion ORDER BY total DESC`),
    prisma.$queryRaw(Prisma.sql`
      SELECT e.descripcion, COUNT(g.efectivo_id)::int AS total
        FROM gestion g JOIN efectivo e ON g.efectivo_id = e.id
       WHERE g.fecha BETWEEN ${d} AND ${h} AND g.servicio_id = ${servicioId}
       GROUP BY e.descripcion ORDER BY total DESC`),
  ]);
  res.json({ desde, hasta, servicio_id: servicioId, gestion, ventasProducto, motivosNoEfectivo, motivosEfectivo });
});

/** Ventas por estado geográfico (campaña opcional). */
reportesRouter.get('/ventas-estado', async (req, res) => {
  const { desde, hasta } = rango(req);
  const servicioId = await campanaDe(req, false);
  const filtro = servicioId === null ? Prisma.empty : Prisma.sql`AND r.servicio_id = ${servicioId}`;
  const filas = await prisma.$queryRaw(Prisma.sql`
    SELECT e.id, e.estado, COUNT(*)::int AS total
      FROM resultados r JOIN estado e ON r.estado_id = e.id
     WHERE r.fecha_venta BETWEEN ${dia(desde)} AND ${dia(hasta)} ${filtro}
     GROUP BY e.id, e.estado ORDER BY total DESC, e.estado`);
  res.json({ desde, hasta, servicio_id: servicioId, filas });
});

/** Detalle de un estado: ventas por ciudad. */
reportesRouter.get('/ventas-ciudad', async (req, res) => {
  const { desde, hasta } = rango(req);
  const estadoId = inputInt(req.query.estado_id, 1);
  if (estadoId === null) throw invalido('Estado inválido.');
  const servicioId = await campanaDe(req, false);
  const filtro = servicioId === null ? Prisma.empty : Prisma.sql`AND r.servicio_id = ${servicioId}`;
  const [estado, filas] = await Promise.all([
    prisma.estado.findUnique({ where: { id: estadoId }, select: { estado: true } }),
    prisma.$queryRaw(Prisma.sql`
      SELECT c.id, c.ciudad, COUNT(*)::int AS total
        FROM resultados r JOIN ciudad c ON r.ciudad_id = c.id
       WHERE r.fecha_venta BETWEEN ${dia(desde)} AND ${dia(hasta)} AND r.estado_id = ${estadoId} ${filtro}
       GROUP BY c.id, c.ciudad ORDER BY total DESC, c.ciudad`),
  ]);
  res.json({ desde, hasta, estado: estado?.estado.trim() ?? '', filas });
});

interface VentaDetalle {
  nombre: string; apellido: string; cedula: string; fecha_nacimiento: Date | null; telf_hab: string; telf_celular: string;
  correo: string; producto: string | null; agente: string; fecha_venta: Date;
}

function ventaDetallada(desde: string, hasta: string, servicioId: number) {
  return prisma.$queryRaw<VentaDetalle[]>(Prisma.sql`
    SELECT r.nombre, r.apellido, r.cedula, r.fecha_nacimiento, r.telf_hab, r.telf_celular, r.correo,
           p.descripcion AS producto, u.nombre || ' ' || u.apellido AS agente, r.fecha_venta
      FROM resultados r
      JOIN productos p ON r.producto_id = p.id
      JOIN gestion g ON r.gestion_id = g.id
      JOIN users u ON g.user_id = u.id
     WHERE r.fecha_venta BETWEEN ${dia(desde)} AND ${dia(hasta)} AND r.servicio_id = ${servicioId}
     ORDER BY r.fecha_venta DESC, r.id DESC`);
}

const comoFila = (v: VentaDetalle) => ({ ...v, fecha_nacimiento: deFechaDb(v.fecha_nacimiento), fecha_venta: deFechaDb(v.fecha_venta) });

reportesRouter.get('/detalle-ventas', async (req, res) => {
  const { desde, hasta } = rango(req);
  const servicioId = (await campanaDe(req))!;
  res.json({ desde, hasta, servicio_id: servicioId, filas: (await ventaDetallada(desde, hasta, servicioId)).map(comoFila) });
});

reportesRouter.get('/detalle-ventas/exportar', async (req, res) => {
  const { desde, hasta } = rango(req);
  const servicioId = (await campanaDe(req))!;
  const ventas = await ventaDetallada(desde, hasta, servicioId);

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hoja.columns = [
    ['Nombre', 22], ['Apellido', 22], ['Cédula', 12], ['Fecha de nacimiento', 18], ['Teléfono 1', 18], ['Teléfono 2', 18],
    ['Correo', 30], ['Producto', 26], ['Agente', 26], ['Fecha', 12],
  ].map(([header, width]) => ({ header: header as string, width: width as number }));
  hoja.getRow(1).eachCell((c) => aplicarEstilo(c, ESTILO_ENCABEZADO[0]!));
  for (const v of ventas.map(comoFila)) {
    hoja.addRow([v.nombre, v.apellido, v.cedula, v.fecha_nacimiento, v.telf_hab, v.telf_celular, v.correo, v.producto ?? '', v.agente, v.fecha_venta]);
  }
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="ventas_detalladas_${desde}_${hasta}.xlsx"`);
  res.setHeader('Cache-Control', 'no-store');
  await libro.xlsx.write(res);
  res.end();
});

// --- Dashboard ----------------------------------------------------------------

/** Acumulado del mes por campaña. En el mes actual el corte es hoy. */
reportesRouter.get('/dashboard', async (req, res) => {
  const mesActual = hoy().slice(0, 7);
  const mes = typeof req.query.mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.mes) ? req.query.mes : mesActual;
  const desde = `${mes}-01`;
  const hasta = mes === mesActual ? hoy() : finDeMes(mes);
  const idVenta = await idEfectivoVenta();
  const d = dia(desde);
  const h = dia(hasta);

  const [servicios, diarias, meses] = await Promise.all([
    prisma.$queryRaw(Prisma.sql`
      SELECT g.servicio_id AS id, s.descripcion AS nombre, COUNT(*)::int AS gestionados,
             (COUNT(*) FILTER (WHERE g.contacto_id = 1))::int AS efectivos,
             (COUNT(*) FILTER (WHERE g.efectivo_id = ${idVenta}))::int AS ventas
        FROM gestion g JOIN servicios s ON s.id = g.servicio_id
       WHERE s.status_id = ${REGISTRO.ACTIVO} AND g.fecha BETWEEN ${d} AND ${h}
       GROUP BY g.servicio_id, s.descripcion
       ORDER BY ventas DESC, gestionados DESC`),
    prisma.$queryRaw(Prisma.sql`
      SELECT g.servicio_id AS id, to_char(g.fecha, 'YYYY-MM-DD') AS dia, COUNT(*)::int AS ventas
        FROM gestion g
       WHERE g.efectivo_id = ${idVenta} AND g.fecha BETWEEN ${d} AND ${h}
       GROUP BY g.servicio_id, g.fecha ORDER BY g.fecha`),
    prisma.$queryRaw<Array<{ ym: string }>>(Prisma.sql`
      SELECT to_char(fecha, 'YYYY-MM') AS ym FROM gestion GROUP BY ym ORDER BY ym DESC`),
  ]);
  const disponibles = meses.map((m) => m.ym);
  if (!disponibles.includes(mesActual)) disponibles.unshift(mesActual);
  res.json({ mes, desde, hasta, servicios, diarias, meses: disponibles });
});

// --- Reporte de formularios dinámicos -------------------------------------------

interface NodoFormulario { id: number; nombre: string }
interface NodoCampana { id: number; nombre: string; formularios: NodoFormulario[] }
interface NodoCliente { id: number; nombre: string; campanas: NodoCampana[] }

/**
 * Árbol cliente → campaña → formulario: las asignaciones vigentes del Constructor
 * más las que ya tienen envíos (un formulario desasignado o eliminado conserva su
 * historial). Solo campañas no bancarias.
 */
async function arbolReporte(): Promise<NodoCliente[]> {
  const filas = await prisma.$queryRaw<Array<{
    empresa_id: number; empresa: string; servicio_id: number; campana: string; formulario_id: number; formulario: string; eliminado: boolean;
  }>>(Prisma.sql`
    SELECT em.id AS empresa_id, em.nombre AS empresa, s.id AS servicio_id, s.descripcion AS campana,
           f.id AS formulario_id, f.nombre AS formulario, f.eliminado
      FROM (SELECT formulario_id, servicio_id FROM formulario_servicios
            UNION
            SELECT DISTINCT formulario_id, servicio_id FROM formulario_envios) p
      JOIN formularios f ON f.id = p.formulario_id
      JOIN servicios s ON s.id = p.servicio_id
      JOIN empresas em ON em.id = s.empresa_id
     WHERE s.tipo_flujo = ${FLUJO.DINAMICO}::tipo_flujo
     ORDER BY em.nombre, s.descripcion, f.eliminado, f.nombre`);

  const arbol: NodoCliente[] = [];
  for (const f of filas) {
    let cliente = arbol.find((c) => c.id === f.empresa_id);
    if (!cliente) arbol.push(cliente = { id: f.empresa_id, nombre: f.empresa, campanas: [] });
    let campana = cliente.campanas.find((c) => c.id === f.servicio_id);
    if (!campana) cliente.campanas.push(campana = { id: f.servicio_id, nombre: f.campana, formularios: [] });
    campana.formularios.push({ id: f.formulario_id, nombre: f.formulario + (f.eliminado ? ' (eliminado)' : '') });
  }
  return arbol;
}

interface Envio {
  id: number; fecha: Date; version: number; registro: Prisma.JsonValue; valores: Prisma.JsonValue; usuario: string | null; operador: string;
}

/** Filtro de envíos: formulario, campaña y rango de fechas (inclusivo, en la zona horaria de negocio). */
const filtroEnvios = (formId: number, servicioId: number, desde: string, hasta: string) => Prisma.sql`
  e.formulario_id = ${formId} AND e.servicio_id = ${servicioId}
  AND e.fecha >= (${desde}::date)::timestamp AT TIME ZONE ${env.APP_TZ}
  AND e.fecha < ((${hasta}::date + 1))::timestamp AT TIME ZONE ${env.APP_TZ}`;

/** Envíos del filtro. `fecha` llega como hora local de negocio (para mostrar y exportar). */
function envios(formId: number, servicioId: number, desde: string, hasta: string, limite: number, salto: number) {
  return prisma.$queryRaw<Envio[]>(Prisma.sql`
    SELECT e.id, (e.fecha AT TIME ZONE ${env.APP_TZ}) AS fecha, v.version, e.registro, e.valores, u.username AS usuario,
           TRIM(COALESCE(u.nombre, '') || ' ' || COALESCE(u.apellido, '')) AS operador
      FROM formulario_envios e
      JOIN formulario_versiones v ON v.id = e.version_id
      LEFT JOIN users u ON u.id = e.user_id
     WHERE ${filtroEnvios(formId, servicioId, desde, hasta)}
     ORDER BY e.fecha DESC, e.id DESC
     LIMIT ${limite} OFFSET ${Math.max(0, salto)}`);
}

interface Columna { k: string; label: string; tipo: string }

/**
 * Columnas del reporte: une las versiones del formulario y las cargas de BD. Las
 * etiquetas salen de lo más reciente; las claves antiguas se agregan al final.
 */
async function columnasReporte(formId: number): Promise<{ bd: Columna[]; campos: Columna[] }> {
  const [versiones, cargas] = await Promise.all([
    prisma.formularioVersion.findMany({ where: { formulario_id: formId }, orderBy: { version: 'desc' }, select: { definicion: true } }),
    prisma.formularioCarga.findMany({ where: { formulario_id: formId }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }], select: { mapping: true } }),
  ]);
  const bd = new Map<string, Columna>();
  for (const c of cargas) {
    for (const col of comoMapping(c.mapping)?.columnas ?? []) if (!bd.has(col.k)) bd.set(col.k, { k: col.k, label: col.label, tipo: 'text' });
  }
  const campos = new Map<string, Columna>();
  for (const v of versiones) {
    for (const c of comoDefinicion(v.definicion).campos) if (!campos.has(c.k)) campos.set(c.k, { k: c.k, label: c.label, tipo: c.type });
  }
  return { bd: [...bd.values()], campos: [...campos.values()] };
}

/** Filtros del reporte, validados contra el árbol (ids manipulados → sin selección). */
async function seleccionReporte(req: Request) {
  const arbol = await arbolReporte();
  const hoyStr = hoy();
  const { desde, hasta } = rango(req, { desde: `${hoyStr.slice(0, 7)}-01`, hasta: hoyStr });
  const cliente = arbol.find((c) => c.id === inputInt(req.query.cliente, 1));
  const campana = cliente?.campanas.find((c) => c.id === inputInt(req.query.campana, 1));
  const formulario = campana?.formularios.find((f) => f.id === inputInt(req.query.formulario, 1));
  return { arbol, desde, hasta, seleccion: cliente && campana && formulario ? { cliente, campana, formulario } : null };
}

const fechaHora = (d: Date): string => d.toISOString().slice(0, 19).replace('T', ' ');

reportesRouter.get('/formularios', async (req, res) => {
  const { arbol, desde, hasta, seleccion } = await seleccionReporte(req);
  const porPagina = inputEnum(req.query.n, REPORTE_FILAS_POR_PAGINA) ?? REPORTE_FILAS_POR_DEFECTO;
  if (!seleccion) {
    res.json({ arbol, desde, hasta, seleccion: null, columnas: { bd: [], campos: [] }, filas: [], total: 0, pagina: 1, totalPaginas: 1, porPagina });
    return;
  }

  const formId = seleccion.formulario.id;
  const servicioId = seleccion.campana.id;
  const [conteo, columnas, vigente] = await Promise.all([
    prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`SELECT COUNT(*)::int AS n FROM formulario_envios e WHERE ${filtroEnvios(formId, servicioId, desde, hasta)}`),
    columnasReporte(formId),
    prisma.formularioVersion.findFirst({ where: { formulario_id: formId, vigente: true }, select: { version: true } }),
  ]);
  const total = conteo[0]?.n ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(inputInt(req.query.p, 1) ?? 1, totalPaginas);
  const filas = await envios(formId, servicioId, desde, hasta, porPagina, (pagina - 1) * porPagina);

  res.json({
    arbol, desde, hasta, seleccion, columnas, total, pagina, totalPaginas, porPagina,
    versionVigente: vigente?.version ?? null,
    etiqueta: etiquetaCampana(seleccion.cliente.nombre, seleccion.campana.nombre),
    filas: filas.map((e) => {
      const registro = comoRegistro(e.registro);
      const valores = comoRegistro(e.valores);
      return {
        id: e.id, fecha: fechaHora(e.fecha), operador: e.operador || e.usuario || '', usuario: e.usuario ?? '', version: e.version,
        bd: Object.fromEntries(columnas.bd.map((c) => [c.k, valorComoTexto(registro[c.k])])),
        campos: Object.fromEntries(columnas.campos.map((c) => [c.k, valorComoTexto(valores[c.k])])),
      };
    }),
  });
});

/** Exporta a .xlsx todas las filas del filtro, leyendo la BD por tandas. */
reportesRouter.get('/formularios/exportar', async (req, res) => {
  const { desde, hasta, seleccion } = await seleccionReporte(req);
  if (!seleccion) throw invalido('Elige cliente, campaña y formulario antes de exportar.');
  const formId = seleccion.formulario.id;
  const servicioId = seleccion.campana.id;
  const [columnas, vigente, usuario] = await Promise.all([
    columnasReporte(formId),
    prisma.formularioVersion.findFirst({ where: { formulario_id: formId, vigente: true }, select: { version: true } }),
    prisma.user.findUnique({ where: { id: sesionDe(req).userId }, select: { username: true } }),
  ]);

  const nombre = `reporte_${slug(seleccion.cliente.nombre) || 'sin-nombre'}_${slug(seleccion.campana.nombre) || 'sin-nombre'}_${slug(seleccion.formulario.nombre) || 'sin-nombre'}_${desde}_${hasta}.xlsx`;
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  res.setHeader('Cache-Control', 'no-store');

  const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true });
  const hoja = libro.addWorksheet('Registros', { views: [{ state: 'frozen', ySplit: 1 }] });
  const titulos: Array<[string, number, number]> = [
    ['ID', 8, 0], ['Fecha', 19, 0], ['Operador', 24, 0], ['Usuario', 14, 0],
    ...columnas.bd.map((c): [string, number, number] => [c.label, anchoColumna(c.label), 1]),
    ...columnas.campos.map((c): [string, number, number] => [c.label, anchoColumna(c.label), 2]),
    ['Versión', 9, 0],
  ];
  hoja.columns = titulos.map(([header, width]) => ({ header, width }));
  hoja.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm:ss';
  const encabezado = hoja.getRow(1);
  titulos.forEach(([, , grupo], i) => aplicarEstilo(encabezado.getCell(i + 1), ESTILO_ENCABEZADO[grupo]!));
  encabezado.commit();

  // Los campos numéricos y de fecha se exportan como valores nativos; el resto como texto.
  const celda = (tipo: string, texto: string): string | number | Date => {
    if (tipo === 'number' && esNumerico(texto)) return Number(texto);
    if (tipo === 'date' && inputDate(texto) !== null) return aFechaDb(texto);
    return texto;
  };

  let total = 0;
  for (let salto = 0; ; salto += REPORTE_TANDA_EXPORTACION) {
    const tanda = await envios(formId, servicioId, desde, hasta, REPORTE_TANDA_EXPORTACION, salto);
    for (const e of tanda) {
      const registro = comoRegistro(e.registro);
      const valores = comoRegistro(e.valores);
      hoja.addRow([
        e.id, e.fecha, e.operador || e.usuario || '', e.usuario ?? '',
        ...columnas.bd.map((c) => valorComoTexto(registro[c.k])),
        ...columnas.campos.map((c) => celda(c.tipo, valorComoTexto(valores[c.k]))),
        e.version,
      ]).commit();
    }
    total += tanda.length;
    if (tanda.length < REPORTE_TANDA_EXPORTACION) break;
  }
  hoja.commit();

  const filtros = libro.addWorksheet('Filtros');
  filtros.columns = [{ width: 22 }, { width: 60 }];
  const ahora = new Date();
  for (const [k, v] of [
    ['Cliente', seleccion.cliente.nombre], ['Campaña', seleccion.campana.nombre], ['Formulario', seleccion.formulario.nombre],
    ['Versión vigente', vigente ? `v${vigente.version}` : '—'], ['Período', `${fechaLarga(desde)} – ${fechaLarga(hasta)}`],
    ['Registros', String(total)], ['Generado por', usuario?.username ?? ''],
    ['Fecha de generación', `${fechaLarga(hoy(ahora))} ${ahora.toLocaleTimeString('es-VE', { timeZone: env.APP_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`],
  ]) {
    const fila = filtros.addRow([k, v]);
    fila.getCell(1).font = { bold: true };
    fila.commit();
  }
  filtros.commit();
  await libro.commit();

  logger.info({
    event: 'reporte.formulario_exportado', formulario_id: formId, servicio_id: servicioId, desde, hasta, registros: total, user_id: sesionDe(req).userId,
  }, 'Reporte de formulario dinámico exportado');
});
