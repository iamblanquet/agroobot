const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'tesa_default_secret_jwt_2026';

/**
 * Middleware para validar el JWT en encabezados Authorization
 */
async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo FROM usuario WHERE id = ?', [decoded.id]);

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware para autorización por roles
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (!roles.includes(req.user.rol) && req.user.rol !== 'it') {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere uno de los roles: [${roles.join(', ')}]. Tu rol es: ${req.user.rol}`
      });
    }
    next();
  };
}

/**
 * Validación criptográfica HMAC-SHA256 para initData de Telegram WebApp
 * Especificación oficial de Telegram
 */
function verifyTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) return { isValid: false, user: null };

  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return { isValid: false, user: null };

    urlParams.delete('hash');

    // Ordenar claves alfabéticamente
    const params = Array.from(urlParams.entries())
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join('\n');

    // Clave secreta = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Hash calculado = HMAC_SHA256(secretKey, params)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(params)
      .digest('hex');

    const isValid = calculatedHash === hash;
    let user = null;
    const userParam = urlParams.get('user');
    if (userParam) {
      user = JSON.parse(userParam);
    }

    return { isValid, user };
  } catch (err) {
    console.error('Error al validar HMAC-SHA256 de Telegram:', err);
    return { isValid: false, user: null };
  }
}

module.exports = {
  JWT_SECRET,
  authenticateJWT,
  requireRole,
  verifyTelegramWebAppData
};
