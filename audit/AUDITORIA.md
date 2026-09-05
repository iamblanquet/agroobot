# Auditoría de AGROKOOL — 5 de septiembre de 2026

Resultado original: 8 hallazgos, uno crítico. Auditoría del código local; no se verificó un despliegue de producción.

## Estado de corrección — 5 de septiembre de 2026

Los hallazgos se corrigieron en el árbol de trabajo: se retiró la exposición de PIN y el acceso offline que fabricaba sesiones; los reportes ahora validan referencias y se persisten en una transacción; Campo envía hito y tarea; las fechas operativas usan `TIMEZONE`; el umbral de mantenimiento es configurable; Telegram exige datos frescos; y la cola offline se sincroniza al recuperar conexión sin perder reportes fallidos. También se eliminó el inicio con una clave JWT predeterminada y el acceso Telegram sin token válido. Falta desplegar y rotar los PIN/credenciales que hubieran sido expuestos antes de estos cambios.

## Hallazgos priorizados

### 1. [P0] El catálogo público permite obtener acceso como administrador

**Ubicación:** `server/routes/auth.js:57–62`; autenticación con PIN en el mismo archivo, líneas 12–47.

`GET /api/auth/operators` no exige autenticación y devuelve los PIN de todos los usuarios activos, incluidos los de IT. Esos mismos PIN bastan para obtener un JWT de 30 días mediante `/pin-login`. Se reprodujo la cadena completa: consulta anónima, autenticación con el PIN recibido y acceso autorizado a `/api/users`.

**Corrección:** eliminar los PIN de la respuesta y del catálogo que se guarda en el navegador; diseñar la autenticación offline sin distribuir credenciales de terceros. Rotar los PIN si esta versión estuvo expuesta. Añadir límites de intentos al login.

### 2. [P1] Una sincronización fallida deja reportes incompletos que los reintentos dan por terminados

**Ubicación:** `server/routes/reports.js:54–67`, `:117–153`; `client/src/db/indexedDb.js`, función `syncPendingReports`.

La cabecera, líneas, avance y lecturas se escriben por separado, sin transacción. Se reprodujo un reporte con avance válido y una máquina inexistente: devuelve HTTP 500 después de guardar la cabecera y el avance. El reintento con el mismo UUID devuelve `ignored`, aunque faltan las lecturas. El cliente elimina de IndexedDB los resultados `ignored`, perdiendo el contenido pendiente de recuperar.

**Corrección:** validar referencias y estructura antes de escribir; guardar cada reporte completo y su avance de forma atómica. Resolver concurrencia/idempotencia dentro de la operación de persistencia. El wrapper actual de transacciones usa una sola conexión: debe coordinar las solicitudes concurrentes antes de utilizarse en rutas.

### 3. [P1] Captura de campo no vincula el reporte con la tarea seleccionada

**Ubicación:** `client/src/views/CampoView.jsx:252–295`; `server/routes/reports.js:117`.

La UI permite elegir hito y tarea, pero `reportPayload` omite `hito_id` y `tarea_id`. El backend actualiza `cantidad_acumulada` únicamente cuando recibe `tarea_id`. Se comprobó que un payload con la forma enviada por Campo guarda las líneas, pero deja intacto el avance de la tarea. Esto también afecta los indicadores de Dirección basados en tareas.

**Corrección:** enviar ambos identificadores y validar que tarea, hito, proyecto y frente sean compatibles en el servidor.

### 4. [P1] La fecha UTC desplaza reportes y el corte nocturno al día siguiente

**Ubicación:** `client/src/views/CampoView.jsx:245`; `server/bot/cron.js:12`; `server/routes/stats.js:12`.

Se usabre, con offset -06:00, la fecha consultada es el 6 de septiembre. El reclamo nocturno puede marcar como pendientes frentes que `toISOString().split('T')[0]` para la fecha operativa, aunque el cron se programa en `America/Merida`. A las 21:00 del 5 de septiem sí reportaron durante el día; las capturas a partir de las 18:00 quedan fechadas en el día siguiente.

**Corrección:** centralizar la fecha operativa usando la zona configurada en `TIMEZONE`; mantener UTC para instantes de auditoría, no para decidir el día operativo local.

### 5. [P1] El servidor acepta una clave JWT pública si falta configuración

**Ubicación:** `server/middleware/auth.js:5`.

