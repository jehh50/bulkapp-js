/**
 * Aplicación Express: cabeceras de seguridad, request_id, rutas /api/v1 con sus
 * guardas por rol, 404 JSON, manejador global de errores y la web compilada.
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler, type Request, type Response } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { Prisma } from '@prisma/client';
import { ROLES, ROLES_ADMIN, ROLES_SUPERVISION } from '@bulkapp/shared';
import { env } from './config/env.ts';
import { HttpError, contexto, logger, prisma } from './lib/core.ts';
import { requireAuth, requireRole } from './middleware/auth.ts';
import { administracionRouter } from './modules/administracion.ts';
import { authRouter } from './modules/auth.ts';
import { bancarioRouter } from './modules/bancario.ts';
import { capturaRouter } from './modules/captura.ts';
import { constructorRouter } from './modules/constructor.ts';
import { empresasRouter } from './modules/empresas.ts';
import { reportesRouter } from './modules/reportes.ts';
import { xmlRouter } from './modules/xml.ts';

const MENSAJE_GENERICO = 'Ocurrió un error inesperado. Intenta de nuevo.';

/** Log completo en servidor; al cliente solo los errores controlados (HttpError). */
const manejarErrores: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  if (res.headersSent) {
    logger.error({ err, ruta: req.originalUrl }, 'Error después de enviar cabeceras');
    res.end();
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, ...err.extra });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'El cuerpo de la petición no es JSON válido.' });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ message: 'Ya existe un registro con esos datos.' });
    return;
  }
  logger.error({ err, ruta: req.originalUrl, metodo: req.method, user_id: req.sesion?.userId }, 'Error no controlado');
  res.status(500).json({ message: MENSAJE_GENERICO });
};

export function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    contexto.run({ requestId }, next);
  });
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => !req.url?.startsWith('/api/') } }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"], fontSrc: ["'self'", 'data:'], frameAncestors: ["'self'"],
        // Solo con HTTPS (producción): en HTTP local rompería la carga de los recursos.
        upgradeInsecureRequests: env.esProduccion ? [] : null,
      },
    },
    hsts: env.esProduccion,
    referrerPolicy: { policy: 'same-origin' },
  }));

  // En desarrollo la web corre en Vite (otro origen): CORS acotado a ese origen.
  if (env.CORS_ORIGIN !== '') {
    app.use((req, res, next) => {
      if (req.get('origin') === env.CORS_ORIGIN) {
        res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('Vary', 'Origin');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use('/auth', authRouter);
  api.use(requireAuth);
  api.use('/bancario', requireRole(ROLES), bancarioRouter);
  api.use('/captura', requireRole(ROLES), capturaRouter);
  api.use('/reportes', requireRole(ROLES_SUPERVISION), reportesRouter);
  api.use('/xml', requireRole(ROLES_SUPERVISION), xmlRouter);
  api.use('/admin', requireRole(ROLES_SUPERVISION), administracionRouter);
  api.use('/constructor', requireRole(ROLES_ADMIN), constructorRouter);
  api.use('/organizacion', requireRole(ROLES_ADMIN), empresasRouter);
  app.use('/api/v1', api);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'Recurso no encontrado.' });
  });

  // Producción: la API sirve solo la web compilada (dist) y nada más del repositorio.
  if (existsSync(path.join(env.webDist, 'index.html'))) {
    app.use(express.static(env.webDist, { index: false, maxAge: '1y', immutable: true }));
    app.get('/{*ruta}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(env.webDist, 'index.html'));
    });
  }

  app.use(manejarErrores);
  return app;
}
