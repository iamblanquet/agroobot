const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/machines
 * Listar máquinas con cálculos de horas para mantenimiento y estatus de alerta
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM maquina ORDER BY codigo ASC');
    const machines = rows.map((m) => {
      const hrsDesdeServicio = m.horometro_actual - (m.ultimo_servicio_hr || 0);
      const hrsRestantesPara300 = Math.max(0, 300 - hrsDesdeServicio);
      const alerta = hrsDesdeServicio >= 280 ? 1 : 0;

      return {
        ...m,
        horas_desde_servicio: parseFloat(hrsDesdeServicio.toFixed(1)),
        horas_restantes_300: parseFloat(hrsRestantesPara300.toFixed(1)),
        alerta_mantenimiento: alerta,
        estado_servicio: hrsDesdeServicio >= 300
          ? 'vencido'
          : hrsDesdeServicio >= 280
          ? 'preventivo_urgente'
          : 'optimo'
      };
    });

    return res.json({ machines });
  } catch (err) {
    console.error('Error en GET /api/machines:', err);
    return res.status(500).json({ error: 'Error al consultar catálogo de maquinaria.' });
  }
});

/**
 * POST /api/machines
 * Registrar nueva máquina
 */
router.post('/', authenticateJWT, requireRole('supervisor', 'it'), async (req, res) => {
  try {
    const { codigo, modelo, horometro_actual = 0, ultimo_servicio_hr = 0 } = req.body;
    if (!codigo || !modelo) {
      return res.status(400).json({ error: 'Código y modelo son obligatorios.' });
    }

    const hActual = parseFloat(horometro_actual) || 0;
    const uServicio = parseFloat(ultimo_servicio_hr) || 0;
    const alerta = (hActual - uServicio) >= 280 ? 1 : 0;

    const result = await db.run(
      `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
       VALUES (?, ?, ?, ?, ?)`,
      [codigo.trim().toUpperCase(), modelo.trim(), hActual, uServicio, alerta]
    );

    const newMachine = await db.get('SELECT * FROM maquina WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, machine: newMachine });
  } catch (err) {
    console.error('Error en POST /api/machines:', err);
    return res.status(500).json({ error: 'Error al registrar máquina.' });
  }
});

/**
 * POST /api/machines/:id/service
 * Registrar servicio de mantenimiento realizado (resetea contador)
 */
router.post('/:id/service', authenticateJWT, requireRole('supervisor', 'it'), async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await db.get('SELECT * FROM maquina WHERE id = ?', [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Máquina no encontrada.' });
    }

    await db.run(
      `UPDATE maquina
       SET ultimo_servicio_hr = horometro_actual,
           alerta_mantenimiento = 0
       WHERE id = ?`,
      [id]
    );

    const updated = await db.get('SELECT * FROM maquina WHERE id = ?', [id]);
    return res.json({
      success: true,
      message: `Servicio de 300 hrs aplicado a ${machine.codigo}. Horómetro de referencia reseteado a ${machine.horometro_actual} hrs.`,
      machine: updated
    });
  } catch (err) {
    console.error('Error en POST /api/machines/:id/service:', err);
    return res.status(500).json({ error: 'Error al registrar servicio.' });
  }
});

module.exports = router;
