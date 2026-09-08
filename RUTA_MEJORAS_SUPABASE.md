# Ruta de mejora y migración a Supabase

## Estado actual

- **Capa de Repositorios Dual-Engine implementada y activa:** Todas las rutas de Express (`auth`, `users`, `projects`, `reports`, `machines`, `issues`, `materials`, `stats`) y el planificador cron operan 100% desacopladas de SQLite mediante repositorios de negocio.
- **Soporte transparente:** Los repositorios operan consultando Supabase REST cuando las variables de entorno están activas (`SUPABASE_AUTH_ENABLED=true` y `SUPABASE_SERVICE_ROLE_KEY` configurada) o con respaldo SQLite local sin tiempo de caída.
- **Conmutador de Retiro de SQLite implementado:** Activando `DISABLE_SQLITE=true` en `.env`, el servidor omite por completo la inicialización y el auto-seeding de SQLite.
- **Respaldo de datos salvaguardado:** Script `server/db/export-backup.js` disponible para extraer copias de seguridad en JSON estructurado.
- **Portabilidad PostgreSQL estándar lista:** Módulo `server/db/postgres-connection.js` para conexión directa y migración a AWS RDS / Aurora vía `pg_dump`.

## Fases del Plan

### ✅ 1. Validar autenticación (Completado)
- [x] Probar login por PIN, usuario/contraseña y Telegram (`server/test_auth_flow.js`).
- [x] Confirmar que el JWT y `/api/auth/me` funcionan correctamente.
- [x] Aislar credenciales en `.env` local.

### ✅ 2. Crear una capa de repositorios (Completado)
- [x] Desacoplar rutas de llamadas SQL directas.
- [x] Crear repositorios: `userRepository`, `projectRepository`, `machineRepository`, `issueRepository`, `materialRepository`, `reportRepository` y `statsRepository`.
- [x] Definir una interfaz común para consultar y guardar datos (Dual-Engine: Supabase / SQLite).

### ✅ 3. Migrar proyectos y catálogos (Completado)
- [x] Migrar `projects.js`, `users.js` y catálogos hacia repositorios.
- [x] Estandarizar la devolución de objetos de negocio (`id` unificado).

### ✅ 4. Migrar reportes offline (Completado)
- [x] Conectar `/api/reports/sync` a `reportRepository`.
- [x] Conservar `client_uuid` como índice único para evitar duplicados en reenvíos.
- [x] Procesamiento transaccional de avances, cuadrillas, horómetros de maquinaria y fotos.

### ✅ 5. Migrar operación agrícola (Completado)
- [x] Predios, obras y relación obra–predio migrados a `projectRepository`.
- [x] Maquinaria, horas restantes y lecturas de horómetro migrados a `machineRepository`.
- [x] Incidencias con folios únicos y causa raíz estricta migradas a `issueRepository`.
- [x] Materiales, cálculo de déficit y recepciones migrados a `materialRepository`.

### ✅ 6. Migrar Telegram y cron (Completado)
- [x] Conectar `cron.js` (reclamo 21:00, tablero 21:30, alertas 08:00, reporte general 07:30) a repositorios.
- [x] Mantener `tg_thread_id` en obras y supergrupo de Telegram.
- [x] Validar ejecución exitosa de los 4 crons programados.

### ✅ 7. Migrar estadísticas y administración (Completado)
- [x] Reemplazar consultas agregadas de `stats.js` por `statsRepository`.
- [x] 4 widgets canónicos de supervisión y KPIs consolidados de dirección.

### ✅ 8. Retirar SQLite (Completado y Salvaguardado)
- [x] Script de respaldo y extracción de datos: `server/db/export-backup.js`.
- [x] Conmutador de entorno `DISABLE_SQLITE=true` en `server/index.js` para omitir SQLite y auto-seeding cuando se opere en la nube.
- [x] Generación de respaldos previa a cualquier acción destructiva.

### ✅ 9. Preparar Amazon PostgreSQL / Aurora (Completado)
- [x] Módulo `server/db/postgres-connection.js` para portabilidad estándar con `DATABASE_URL`.
- [x] Pautas de migración mediante `pg_dump` y `pg_restore` documentadas.
- [x] Código SQL estándar compatible sin dependencias propietarias exclusivas.

## Comandos útiles

```bash
# Exportar respaldo seguro de datos
node server/db/export-backup.js

# Validar suite de autenticación
node server/test_auth_flow.js

# Validar suite completa de endpoints y cron jobs
node server/test_http_endpoints.js

# Migrar datos a Supabase Cloud (cuando SUPABASE_SERVICE_ROLE_KEY esté configurada)
npm run migrate:supabase

# Compilar cliente y arrancar servidor
npm run client:build
npm start
```
