/**
 * Autenticación: login (con rehash de MD5 heredado), refresco, cambio de campaña,
 * cambio de contraseña y logout. Reglas en docs/nodejs-react.md §4.5.
 */
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  PASSWORD_MIN, PASSWORDS_PROHIBIDAS, REGISTRO, inputInt, inputString,
  type Rol, type SesionRespuesta, type UsuarioSesion,
} from '@bulkapp/shared';
import { env } from '../config/env.ts';
import { campanasDeUsuario, flujoDe } from '../lib/campanas.ts';
import { HttpError, invalido, logger, prisma } from '../lib/core.ts';
import {
  COOKIE_REFRESCO, firmarAcceso, firmarRefresco, hashPassword, huellaCoincide, necesitaRehash, opcionesCookie,
  verificarPassword, verificarRefresco,
} from '../lib/seguridad.ts';
import { requireAuth, sesionDe } from '../middleware/auth.ts';

interface UsuarioBd {
  id: number; username: string; nombre: string; apellido: string; password: string;
  usertype_id: number; status_id: number; servicio_id: number;
}

const SESION_EXPIRADA = () => new HttpError(401, 'Su sesión expiró. Vuelva a iniciar sesión.', { code: 'sesion_expirada' });

/** Emite el par de tokens y arma la respuesta de sesión para una campaña activa. */
async function abrirSesion(res: Response, user: UsuarioBd, servicioId: number): Promise<SesionRespuesta> {
  const [campanas, flujo] = await Promise.all([campanasDeUsuario(user.id), flujoDe(servicioId)]);
  if (flujo === null) throw new HttpError(409, 'El usuario no tiene una campaña válida asignada.');

  const usuario: UsuarioSesion = {
    id: user.id,
    username: user.username,
    nombre: user.nombre,
    apellido: user.apellido,
    rol: user.usertype_id as Rol,
    servicioId,
    tipoFlujo: flujo,
    campanas,
  };
  res.cookie(COOKIE_REFRESCO, firmarRefresco(user.id, servicioId, user.password), opcionesCookie());
  return {
    accessToken: firmarAcceso({ sub: user.id, rol: usuario.rol, sid: servicioId }),
    expiresIn: env.JWT_ACCESS_TTL,
    usuario,
  };
}

function cerrarSesion(res: Response): void {
  const { maxAge: _maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(COOKIE_REFRESCO, opciones);
}

/** Usuario activo dueño de un token de refresco vigente (o null). */
async function usuarioDeRefresco(req: Request): Promise<{ user: UsuarioBd; servicioId: number } | null> {
  const token: unknown = req.cookies?.[COOKIE_REFRESCO];
  const claims = typeof token === 'string' ? verificarRefresco(token) : null;
  if (!claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || user.status_id === REGISTRO.INACTIVO || !huellaCoincide(claims.pv, user.password)) return null;
  return { user, servicioId: claims.sid };
}

export const authRouter = Router();

const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.' },
});

authRouter.post('/login', limiteLogin, async (req, res) => {
  const username = inputString(req.body?.username, 50);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const base = { ip: req.ip, user_agent: req.get('user-agent') ?? '' };

  if (username === '' || password === '') {
    logger.warn({ event: 'auth.login_failed', reason: 'missing_credentials', username, ...base }, 'Intento de inicio de sesión incompleto');
    throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verificarPassword(password, user.password))) {
    logger.warn({ event: 'auth.login_failed', reason: 'invalid_credentials', username, user_id: user?.id, ...base }, 'Inicio de sesión fallido');
    throw new HttpError(401, 'Usuario o contraseña incorrectos.');
  }
  if (user.status_id === REGISTRO.INACTIVO) {
    logger.warn({ event: 'auth.login_failed', reason: 'disabled', user_id: user.id, username, ...base }, 'Inicio de sesión rechazado: usuario inactivo');
    throw new HttpError(403, 'Tu usuario está inactivo. Contacta a tu supervisor.', { code: 'usuario_inactivo' });
  }

  // Migración transparente del hash heredado. Si falla, el login continúa.
  if (necesitaRehash(user.password)) {
    try {
      user.password = await hashPassword(password);
      await prisma.user.update({ where: { id: user.id }, data: { password: user.password } });
      logger.info({ event: 'auth.password_rehash', user_id: user.id }, 'Hash de contraseña actualizado');
    } catch (e) {
      logger.warn({ event: 'auth.password_rehash_failed', user_id: user.id, err: e }, 'No se pudo migrar el hash de contraseña');
    }
  }

  const sesion = await abrirSesion(res, user, user.servicio_id);
  logger.info({ event: 'auth.login_success', user_id: user.id, username, usertype_id: user.usertype_id, servicio_id: user.servicio_id, ...base }, 'Inicio de sesión exitoso');
  res.json(sesion);
});

