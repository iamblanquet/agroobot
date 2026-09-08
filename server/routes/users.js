const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const userRepository = require('../repositories/userRepository');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/users
 * Listar todos los usuarios para la vista de administración IT
 */
router.get('/', authenticateJWT, requireRole('it'), async (req, res) => {
  try {
    const users = await userRepository.findAll();
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

    const existing = await userRepository.findByUsername(username.trim());
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya existe en el sistema.' });
    }

    // Si viene PIN, verificar que no esté repetido
    const cleanPin = pin ? pin.trim() : String(Math.floor(1000 + Math.random() * 9000));
    const pinExisting = await userRepository.findExistingPin(cleanPin);
    if (pinExisting) {
      return res.status(400).json({ error: `El PIN ${cleanPin} ya está asignado a ${pinExisting.nombre}.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await userRepository.create({
      username: username.trim(),
      password_hash: passwordHash,
      pin: cleanPin,
      nombre: nombre.trim(),
      rol,
      activo: true
    });

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

    const user = await userRepository.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const updateFields = {};

    if (nombre !== undefined) {
      updateFields.nombre = nombre.trim();
    }

    if (rol !== undefined) {
      updateFields.rol = rol;
    }

    if (activo !== undefined) {
      updateFields.activo = Boolean(activo);
    }

    if (password && password.trim().length > 0) {
      updateFields.password_hash = await bcrypt.hash(password, 10);
    }

    if (pin !== undefined && pin !== null && String(pin).trim().length > 0) {
      const cleanPin = String(pin).trim();
      const pinConflict = await userRepository.findExistingPin(cleanPin, id);
      if (pinConflict) {
        return res.status(400).json({ error: `El PIN ${cleanPin} ya está asignado a ${pinConflict.nombre}.` });
      }
      updateFields.pin = cleanPin;
    }

    const updated = await userRepository.update(id, updateFields);
    return res.json({ success: true, user: updated });
  } catch (err) {
    console.error('Error en PATCH /api/users/:id:', err);
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

/**
 * POST /api/users/clear-operational-data
 * Vaciar datos operativos conservando usuarios (para reiniciar pruebas desde cualquier entorno)
 */
router.post('/clear-operational-data', authenticateJWT, requireRole('it', 'admin'), async (req, res) => {
  try {
    const { initDatabase, db } = require('../db/database');
    await initDatabase();
    const supabase = require('../db/supabase');

    const tablesToClear = [
      'lectura_activo_fijo', 'activo_fijo', 'reporte_foto', 'medicion', 'material',
      'incidencia', 'lectura_maquina', 'reporte_cuadrilla', 'reporte_linea', 'reporte',
      'maquina', 'obra_predio', 'obra', 'predio', 'tarea', 'hito', 'proyecto', 'entidad'
    ];

    for (const table of tablesToClear) {
      try {
        await db.run(`DELETE FROM ${table}`);
      } catch (_) {}
    }

    if (supabase.isSupabaseConfigured()) {
      for (const table of tablesToClear) {
        try {
          if (table === 'obra_predio') {
            await supabase.deleteRows(table, { obra_id: 'gt.0' });
          } else {
            await supabase.deleteRows(table, { id: 'gt.0' });
          }
        } catch (_) {}
      }
    }

    return res.json({ success: true, message: 'Datos operativos vaciados correctamente en el servidor.' });
  } catch (err) {
    console.error('Error en /api/users/clear-operational-data:', err);
    return res.status(500).json({ error: 'Error al vaciar datos: ' + err.message });
  }
});

module.exports = router;

