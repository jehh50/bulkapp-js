# BulkApp 2 — implementación Node.js + React

Implementación de la guía [`nodejs-react.md`](nodejs-react.md). Proyecto independiente de
la aplicación PHP original (`bulkapp`): no comparten archivos; solo la base MySQL de
aquella sirve de origen para la importación inicial de datos.

## Stack

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 24 (`.nvmrc`). La API ejecuta TypeScript de forma nativa: sin paso de compilación. |
| API | Express 5, Prisma 6 (PostgreSQL), JWT (`jsonwebtoken`), zod, pino, helmet, multer, exceljs |
| Web | React 19, Vite 7, Material UI 7 (+ MUI X Charts), React Router 7, TanStack Query 5 |
| Pruebas | `node --test` |

## Estructura (npm workspaces)

```
packages/shared/   Constantes de negocio, saneamiento (input*) y validación pura.
                   La usan la API (siempre) y la web (como ayuda al usuario).
apps/api/          API REST bajo /api/v1.
  prisma/          schema.prisma, migraciones y seed.
  scripts/         importar-mysql.ts (MySQL → PostgreSQL).
  src/modules/     auth, bancario, captura, constructor, empresas, reportes, xml, administracion.
apps/web/          SPA React + Material UI.
  src/features/    Una pantalla por archivo.
  src/shared/      Cliente HTTP, sesión, componentes comunes.
```

## Puesta en marcha

```bash
nvm use                                  # Node 24
npm install
cp apps/api/.env.example apps/api/.env   # DATABASE_URL, secretos JWT y MYSQL_* (origen)
npm run db:migrate                       # crea el esquema en PostgreSQL

# Datos: una de las dos
npm run db:importar-mysql -- --confirmar # copia la BD MySQL actual (VACÍA el destino)
SEED_ADMIN_PASSWORD='...' npm run db:seed # base nueva: catálogos + usuario «admin»

npm run dev:api                          # API en http://localhost:4000
npm run dev:web                          # web en http://localhost:5173 (proxy de /api)
```

Producción: `npm run build` y `npm start`. La API sirve la web compilada
(`apps/web/dist`) y nada más del repositorio.

```bash
npm run typecheck   # tipos de los tres paquetes
npm test            # pruebas unitarias
```

## Autenticación (JWT)

- **Token de acceso** (15 min, `Authorization: Bearer`): usuario, rol y campaña activa.
  La web lo guarda solo en memoria.
- **Token de refresco**: cookie `httpOnly`, `SameSite=Strict`, limitada a `/api/v1/auth`.
  Se rota en cada renovación y vive `SESSION_IDLE_TIMEOUT` segundos: con actividad la
  sesión continúa; sin ella, caduca.
- Cambiar o reiniciar la contraseña invalida los tokens de refresco existentes.
- Las contraseñas MD5 heredadas se aceptan una vez y se regeneran con bcrypt al entrar;
  los hashes `$2y$` de PHP funcionan sin cambios.
- La campaña activa viaja en el token: la API nunca confía en un `servicio_id` de sesión
  enviado por el cliente. Cambiar de campaña emite tokens nuevos.

## Permisos

| Rol | Acceso |
|-----|--------|
| Operador | Captura (bancaria o dinámica, según la campaña activa) |
| Supervisor | + dashboard, reportes, XML, usuarios, productos, clientes y ventas |
| Administrador | + empresas y campañas, Constructor |

Las guardas están en la API (`requireRole`, `requireFlujo`); el menú y las rutas de la
web solo las reflejan.

## Decisiones y diferencias con PHP

- **Esquema** (§5.6 de la guía): `users.user` → `username`; `servicios."campo 2"` →
  `campo_2`; `gestion.subContacto_id/tipoGestion` → `subcontacto_id/tipo_gestion`;
  `gestion.servicio_id` entero; fechas de `resultados` como `date`; `DATETIME` →
  `timestamptz` (la hora de negocio es `APP_TZ`, por defecto America/Caracas); columnas
  JSON → `jsonb`; banderas → `boolean`. No se migran `carga_temporal_clientes`,
  `rechazo_ventas` ni las tablas de Cashea.
- **Sin claves foráneas** en `gestion`, `resultados` y `clientes`: los datos actuales
  tienen referencias huérfanas. Queda pendiente depurarlas y agregarlas.
- **XML**: los archivos se escriben en `storage/xml/<campaña>/` y se descargan por un
  endpoint autenticado (antes eran públicos). La numeración se reserva con bloqueo de
  tabla para que dos generaciones simultáneas no la repitan. Se conserva el
  comportamiento de PHP: la primera transacción del archivo reutiliza el último número
  registrado.
- **Cambio de contraseña**: ahora pide la contraseña actual.
- **Cargas y exportaciones** se procesan dentro de la petición, por lotes, sin cola de
  trabajos. Suficiente para los volúmenes actuales (10–20 MB); con archivos mayores
  convendría una cola.
- **Importación**: 6 ventas tienen una fecha de nacimiento ilegible en el origen y
  quedan en `NULL` (el script lo informa).
- **Telefonía** (Issabel / ViciDial) queda fuera: es un servicio aparte.

## Reglas que se mantienen

- Nada de SQL concatenado: Prisma, o `Prisma.sql` con parámetros en las consultas crudas.
  Las fechas en SQL crudo llevan conversión explícita (`${fecha}::date`).
- Sin literales de negocio: `packages/shared/src/constants.ts`.
- Toda entrada se valida en el servidor con los helpers `input*` y los validadores
  compartidos.
- Errores: log completo con `logger` (pino, con `request_id`); al cliente, un mensaje
  genérico o el de un `HttpError` controlado.
- Sin `console.log` en la aplicación: `logger`.
