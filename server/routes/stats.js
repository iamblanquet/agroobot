const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/stats/supervisor
 * Retorna los 4 Widgets Canónicos del Supervisor + estado de maquinaria
 */
router.get('/supervisor', authenticateJWT, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Widget 1: Obras sin reporte hoy (y cálculo de días de atraso)
    const activeObras = await db.all(`
      SELECT o.id, o.nombre, o.fase_actual, o.estado, p.nombre AS proyecto_nombre
      FROM obra o
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.estado = 'operacion'
      ORDER BY o.id ASC
    `);

    const obrasSinReporte = [];
    for (const obra of activeObras) {
      const hoyRep = await db.get(
        'SELECT id FROM reporte WHERE obra_id = ? AND fecha_operativa = ?',
        [obra.id, todayStr]
      );

      if (!hoyRep) {
        // Buscar el último reporte recibido para esta obra
        const lastRep = await db.get(
          'SELECT fecha_operativa FROM reporte WHERE obra_id = ? ORDER BY fecha_operativa DESC LIMIT 1',
          [obra.id]
        );

        let diasAtraso = 1;
        if (lastRep && lastRep.fecha_operativa) {
          const diffTime = Math.abs(new Date(todayStr) - new Date(lastRep.fecha_operativa));
          diasAtraso = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }

        obrasSinReporte.push({
          ...obra,
          ultimo_reporte_fecha: lastRep ? lastRep.fecha_operativa : 'Sin reportes previos',
          dias_atraso: diasAtraso
        });
      }
    }

    // 2. Widget 2: Avance contra meta (Campo vs Medición Dron vs Meta)
    const proyectosAvance = await db.all('SELECT id, nombre, tipo, superficie_meta_ha FROM proyecto ORDER BY id ASC');
    const comparativaAvance = [];

    for (const p of proyectosAvance) {
      // Suma de hectáreas reportadas por campo
      const campoRes = await db.get(`
        SELECT COALESCE(SUM(rl.cantidad_ha), 0) AS total_ha_campo
        FROM reporte_linea rl
        JOIN reporte r ON rl.reporte_id = r.id
        WHERE r.proyecto_id = ? AND rl.fuente = 'campo'
      `, [p.id]);

      // Tareas acumuladas
      const tareasRes = await db.get(`
        SELECT COALESCE(SUM(cantidad_acumulada), 0) AS acum_tareas,
               COALESCE(SUM(cantidad_meta), 0) AS meta_tareas
        FROM tarea
        WHERE proyecto_id = ?
      `, [p.id]);

      // Última medición de dron
      const dronRes = await db.get(`
        SELECT hectareas, fecha
        FROM medicion
        WHERE proyecto_id = ? AND fuente = 'dron'
        ORDER BY fecha DESC LIMIT 1
      `, [p.id]);

      const haCampo = parseFloat(tareasRes?.acum_tareas || campoRes?.total_ha_campo || 0);
      const haDron = dronRes ? parseFloat(dronRes.hectareas) : null;
      const haMeta = parseFloat(p.superficie_meta_ha) || 1;

      comparativaAvance.push({
        proyecto_id: p.id,
        proyecto_nombre: p.nombre,
        tipo: p.tipo,
        meta_ha: haMeta,
        campo_ha: haCampo,
        dron_ha: haDron,
        dron_fecha: dronRes?.fecha || null,
        porcentaje_campo: Math.min(100, Math.round((haCampo / haMeta) * 100)),
        porcentaje_dron: haDron ? Math.min(100, Math.round((haDron / haMeta) * 100)) : null,
        discrepancia_ha: haDron !== null ? parseFloat((haCampo - haDron).toFixed(2)) : 0
      });
    }

    // 3. Widget 3: Incidencias abiertas y folios activos
    const incidenciasAbiertas = await db.all(`
      SELECT i.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE i.estado != 'cerrada'
      ORDER BY i.abierta_en DESC
    `);

    // 4. Widget 4: Bloqueado por material (requerido - en_sitio > 0)
    const materialesBloqueados = await db.all(`
      SELECT m.*, (m.requerido - m.en_sitio) AS deficit,
             o.nombre AS obra_nombre, p.nombre AS proyecto_nombre,
             CASE WHEN m.eta IS NOT NULL AND m.eta < date('now') THEN 1 ELSE 0 END AS eta_vencido
      FROM material m
      JOIN obra o ON m.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE (m.requerido - m.en_sitio) > 0
      ORDER BY eta_vencido DESC, m.eta ASC
    `);

    // Monitor de horómetros con alertas preventivas
    const maquinas = await db.all('SELECT * FROM maquina ORDER BY alerta_mantenimiento DESC, codigo ASC');
    const maquinasCalculadas = maquinas.map((m) => {
      const hrsDesdeServicio = m.horometro_actual - (m.ultimo_servicio_hr || 0);
      const hrsRestantes = Math.max(0, 300 - hrsDesdeServicio);
      return {
        ...m,
        horas_desde_servicio: hrsDesdeServicio,
        horas_restantes: hrsRestantes,
        alerta_activa: hrsDesdeServicio >= 280
      };
    });

    return res.json({
      widgets: {
        obras_sin_reporte_hoy: obrasSinReporte,
        avance_contra_meta: comparativaAvance,
        incidencias_abiertas: incidenciasAbiertas,
        bloqueado_por_material: materialesBloqueados
      },
      maquinaria: maquinasCalculadas
    });
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
    // Proyectos totales y superficie meta consolidada
    const metas = await db.get(`
      SELECT COUNT(*) AS total_proyectos,
             COALESCE(SUM(superficie_meta_ha), 0) AS total_meta_ha
      FROM proyecto
    `);

    // Avance de tareas por tipo / estado
    const tareasConsolidadas = await db.get(`
      SELECT COALESCE(SUM(cantidad_acumulada), 0) AS total_habilitadas_ha,
             COALESCE(SUM(cantidad_meta), 0) AS total_planificadas_ha
      FROM tarea
    `);

    // Hectáreas medidas por dron
    const dronTotal = await db.get(`
      SELECT COALESCE(SUM(hectareas), 0) AS total_dron_ha
      FROM (
        SELECT proyecto_id, hectareas, MAX(fecha)
        FROM medicion
        WHERE fuente = 'dron'
        GROUP BY proyecto_id
      )
    `);

    // Diesel total consumido y horas máquina trabajadas
    const dieselHours = await db.get(`
      SELECT COALESCE(SUM(litros_diesel), 0) AS total_diesel_litros,
             COALESCE(SUM(horas_trabajadas), 0) AS total_horas_maquina
      FROM lectura_maquina
    `);

    // Resumen de incidencias
    const incidenciasSummary = await db.get(`
      SELECT
        COUNT(*) AS total_historico,
        SUM(CASE WHEN estado = 'cerrada' THEN 1 ELSE 0 END) AS cerradas,
        SUM(CASE WHEN estado != 'cerrada' THEN 1 ELSE 0 END) AS activas
      FROM incidencia
    `);

    // Proyectos detallados para tabla de dirección
    const proyectosList = await db.all(`
      SELECT p.*,
             (SELECT COALESCE(SUM(cantidad_acumulada), 0) FROM tarea WHERE proyecto_id = p.id) AS ha_campo,
             (SELECT hectareas FROM medicion WHERE proyecto_id = p.id AND fuente = 'dron' ORDER BY fecha DESC LIMIT 1) AS ha_dron,
             (SELECT COUNT(*) FROM obra WHERE proyecto_id = p.id) AS num_obras,
             (SELECT COUNT(*) FROM incidencia i JOIN obra o ON i.obra_id = o.id WHERE o.proyecto_id = p.id AND i.estado != 'cerrada') AS incidencias_activas
      FROM proyecto p
    `);

    const totalMetaHa = metas?.total_meta_ha || 0;
    const totalCampoHa = tareasConsolidadas?.total_habilitadas_ha || 0;
    const totalDronHa = dronTotal?.total_dron_ha || 0;
    const discrepanciaGeneralHa = parseFloat((totalCampoHa - totalDronHa).toFixed(2));

    return res.json({
      kpis: {
        total_proyectos: metas?.total_proyectos || 0,
        total_meta_ha: totalMetaHa,
        total_campo_ha: totalCampoHa,
        total_dron_ha: totalDronHa,
        porcentaje_avance_global: totalMetaHa > 0 ? Math.min(100, Math.round((totalCampoHa / totalMetaHa) * 100)) : 0,
        discrepancia_ha: discrepanciaGeneralHa,
        porcentaje_discrepancia: totalDronHa > 0 ? parseFloat((((totalCampoHa - totalDronHa) / totalDronHa) * 100).toFixed(1)) : 0,
        total_diesel_litros: dieselHours?.total_diesel_litros || 0,
        total_horas_maquina: dieselHours?.total_horas_maquina || 0,
        incidencias_activas: incidenciasSummary?.activas || 0,
        incidencias_cerradas: incidenciasSummary?.cerradas || 0
      },
      proyectos: proyectosList
    });
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
    const { runEveningCheck, runNightlyTablero, runMorningAlerts } = require('../bot/cron');

    if (type === 'evening') {
      const result = await runEveningCheck();
      return res.json({ success: true, type: '21:00 Reclamo de Obras Sin Reporte', result });
    } else if (type === 'tablero') {
      const result = await runNightlyTablero();
      return res.json({ success: true, type: '21:30 Corte del Tablero de Control', result });
    } else if (type === 'morning') {
      const result = await runMorningAlerts();
      return res.json({ success: true, type: '08:00 Alertas Matutinas', result });
    } else {
      return res.status(400).json({ error: 'Tipo de alerta inválido. Opciones: evening, tablero, morning.' });
    }
  } catch (err) {
    console.error('Error en /cron-trigger:', err);
    return res.status(500).json({ error: 'Error ejecutando cron manual.' });
  }
});

module.exports = router;
