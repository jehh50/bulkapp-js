/**
 * Configuración validada. Si falta o es inválida una variable, la API no arranca.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const API_ROOT = path.resolve(import.meta.dirname, '../..');

const archivoEnv = path.join(API_ROOT, '.env');
if (existsSync(archivoEnv)) process.loadEnvFile(archivoEnv);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  APP_TZ: z.string().min(1).default('America/Caracas'),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.coerce.number().int().min(60).max(3600).default(900),
  SESSION_IDLE_TIMEOUT: z.coerce.number().int().default(1800),
  CORS_ORIGIN: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  STORAGE_DIR: z.string().default('../../storage'),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Configuración inválida (.env): ${detalle}`);
}

const datos = resultado.data;

export const env = {
  ...datos,
  esProduccion: datos.NODE_ENV === 'production',
  /** Timeout de sesión por inactividad (mínimo 300 s, igual que en PHP). */
  SESSION_IDLE_TIMEOUT: Math.max(300, datos.SESSION_IDLE_TIMEOUT),
  storageDir: path.resolve(API_ROOT, datos.STORAGE_DIR),
  webDist: path.resolve(API_ROOT, '../web/dist'),
};
