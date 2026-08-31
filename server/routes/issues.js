const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT } = require('../middleware/auth');

/**
 * GET /api/issues
 * Listar incidencias con información de la obra
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { estado, obra_id } = req.query;
    let query = `
      SELECT i.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      query += ` AND i.estado = ?`;
      params.push(estado);
    }
    if (obra_id) {
      query += ` AND i.obra_id = ?`;
      params.push(obra_id);
    }

    query += ` ORDER BY CASE WHEN i.estado = 'cerrada' THEN 1 ELSE 0 END, i.abierta_en DESC`;

    const issues = await db.all(query, params);
    return res.json({ issues });
  } catch (err) {
    console.error('Error en GET /api/issues:', err);
    return res.status(500).json({ error: 'Error al consultar incidencias.' });
  }
});

/**
 * POST /api/issues
 * Crear una nueva incidencia
 */
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { tipo, obra_id, causa_raiz } = req.body;

    if (!tipo || !obra_id) {
      return res.status(400).json({ error: 'El tipo de incidencia y la obra son obligatorios.' });
    }

    // Generar Folio único INC-YYYY-XXX
    const year = new Date().getFullYear();
    const countRes = await db.get(
      "SELECT COUNT(*) as total FROM incidencia WHERE folio LIKE ?",
      [`INC-${year}-%`]
    );
    const seq = String((countRes?.total || 0) + 1).padStart(3, '0');
    const folio = `INC-${year}-${seq}`;

    const insertRes = await db.run(
      `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
       VALUES (?, ?, ?, 'abierta', datetime('now'), ?)`,
      [folio, tipo.trim(), obra_id, causa_raiz || null]
    );

    const newIssue = await db.get(
      `SELECT i.*, o.nombre AS obra_nombre
       FROM incidencia i
       JOIN obra o ON i.obra_id = o.id
       WHERE i.id = ?`,
      [insertRes.lastID]
    );

    return res.status(201).json({ success: true, issue: newIssue });
  } catch (err) {
    console.error('Error en POST /api/issues:', err);
    return res.status(500).json({ error: 'Error al crear la incidencia.' });
  }
});

/**
 * POST /api/issues/:id/close
 * Cierre formal de incidencia con VALIDACIÓN ESTRICTA de causa raíz (>= 10 caracteres)
 */
router.post('/:id/close', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { causa_raiz } = req.body;

    if (!causa_raiz || typeof causa_raiz !== 'string' || causa_raiz.trim().length < 10) {
      return res.status(400).json({
        error: 'Validación rechazada: La "causa_raiz" es obligatoria y debe tener al menos 10 caracteres de longitud detallada.'
      });
    }

    const issue = await db.get('SELECT * FROM incidencia WHERE id = ?', [id]);
    if (!issue) {
      return res.status(404).json({ error: 'Incidencia no encontrada.' });
    }

    if (issue.estado === 'cerrada') {
      return res.status(400).json({ error: 'La incidencia ya se encuentra cerrada.' });
    }

    await db.run(
      `UPDATE incidencia
       SET estado = 'cerrada',
           cerrada_en = datetime('now'),
           causa_raiz = ?
       WHERE id = ?`,
      [causa_raiz.trim(), id]
    );

    const updated = await db.get(
      `SELECT i.*, o.nombre AS obra_nombre
       FROM incidencia i
       JOIN obra o ON i.obra_id = o.id
       WHERE i.id = ?`,
      [id]
    );

    return res.json({
      success: true,
      message: 'Incidencia cerrada exitosamente con causa raíz registrada.',
      issue: updated
    });
  } catch (err) {
    console.error('Error en POST /api/issues/:id/close:', err);
    return res.status(500).json({ error: 'Error interno al cerrar la incidencia.' });
  }
});

/**
 * PATCH /api/issues/:id/status
 * Actualizar fase de atención de la incidencia
 */
router.patch('/:id/status', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const allowed = ['abierta', 'diagnostico', 'reparacion', 'verificacion'];
    if (!allowed.includes(estado)) {
      return res.status(400).json({
        error: `Estado no permitido mediante este endpoint. Utilice /close para cerrar. Válidos: ${allowed.join(', ')}`
      });
    }

    await db.run('UPDATE incidencia SET estado = ? WHERE id = ?', [estado, id]);
    const updated = await db.get('SELECT * FROM incidencia WHERE id = ?', [id]);

    return res.json({ success: true, issue: updated });
  } catch (err) {
    console.error('Error en PATCH /api/issues/:id/status:', err);
    return res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

module.exports = router;
