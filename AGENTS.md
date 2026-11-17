# AGENTS.md — BulkApp (Node.js + React)

Monorepo npm workspaces: `packages/shared`, `apps/api`, `apps/web`. Leer antes
[`docs/implementacion.md`](docs/implementacion.md) y, para reglas de negocio,
[`docs/nodejs-react.md`](docs/nodejs-react.md).

## Comandos

```bash
npm run typecheck   # tipos (shared, api, web)
npm test            # pruebas unitarias (node --test)
npm run build       # compila la web
npm run dev:api     # API en :4000
npm run dev:web     # web en :5173
```

Requiere Node 24 (`nvm use`).

## Reglas de oro

- **No** concatenar entrada de usuario en SQL: Prisma, o `Prisma.sql` con parámetros.
  En SQL crudo las fechas llevan conversión explícita: `${fecha}::date`.
- **No** dejar `console.log()` en la aplicación: usar `logger` (pino).
- **No** escribir literales de negocio: usar `packages/shared/src/constants.ts`.
- Toda entrada (`req.body`, `req.query`, `req.params`) se valida en el servidor con los
  helpers `input*` y los validadores de `packages/shared`. La validación de la web es
  solo una ayuda.
- Errores: lanzar `HttpError` (`invalido`, `noEncontrado`) para lo que el usuario debe
  leer; lo demás lo registra el manejador global y responde un mensaje genérico.
- La campaña activa sale del token (`sesionDe(req).servicioId`), nunca del cliente.
- Los permisos se imponen en la API (`requireRole`, `requireFlujo`); la web los refleja.
- La API corre TypeScript nativo: imports con extensión `.ts`, `import type` para tipos,
  sin `enum` ni parameter properties.
- Web: Material UI 7 y TanStack Query; una pantalla por archivo en `src/features`.
- Los secretos viven solo en `apps/api/.env` (no versionado).
