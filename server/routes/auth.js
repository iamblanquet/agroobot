const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { JWT_SECRET, authenticateJWT, verifyTelegramWebAppData } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Autenticación tradicional por usuario y password
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
      JWT_SECRET,
      { expiresIn: '7d' }
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
      // En modo desarrollo sin botToken configurado, podemos permitir fallback si viene user
      const urlParams = new URLSearchParams(initData);
      const userParam = urlParams.get('user');
      if (userParam && process.env.NODE_ENV === 'development') {
        const tgUser = JSON.parse(userParam);
        const user = await db.get(
          'SELECT id, username, nombre, rol, tg_user_id, activo FROM usuario WHERE tg_user_id = ? OR id = ?',
          [String(tgUser.id), 1]
        );
        if (user) {
          const token = jwt.sign(
            { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return res.json({ token, user });
        }
      }
      return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN no configurado en el servidor.' });
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
      JWT_SECRET,
      { expiresIn: '7d' }
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
