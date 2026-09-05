const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDatabase, db } = require('./db/database');
const { initTelegramBot } = require('./bot/bot');
const { requireJwtSecret } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const projectsRoutes = require('./routes/projects');
const issuesRoutes = require('./routes/issues');
const machinesRoutes = require('./routes/machines');
const materialsRoutes = require('./routes/materials');
const usersRoutes = require('./routes/users');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Seguridad y Cabeceras para Telegram WebApp (Mini Apps)
app.use((req, res, next) => {
  // Remover X-Frame-Options para permitir incrustación dentro de Telegram Desktop y Mobile Web
  res.removeHeader('X-Frame-Options');

  // CSP configurado con frame-ancestors según especificación
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; " +
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org telegram:; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org https://*.telegram.org; " +
    "connect-src 'self' https: wss: http:;"
  );

  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir fotos de evidencias cargadas
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Rutas de la API Standalone
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/issues', issuesRoutes);
app.use('/api/machines', machinesRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/stats', statsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'TESA - Sistema de Operación de Campo y Tablero de Control',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Servir frontend compilado (Producción / Render)
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
} else {
  app.get('/', (req, res) => {
    res.send(`
      <div style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 24px; border: 1px solid #064e3b; border-radius: 8px;">
        <h2 style="color: #064e3b;">🚀 TESA API Servidor Operativo</h2>
        <p>El backend de Express y SQLite está funcionando.</p>
        <p>Para iniciar el cliente en desarrollo: <code>npm run client</code></p>
        <p>Para construir producción: <code>npm run client:build</code></p>
        <hr/>
        <p><strong>Endpoints Principales:</strong></p>
        <ul>
          <li><a href="/api/health">/api/health</a></li>
          <li>/api/auth/login</li>
          <li>/api/reports/sync</li>
          <li>/api/stats/supervisor</li>
          <li>/api/stats/direction</li>
        </ul>
      </div>
    `);
  });
}

// Inicializar DB, Bot y arrancar servidor
async function startServer() {
  try {
    requireJwtSecret();
    await initDatabase();

    // Auto-seed si no hay usuarios
    const userCount = await db.get('SELECT COUNT(*) as count FROM usuario');
    if (userCount?.count === 0) {
      console.warn('⚠️ Base de datos SQLite vacía: creando datos iniciales temporales. Configure un disco persistente para conservarlos entre despliegues.');
      const seed = require('./db/seed');
      await seed();
    }

    // Inicializar Bot de Telegram y Planificador de Tareas Cron (Docs 2 §4)
    initTelegramBot(app);
    const { initScheduler } = require('./bot/cron');
    initScheduler();

    app.listen(PORT, () => {
      console.log(`\n==================================================`);
      console.log(`🌾 TESA Servidor Operativo en http://localhost:${PORT}`);
      console.log(`🔒 Modo de seguridad: CSP frame-ancestors Telegram activo`);
      console.log(`==================================================\n`);
    });
  } catch (err) {
    console.error('❌ Error fatal al arrancar el servidor:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
