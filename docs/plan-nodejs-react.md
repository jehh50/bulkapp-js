# Plan de ejecución — Migración a Node.js + React (PostgreSQL)

**Ubicación de la migración:** `/var/www/html/bulkapp-js` (nuevo proyecto). La carpeta `/var/www/html/bulkapp` queda como **legacy (PHP)** y no se modifica durante la migración.
**Fuente funcional:** `/var/www/html/bulkapp/docs/migracion/nodejs-react.md` y `esquema-actual.sql` (solo lectura).
**Estado:** borrador para aprobación. Ninguna fase se ha iniciado.

---

## 0. Supuestos y decisiones previas

Tomo como válidas las recomendaciones de la guía salvo donde se indica. Cada una se puede revertir antes de la Fase 0.

| Tema | Supuesto adoptado | Origen |
|------|-------------------|--------|
| Lenguaje | TypeScript en API y web | §11, pregunta 7 (recomendado) |
| Monorepo | pnpm workspaces: `apps/api`, `apps/web`, `packages/shared` | §7 |
| API | Fastify (alternativa: Express). Decidir en Fase 0 y no cambiar después. | §2, §7 |
| Acceso a datos | `pg` + Drizzle ORM (o Knex). Placeholders `$1, $2…`, nunca concatenar. | §3.3, §5.5 |
| Frontend | React + Vite + React Router + TanStack Query + React Hook Form + Zod | §7 |
| Migración de datos | `pgloader` + script SQL versionado con las correcciones de §5.6 | §5.6 |
| Colas | BullMQ + Redis para exportaciones y cargas | §4.4, §10 |

### 0.1 Preguntas abiertas que bloquean fases

| # | Pregunta (§11) | Bloquea | Plazo recomendado |
|---|----------------|---------|-------------------|
| 6 | ¿Se requiere auditoría de clientes y gestiones? | Esquema de Fase 0 (triggers/tablas de auditoría) | **Antes de Fase 0** |
| 3 | ¿Dónde se despliega (VPS, contenedores, PaaS) y con qué versión de Node/PostgreSQL? | Infra y CI; no bloquea el desarrollo local | Antes de Fase 6 |
| 5 | ¿SSO o usuario/contraseña local? | Fase 1 (auth) | Antes de Fase 1 |
| 1 | ¿Se desactiva la carga anterior de clientes bancarios al importar? | Fase 5 | Antes de Fase 5 |
| 2 | ¿Hay consumidores externos de la secuencia de `transacciones`? | Fase 4 (XML) | Antes de Fase 4 |
| 4 | ¿Asterisk/Elastix se mantiene en el mismo servidor? | Servicio de telefonía (§8) | Antes de Fase 5 |

---

## 1. Hallazgos que cambian el alcance

1. **Conteos desactualizados.** §5.1 usa datos del 2026-11-03. Después se eliminaron usuarios (2026-11-04, se conservó solo el administrador) y la campaña 2. La Fase 0 debe **recontar** cada tabla en origen y usar esos conteos como referencia, no los de la guía.
2. **Migraciones fuera del DDL.** `20261105_constructor_expresiones.sql` (catálogo `formulario_expresiones`) no está en `esquema-actual.sql`. El esquema destino debe incluirla.
3. **Inconsistencia en campañas.** §1.1 dice «3 campañas», pero §5.1 indica 4 filas en `servicios`. Verificar en origen antes de fijar los datos semilla.
4. **Huérfanos de usuario.** Tras eliminar usuarios, `gestion.user_id` tiene 61 112 de 61 124 referencias huérfanas. No se pueden declarar FKs sobre `gestion.user_id` sin una decisión explícita (conservar la columna sin FK, o archivar esas gestiones).
5. **Integridad sin FKs.** `gestion`, `resultados` y `clientes` no tienen FKs. La limpieza de huérfanos (§5.6, punto 10) es prerrequisito de la carga final, no un paso opcional.

---

## 2. Fases

Cada fase termina con un criterio de salida verificable. No se avanza a la siguiente sin cumplirlo.