/** Renueva los tokens. Cada refresco reinicia el timeout por inactividad. */
authRouter.post('/refresh', async (req, res) => {
  const actual = await usuarioDeRefresco(req);
  if (!actual) {
    cerrarSesion(res);
    throw SESION_EXPIRADA();
  }
  res.json(await abrirSesion(res, actual.user, actual.servicioId));
});

authRouter.post('/logout', async (req, res) => {
  const actual = await usuarioDeRefresco(req);
  cerrarSesion(res);
  if (actual) logger.info({ event: 'auth.logout', user_id: actual.user.id, username: actual.user.username }, 'Cierre de sesión');
  res.status(204).end();
});

/** Cambia la campaña activa entre las asignadas al usuario. */
authRouter.post('/campana', requireAuth, async (req, res) => {
  const sesion = sesionDe(req);
  const actual = await usuarioDeRefresco(req);
  if (!actual || actual.user.id !== sesion.userId) throw SESION_EXPIRADA();

  const destino = inputInt(req.body?.servicio_id, 1);
  const permitidas = (await campanasDeUsuario(sesion.userId)).map((c) => c.id);
  if (destino === null || !permitidas.includes(destino)) {
    logger.warn({ event: 'auth.campana_rechazada', user_id: sesion.userId, servicio_id: destino }, 'Cambio de campaña rechazado');
    throw new HttpError(403, 'No tienes asignada esa campaña.');
  }
  logger.info({ event: 'auth.campana_cambiada', user_id: sesion.userId, desde: sesion.servicioId, hacia: destino }, 'Cambio de campaña');
  res.json(await abrirSesion(res, actual.user, destino));
});

/** Cambio de la contraseña propia. Cierra la sesión: hay que volver a entrar. */
authRouter.post('/password', requireAuth, async (req, res) => {
  const sesion = sesionDe(req);
  const actual = typeof req.body?.actual === 'string' ? req.body.actual : '';
  const nueva = typeof req.body?.nueva === 'string' ? req.body.nueva : '';
  const confirmacion = typeof req.body?.confirmacion === 'string' ? req.body.confirmacion : '';

  const user = await prisma.user.findUnique({ where: { id: sesion.userId } });
  if (!user) throw SESION_EXPIRADA();
  if (!(await verificarPassword(actual, user.password))) throw invalido('La contraseña actual no es correcta.', { errores: { actual: 'Contraseña incorrecta.' } });
  if (nueva.length < PASSWORD_MIN) throw invalido(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`, { errores: { nueva: 'Demasiado corta.' } });
  if (nueva !== confirmacion) throw invalido('Las contraseñas no coinciden.', { errores: { confirmacion: 'No coincide.' } });
  if (PASSWORDS_PROHIBIDAS.includes(nueva)) throw invalido('Elige una contraseña menos predecible.', { errores: { nueva: 'Contraseña no permitida.' } });

  await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(nueva) } });
  logger.info({ event: 'auth.password_changed', user_id: user.id }, 'Contraseña actualizada por el usuario');
  cerrarSesion(res);
  res.status(204).end();
});
