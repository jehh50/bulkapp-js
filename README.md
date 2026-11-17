# BulkApp

CRM / call center: captura de gestiones y ventas, formularios dinámicos por campaña,
reportes y generación del XML de ventas.

API en Node.js 24 + TypeScript (Express, Prisma, PostgreSQL, JWT) y web en React +
Material UI.

```bash
nvm use
npm install
cp apps/api/.env.example apps/api/.env
npm run db:migrate
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

Documentación:

- [`docs/implementacion.md`](docs/implementacion.md) — estructura, puesta en marcha, autenticación y decisiones.
- [`docs/nodejs-react.md`](docs/nodejs-react.md) — reglas de negocio y guía de migración desde la aplicación PHP.
- [`docs/esquema-actual.sql`](docs/esquema-actual.sql) — esquema MySQL de origen.
- [`AGENTS.md`](AGENTS.md) — reglas para trabajar en el código.
