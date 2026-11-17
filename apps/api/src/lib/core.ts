/**
 * Servicios transversales: Prisma, logger con request_id, errores HTTP y fechas
 * en la zona horaria de negocio.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { env } from '../config/env.ts';

export const prisma = new PrismaClient();

/** Contexto por petición: el logger añade `request_id` a cada línea. */
export const contexto = new AsyncLocalStorage<{ requestId: string }>();

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  mixin: () => {
    const ctx = contexto.getStore();
    return ctx ? { request_id: ctx.requestId } : {};
  },
  redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'pass'],
});

/** Error controlado: su mensaje sí se muestra al cliente. */
export class HttpError extends Error {
  status: number;
  extra: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const noEncontrado = (mensaje = 'Recurso no encontrado.') => new HttpError(404, mensaje);
export const invalido = (mensaje: string, extra: Record<string, unknown> = {}) => new HttpError(422, mensaje, extra);

// --- Fechas -----------------------------------------------------------------

const fmtFecha = new Intl.DateTimeFormat('en-CA', { timeZone: env.APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: env.APP_TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

/** Fecha de hoy (`AAAA-MM-DD`) en la zona horaria de negocio. */
export const hoy = (instante = new Date()): string => fmtFecha.format(instante);
/** Hora actual (`HH:mm:ss`) en la zona horaria de negocio. */
export const horaActual = (instante = new Date()): string => fmtHora.format(instante);

/** `AAAA-MM-DD` → Date para una columna `date`. */
export const aFechaDb = (fecha: string): Date => new Date(`${fecha}T00:00:00Z`);
/** `HH:mm:ss` → Date para una columna `time`. */
export const aHoraDb = (hora: string): Date => new Date(`1970-01-01T${hora}Z`);
/** Columna `date` → `AAAA-MM-DD`. */
export const deFechaDb = (fecha: Date | null | undefined): string => (fecha ? fecha.toISOString().slice(0, 10) : '');
/** `AAAA-MM-DD` → `AAAAMMDD` (formato del XML). */
export const compacta = (fecha: string): string => fecha.replaceAll('-', '');
/** `AAAA-MM-DD` → `dd/mm/aaaa`. */
export const fechaLarga = (fecha: string): string => fecha.split('-').reverse().join('/');

/** Suma meses a una fecha `AAAA-MM-DD` (desborda como `DateTime::modify('+1 month')`). */
export function sumarMeses(fecha: string, meses: number): string {
  const d = aFechaDb(fecha);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return deFechaDb(d);
}

/** Último día del mes de `AAAA-MM`. */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return deFechaDb(new Date(Date.UTC(a!, m!, 0)));
}
