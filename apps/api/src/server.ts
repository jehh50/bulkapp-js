import { crearApp } from './app.ts';
import { env } from './config/env.ts';
import { logger, prisma } from './lib/core.ts';

const servidor = crearApp().listen(env.PORT, () => {
  logger.info({ event: 'app.inicio', puerto: env.PORT, entorno: env.NODE_ENV }, `API de BulkApp en http://localhost:${env.PORT}`);
});

function cerrar(senal: string): void {
  logger.info({ event: 'app.cierre', senal }, 'Cerrando la API');
  servidor.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => cerrar('SIGTERM'));
process.on('SIGINT', () => cerrar('SIGINT'));