`JWT_SECRET` tiene un valor fijo en el código como alternativa. Si el servidor arranca sin la variable, es posible firmar un token con el ID de un usuario activo y superar la autenticación. El middleware sí vuelve a consultar el rol en la base; eso no impide suplantar el ID de un administrador. Hallazgo estático y condicionado a la ausencia de configuración; `render.yaml` sí solicita generar la variable, por lo que no se afirma que el despliegue actual use la alternativa.

**Corrección:** abortar el arranque cuando falte una clave adecuada; no incluir una alternativa utilizable fuera de pruebas aisladas.

### 6. [P2] Las alertas de mantenimiento ignoran el intervalo configurable

**Ubicación:** `server/routes/reports.js:153–161`; `server/routes/stats.js:120–129`; comparación con `server/routes/machines.js:37–55`.

El catálogo respeta `umbral_servicio_hrs`, pero sincronización y Supervisor fijan 280/300 horas. Se reprodujo una máquina con intervalo de 100 horas y horómetro en 90: el catálogo muestra mantenimiento preventivo, mientras Supervisor devuelve `alerta_activa: false`. Para intervalos mayores a 300 también aparecen avisos prematuros.

**Corrección:** compartir el cálculo del intervalo, horas restantes y alerta entre todos los consumidores.

### 7. [P2] La autenticación de Telegram acepta firmas sin caducidad

**Ubicación:** `server/middleware/auth.js:51–89`; consumo en `server/routes/auth.js`, ruta `/telegram`.

La validación comprueba el HMAC, pero no la antigüedad de `auth_date`. Una captura de `initData` auténtica puede reutilizarse para obtener JWT nuevos mientras permanezcan válidos el token del bot y la vinculación del usuario. Se reprodujo la aceptación de una firma correctamente calculada con `auth_date=1`. Esto requiere disponer de datos firmados previamente; no permite inventar una firma.

**Corrección:** exigir una fecha válida y limitar su antigüedad, incluyendo una tolerancia explícita de reloj.

### 8. [P2] La sincronización automática puede quedar desactivada al recuperar conexión

**Ubicación:** `client/src/components/OfflineBadge.jsx:25–48`.

El listener `online` captura `handleManualSync` del render donde se registró. El efecto solo depende de `offlineSimulated`. Si el componente se monta sin conexión, la función capturada conserva `effectiveOnline=false`; `setIsOnline(true)` no actualiza esa clausura. Cuando llega la red, muestra el aviso de modo offline y deja los reportes en cola. El botón manual funciona después del nuevo render. Hallazgo por análisis de flujo; no se ejecutó una prueba de navegador para este caso.

**Corrección:** activar la sincronización desde un efecto que observe la transición real a conectado, con control de ejecución en curso, o separar el procesamiento de la cola de la validación usada por el botón.

## Verificación y límites

- `npm.cmd --prefix client run build`: correcto, 1485 módulos procesados. El primer intento encontró una restricción de lectura de esbuild; la ejecución autorizada posterior terminó correctamente.
- `server/test_system.js`: las seis pruebas existentes pasan con `DB_PATH=:memory:` y Telegram desactivado.
- `node audit/reproduce.cjs`: seis reproducciones con aserciones correctas (hallazgos 1, 2, 3, 4, 6 y 7). Usa SQLite en memoria, usuarios sintéticos, servidor en loopback y notificaciones simuladas. No toca la base operativa ni envía mensajes.
- Las reproducciones confirman el comportamiento defectuoso actual; no son pruebas que certifiquen una corrección.
- Las pruebas existentes de idempotencia y mantenimiento ejercitan principalmente consultas o cálculos directos, sin cubrir errores parciales, intervalos configurables ni el payload de la UI.
- No se ejecutaron `test_http_endpoints.js` ni `test_bot_connection.js`: el primero importa el arranque completo y contiene disparos de cron; esta auditoría usó rutas aisladas para no activar integraciones reales.
- No se efectuó auditoría de dependencias/CVE, pentest externo ni validación visual completa. La compilación correcta no garantiza que los flujos de usuario funcionen correctamente.

Prioridad de reparación: cerrar la exposición de credenciales, garantizar persistencia atómica, restaurar el vínculo con tareas y unificar fechas; después atender configuración JWT, mantenimiento, caducidad de Telegram y reconexión offline.
