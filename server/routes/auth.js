const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { JWT_SECRET, requireJwtSecret, authenticateJWT, verifyTelegramWebAppData } = require('../middleware/auth');

/**
 * POST /api/auth/pin-login
 * Acceso rápido por PIN de 4 dígitos para operadores de campo y supervisores
 */
router.post('/pin-login', async (req, res) => {
  try {
    const { pin } = req.body;

    if (!pin || typeof pin !== 'string' || pin.trim().length < 4) {
      return res.status(400).json({ error: 'Debe ingresar un PIN de 4 dígitos.' });
    }

    const cleanPin = pin.trim();

    const user = await db.get(
      'SELECT id, username, nombre, rol, pin, activo FROM usuario WHERE pin = ? AND activo = 1',
      [cleanPin]
    );

    if (!user) {
      return res.status(401).json({ error: 'PIN no encontrado o incorrecto.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre },
      requireJwtSecret(),
      { expiresIn: '30d' } // Sesión persistente de 30 días para trabajo continuo
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol
      }
    });
  } catch (err) {
    console.error('Error en /auth/pin-login:', err);
    return res.status(500).json({ error: 'Error interno al validar PIN.' });
  }
});

/**
 * POST /api/auth/login
 * Autenticación tradicional por usuario y password (para supervisores y admins)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Debe ingresar usuario y contraseña.' });
    }

    const user = await db.get(
      'SELECT id, username, password_hash, nombre, rol, tg_user_id, activo FROM usuario WHERE username = ?',
      [username.trim()]
    );

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre },
      requireJwtSecret(),
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        tg_user_id: user.tg_user_id
      }
    });
  } catch (err) {
    console.error('Error en /login:', err);
    return res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
});

/**
 * POST /api/auth/telegram
 * Validación criptográfica HMAC-SHA256 del initData de Telegram WebApp
 */
router.post('/telegram', async (req, res) => {
  try {
    const { initData } = req.body;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!initData) {
      return res.status(400).json({ error: 'initData de Telegram es obligatorio.' });
    }

    if (!botToken) {
      return res.status(503).json({ error: 'Autenticación de Telegram no disponible: TELEGRAM_BOT_TOKEN no configurado.' });
    }

    const { isValid, user: tgUser } = verifyTelegramWebAppData(initData, botToken);

    if (!isValid || !tgUser) {
      return res.status(401).json({ error: 'Firma criptográfica de Telegram inválida o alterada.' });
    }

    const user = await db.get(
      'SELECT id, username, nombre, rol, tg_user_id, activo FROM usuario WHERE tg_user_id = ? AND activo = 1',
      [String(tgUser.id)]
    );

    if (!user) {
      return res.status(404).json({
        error: `El ID de Telegram ${tgUser.id} (${tgUser.first_name || ''}) no está vinculado a ningún usuario activo. Contacte al administrador IT.`
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre },
      requireJwtSecret(),
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        nombre: user.nombre,
        rol: user.rol,
        tg_user_id: user.tg_user_id
      }
    });
  } catch (err) {
    console.error('Error en /auth/telegram:', err);
    return res.status(500).json({ error: 'Error procesando autenticación de Telegram.' });
  }
});

/**
 * GET /api/auth/me
 * Obtener perfil del usuario autenticado
 */
router.get('/me', authenticateJWT, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
