const express = require('express');
const router = express.Router();
const issueRepository = require('../repositories/issueRepository');
const { authenticateJWT } = require('../middleware/auth');

/**
 * GET /api/issues
 * Listar incidencias con información de la obra
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { estado, obra_id } = req.query;
    const issues = await issueRepository.findAll({ estado, obra_id });
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

    const folio = await issueRepository.generateNextFolio();
    const newIssue = await issueRepository.create({
      folio,
      tipo: tipo.trim(),
      obra_id,
      causa_raiz: causa_raiz || null,
      estado: 'abierta'
    });

    // Notificar automáticamente al tema #Incidencias de Telegram
    try {
      const { notifyIncidencia } = require('../bot/bot');
      notifyIncidencia({
        folio: newIssue.folio,
        tipo: newIssue.tipo,
        obraNombre: newIssue.obra_nombre,
        descripcion: causa_raiz,
        estado: newIssue.estado
      });
    } catch (e) {}

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

    const issue = await issueRepository.findById(id);
    if (!issue) {
      return res.status(404).json({ error: 'Incidencia no encontrada.' });
    }

    if (issue.estado === 'cerrada') {
      return res.status(400).json({ error: 'La incidencia ya se encuentra cerrada.' });
    }

    const updated = await issueRepository.close(id, causa_raiz.trim());

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

    const updated = await issueRepository.updateStatus(id, estado);
    return res.json({ success: true, issue: updated });
  } catch (err) {
    console.error('Error en PATCH /api/issues/:id/status:', err);
    return res.status(500).json({ error: 'Error al actualizar estado.' });
  }
});

module.exports = router;
