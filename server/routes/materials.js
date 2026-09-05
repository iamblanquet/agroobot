const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { getOperationalDate } = require('../utils/operationalDate');

/**
 * GET /api/materials
 * Listar materiales con cálculo de déficit y estado de bloqueo
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { obra_id, solo_bloqueados } = req.query;
    let query = `
      SELECT m.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM material m
      JOIN obra o ON m.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (obra_id) {
      query += ` AND m.obra_id = ?`;
      params.push(obra_id);
    }

    query += ` ORDER BY m.obra_id ASC, m.nombre ASC`;

    const rows = await db.all(query, params);
    const todayStr = getOperationalDate();

    const materials = rows.map((m) => {
      const deficit = Math.max(0, m.requerido - m.en_sitio);
      const isBloqueado = deficit > 0;
      const isAtrasado = isBloqueado && m.eta && m.eta < todayStr;

      return {
        ...m,
        deficit,
        is_bloqueado: isBloqueado,
        is_atrasado: isAtrasado,
        porcentaje_en_sitio: m.requerido > 0 ? Math.min(100, Math.round((m.en_sitio / m.requerido) * 100)) : 100
      };
    });

    const filtered = solo_bloqueados === 'true' ? materials.filter((m) => m.is_bloqueado) : materials;
    return res.json({ materials: filtered });
  } catch (err) {
    console.error('Error en GET /api/materials:', err);
    return res.status(500).json({ error: 'Error al consultar materiales.' });
  }
});

/**
 * POST /api/materials
 * Registrar nuevo material en obra
 */
router.post('/', authenticateJWT, requireRole('supervisor', 'it'), async (req, res) => {
  try {
    const { obra_id, nombre, requerido = 0, en_sitio = 0, pedido = 0, unidad = 'pza', eta } = req.body;
    if (!obra_id || !nombre) {
      return res.status(400).json({ error: 'Obra y nombre del material son obligatorios.' });
    }

    const result = await db.run(
      `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [obra_id, nombre.trim(), requerido, en_sitio, pedido, unidad, eta || null]
    );

    const newMaterial = await db.get('SELECT * FROM material WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, material: newMaterial });
  } catch (err) {
    console.error('Error en POST /api/materials:', err);
    return res.status(500).json({ error: 'Error al registrar material.' });
  }
});

/**
 * PATCH /api/materials/:id/receive
 * Registrar recepción de material en obra
 */
router.patch('/:id/receive', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const { cantidad_recibida } = req.body;

    const cant = parseFloat(cantidad_recibida) || 0;
    if (cant <= 0) {
      return res.status(400).json({ error: 'La cantidad recibida debe ser mayor a 0.' });
    }

    await db.run(
      `UPDATE material
       SET en_sitio = en_sitio + ?,
           pedido = CASE WHEN pedido >= ? THEN pedido - ? ELSE 0 END
       WHERE id = ?`,
      [cant, cant, cant, id]
    );

    const updated = await db.get('SELECT * FROM material WHERE id = ?', [id]);
    return res.json({ success: true, material: updated });
  } catch (err) {
    console.error('Error en PATCH /api/materials/:id/receive:', err);
    return res.status(500).json({ error: 'Error al registrar recepción de material.' });
  }
});

module.exports = router;
