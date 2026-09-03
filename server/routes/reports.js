const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { db } = require('../db/database');
const { authenticateJWT } = require('../middleware/auth');

/**
 * POST /api/reports/sync
 * Sincronización idempotente por client_uuid con cálculo de horómetros y reglas de alerta
 */
router.post('/sync', authenticateJWT, async (req, res) => {
  try {
    let reports = req.body;
    if (!Array.isArray(reports)) {
      reports = reports.reports || [reports];
    }

    if (!reports || reports.length === 0) {
      return res.status(400).json({ error: 'No se enviaron reportes para sincronizar.' });
    }

    const results = [];
    let syncedCount = 0;
    let ignoredCount = 0;

    for (const item of reports) {
      const {
        client_uuid,
        proyecto_id,
        hito_id,
        tarea_id,
        obra_id,
        fecha_operativa,
        autor_nombre,
        texto_original,
        nota,
        es_sin_actividad,
        motivo_sin_actividad,
        lineas = [],
        cuadrilla = [],
        maquinaria = [],
        fotos = []
      } = item;

      if (!client_uuid) {
        results.push({ client_uuid: null, status: 'error', message: 'client_uuid es requerido.' });
        continue;
      }

      // Verificar si ya existe este client_uuid (idempotencia)
      const existing = await db.get('SELECT id, client_uuid FROM reporte WHERE client_uuid = ?', [client_uuid]);
      if (existing) {
        ignoredCount++;
        results.push({ client_uuid, status: 'ignored', message: 'Reporte ya existía previamente en el servidor.' });
        continue;
      }

      const opDate = fecha_operativa || new Date().toISOString().split('T')[0];
      const author = autor_nombre || req.user.nombre || 'Operador de Campo';

      // Insertar reporte principal
      const repRes = await db.run(
        `INSERT INTO reporte (
          client_uuid, proyecto_id, hito_id, tarea_id, obra_id,
          recibido_en, fecha_operativa, autor_nombre, texto_original,
          nota, estado, es_sin_actividad, motivo_sin_actividad
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, 'confirmado', ?, ?)`,
        [
          client_uuid,
          proyecto_id || null,
          hito_id || null,
          tarea_id || null,
          obra_id || null,
          opDate,
          author,
          texto_original || null,
          nota || null,
          es_sin_actividad ? 1 : 0,
          motivo_sin_actividad || null
        ]
      );

      const reporteId = repRes.lastID;

      // Si no es un día sin actividad, procesar líneas, avance de tarea, cuadrilla y horómetros
      if (!es_sin_actividad) {
        // 1. Líneas de avance
        let totalAvanceHa = 0;
        for (const line of lineas) {
          const cant = parseFloat(line.cantidad) || 0;
          const cantHa = parseFloat(line.cantidad_ha) || cant;
          totalAvanceHa += cantHa;

          await db.run(
            `INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              reporteId,
              line.predio_id || null,
              line.actividad_id || 'actividad_general',
              cant,
              line.unidad || 'ha',
              cantHa,
              line.fuente || 'campo'
            ]
          );
        }

        // Actualizar acumulado en la tarea correspondiente
        if (tarea_id && totalAvanceHa > 0) {
          await db.run(
            `UPDATE tarea
             SET cantidad_acumulada = cantidad_acumulada + ?,
                 estado = CASE WHEN (cantidad_acumulada + ?) >= cantidad_meta THEN 'completada' ELSE estado END
             WHERE id = ?`,
            [totalAvanceHa, totalAvanceHa, tarea_id]
          );
        }

        // 2. Cuadrilla
        for (const c of cuadrilla) {
          const count = parseInt(c.headcount, 10) || 0;
          if (count > 0) {
            await db.run(
              `INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount)
               VALUES (?, ?, ?)`,
              [reporteId, c.rol_id, count]
            );
          }
        }

        // 3. Lecturas de máquina y actualización de horómetros
        for (const m of maquinaria) {
          const maquinaId = parseInt(m.maquina_id, 10);
          const hInicio = parseFloat(m.horometro_inicio) || 0;
          const hFin = parseFloat(m.horometro_fin) || hInicio;
          const horasTrab = parseFloat(m.horas_trabajadas) || Math.max(0, hFin - hInicio);
          const litros = parseFloat(m.litros_diesel) || 0;

          if (maquinaId) {
            await db.run(
              `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [reporteId, maquinaId, hInicio, hFin, horasTrab, litros]
            );

            // Obtener máquina actual para verificar regla de mantenimiento preventivo (280 hrs)
            const maq = await db.get('SELECT id, horometro_actual, ultimo_servicio_hr FROM maquina WHERE id = ?', [maquinaId]);
            if (maq) {
              const nuevoHorometro = Math.max(maq.horometro_actual, hFin);
              const hrsDesdeServicio = nuevoHorometro - (maq.ultimo_servicio_hr || 0);

              // Regla: si hrsDesdeServicio >= 280 (aviso preventivo cuando falten <= 20 hrs para las 300 hrs)
              const alerta = hrsDesdeServicio >= 280 ? 1 : 0;

              await db.run(
                `UPDATE maquina
                 SET horometro_actual = ?,
                     alerta_mantenimiento = ?
                 WHERE id = ?`,
                [nuevoHorometro, alerta, maquinaId]
              );
            }
          }
        }
      }

      // 4. Guardar evidencias fotográficas si se incluyeron
      const savedFotos = [];
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      if (Array.isArray(fotos) && fotos.length > 0) {
        for (let i = 0; i < fotos.length; i++) {
          const fotoItem = fotos[i];
          const dataUri = typeof fotoItem === 'string' ? fotoItem : (fotoItem.data || fotoItem.url);
          const descripcion = typeof fotoItem === 'object' ? (fotoItem.descripcion || '') : '';

          if (dataUri && dataUri.startsWith('data:image')) {
            try {
              // Parse data URI: data:image/jpeg;base64,...
              const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
              if (matches) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const base64Data = matches[2];
                const filename = `foto_${client_uuid}_${Date.now()}_${i}.${ext}`;
                const filePath = path.join(uploadsDir, filename);
                fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

                const publicUrl = `/uploads/${filename}`;
                await db.run(
                  `INSERT INTO reporte_foto (reporte_id, archivo_ruta, url, descripcion)
                   VALUES (?, ?, ?, ?)`,
                  [reporteId, filePath, publicUrl, descripcion]
                );

                savedFotos.push({ url: publicUrl, filePath, descripcion });
              }
            } catch (err) {
              console.warn('⚠️ Error al procesar imagen base64:', err.message);
            }
          } else if (dataUri && dataUri.startsWith('/uploads/')) {
            // Ya es una ruta existente
            await db.run(
              `INSERT INTO reporte_foto (reporte_id, archivo_ruta, url, descripcion)
               VALUES (?, ?, ?, ?)`,
              [reporteId, path.join(uploadsDir, path.basename(dataUri)), dataUri, descripcion]
            );
            savedFotos.push({ url: dataUri, filePath: path.join(uploadsDir, path.basename(dataUri)), descripcion });
          }
        }
      }

      // Notificar al tema #Reportes de Telegram si el supergrupo está configurado
      try {
        const { notifyReporte } = require('../bot/bot');
        const obraObj = obra_id ? await db.get('SELECT nombre FROM obra WHERE id = ?', [obra_id]) : null;
        const projObj = proyecto_id ? await db.get('SELECT nombre FROM proyecto WHERE id = ?', [proyecto_id]) : null;
        notifyReporte({
          obraNombre: obraObj?.nombre,
          proyectoNombre: projObj?.nombre,
          fechaOperativa: opDate,
          autorNombre: author,
          esSinActividad: !!es_sin_actividad,
          motivoSinActividad: motivo_sin_actividad,
          lineas,
          cuadrilla,
          maquinaria,
          fotos: savedFotos,
          clientUuid: client_uuid
        });
      } catch (e) {}

      syncedCount++;
      results.push({ client_uuid, id: reporteId, status: 'synced', fotosCount: savedFotos.length });
    }

    return res.json({
      success: true,
      syncedCount,
      ignoredCount,
      totalReceived: reports.length,
      results
    });
  } catch (err) {
    console.error('Error en /api/reports/sync:', err);
    return res.status(500).json({ error: 'Error interno al sincronizar reportes.' });
  }
});