### Fase 0 — Base, datos y entorno

**Entregables**
- Monorepo pnpm con `apps/api`, `apps/web`, `packages/shared`; TypeScript estricto; lint y formato.
- API con `GET /health` y configuración validada con Zod (falla al arrancar si falta una variable).
- PostgreSQL nuevo (local con Docker para desarrollo) y migraciones versionadas.
- Script SQL con las correcciones de §5.6 (puntos 1 a 11), más las tablas de `20261105_constructor_expresiones.sql`.
- Carga con `pgloader` desde una **copia** de la BD MySQL, con reglas de conversión de §5.5.
- Ajuste de secuencias: `transacciones.id_transaccion` a 6 104 710 o al máximo real.
- Decisión sobre auditoría (pregunta 6) reflejada en el esquema.

**Criterio de salida**
- Conteos por tabla iguales entre MySQL y PostgreSQL (recontados, ver §1).
- Totales de control iguales: ventas por mes, gestiones por usuario y por día.
- Ninguna fecha cero, ningún `cedula` con ceros perdidos, ningún `servicio_id` no numérico.

### Fase 1 — Dominio y seguridad

**Entregables**
- `packages/shared`: constantes (`USUARIO_*`, `ESTADO_*`, `SERVICIO_*`, flujos) y esquemas Zod reutilizados por API y web.
- Login con `argon2` o `bcrypt`; rehash automático de hashes MD5 en el primer inicio de sesión correcto. El MD5 de Elastix se mantiene solo para el protocolo ECCP.
- Middleware `requireAuth`, `requireRole(...)`, `requireCampana` y CSRF.
- Sesión por cookie `httpOnly`, `secure`, `SameSite=Lax`, con timeout de inactividad de 1 800 s (mínimo 300 s).
- Cambio de campaña activa y filtro por campaña en todas las consultas.
- `helmet`, `express-rate-limit` y middleware global de errores (log completo, mensaje genérico al cliente).
- Logging con `pino` y `request_id`.

**Criterio de salida**
- Pruebas de §4.5 pasan (usuario inactivo rechazado, rehash MD5, timeout, cambio de campaña).
- Las 5 reglas de oro de §2 se cumplen y tienen prueba cuando aplique.

### Fase 2 — Captura bancaria (campañas 1 y 5)

**Entregables**
- `GET /api/v1/clientes` por cédula o teléfono, con búsqueda insensible (`lower` o `ILIKE`) y prueba con casos reales.
- Catálogos cacheables (ciudades, municipios, estados, subcontactos, productos) con la campaña base `servicioBase()`.
- `POST /api/v1/gestiones` con una sola transacción:
  1. Validación de campos base y de venta (tabla de §4.1).
  2. `UPDATE clientes SET status_id = $1 WHERE id = $2 AND status_id <> 7 RETURNING id` (guardia de idempotencia).
  3. Si no hay fila afectada, se termina sin insertar nada más.
  4. Inserción en `gestion` y, si es venta, en `resultados`.
- Pantalla `CapturaBancariaPage` con React Hook Form + Zod.
- Formulario bancario **sin cambios de flujo** (regla de producto).

**Criterio de salida**
- Paridad con PHP en casos reales: mismo `status_id` final, misma fila en `gestion` y `resultados`.
- Prueba de doble envío: la segunda petición no duplica la venta.
- Pruebas E2E de captura con Playwright.

### Fase 3 — Constructor y captura dinámica

**Entregables**
- Definiciones y versiones de formularios en `jsonb`, con una sola versión `vigente`.
- Asignación formulario ↔ campaña (`formulario_servicios`).
- Borrado lógico de formularios (`eliminado`, `eliminado_en`).
- Cargas CSV/XLSX con mapping; parser en `services/cargaParser.ts`; una sola carga `vigente` por formulario.
- Envíos con `UNIQUE (fila_id)`, `valores` y `registro` en `jsonb`.
- Catálogo `formulario_expresiones` (5 validaciones: correo, solo números, solo letras, mayúsculas, teléfono). Sus patrones no llevan barras invertidas, por lo que funcionan igual en PostgreSQL (`~`) y en JS.
- Reporte de formularios con filtros de fecha, paginación (10/25/50/100), sin ordenamiento (decisión de producto) y exportación `.xlsx` con `exceljs` en streaming, por tandas de 1 000.

