/**
 * Importa los datos de la BD MySQL de origen a PostgreSQL aplicando las
 * conversiones de docs/nodejs-react.md §5.5 y §5.6, ajusta las
 * secuencias y compara los conteos por tabla.
 *
 *   npm run db:importar-mysql -- --confirmar
 *
 * VACÍA las tablas de destino antes de cargar: por eso exige `--confirmar`.
 * Origen: variables MYSQL_* de apps/api/.env (la base de la aplicación PHP).
 */
import mysql from 'mysql2/promise';
import { Prisma } from '@prisma/client';
import { env } from '../src/config/env.ts';
import { prisma } from '../src/lib/core.ts';

type Fila = Record<string, unknown>;
interface Tabla {
  /** Nombre de la tabla (igual en origen y destino). */
  nombre: string;
  /** Columna para paginar en origen; null = tabla pequeña sin id. */
  pk: string | null;
  insertar: (filas: Fila[]) => Promise<{ count: number }>;
  mapear: (f: Fila) => Fila | null;
}

const LOTE = 2000;
const avisos: Record<string, number> = {};
const avisar = (clave: string): void => { avisos[clave] = (avisos[clave] ?? 0) + 1; };

// --- Conversiones ---------------------------------------------------------------

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const textoNulo = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const entero = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));
const booleano = (v: unknown): boolean => Number(v) === 1;

