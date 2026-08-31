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
      SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo, creado_en
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
 * Crear un nuevo usuario del sistema
 */
router.post('/', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const { username, password, nombre, rol, tg_user_id } = req.body;

    if (!username || !password || !nombre || !rol) {
      return res.status(400).json({ error: 'Username, password, nombre y rol son obligatorios.' });
    }

    const existing = await db.get('SELECT id FROM usuario WHERE username = ?', [username.trim()]);
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe en el sistema.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.run(
      `INSERT INTO usuario (username, password_hash, nombre, rol, tg_user_id, tg_chat_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [username.trim(), passwordHash, nombre.trim(), rol, tg_user_id || null, tg_user_id || null]
    );

    const newUser = await db.get(
      'SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo, creado_en FROM usuario WHERE id = ?',
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
 * Actualizar datos de usuario (rol, vinculación Telegram, estado activo, contraseña)
 */
router.patch('/:id', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol, tg_user_id, activo, password } = req.body;

    const user = await db.get('SELECT * FROM usuario WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    let passwordHash = user.password_hash;
    if (password && password.trim().length > 0) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await db.run(
      `UPDATE usuario
       SET nombre = ?,
           rol = ?,
           tg_user_id = ?,
           tg_chat_id = ?,
           activo = ?,
           password_hash = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : user.nombre,
        rol !== undefined ? rol : user.rol,
        tg_user_id !== undefined ? (tg_user_id || null) : user.tg_user_id,
        tg_user_id !== undefined ? (tg_user_id || null) : user.tg_chat_id,
        activo !== undefined ? (activo ? 1 : 0) : user.activo,
        passwordHash,
        id
      ]
    );

    const updated = await db.get(
      'SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo, creado_en FROM usuario WHERE id = ?',
      [id]
    );

    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Error en PATCH /api/users/:id:', err);
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

module.exports = router;