/**
 * GET /api/reports
 * Consulta de reportes con filtros y detalles
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const { fecha, obra_id, proyecto_id, limit = 50 } = req.query;

    let query = `
      SELECT r.*,
             o.nombre AS obra_nombre,
             p.nombre AS proyecto_nombre,
             h.nombre AS hito_nombre,
             t.nombre AS tarea_nombre
      FROM reporte r
      LEFT JOIN obra o ON r.obra_id = o.id
      LEFT JOIN proyecto p ON r.proyecto_id = p.id
      LEFT JOIN hito h ON r.hito_id = h.id
      LEFT JOIN tarea t ON r.tarea_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha) {
      query += ` AND r.fecha_operativa = ?`;
      params.push(fecha);
    }
    if (obra_id) {
      query += ` AND r.obra_id = ?`;
      params.push(obra_id);
    }
    if (proyecto_id) {
      query += ` AND r.proyecto_id = ?`;
      params.push(proyecto_id);
    }

    query += ` ORDER BY r.fecha_operativa DESC, r.id DESC LIMIT ?`;
    params.push(parseInt(limit, 10));

    const reports = await db.all(query, params);

    // Adjuntar detalles para cada reporte
    for (const r of reports) {
      r.lineas = await db.all('SELECT * FROM reporte_linea WHERE reporte_id = ?', [r.id]);
      r.cuadrilla = await db.all('SELECT * FROM reporte_cuadrilla WHERE reporte_id = ?', [r.id]);
      r.maquinaria = await db.all(`
        SELECT lm.*, m.codigo AS maquina_codigo, m.modelo AS maquina_modelo
        FROM lectura_maquina lm
        JOIN maquina m ON lm.maquina_id = m.id
        WHERE lm.reporte_id = ?
      `, [r.id]);
      r.fotos = await db.all('SELECT id, url, descripcion, creado_en FROM reporte_foto WHERE reporte_id = ?', [r.id]);
    }

    return res.json({ reports });
  } catch (err) {
    console.error('Error en GET /api/reports:', err);
    return res.status(500).json({ error: 'Error al consultar reportes.' });
  }
});

module.exports = router;