/** Desplazamiento UTC de la zona de negocio en un instante (p. ej. `-04:00`). */
function desplazamiento(fecha: string): string {
  const parte = new Intl.DateTimeFormat('en-US', { timeZone: env.APP_TZ, timeZoneName: 'longOffset' })
    .formatToParts(new Date(`${fecha}T12:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  return parte === 'GMT' ? '+00:00' : parte.replace('GMT', '');
}

/** DATETIME de MySQL (hora local de negocio) → instante. Fechas cero o nulas → ahora. */
function instante(v: unknown): Date {
  const s = texto(v);
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s) || s.startsWith('0000')) return new Date();
  const d = new Date(`${s.slice(0, 10)}T${s.slice(11, 19)}${desplazamiento(s.slice(0, 10))}`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
const instanteNulo = (v: unknown): Date | null => (v === null || v === undefined ? null : instante(v));

/** `AAAA-MM-DD`, `DD-MM-AAAA` o `AAAAMMDD` → Date (columna date) o null. */
function fecha(v: unknown): Date | null {
  const s = texto(v).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  const dma = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : dma ? `${dma[3]}-${dma[2]}-${dma[1]}` : null;
  if (iso === null) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? d : null;
}

const hora = (v: unknown): Date => {
  const s = texto(v);
  return new Date(`1970-01-01T${/^\d{2}:\d{2}:\d{2}$/.test(s) ? s : '00:00:00'}Z`);
};

function json(v: unknown, tabla: string): Prisma.InputJsonValue | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return v as Prisma.InputJsonValue;
  try {
    return JSON.parse(v) as Prisma.InputJsonValue;
  } catch {
    avisar(`${tabla}: JSON inválido`);
    return null;
  }
}

const marcas = (f: Fila) => ({ created_at: instante(f.created_at), updated_at: instante(f.updated_at) });

// --- Tablas, en orden de dependencias ----------------------------------------------

const tablas: Tabla[] = [
  { nombre: 'status', pk: 'id', insertar: (d) => prisma.status.createMany({ data: d as never }), mapear: (f) => ({ id: f.id, name: f.name, ...marcas(f) }) },
  { nombre: 'usertypes', pk: 'id', insertar: (d) => prisma.usertype.createMany({ data: d as never }), mapear: (f) => ({ id: f.id, name: f.name, ...marcas(f) }) },
  {
    nombre: 'empresas', pk: 'id', insertar: (d) => prisma.empresa.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, nombre: f.nombre, identificacion: f.identificacion, status_id: f.status_id, ...marcas(f) }),
  },
  {
    nombre: 'servicios', pk: 'id', insertar: (d) => prisma.servicio.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, empresa_id: f.empresa_id, descripcion: texto(f.descripcion).trim(), detalle: f.detalle, fecha_inicio: fecha(f.fecha_inicio) ?? new Date(),
      meta: f.meta, tipo_flujo: f.tipo_flujo, status_id: f.status_id, codigo: texto(f.codigo), campo_2: textoNulo(f['campo 2']), ...marcas(f),
    }),
  },
  {
    nombre: 'users', pk: 'id', insertar: (d) => prisma.user.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, nombre: f.nombre, apellido: f.apellido, username: f.user, password: f.password, usertype_id: f.usertype_id,
      status_id: f.status_id, servicio_id: f.servicio_id,
    }),
  },
  {
    nombre: 'usuario_servicios', pk: null, insertar: (d) => prisma.usuarioServicio.createMany({ data: d as never }),
    mapear: (f) => ({ user_id: f.user_id, servicio_id: f.servicio_id, created_at: instante(f.created_at) }),
  },
  {
    nombre: 'clientes', pk: 'id', insertar: (d) => prisma.cliente.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, identificacion: f.identificacion, nombre_legal: f.nombre_legal, telf_hab: f.telf_hab, telf_ofi: f.telf_ofi, telf_cel: f.telf_cel,
      correo: f.correo, direccion: f.direccion, cuenta: f.cuenta, oferta: texto(f.oferta), status_id: f.status_id, servicio_id: f.servicio_id,
      is_active: booleano(f.is_active), ...marcas(f),
    }),
  },
  {
    nombre: 'efectivo', pk: 'id', insertar: (d) => prisma.efectivo.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, descripcion: f.descripcion, servicio_id: f.servicio_id, ...marcas(f) }),
  },
  {
    nombre: 'noefectivo', pk: 'id', insertar: (d) => prisma.noefectivo.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, descripcion: f.descripcion, servicio_id: f.servicio_id, ...marcas(f) }),
  },
  {
    nombre: 'subcontacto', pk: 'id', insertar: (d) => prisma.subcontacto.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, descripcion: f.descripcion, efectivo_id: f.efectivo_id, ...marcas(f) }),
  },
  {
    nombre: 'productos', pk: 'id', insertar: (d) => prisma.producto.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, descripcion: f.descripcion, codigo_producto: f.codigo_producto, costo_prod: f.costo_prod, status_id: f.status_id,
      servicio_id: f.servicio_id, fecha: texto(f.fecha), codplan: texto(f.codplan), ...marcas(f),
    }),
  },
  { nombre: 'estado', pk: 'id', insertar: (d) => prisma.estado.createMany({ data: d as never }), mapear: (f) => ({ id: f.id, estado: f.estado, codigo: f.codigo, servicio_id: f.servicio_id }) },
  {
    nombre: 'ciudad', pk: 'id', insertar: (d) => prisma.ciudad.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, ciudad: f.ciudad, codigo: f.codigo, estado_id: f.estado_id, servicio_id: f.servicio_id }),
  },
  {
    nombre: 'municipio', pk: 'id', insertar: (d) => prisma.municipio.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigo, estado_id: f.estado_id, servicio_id: f.servicio_id }),
  },
  {
    nombre: 'tipo_cuentas', pk: 'id', insertar: (d) => prisma.tipoCuenta.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, nombre: f.nombre, codigo: f.codigo, status_id: f.status_id }),
  },
  {
    nombre: 'gestion', pk: 'id', insertar: (d) => prisma.gestion.createMany({ data: d as never }),
    mapear: (f) => {
      const servicio = entero(f.servicio_id);
      const dia = fecha(f.fecha);
      if (servicio === null || !Number.isInteger(servicio) || dia === null) {
        avisar('gestion: fila omitida (servicio_id o fecha inválidos)');
        return null;
      }
      return {
        id: f.id, contacto_id: f.contacto_id, efectivo_id: f.efectivo_id, producto_id: f.producto_id, noefectivo_id: f.noefectivo_id,
        subcontacto_id: f.subContacto_id, user_id: f.user_id, fecha: dia, cliente_id: f.cliente_id, status_id: f.status_id, hora: hora(f.hora),
        servicio_id: servicio, tipo_gestion: texto(f.tipoGestion), ...marcas(f),
      };
    },
  },
  {
    nombre: 'resultados', pk: 'id', insertar: (d) => prisma.resultado.createMany({ data: d as never }),
    mapear: (f) => {
      const nacimiento = fecha(f.fecha_nacimiento);
      if (nacimiento === null) avisar('resultados: fecha_nacimiento inválida → NULL');
      let venta = fecha(f.fecha_venta);
      if (venta === null) {
        avisar('resultados: fecha_venta inválida → fecha de created_at');
        venta = fecha(texto(f.created_at).slice(0, 10)) ?? new Date();
      }
      return {
        id: f.id, gestion_id: f.gestion_id, nombre: f.nombre, apellido: f.apellido, genero: f.genero, fecha_nacimiento: nacimiento,
        nacionalidad: texto(f.nacionalidad), cedula: texto(f.cedula), telf_hab: f.telf_hab, telf_ofi: f.telf_ofi, telf_celular: f.telf_celular,
        correo: f.correo, estado_id: f.estado_id, ciudad_id: f.ciudad_id, municipio_id: f.municipio_id, cuenta: f.cuenta,
        tipo_cuenta_id: f.tipo_cuenta_id, producto_id: f.producto_id, observaciones: texto(f.observaciones), fecha_venta: venta,
        servicio_id: f.servicio_id, status_id: f.status_id, ...marcas(f),
      };
    },
  },
  {
    nombre: 'transacciones', pk: 'id_transaccion', insertar: (d) => prisma.transaccion.createMany({ data: d as never }),
    mapear: (f) => ({ id_transaccion: f.id_transaccion, fecha: texto(f.fecha), resultado_id: f.resultado_id }),
  },
  {
    nombre: 'formularios', pk: 'id', insertar: (d) => prisma.formulario.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, nombre: f.nombre, status_id: f.status_id, btn_texto: f.btn_texto, eliminado: booleano(f.eliminado),
      eliminado_en: instanteNulo(f.eliminado_en), user_id: f.user_id, fecha: instante(f.fecha), actualizado: instante(f.actualizado),
    }),
  },
  {
    nombre: 'formulario_versiones', pk: 'id', insertar: (d) => prisma.formularioVersion.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, formulario_id: f.formulario_id, version: f.version, definicion: json(f.definicion, 'formulario_versiones') ?? { campos: [] },
      nota: f.nota, vigente: booleano(f.vigente), user_id: f.user_id, fecha: instante(f.fecha),
    }),
  },
  {
    nombre: 'formulario_servicios', pk: 'id', insertar: (d) => prisma.formularioServicio.createMany({ data: d as never }),
    mapear: (f) => ({ id: f.id, formulario_id: f.formulario_id, servicio_id: f.servicio_id }),
  },
  {
    nombre: 'formulario_cargas', pk: 'id', insertar: (d) => prisma.formularioCarga.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, formulario_id: f.formulario_id, archivo: f.archivo, filas: f.filas, mapping: json(f.mapping, 'formulario_cargas') ?? {},
      vigente: booleano(f.vigente), user_id: f.user_id, fecha: instante(f.fecha),
    }),
  },
  {
    nombre: 'formulario_carga_filas', pk: 'id', insertar: (d) => prisma.formularioCargaFila.createMany({ data: d as never }),
    mapear: (f) => ({ id: BigInt(texto(f.id)), carga_id: f.carga_id, clave: f.clave, fila: json(f.fila, 'formulario_carga_filas') ?? {} }),
  },
  {
    nombre: 'formulario_envios', pk: 'id', insertar: (d) => prisma.formularioEnvio.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, formulario_id: f.formulario_id, version_id: f.version_id, servicio_id: f.servicio_id, carga_id: f.carga_id,
      fila_id: f.fila_id === null ? null : BigInt(texto(f.fila_id)), registro: json(f.registro, 'formulario_envios') ?? Prisma.DbNull,
      valores: json(f.valores, 'formulario_envios') ?? {}, user_id: f.user_id, fecha: instante(f.fecha),
    }),
  },
  {
    nombre: 'formulario_expresiones', pk: 'id', insertar: (d) => prisma.formularioExpresion.createMany({ data: d as never }),
    mapear: (f) => ({
      id: f.id, clave: f.clave, nombre: f.nombre, descripcion: f.descripcion, patron: f.patron, transformacion: f.transformacion, tipos: f.tipos,
      ejemplo_valido: f.ejemplo_valido, ejemplo_invalido: f.ejemplo_invalido, orden: f.orden, status_id: f.status_id,
    }),
  },
];

// --- Ejecución ------------------------------------------------------------------

function origen(): mysql.ConnectionOptions {
  const leer = (nombre: string): string => process.env[nombre] ?? '';
  const config = {
    host: leer('MYSQL_HOST') || 'localhost', port: Number(leer('MYSQL_PORT') || 3306),
    user: leer('MYSQL_USER'), password: leer('MYSQL_PASS'), database: leer('MYSQL_NAME'),
  };
  if (!config.user || !config.database) throw new Error('Faltan las credenciales de MySQL: define MYSQL_* en apps/api/.env.');
  return { ...config, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, charset: 'utf8mb4' };
}

async function importar(db: mysql.Connection, t: Tabla): Promise<{ origen: number; destino: number }> {
  let leidas = 0;
  let escritas = 0;
  let ultimo: unknown = null;
  for (;;) {
    const [filas] = t.pk === null
      ? await db.query(`SELECT * FROM \`${t.nombre}\``)
      : await db.query(`SELECT * FROM \`${t.nombre}\` WHERE ? IS NULL OR \`${t.pk}\` > ? ORDER BY \`${t.pk}\` LIMIT ${LOTE}`, [ultimo, ultimo]);
    const lote = filas as Fila[];
    if (lote.length === 0) break;
    leidas += lote.length;
    const datos = lote.map(t.mapear).filter((f): f is Fila => f !== null);
    if (datos.length > 0) escritas += (await t.insertar(datos)).count;
    if (t.pk === null || lote.length < LOTE) break;
    ultimo = lote[lote.length - 1]![t.pk];
  }
  return { origen: leidas, destino: escritas };
}

