const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const reportRepository = {
  async findByClientUuid(client_uuid) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('reporte', {
        select: '*',
        filters: { client_uuid: `eq.${client_uuid}`, limit: '1' }
      });
      return rows[0] || null;
    }
    return db.get('SELECT * FROM reporte WHERE client_uuid = ?', [client_uuid]);
  },

  async findById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('reporte', {
        select: '*,obra:obra_id(id,nombre),proyecto:proyecto_id(id,nombre)',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        ...r,
        obra_nombre: r.obra ? r.obra.nombre : null,
        proyecto_nombre: r.proyecto ? r.proyecto.nombre : null
      };
    }
    return db.get(`
      SELECT r.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM reporte r
      LEFT JOIN obra o ON r.obra_id = o.id
      LEFT JOIN proyecto p ON r.proyecto_id = p.id
      WHERE r.id = ?
    `, [id]);
  },

  async findAll({ fecha_desde, fecha_hasta, obra_id, proyecto_id, limit = 50 } = {}) {
    if (useSupabase()) {
      const filters = { order: 'recibido_en.desc', limit: String(limit) };
      if (fecha_desde) filters.fecha_operativa = `gte.${fecha_desde}`;
      if (fecha_hasta) filters.fecha_operativa = `lte.${fecha_hasta}`;
      if (obra_id) filters.obra_id = `eq.${obra_id}`;
      if (proyecto_id) filters.proyecto_id = `eq.${proyecto_id}`;

      const rows = await supabase.selectRows('reporte', {
        select: '*,obra:obra_id(id,nombre),proyecto:proyecto_id(id,nombre),hito:hito_id(id,nombre),tarea:tarea_id(id,nombre)',
        filters
      });

      return (rows || []).map(r => ({
        ...r,
        obra_nombre: r.obra ? r.obra.nombre : null,
        proyecto_nombre: r.proyecto ? r.proyecto.nombre : null,
        hito_nombre: r.hito ? r.hito.nombre : null,
        tarea_nombre: r.tarea ? r.tarea.nombre : null
      }));
    }

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

    if (fecha_desde) {
      query += ' AND r.fecha_operativa >= ?';
      params.push(fecha_desde);
    }
    if (fecha_hasta) {
      query += ' AND r.fecha_operativa <= ?';
      params.push(fecha_hasta);
    }
    if (obra_id) {
      query += ' AND r.obra_id = ?';
      params.push(obra_id);
    }
    if (proyecto_id) {
      query += ' AND r.proyecto_id = ?';
      params.push(proyecto_id);
    }

    query += ' ORDER BY r.recibido_en DESC LIMIT ?';
    params.push(limit);

    return db.all(query, params);
  },

  async findLinesByReportId(reporteId) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('reporte_linea', {
        select: '*,predio:predio_id(id,nombre)',
        filters: { reporte_id: `eq.${reporteId}` }
      });
      return (rows || []).map(l => ({
        ...l,
        predio_nombre: l.predio ? l.predio.nombre : null
      }));
    }

    return db.all(`
      SELECT rl.*, pr.nombre AS predio_nombre
      FROM reporte_linea rl
      LEFT JOIN predio pr ON rl.predio_id = pr.id
      WHERE rl.reporte_id = ?
    `, [reporteId]);
  },

  async findCrewByReportId(reporteId) {
    if (useSupabase()) {
      return supabase.selectRows('reporte_cuadrilla', {
        select: '*',
        filters: { reporte_id: `eq.${reporteId}` }
      });
    }
    return db.all('SELECT * FROM reporte_cuadrilla WHERE reporte_id = ?', [reporteId]);
  },

  async findPhotosByReportId(reporteId) {
    if (useSupabase()) {
      return supabase.selectRows('reporte_foto', {
        select: '*',
        filters: { reporte_id: `eq.${reporteId}` }
      });
    }
    return db.all('SELECT * FROM reporte_foto WHERE reporte_id = ?', [reporteId]);
  },

  async findMachineReadingsByReportId(reporteId) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('lectura_maquina', {
        select: '*,maquina:maquina_id(id,codigo,nombre,modelo)',
        filters: { reporte_id: `eq.${reporteId}` }
      });
      return (rows || []).map(lm => ({
        ...lm,
        maquina_codigo: lm.maquina ? lm.maquina.codigo : null,
        maquina_modelo: lm.maquina ? lm.maquina.modelo : null
      }));
    }

    return db.all(`
      SELECT lm.*, m.codigo AS maquina_codigo, m.modelo AS maquina_modelo
      FROM lectura_maquina lm
      JOIN maquina m ON lm.maquina_id = m.id
      WHERE lm.reporte_id = ?
    `, [reporteId]);
  },

  async validateReferences({ proyecto_id, hito_id, tarea_id, obra_id, lineas = [], maquinaria = [] }) {
    const projectId = proyecto_id ? Number(proyecto_id) : null;
    const hitoId = hito_id ? Number(hito_id) : null;
    const tareaId = tarea_id ? Number(tarea_id) : null;
    const obraId = obra_id ? Number(obra_id) : null;

    if (useSupabase()) {
      if (projectId) {
        const rows = await supabase.selectRows('proyecto', { select: 'id', filters: { id: `eq.${projectId}`, limit: '1' } });
        if (!rows.length) throw new Error('Proyecto no encontrado.');
      }
      if (hitoId) {
        const rows = await supabase.selectRows('hito', { select: 'proyecto_id', filters: { id: `eq.${hitoId}`, limit: '1' } });
        if (!rows.length || (projectId && Number(rows[0].proyecto_id) !== projectId)) throw new Error('Hito no válido para el proyecto.');
      }
      if (tareaId) {
        const rows = await supabase.selectRows('tarea', { select: 'proyecto_id,hito_id', filters: { id: `eq.${tareaId}`, limit: '1' } });
        if (!rows.length || (projectId && Number(rows[0].proyecto_id) !== projectId) || (hitoId && Number(rows[0].hito_id) !== hitoId)) {
          throw new Error('Tarea no válida para el proyecto o hito.');
        }
      }
      if (obraId) {
        const rows = await supabase.selectRows('obra', { select: 'proyecto_id', filters: { id: `eq.${obraId}`, limit: '1' } });
        if (!rows.length || (projectId && Number(rows[0].proyecto_id) !== projectId)) throw new Error('Frente no válido para el proyecto.');
      }
      for (const line of lineas) {
        if (line.predio_id) {
          const rows = await supabase.selectRows('predio', { select: 'id', filters: { id: `eq.${Number(line.predio_id)}`, limit: '1' } });
          if (!rows.length) throw new Error('Predio no encontrado.');
        }
      }
      for (const machine of maquinaria) {
        if (!machine.maquina_id) throw new Error('Máquina no encontrada.');
        const rows = await supabase.selectRows('maquina', { select: 'id', filters: { id: `eq.${Number(machine.maquina_id)}`, limit: '1' } });
        if (!rows.length) throw new Error('Máquina no encontrada.');
      }
      return true;
    }

    if (projectId && !await db.get('SELECT id FROM proyecto WHERE id = ?', [projectId])) throw new Error('Proyecto no encontrado.');
    if (hitoId) {
      const hito = await db.get('SELECT proyecto_id FROM hito WHERE id = ?', [hitoId]);
      if (!hito || (projectId && hito.proyecto_id !== projectId)) throw new Error('Hito no válido para el proyecto.');
    }
    if (tareaId) {
      const tarea = await db.get('SELECT proyecto_id, hito_id FROM tarea WHERE id = ?', [tareaId]);
      if (!tarea || (projectId && tarea.proyecto_id !== projectId) || (hitoId && tarea.hito_id !== hitoId)) throw new Error('Tarea no válida para el proyecto o hito.');
    }
    if (obraId) {
      const obra = await db.get('SELECT proyecto_id FROM obra WHERE id = ?', [obraId]);
      if (!obra || (projectId && obra.proyecto_id !== projectId)) throw new Error('Frente no válido para el proyecto.');
    }
    for (const line of lineas) {
      if (line.predio_id && !await db.get('SELECT id FROM predio WHERE id = ?', [Number(line.predio_id)])) throw new Error('Predio no encontrado.');
    }
    for (const machine of maquinaria) {
      if (!machine.maquina_id || !await db.get('SELECT id FROM maquina WHERE id = ?', [Number(machine.maquina_id)])) throw new Error('Máquina no encontrada.');
    }
    return true;
  },

  async syncReport({
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
    es_sin_actividad = false,
    motivo_sin_actividad = null,
    lineas = [],
    cuadrilla = [],
    maquinaria = [],
    savedFotos = []
  }) {
    if (useSupabase()) {
      const createdRep = await supabase.insertRow('reporte', {
        client_uuid,
        proyecto_id: proyecto_id || null,
        hito_id: hito_id || null,
        tarea_id: tarea_id || null,
        obra_id: obra_id || null,
        recibido_en: new Date().toISOString(),
        fecha_operativa,
        hora_offline: hora_offline || null,
        creado_offline: creado_offline || null,
        autor_nombre,
        texto_original: texto_original || null,
        nota: nota || null,
        estado: 'confirmado',
        es_sin_actividad: Boolean(es_sin_actividad),
        motivo_sin_actividad: motivo_sin_actividad || null
      });

      const reporteId = createdRep.id;

      if (!es_sin_actividad) {
        let totalAvanceHa = 0;
        for (const line of lineas) {
          const cant = parseFloat(line.cantidad) || 0;
          const cantHa = parseFloat(line.cantidad_ha) || cant;
          totalAvanceHa += cantHa;
          await supabase.insertRow('reporte_linea', {
            reporte_id: reporteId,
            predio_id: line.predio_id || null,
            actividad_id: line.actividad_id || 'actividad_general',
            cantidad: cant,
            unidad: line.unidad || 'ha',
            cantidad_ha: cantHa,
            fuente: line.fuente || 'campo'
          });
        }

        if (tarea_id && totalAvanceHa > 0) {
          const tareas = await supabase.selectRows('tarea', { select: 'cantidad_acumulada,cantidad_meta', filters: { id: `eq.${tarea_id}`, limit: '1' } });
          if (tareas.length > 0) {
            const currentAcum = parseFloat(tareas[0].cantidad_acumulada) || 0;
            const meta = parseFloat(tareas[0].cantidad_meta) || 0;
            const newAcum = currentAcum + totalAvanceHa;
            const newEstado = meta > 0 && newAcum >= meta ? 'completada' : undefined;
            const updatePayload = { cantidad_acumulada: newAcum };
            if (newEstado) updatePayload.estado = newEstado;
            await supabase.updateRows('tarea', { id: `eq.${tarea_id}` }, updatePayload);
          }
        }

        for (const c of cuadrilla) {
          const count = parseInt(c.headcount, 10) || 0;
          if (count > 0) {
            await supabase.insertRow('reporte_cuadrilla', {
              reporte_id: reporteId,
              rol_id: c.rol_id,
              headcount: count
            });
          }
        }

        for (const m of maquinaria) {
          const maquinaId = parseInt(m.maquina_id, 10);
          const hInicio = parseFloat(m.horometro_inicio) || 0;
          const hFin = parseFloat(m.horometro_fin) || hInicio;
          const horasTrab = parseFloat(m.horas_trabajadas) || Math.max(0, hFin - hInicio);
          const litros = parseFloat(m.litros_diesel) || 0;

          if (maquinaId) {
            await supabase.insertRow('lectura_maquina', {
              reporte_id: reporteId,
              maquina_id: maquinaId,
              horometro_inicio: hInicio,
              horometro_fin: hFin,
              horas_trabajadas: horasTrab,
              litros_diesel: litros
            });

            const maqs = await supabase.selectRows('maquina', { select: 'id,horometro_actual,ultimo_servicio_hr,umbral_servicio_hrs', filters: { id: `eq.${maquinaId}`, limit: '1' } });
            if (maqs.length > 0) {
              const maq = maqs[0];
              const nuevoHorometro = Math.max(maq.horometro_actual, hFin);
              const hrsDesdeServicio = nuevoHorometro - (maq.ultimo_servicio_hr || 0);
              const umbral = Number(maq.umbral_servicio_hrs) || 300;
              const alerta = hrsDesdeServicio >= Math.max(0, umbral - 20);
              await supabase.updateRows('maquina', { id: `eq.${maquinaId}` }, {
                horometro_actual: nuevoHorometro,
                alerta_mantenimiento: alerta
              });
            }
          }
        }
      }

      for (const foto of savedFotos) {
        await supabase.insertRow('reporte_foto', {
          reporte_id: reporteId,
          archivo_ruta: foto.filePath,
          url: foto.url,
          descripcion: foto.descripcion || ''
        });
      }

      return reporteId;
    }

    // Modo SQLite
    let reporteId;
    await db.transaction(async () => {
      const repRes = await db.run(
        `INSERT INTO reporte (
          client_uuid, proyecto_id, hito_id, tarea_id, obra_id,
          recibido_en, fecha_operativa, hora_offline, creado_offline, autor_nombre, texto_original,
          nota, estado, es_sin_actividad, motivo_sin_actividad
        ) VALUES (?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?)`,
        [
          client_uuid,
          proyecto_id || null,
          hito_id || null,
          tarea_id || null,
          obra_id || null,
          fecha_operativa,
          hora_offline || null,
          creado_offline || null,
          autor_nombre,
          texto_original || null,
          nota || null,
          es_sin_actividad ? 1 : 0,
          motivo_sin_actividad || null
        ]
      );
      reporteId = repRes.lastID;

      if (!es_sin_actividad) {
        let totalAvanceHa = 0;
        for (const line of lineas) {
          const cant = parseFloat(line.cantidad) || 0;
          const cantHa = parseFloat(line.cantidad_ha) || cant;
          totalAvanceHa += cantHa;
          await db.run(
            `INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [reporteId, line.predio_id || null, line.actividad_id || 'actividad_general', cant, line.unidad || 'ha', cantHa, line.fuente || 'campo']
          );
        }

        if (tarea_id && totalAvanceHa > 0) {
          await db.run(
            `UPDATE tarea
             SET cantidad_acumulada = cantidad_acumulada + ?,
                 estado = CASE WHEN (cantidad_acumulada + ?) >= cantidad_meta THEN 'completada' ELSE estado END
             WHERE id = ?`,
            [totalAvanceHa, totalAvanceHa, tarea_id]
          );
        }

        for (const c of cuadrilla) {
          const count = parseInt(c.headcount, 10) || 0;
          if (count > 0) {
            await db.run('INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)', [reporteId, c.rol_id, count]);
          }
        }

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

            const maq = await db.get('SELECT id, horometro_actual, ultimo_servicio_hr, umbral_servicio_hrs FROM maquina WHERE id = ?', [maquinaId]);
            if (maq) {
              const nuevoHorometro = Math.max(maq.horometro_actual, hFin);
              const hrsDesdeServicio = nuevoHorometro - (maq.ultimo_servicio_hr || 0);
              const umbral = Number(maq.umbral_servicio_hrs) || 300;
              const alerta = hrsDesdeServicio >= Math.max(0, umbral - 20) ? 1 : 0;
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

      for (const foto of savedFotos) {
        await db.run(
          'INSERT INTO reporte_foto (reporte_id, archivo_ruta, url, descripcion) VALUES (?, ?, ?, ?)',
          [reporteId, foto.filePath, foto.url, foto.descripcion || '']
        );
      }
    });

    return reporteId;
  },

  async addPhoto(reporteId, { archivo_ruta, url, descripcion = '' }) {
    if (useSupabase()) {
      return supabase.insertRow('reporte_foto', {
        reporte_id: reporteId,
        archivo_ruta,
        url,
        descripcion
      });
    }

    const res = await db.run(
      'INSERT INTO reporte_foto (reporte_id, archivo_ruta, url, descripcion) VALUES (?, ?, ?, ?)',
      [reporteId, archivo_ruta, url, descripcion]
    );
    return db.get('SELECT * FROM reporte_foto WHERE id = ?', [res.lastID]);
  }
};

module.exports = reportRepository;
