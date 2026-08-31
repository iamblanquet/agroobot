# 🌾 Agroobot TESA - Sistema de Operación de Campo & Tablero de Control

Sistema modular full-stack para la gestión de frentes agrícolas, maquinaria, cuadrillas, incidencias y tableros ejecutivos bajo el patrón **TESA (Telegram Entry, Standalone API, Offline Storage)**.

---

## 🛠️ Stack Tecnológico

* **Backend:** Node.js, Express, SQLite (`sqlite3` con wrapper de promesas y `PRAGMA foreign_keys = ON;`), JWT, `node-telegram-bot-api`, `bcryptjs`.
* **Frontend:** React 18, Vite, Tailwind CSS, Lucide React, Telegram WebApp SDK (`https://telegram.org/js/telegram-web-app.js`).
* **Offline First:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`), e `IndexedDB` (`idb`) como cola local de sincronización idempotente por UUID.
* **Seguridad:** CSP con `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org telegram:;` y remoción de `X-Frame-Options`. Validación criptográfica HMAC-SHA256 para `initData` de Telegram.

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

* **Campo:** `campo_user`
* **Supervisor:** `sup_user`
* **Dirección:** `dir_user`
* **Admin IT:** `admin_user`
