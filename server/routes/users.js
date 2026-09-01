const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/users
 * Listar todos los usuarios para la vista de administración IT
 */
router.get('/', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const users = await db.all(`
      SELECT id, username, pin, nombre, rol, activo, creado_en
      FROM usuario
      ORDER BY id ASC
    `);
    return res.json({ users });
  } catch (err) {
    console.error('Error en GET /api/users:', err);
    return res.status(500).json({ error: 'Error al consultar usuarios.' });
  }
});

/**
 * POST /api/users
 * Crear un nuevo usuario del sistema con PIN de 4 dígitos
 */
router.post('/', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const { username, password, pin, nombre, rol } = req.body;

    if (!username || !password || !nombre || !rol) {
      return res.status(400).json({ error: 'Username, password, nombre y rol son obligatorios.' });
    }

    const existing = await db.get('SELECT id FROM usuario WHERE username = ?', [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe en el sistema.' });
    }

    // Si viene PIN, verificar que no esté repetido
    const cleanPin = pin ? pin.trim() : String(Math.floor(1000 + Math.random() * 9000));
    const pinExisting = await db.get('SELECT id, nombre FROM usuario WHERE pin = ?', [cleanPin]);
    if (pinExisting) {
      return res.status(400).json({ error: `El PIN ${cleanPin} ya está asignado a ${pinExisting.nombre}.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO usuario (username, password_hash, pin, nombre, rol, activo)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [username.trim(), passwordHash, cleanPin, nombre.trim(), rol]
    );

    const newUser = await db.get(
      'SELECT id, username, pin, nombre, rol, activo, creado_en FROM usuario WHERE id = ?',
      [result.lastID]
    );

    return res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error('Error en POST /api/users:', err);
    return res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

/**
 * PATCH /api/users/:id
 * Actualizar datos de usuario (nombre, rol, PIN de 4 dígitos, contraseña, activo)
 */
router.patch('/:id', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, pin, activo, password } = req.body;

    const user = await db.get('SELECT * FROM usuario WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    let targetPin = user.pin;
    if (pin !== undefined && pin !== null && String(pin).trim().length > 0) {
      const cleanPin = String(pin).trim();
      const pinConflict = await db.get('SELECT id, nombre FROM usuario WHERE pin = ? AND id != ?', [cleanPin, id]);
      if (pinConflict) {
        return res.status(400).json({ error: `El PIN ${cleanPin} ya está asignado a ${pinConflict.nombre}.` });
      }
      targetPin = cleanPin;
    }

    await db.run(
      `UPDATE usuario
       SET nombre = ?,
           rol = ?,
           pin = ?,
           activo = ?,
           password_hash = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : user.nombre,
        rol !== undefined ? rol : user.rol,
        targetPin,
        activo !== undefined ? (activo ? 1 : 0) : user.activo,
        passwordHash,
        id
      ]
    );

    const updated = await db.get(
      'SELECT id, username, pin, nombre, rol, activo, creado_en FROM usuario WHERE id = ?',
      [id]
    );

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Error en PATCH /api/users/:id:', err);
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

module.exports = router;
