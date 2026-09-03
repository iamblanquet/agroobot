# 🌾 AGROKOOL - Sistema de Operación de Campo & Tablero de Control

Sistema modular full-stack para la gestión de frentes agrícolas, maquinaria, cuadrillas, incidencias y tableros ejecutivos bajo el patrón **TESA (Telegram Entry, Standalone API, Offline Storage)** con la identidad oficial **AGROKOOL**.

---

## 🛠️ Stack Tecnológico

* **Backend:** Node.js, Express, SQLite (`sqlite3` con wrapper de promesas y `PRAGMA foreign_keys = ON;`), JWT, `node-telegram-bot-api`, `node-cron`, `bcryptjs`.
* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Telegram WebApp SDK (`https://telegram.org/js/telegram-web-app.js`).
* **Offline First:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`), e `IndexedDB` (`idb`) como cola local de sincronización idempotente por UUID.
* **Seguridad:** CSP con `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org telegram:;` y remoción de `X-Frame-Options`. Validación criptográfica HMAC-SHA256 para `initData` de Telegram.
* **Identidad Visual:** Paleta corporativa AGROKOOL (Verde Bosque `#2c4001`, Verde Lima `#a1c62e`, Ocre Dorado `#a87d13`).

---

## ⏰ Automatizaciones y Alertas Diarias (Cron Jobs)

1. **07:30 hrs — Reporte General:** Publica en `#General` el estado de tareas y proyectos en ejecución.
2. **08:00 hrs — Alertas Matutinas:** Notifica incidencias abiertas $\ge 3$ días y maquinaria próxima a servicio de 300 hrs.
3. **21:00 hrs — Reclamos:** Aviso automático a los frentes activos sin reporte registrado.
4. **21:30 hrs — Corte Oficial del Tablero:** Publica y fija el Tablero de Control en `#Tablero`.

---

## 🚀 Despliegue en Render

Este proyecto está preconfigurado para compilarse y desplegarse como un solo servicio Web en [Render](https://render.com).

### 1. Configuración del Servicio Web en Render:
* **Build Command:** `npm run render-build`
* **Start Command:** `npm run render-start`

### 2. Variables de Entorno (Environment Variables) en Render:
| Variable | Valor / Descripción |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(Generar clave secreta segura)* |
| `TELEGRAM_BOT_TOKEN` | Tu Token de `@BotFather` |
| `TELEGRAM_MINI_APP_URL` | La URL HTTPS que te asigne Render (ej. `https://agroobot-tesa.onrender.com`) |
| `DB_PATH` | `./server/db/tesa_campo.sqlite` |
| `TIMEZONE` | `America/Merida` |

---

## 💻 Desarrollo Local

```bash
# 1. Instalar dependencias
npm install
npm --prefix client install

# 2. Inicializar base de datos con datos de prueba
npm run seed

# 3. Iniciar servidor backend y bot
npm start

# 4. En otra terminal, iniciar cliente React con Vite
npm run client
```

---

## 👥 Credenciales de Prueba Preconfiguradas (Contraseña común: `demo123`)

* **Campo:** `campo_user` · PIN: `1234`
* **Supervisor:** `sup_user` · PIN: `2345`
* **Dirección:** `dir_user` · PIN: `3456`
* **Admin IT:** `admin_user` · PIN: `9999`
