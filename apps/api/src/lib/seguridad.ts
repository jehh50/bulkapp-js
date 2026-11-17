/**
 * Contraseñas y tokens JWT.
 *
 * - Token de acceso: vida corta (JWT_ACCESS_TTL), viaja en `Authorization: Bearer`.
 *   Lleva usuario, rol y campaña activa.
 * - Token de refresco: cookie httpOnly + SameSite=Strict limitada a /api/v1/auth.
 *   Vive SESSION_IDLE_TIMEOUT y se renueva en cada refresco, así que equivale al
 *   timeout por inactividad de la sesión PHP. Incluye una huella del hash de la
 *   contraseña: cambiarla invalida las sesiones abiertas.
 */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { CookieOptions } from 'express';
import type { Rol } from '@bulkapp/shared';
import { env } from '../config/env.ts';

const BCRYPT_COSTO = 12;
const MD5 = /^[a-f0-9]{32}$/i;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_COSTO);

/** Verifica contra bcrypt (`password_hash()` de PHP) o contra el MD5 heredado. */
export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  if (password === '' || hash === '') return false;
  if (MD5.test(hash)) {
    const calculado = Buffer.from(createHash('md5').update(password).digest('hex'));
    const guardado = Buffer.from(hash.toLowerCase());
    return calculado.length === guardado.length && timingSafeEqual(calculado, guardado);
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/** Los hashes MD5 heredados (o con costo menor) se reemplazan tras un login correcto. */
export function necesitaRehash(hash: string): boolean {
  if (MD5.test(hash) || hash === '') return true;
  try {
    return bcrypt.getRounds(hash) < BCRYPT_COSTO - 2;
  } catch {
    return true;
  }
}

export function passwordAleatoria(largo = 14): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let out = '';
  for (let i = 0; i < largo; i++) out += alfabeto[randomInt(alfabeto.length)];
  return out;
}

const huella = (hash: string): string => createHash('sha256').update(hash).digest('hex').slice(0, 16);

export interface ClaimsAcceso { sub: number; rol: Rol; sid: number }
export interface ClaimsRefresco { sub: number; sid: number; pv: string }

export function firmarAcceso(claims: ClaimsAcceso): string {
  return jwt.sign({ rol: claims.rol, sid: claims.sid, typ: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: String(claims.sub), expiresIn: env.JWT_ACCESS_TTL, algorithm: 'HS256',
  });
}

export function firmarRefresco(userId: number, servicioId: number, passwordHash: string): string {
  return jwt.sign({ sid: servicioId, pv: huella(passwordHash), typ: 'refresh' }, env.JWT_REFRESH_SECRET, {
    subject: String(userId), expiresIn: env.SESSION_IDLE_TIMEOUT, algorithm: 'HS256',
  });
}

function verificar(token: string, secreto: string, tipo: string): jwt.JwtPayload | null {
  try {
    const payload = jwt.verify(token, secreto, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || payload.typ !== tipo) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verificarAcceso(token: string): ClaimsAcceso | null {
  const p = verificar(token, env.JWT_ACCESS_SECRET, 'access');
  const sub = Number(p?.sub);
  if (!p || !Number.isInteger(sub) || !Number.isInteger(p.sid) || !Number.isInteger(p.rol)) return null;
  return { sub, rol: p.rol as Rol, sid: p.sid as number };
}

export function verificarRefresco(token: string): ClaimsRefresco | null {
  const p = verificar(token, env.JWT_REFRESH_SECRET, 'refresh');
  const sub = Number(p?.sub);
  if (!p || !Number.isInteger(sub) || !Number.isInteger(p.sid) || typeof p.pv !== 'string') return null;
  return { sub, sid: p.sid as number, pv: p.pv };
}

export const huellaCoincide = (pv: string, passwordHash: string): boolean => pv === huella(passwordHash);

export const COOKIE_REFRESCO = 'bulkapp_rt';
export const RUTA_COOKIE = '/api/v1/auth';

export function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.esProduccion,
    sameSite: 'strict',
    path: RUTA_COOKIE,
    maxAge: env.SESSION_IDLE_TIMEOUT * 1000,
  };
}