**Criterio de salida**
- Un formulario versionado conserva las capturas de su versión original.
- Una fila de carga no puede capturarse dos veces (prueba de concurrencia).
- Exportación con dos hojas (`Registros`, `Filtros`) y fechas Excel con hora completa.

### Fase 4 — Reportes, dashboard y XML

**Prerrequisito:** respuesta a la pregunta 2 (consumidores de `transacciones`).

**Entregables**
- Reportes: acumulado, productividad por producto, ventas, ventas por estado, detalle de ventas (§4.3).
- Dashboard del mes.
- Generación de XML y XSD con `transacciones` y la secuencia restaurada.

**Criterio de salida**
- Para cada reporte, la cifra de Node y la de PHP coinciden en el mismo rango de fechas (criterio de paridad de §9).
- El siguiente número de transacción XML es el esperado y no colisiona.

### Fase 5 — Cargas masivas, administración y telefonía

**Prerrequisito:** respuestas a las preguntas 1 y 4.

**Entregables**
- Importación de clientes bancarios como job en BullMQ, en lotes de 1 000 filas, con límite de 10 MB.
- Límite de 20 MB para cargas de formularios.
- ABM de empresas, campañas y campañas por usuario (solo Administrador).
- ABM de usuarios y cambio de contraseña (Supervisor+).
- ABM de productos.
- Servicio aparte `services/telefonia` para AMI y ECCP, separado de las rutas HTTP (§8).

**Criterio de salida**
- Importación de un lote real termina con conteos esperados y sin bloquear la API.
- Las exportaciones y cargas pueden cancelarse o reintentarse sin duplicar filas.

### Fase 6 — Retiro de PHP

**Entregables**
- Plan de corte: despliegue, ventana de cambio, procedimiento de regreso (rollback) a PHP.
- Apagado de PHP solo después de verificar paridad en todos los módulos.

**Criterio de salida**
- Todos los criterios de paridad de las fases 2 a 5 cumplidos.
- Respaldo final de MySQL conservado en almacenamiento frío.

---

## 3. Calendario relativo

| Fase | Depende de | Puede correr en paralelo con |
|------|-----------|------------------------------|
| 0 | Pregunta 6 | — |
| 1 | Fase 0 | Frontend base (layout, login UI) |
| 2 | Fase 1 | Catálogos de Fase 0 |
| 3 | Fase 1 | Fase 2 (equipos distintos) |
| 4 | Fase 2 y 3, pregunta 2 | — |
| 5 | Fase 1, preguntas 1 y 4 | Fase 4 |
| 6 | Todas | — |

---

## 4. Riesgos y mitigación

| Riesgo | Mitigación |
|--------|-----------|
| Pérdida de datos en la conversión de tipos | Ensayo con copia de la BD; conteos y totales de control en cada ensayo |
| Cambio de colación (búsqueda por cédula/teléfono) | Búsqueda normalizada y pruebas con casos reales |
| Doble venta por reenvío | Guardia `status_id <> 7` dentro de transacción; prueba de doble envío |
| Colisión de números XML | Restaurar secuencia antes de reactivar XML |
| Exposición de `private/` en staging | Ver `/var/www/html/bulkapp/docs/pentest-sqli-2026-11-02.md` (H1). En Node solo se sirven `dist/` y la API |
| Trabajo duplicado con PHP durante la migración | PHP congelado para módulos ya migrados; cambios de negocio se aplican en ambos mientras dure la paridad |

---

## 5. Primer paso propuesto

1. Responder la pregunta 6 (auditoría), porque afecta el esquema desde el inicio.
2. Recontar tablas en origen y resolver la inconsistencia de campañas (§1, puntos 1 y 3).
3. Crear el monorepo y el script de correcciones de §5.6 (Fase 0), sin tocar la BD MySQL.