async function main(): Promise<void> {
  if (!process.argv.includes('--confirmar')) {
    throw new Error('Esta importación VACÍA las tablas de PostgreSQL antes de cargar. Vuelve a ejecutarla con `-- --confirmar`.');
  }
  const db = await mysql.createConnection(origen());
  const [existentes] = await db.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
  const enOrigen = new Set((existentes as Fila[]).map((f) => texto(f.t)));

  const nombres = tablas.map((t) => `"${t.nombre}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${nombres} RESTART IDENTITY CASCADE`);

  const resumen: Array<{ tabla: string; origen: number; destino: number; ok: string }> = [];
  for (const t of tablas) {
    if (!enOrigen.has(t.nombre)) {
      resumen.push({ tabla: t.nombre, origen: 0, destino: 0, ok: 'no existe en origen' });
      continue;
    }
    const r = await importar(db, t);
    resumen.push({ tabla: t.nombre, ...r, ok: r.origen === r.destino ? 'sí' : 'REVISAR' });
  }

  // Secuencias: el siguiente id debe continuar tras el máximo importado
  // (crítico en `transacciones`: su numeración la usa el XML externo).
  for (const t of tablas) {
    if (t.pk === null) continue;
    await prisma.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t.nombre}"', '${t.pk}'), GREATEST((SELECT COALESCE(MAX("${t.pk}"), 0) FROM "${t.nombre}"), 1))`,
    );
  }
  await db.end();

  console.table(resumen);
  if (Object.keys(avisos).length > 0) console.table(avisos);
  const max = await prisma.transaccion.aggregate({ _max: { id_transaccion: true } });
  console.log(`Última transacción XML: ${max._max.id_transaccion ?? 0}`);
  if (resumen.some((r) => r.ok === 'REVISAR')) process.exitCode = 1;
}

main()
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
