/**
 * Guardas de acceso: sesión (JWT), rol y flujo de la campaña activa.
 */
import type { NextFunction, Request, Response } from 'express';
import { FLUJO, type Flujo, type Rol } from '@bulkapp/shared';
import { flujoDe } from '../lib/campanas.ts';
import { HttpError, logger } from '../lib/core.ts';
import { verificarAcceso } from '../lib/seguridad.ts';

export interface Sesion {
  userId: number;
  rol: Rol;
  /** Campaña activa. */
  servicioId: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sesion?: Sesion;
    }
  }
}

/** Sesión de una petición ya autenticada. */
export function sesionDe(req: Request): Sesion {
  if (!req.sesion) throw new HttpError(401, 'Su sesión expiró. Vuelva a iniciar sesión.', { code: 'sesion_expirada' });
  return req.sesion;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const cabecera = req.get('authorization') ?? '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
  const claims = token ? verificarAcceso(token) : null;
  if (!claims) {
    next(new HttpError(401, 'Su sesión expiró. Vuelva a iniciar sesión.', { code: 'sesion_expirada' }));
    return;
  }
  req.sesion = { userId: claims.sub, rol: claims.rol, servicioId: claims.sid };
  next();
}

export function requireRole(roles: readonly Rol[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const sesion = sesionDe(req);
    if (roles.includes(sesion.rol)) {
      next();
      return;
    }
    logger.warn({ event: 'security.access_denied', user_id: sesion.userId, rol: sesion.rol, ruta: req.originalUrl }, 'Acceso denegado por rol');
    next(new HttpError(403, 'No tienes acceso a esta sección.', { code: 'sin_permiso' }));
  };
}

/** Exige que la campaña activa use el flujo indicado (bancario o dinámico). */
export function requireFlujo(flujo: Flujo) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const actual = await flujoDe(sesionDe(req).servicioId);
    if (actual === flujo) {
      next();
      return;
    }
    const destino = flujo === FLUJO.BANCARIO ? 'bancario' : 'de formulario dinámico';
    next(new HttpError(409, `Tu campaña activa no usa el flujo ${destino}.`, { code: 'flujo_incorrecto' }));
  };
}
