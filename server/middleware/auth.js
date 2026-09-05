const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET;

function requireJwtSecret() {
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET debe estar configurado y tener al menos 32 caracteres.');
  }
  return JWT_SECRET;
}

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
    const decoded = jwt.verify(token, requireJwtSecret());
    const user = await db.get('SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo FROM usuario WHERE id = ?', [decoded.id]);

    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado. Por favor inicia sesión nuevamente.' });
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

    const authDate = Number(urlParams.get('auth_date'));
    const maxAgeSeconds = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
    const now = Math.floor(Date.now() / 1000);
    const isFresh = Number.isFinite(authDate) && authDate <= now + 300 && now - authDate <= maxAgeSeconds;
    const hashBuffer = Buffer.from(hash, 'hex');
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const hashMatches = hashBuffer.length === calculatedBuffer.length && crypto.timingSafeEqual(hashBuffer, calculatedBuffer);
    const isValid = hashMatches && isFresh;
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
  requireJwtSecret,
  authenticateJWT,
  requireRole,
  verifyTelegramWebAppData
};
