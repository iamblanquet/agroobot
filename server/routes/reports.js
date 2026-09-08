const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const reportRepository = require('../repositories/reportRepository');
const projectRepository = require('../repositories/projectRepository');
const supabase = require('../db/supabase');
const { authenticateJWT } = require('../middleware/auth');
const { getOperationalDate } = require('../utils/operationalDate');

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

    for (const reportData of reports) {
      const {
        client_uuid,
        proyecto_id,
        hito_id,
        tarea_id,
        obra_id,
        fecha_operativa,
        hora_offline,
        creado_offline,
        autor_nombre,
        texto_original,
        nota,
        es_sin_actividad,
        motivo_sin_actividad,
        lineas = [],
        cuadrilla = [],
        maquinaria = [],
        fotos = []
      } = reportData;

      if (!client_uuid) {
        results.push({ client_uuid: null, status: 'error', error: 'client_uuid es requerido' });
        continue;
      }

      // Idempotencia: Verificar si ya existe este reporte
      const existing = await reportRepository.findByClientUuid(client_uuid);
      if (existing) {
        ignoredCount++;
        results.push({ client_uuid, id: existing.id, status: 'ignored_duplicate' });
        continue;
      }

      // Validar estructuras mínimas
      if (!Array.isArray(lineas) || !Array.isArray(cuadrilla) || !Array.isArray(maquinaria) || !Array.isArray(fotos)) {
        results.push({ client_uuid, status: 'error', error: 'Formato inválido de arrays relacionales' });
        continue;
      }

      try {
        await reportRepository.validateReferences({ proyecto_id, hito_id, tarea_id, obra_id, lineas, maquinaria });
      } catch (validationError) {
        results.push({ client_uuid, status: 'error', message: validationError.message });
        continue;
      }

      const opDate = fecha_operativa || getOperationalDate();
      const horaOff = hora_offline || new Date().toTimeString().split(' ')[0];
      const creadoOff = creado_offline || new Date().toISOString();
      const author = autor_nombre || req.user?.nombre || req.user?.username || 'Anónimo';

      // Procesar y guardar evidencias fotográficas (Soporte Supabase Storage y Disco Local)
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const savedFotos = [];
      const useCloudStorage = Boolean(
        process.env.SUPABASE_AUTH_ENABLED === 'true' &&
        supabase.isSupabaseConfigured()
      );

      if (Array.isArray(fotos) && fotos.length > 0) {
        for (let i = 0; i < fotos.length; i++) {
          const fotoItem = fotos[i];
          const dataUri = typeof fotoItem === 'string' ? fotoItem : (fotoItem.data || fotoItem.url);
          const descripcion = typeof fotoItem === 'object' ? (fotoItem.descripcion || '') : '';

          if (dataUri && dataUri.startsWith('data:image')) {
            try {
              const matches = dataUri.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
              if (matches) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const mimeType = matches[1] === 'jpg' ? 'image/jpeg' : `image/${matches[1]}`;
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                const filename = `foto_${client_uuid}_${Date.now()}_${i}.${ext}`;
                const filePath = path.join(uploadsDir, filename);

                // Guardar copia local en uploads si se tiene acceso al sistema de archivos
                try {
                  fs.writeFileSync(filePath, buffer);
                } catch (fsErr) {
                  console.warn('⚠️ No se pudo guardar copia local en disco:', fsErr.message);
                }

                let publicUrl = `/uploads/${filename}`;

                // Si Supabase Storage está activo, subir a bucket 'reportes'
                if (useCloudStorage) {
                  try {
                    const storagePath = `evidencias/${filename}`;
                    const uploaded = await supabase.uploadStorageFile('reportes', storagePath, buffer, mimeType);
                    publicUrl = uploaded.publicUrl;
                    console.log(`📷 [Supabase Storage] Evidencia subida: ${publicUrl}`);
                  } catch (storageErr) {
                    console.warn('⚠️ Error al subir a Supabase Storage, manteniendo copia local:', storageErr.message);
                  }
                }

                savedFotos.push({ url: publicUrl, filePath, descripcion });
              }
            } catch (err) {
              console.warn('⚠️ Error al procesar imagen base64:', err.message);
            }
          } else if (dataUri && (dataUri.startsWith('http://') || dataUri.startsWith('https://'))) {
            savedFotos.push({ url: dataUri, filePath: dataUri, descripcion });
          } else if (dataUri && dataUri.startsWith('/uploads/')) {
            savedFotos.push({ url: dataUri, filePath: path.join(uploadsDir, path.basename(dataUri)), descripcion });
          }
        }
      }

      // Guardar mediante repositorio (soporte dual SQLite / Supabase)
      const reporteId = await reportRepository.syncReport({
        client_uuid,
        proyecto_id,
        hito_id,
        tarea_id,
        obra_id,
        fecha_operativa: opDate,
        hora_offline: horaOff,
        creado_offline: creadoOff,
        autor_nombre: author,
        texto_original,
        nota,
        es_sin_actividad,
        motivo_sin_actividad,
        lineas,
        cuadrilla,
        maquinaria,
        savedFotos
      });

      // Notificar al tema #Reportes de Telegram si está configurado
      try {
        const { notifyReporte } = require('../bot/bot');
        const obraObj = obra_id ? await projectRepository.findObraById(obra_id) : null;
        const projObj = proyecto_id ? await projectRepository.findProjectById(proyecto_id) : null;
        notifyReporte({
          obraNombre: obraObj?.nombre,
          proyectoNombre: projObj?.nombre,
          fechaOperativa: opDate,
          horaOffline: horaOff,
          creadoOffline: creadoOff,
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

    const reports = await reportRepository.findAll({
      fecha_desde: fecha,
      fecha_hasta: fecha,
      obra_id: obra_id ? Number(obra_id) : undefined,
      proyecto_id: proyecto_id ? Number(proyecto_id) : undefined,
      limit: parseInt(limit, 10) || 50
    });

    for (const r of reports) {
      r.lineas = await reportRepository.findLinesByReportId(r.id);
      r.cuadrilla = await reportRepository.findCrewByReportId(r.id);
      r.maquinaria = await reportRepository.findMachineReadingsByReportId(r.id);
      r.fotos = await reportRepository.findPhotosByReportId(r.id);
    }

    return res.json({ reports });
  } catch (err) {
    console.error('Error en GET /api/reports:', err);
    return res.status(500).json({ error: 'Error al consultar reportes.' });
  }
});

/**
 * GET /api/reports/:id
 * Consulta de reporte específico con sus detalles
 */
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const { id } = req.params;
    const report = await reportRepository.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Reporte no encontrado.' });
    }

    report.lineas = await reportRepository.findLinesByReportId(id);
    report.cuadrilla = await reportRepository.findCrewByReportId(id);
    report.maquinaria = await reportRepository.findMachineReadingsByReportId(id);
    report.fotos = await reportRepository.findPhotosByReportId(id);

    return res.json({ report });
  } catch (err) {
    console.error('Error en GET /api/reports/:id:', err);
    return res.status(500).json({ error: 'Error al consultar reporte.' });
  }
});

module.exports = router;
