const express = require('express');
const router = express.Router();
const statsRepository = require('../repositories/statsRepository');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { getOperationalDate } = require('../utils/operationalDate');

/**
 * GET /api/stats/supervisor
 * Retorna los 4 Widgets Canónicos del Supervisor + estado de maquinaria
 */
router.get('/supervisor', authenticateJWT, async (req, res) => {
  try {
    const todayStr = getOperationalDate();
    const data = await statsRepository.getSupervisorStats(todayStr);
    return res.json(data);
  } catch (err) {
    console.error('Error en /api/stats/supervisor:', err);
    return res.status(500).json({ error: 'Error al obtener estadísticas del supervisor.' });
  }
});

/**
 * GET /api/stats/direction
 * KPIs consolidados del ciclo agrícola para la Dirección
 */
router.get('/direction', authenticateJWT, async (req, res) => {
  try {
    const data = await statsRepository.getDirectionKPIs();
    return res.json(data);
  } catch (err) {
    console.error('Error en /api/stats/direction:', err);
    return res.status(500).json({ error: 'Error al obtener KPIs de dirección.' });
  }
});

/**
 * POST /api/stats/cron-trigger
 * Disparador manual para pruebas de alertas y cortes programados
 */
router.post('/cron-trigger', authenticateJWT, requireRole('supervisor', 'direccion', 'it'), async (req, res) => {
  try {
    const { type = 'evening' } = req.body;
    const { runEveningCheck, runNightlyTablero, runMorningAlerts, runDailyGeneralReport } = require('../bot/cron');

    if (type === 'general') {
      const result = await runDailyGeneralReport();
      return res.json({ success: true, type: '07:30 Reporte General de Proyectos y Tareas', result });
    } else if (type === 'evening') {
      const result = await runEveningCheck();
      return res.json({ success: true, type: '21:00 Reclamo de Obras Sin Reporte', result });
    } else if (type === 'tablero') {
      const result = await runNightlyTablero();
      return res.json({ success: true, type: '21:30 Corte del Tablero de Control', result });
    } else if (type === 'morning') {
      const result = await runMorningAlerts();
      return res.json({ success: true, type: '08:00 Alertas Matutinas', result });
    } else {
      return res.status(400).json({ error: 'Tipo de alerta inválido. Opciones: general, evening, tablero, morning.' });
    }
  } catch (err) {
    console.error('Error en /cron-trigger:', err);
    return res.status(500).json({ error: 'Error ejecutando cron manual.' });
  }
});

module.exports = router;
