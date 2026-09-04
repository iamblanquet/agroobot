const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/projects
 * Lista de proyectos con sus hitos, tareas y obras asociadas
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const projects = await db.all(`
      SELECT p.*, u.nombre AS gerente_nombre,
             (SELECT COUNT(*) FROM hito WHERE proyecto_id = p.id) AS total_hitos,
             (SELECT COUNT(*) FROM obra WHERE proyecto_id = p.id) AS total_obras
      FROM proyecto p
      LEFT JOIN usuario u ON p.gerente_id = u.id
      ORDER BY p.id ASC
    `);

    for (const p of projects) {
      p.hitos = await db.all('SELECT * FROM hito WHERE proyecto_id = ? ORDER BY orden ASC, id ASC', [p.id]);
      for (const h of p.hitos) {
        h.tareas = await db.all(`
          SELECT t.*, pr.nombre AS predio_nombre
          FROM tarea t
          LEFT JOIN predio pr ON t.predio_id = pr.id
          WHERE t.hito_id = ?
          ORDER BY t.id ASC
        `, [h.id]);
      }
      p.obras = await db.all('SELECT * FROM obra WHERE proyecto_id = ? ORDER BY id ASC', [p.id]);
      for (const ob of p.obras) {
        ob.predios = await db.all(`
          SELECT pr.id, pr.nombre, pr.superficie_util_ha, pr.regimen
          FROM predio pr
          JOIN obra_predio op ON pr.id = op.predio_id
          WHERE op.obra_id = ?
          ORDER BY pr.nombre ASC
        `, [ob.id]);
      }
      p.mediciones = await db.all('SELECT * FROM medicion WHERE proyecto_id = ? ORDER BY fecha DESC', [p.id]);
    }

    return res.json({ projects });
  } catch (err) {
    console.error('Error en GET /api/projects:', err);
    return res.status(500).json({ error: 'Error al obtener proyectos.' });
  }
});

/**
 * POST /api/projects
 * Crear un nuevo proyecto
 */
router.post('/', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { nombre, tipo, ciclo, superficie_meta_ha = 0, fase_catalogo, gerente_id, fecha_inicio, fecha_fin } = req.body;

    if (!nombre || !tipo || !ciclo) {
      return res.status(400).json({ error: 'Nombre, tipo de cultivo y ciclo agrícola son obligatorios.' });
    }

    const gerente = gerente_id ? parseInt(gerente_id, 10) : req.user.id;

    const result = await db.run(
      `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre.trim(),
        tipo.trim(),
        ciclo.trim(),
        parseFloat(superficie_meta_ha) || 0,
        fase_catalogo || 'Planificación Inicial',
        gerente,
        fecha_inicio || new Date().toISOString().split('T')[0],
        fecha_fin || null
      ]
    );

    const newProject = await db.get('SELECT * FROM proyecto WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, project: newProject });
  } catch (err) {
    console.error('Error al crear proyecto:', err);
    return res.status(500).json({ error: 'Error al crear el proyecto.' });
  }
});

/**
 * PATCH /api/projects/:id
 * Actualizar datos generales del proyecto
 */
router.patch('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin } = req.body;

    const proj = await db.get('SELECT * FROM proyecto WHERE id = ?', [id]);
    if (!proj) {
      return res.status(404).json({ error: 'Proyecto no encontrado.' });
    }

    await db.run(
      `UPDATE proyecto
       SET nombre = ?, tipo = ?, ciclo = ?, superficie_meta_ha = ?,
           fase_catalogo = ?, gerente_id = ?, fecha_inicio = ?, fecha_fin = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : proj.nombre,
        tipo !== undefined ? tipo.trim() : proj.tipo,
        ciclo !== undefined ? ciclo.trim() : proj.ciclo,
        superficie_meta_ha !== undefined ? parseFloat(superficie_meta_ha) : proj.superficie_meta_ha,
        fase_catalogo !== undefined ? fase_catalogo : proj.fase_catalogo,
        gerente_id !== undefined ? gerente_id : proj.gerente_id,
        fecha_inicio !== undefined ? fecha_inicio : proj.fecha_inicio,
        fecha_fin !== undefined ? fecha_fin : proj.fecha_fin,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM proyecto WHERE id = ?', [id]);
    return res.json({ success: true, project: updated });
  } catch (err) {
    console.error('Error al actualizar proyecto:', err);
    return res.status(500).json({ error: 'Error al actualizar proyecto.' });
  }
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM proyecto WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Proyecto eliminado.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar proyecto.' });
  }
});

/**
 * POST /api/projects/:id/hitos
 * Crear un hito dentro de un proyecto
 */
router.post('/:id/hitos', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const proyecto_id = req.params.id;
    const { nombre, descripcion, orden = 1, fecha_meta, superficie_meta_ha = 0, estado = 'pendiente' } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre del hito es obligatorio.' });
    }

    const result = await db.run(
      `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        proyecto_id,
        nombre.trim(),
        descripcion || '',
        parseInt(orden, 10) || 1,
        fecha_meta || null,
        parseFloat(superficie_meta_ha) || 0,
        estado
      ]
    );

    const newHito = await db.get('SELECT * FROM hito WHERE id = ?', [result.lastID]);
    return res.status(201).json({ success: true, hito: newHito });
  } catch (err) {
    console.error('Error al crear hito:', err);
    return res.status(500).json({ error: 'Error al crear hito.' });
  }
});

/**
 * PATCH /api/projects/hitos/:id
 * Actualizar hito
 */
router.patch('/hitos/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado } = req.body;

    const hito = await db.get('SELECT * FROM hito WHERE id = ?', [id]);
    if (!hito) {
      return res.status(404).json({ error: 'Hito no encontrado.' });
    }

    await db.run(
      `UPDATE hito
       SET nombre = ?, descripcion = ?, orden = ?, fecha_meta = ?, superficie_meta_ha = ?, estado = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : hito.nombre,
        descripcion !== undefined ? descripcion : hito.descripcion,
        orden !== undefined ? parseInt(orden, 10) : hito.orden,
        fecha_meta !== undefined ? fecha_meta : hito.fecha_meta,
        superficie_meta_ha !== undefined ? parseFloat(superficie_meta_ha) : hito.superficie_meta_ha,
        estado !== undefined ? estado : hito.estado,
        id
      ]
    );

    // LÓGICA EN CASCADA DESCENDENTE: Si el hito cambia de estado explícitamente
    if (estado !== undefined && estado !== hito.estado) {
      if (estado === 'completado') {
        await db.run("UPDATE tarea SET estado = 'completada' WHERE hito_id = ?", [id]);
      } else if (estado === 'pendiente') {
        await db.run("UPDATE tarea SET estado = 'pendiente' WHERE hito_id = ?", [id]);
      }
    }

    const updated = await db.get('SELECT * FROM hito WHERE id = ?', [id]);
    return res.json({ success: true, hito: updated });
  } catch (err) {
    console.error('Error al actualizar hito:', err);
    return res.status(500).json({ error: 'Error al actualizar hito.' });
  }
});

/**
 * DELETE /api/projects/hitos/:id
 */
router.delete('/hitos/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM hito WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Hito eliminado.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar hito.' });
  }
});

/**
 * POST /api/projects/tareas
 * Crear una nueva tarea
 */
router.post('/tareas', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, responsable } = req.body;
    if (!hito_id || !proyecto_id || !nombre) {
      return res.status(400).json({ error: 'hito_id, proyecto_id y nombre son requeridos.' });
    }

    const result = await db.run(
      `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'en_progreso', ?)`,
      [hito_id, proyecto_id, predio_id || null, nombre.trim(), actividad_id || 'general', unidad || 'ha', parseFloat(cantidad_meta) || 0, responsable || '']
    );

    const newTarea = await db.get(`
      SELECT t.*, pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      WHERE t.id = ?
    `, [result.lastID]);

    return res.status(201).json({ success: true, tarea: newTarea });
  } catch (err) {
    console.error('Error al crear tarea:', err);
    return res.status(500).json({ error: 'Error al crear tarea.' });
  }
});

/**
 * PATCH /api/projects/tareas/:id
 * Actualizar tarea (estado, responsable, meta, acumulado, etc.)
 */
router.patch('/tareas/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable, predio_id } = req.body;

    const tarea = await db.get('SELECT * FROM tarea WHERE id = ?', [id]);
    if (!tarea) {
      return res.status(404).json({ error: 'Tarea no encontrada.' });
    }

    await db.run(
      `UPDATE tarea
       SET nombre = ?, actividad_id = ?, unidad = ?, cantidad_meta = ?,
           cantidad_acumulada = ?, estado = ?, responsable = ?, predio_id = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : tarea.nombre,
        actividad_id !== undefined ? actividad_id : tarea.actividad_id,
        unidad !== undefined ? unidad : tarea.unidad,
        cantidad_meta !== undefined ? parseFloat(cantidad_meta) : tarea.cantidad_meta,
        cantidad_acumulada !== undefined ? parseFloat(cantidad_acumulada) : tarea.cantidad_acumulada,
        estado !== undefined ? estado : tarea.estado,
        responsable !== undefined ? responsable : tarea.responsable,
        predio_id !== undefined ? predio_id : tarea.predio_id,
        id
      ]
    );

    // LÓGICA EN CASCADA: Verificar estado del hito padre según sus tareas
    const hitoId = tarea.hito_id;
    if (hitoId) {
      const allTasks = await db.all('SELECT estado FROM tarea WHERE hito_id = ?', [hitoId]);
      if (allTasks.length > 0) {
        const allCompleted = allTasks.every(t => t.estado === 'completada');
        const anyInProgress = allTasks.some(t => t.estado === 'en_progreso');
        let newHitoStatus = 'pendiente';
        if (allCompleted) {
          newHitoStatus = 'completado';
        } else if (anyInProgress || allTasks.some(t => t.estado === 'completada')) {
          newHitoStatus = 'en_proceso';
        }
        await db.run('UPDATE hito SET estado = ? WHERE id = ?', [newHitoStatus, hitoId]);
      }
    }

    const updated = await db.get(`
      SELECT t.*, pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      WHERE t.id = ?
    `, [id]);

    return res.json({ success: true, tarea: updated });
  } catch (err) {
    console.error('Error al actualizar tarea:', err);
    return res.status(500).json({ error: 'Error al actualizar tarea.' });
  }
});

/**
 * DELETE /api/projects/tareas/:id
 */
router.delete('/tareas/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM tarea WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Tarea eliminada.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error al eliminar tarea.' });
  }
});

/**
/**
 * POST /api/projects/:id/obras
 * Crear un nuevo frente/obra en un proyecto (compatible con frontend anidado)
 */
router.post('/:id/obras', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const proyecto_id = req.params.id;
    const { nombre, fase_actual = 'operacion', estado = 'operacion', tg_thread_id, predio_id, predio_ids = [] } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre de la obra o frente es requerido.' });
    }

    const proj = await db.get('SELECT nombre FROM proyecto WHERE id = ?', [parseInt(proyecto_id, 10)]);

    // Obtener lista consolidada de predio_ids
    let consolidatedPredioIds = Array.isArray(predio_ids) ? [...predio_ids] : (predio_ids ? [predio_ids] : []);
    if (predio_id && !consolidatedPredioIds.includes(predio_id)) {
      consolidatedPredioIds.push(predio_id);
    }

    // Obtener nombres de predios para incluirlos en el mensaje de bienvenida de Telegram
    let predioNombres = [];
    if (consolidatedPredioIds.length > 0) {
      const placeholders = consolidatedPredioIds.map(() => '?').join(',');
      const rows = await db.all(`SELECT nombre FROM predio WHERE id IN (${placeholders})`, consolidatedPredioIds);
      predioNombres = rows.map(r => r.nombre);
    }

    // Creación automática del tema en Telegram si no se especificó un ID manual
    let finalThreadId = tg_thread_id || null;
    if (!finalThreadId) {
      try {
        const { createObraForumTopic } = require('../bot/bot');
        const autoThreadId = await createObraForumTopic(nombre.trim(), proj?.nombre || 'General', predioNombres);
        if (autoThreadId) {
          finalThreadId = String(autoThreadId);
        }
      } catch (botErr) {
        console.warn('⚠️ No se pudo generar el tema automático en Telegram:', botErr.message);
      }
    }

    const result = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre.trim(), parseInt(proyecto_id, 10), fase_actual, estado, finalThreadId]
    );

    const obraId = result.lastID;

    // Vincular predios
    for (const pId of consolidatedPredioIds) {
      if (pId) {
        await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [obraId, parseInt(pId, 10)]);
      }
    }

    const newObra = await db.get(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.id = ?
    `, [obraId]);

    newObra.predios = await db.all(`
      SELECT pr.id, pr.nombre, pr.superficie_util_ha
      FROM predio pr
      JOIN obra_predio op ON pr.id = op.predio_id
      WHERE op.obra_id = ?
    `, [obraId]);

    return res.status(201).json({ success: true, obra: newObra });
  } catch (err) {
    console.error('Error al crear obra:', err);
    return res.status(500).json({ error: 'Error al crear frente de obra.' });
  }
});

/**
 * GET /api/projects/cascade-options
 * Opciones para los selectores en cascada del rol Campo:
 * Proyectos -> Hitos -> Tareas (con meta y acumulado) + Obras + Predios
 */
router.get('/cascade-options', authenticateJWT, async (req, res) => {
  try {
    const proyectos = await db.all('SELECT id, nombre, tipo, ciclo FROM proyecto ORDER BY nombre ASC');
    const hitos = await db.all('SELECT id, proyecto_id, nombre, orden, superficie_meta_ha, estado FROM hito ORDER BY orden ASC');
    const tareas = await db.all(`
      SELECT t.id, t.hito_id, t.proyecto_id, t.predio_id, t.nombre, t.actividad_id,
             t.unidad, t.cantidad_meta, t.cantidad_acumulada, t.estado, t.responsable,
             pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      ORDER BY t.nombre ASC
    `);
    const obras = await db.all('SELECT id, proyecto_id, nombre, fase_actual, estado FROM obra ORDER BY nombre ASC');
    const predios = await db.all('SELECT id, nombre, superficie_legal_ha, superficie_util_ha, regimen FROM predio ORDER BY nombre ASC');
    const maquinas = await db.all('SELECT id, codigo, modelo, horometro_actual, alerta_mantenimiento FROM maquina ORDER BY codigo ASC');

    return res.json({
      proyectos,
      hitos,
      tareas,
      obras,
      predios,
      maquinas
    });
  } catch (err) {
    console.error('Error en /cascade-options:', err);
    return res.status(500).json({ error: 'Error al obtener catálogo cascada.' });
  }
});

/**
 * ==========================================
 * CRUD DE PREDIOS
 * ==========================================
 */

/**
 * GET /api/projects/predios
 * Listar todos los predios con sus frentes/obras asociadas
 */
router.get('/predios', authenticateJWT, async (req, res) => {
  try {
    const predios = await db.all(`
      SELECT p.*,
             (SELECT COUNT(*) FROM obra_predio WHERE predio_id = p.id) AS total_obras,
             (SELECT COUNT(*) FROM tarea WHERE predio_id = p.id) AS total_tareas
      FROM predio p
      ORDER BY p.nombre ASC
    `);

    for (const pr of predios) {
      pr.obras = await db.all(`
        SELECT o.id, o.nombre, o.fase_actual, o.estado
        FROM obra o
        JOIN obra_predio op ON o.id = op.obra_id
        WHERE op.predio_id = ?
        ORDER BY o.nombre ASC
      `, [pr.id]);
    }

    return res.json({ predios });
  } catch (err) {
    console.error('Error al obtener predios:', err);
    return res.status(500).json({ error: 'Error al obtener predios.' });
  }
});

/**
 * POST /api/projects/predios
 * Crear nuevo predio (con creación opcional/automática de Frente y Tema en Telegram)
 */
router.post('/predios', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const {
      nombre,
      superficie_legal_ha = 0,
      superficie_util_ha = 0,
      regimen = 'Propiedad Privada',
      poligono_geojson,
      crear_frente_telegram = true,
      proyecto_id
    } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del predio es obligatorio.' });
    }

    const supLegal = parseFloat(superficie_legal_ha) || 0;
    const supUtil = parseFloat(superficie_util_ha) || supLegal;

    const result = await db.run(
      `INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre.trim(), supLegal, supUtil, regimen.trim(), poligono_geojson || null]
    );

    const predioId = result.lastID;
    const newPredio = await db.get('SELECT * FROM predio WHERE id = ?', [predioId]);
    newPredio.obras = [];

    let createdObra = null;
    let autoThreadId = null;

    // Si se solicitó crear automáticamente Frente y Tema en Telegram para este Predio
    if (crear_frente_telegram) {
      try {
        let targetProjId = proyecto_id ? parseInt(proyecto_id, 10) : null;
        let proj = null;
        if (targetProjId) {
          proj = await db.get('SELECT * FROM proyecto WHERE id = ?', [targetProjId]);
        }
        if (!proj) {
          proj = await db.get('SELECT * FROM proyecto ORDER BY id ASC LIMIT 1');
        }

        if (proj) {
          const obraNombre = nombre.trim();
          const { createObraForumTopic } = require('../bot/bot');
          autoThreadId = await createObraForumTopic(obraNombre, proj.nombre, [nombre.trim()]);

          const obraResult = await db.run(
            `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
             VALUES (?, ?, ?, ?, ?)`,
            [obraNombre, proj.id, 'operacion', 'operacion', autoThreadId ? String(autoThreadId) : null]
          );

          const newObraId = obraResult.lastID;
          await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [newObraId, predioId]);

          createdObra = await db.get('SELECT * FROM obra WHERE id = ?', [newObraId]);
          createdObra.predios = [{ id: newPredio.id, nombre: newPredio.nombre, superficie_util_ha: newPredio.superficie_util_ha }];
          newPredio.obras = [{ id: createdObra.id, nombre: createdObra.nombre, estado: createdObra.estado, tg_thread_id: createdObra.tg_thread_id }];
        }
      } catch (tgErr) {
        console.warn('⚠️ Error al auto-crear frente o tema de Telegram para el nuevo predio:', tgErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      predio: newPredio,
      obra: createdObra,
      tg_thread_id: autoThreadId ? String(autoThreadId) : null,
      message: autoThreadId
        ? `Predio registrado y Tema #${autoThreadId} creado en Telegram para el frente "${nombre.trim()}".`
        : `Predio registrado correctamente.`
    });
  } catch (err) {
    console.error('Error al crear predio:', err);
    return res.status(500).json({ error: 'Error al crear el predio: ' + err.message });
  }
});

/**
 * PATCH /api/projects/predios/:id
 * Editar predio existente
 */
router.patch('/predios/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson } = req.body;

    const predio = await db.get('SELECT * FROM predio WHERE id = ?', [id]);
    if (!predio) {
      return res.status(404).json({ error: 'Predio no encontrado.' });
    }

    await db.run(
      `UPDATE predio
       SET nombre = ?, superficie_legal_ha = ?, superficie_util_ha = ?, regimen = ?, poligono_geojson = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : predio.nombre,
        superficie_legal_ha !== undefined ? parseFloat(superficie_legal_ha) || 0 : predio.superficie_legal_ha,
        superficie_util_ha !== undefined ? parseFloat(superficie_util_ha) || 0 : predio.superficie_util_ha,
        regimen !== undefined ? regimen.trim() : predio.regimen,
        poligono_geojson !== undefined ? poligono_geojson : predio.poligono_geojson,
        id
      ]
    );

    const updated = await db.get('SELECT * FROM predio WHERE id = ?', [id]);
    return res.json({ success: true, predio: updated });
  } catch (err) {
    console.error('Error al actualizar predio:', err);
    return res.status(500).json({ error: 'Error al actualizar el predio.' });
  }
});

/**
 * DELETE /api/projects/predios/:id
 * Eliminar predio
 */
router.delete('/predios/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM obra_predio WHERE predio_id = ?', [id]);
    await db.run('UPDATE tarea SET predio_id = NULL WHERE predio_id = ?', [id]);
    await db.run('DELETE FROM predio WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Predio eliminado correctamente.' });
  } catch (err) {
    console.error('Error al eliminar predio:', err);
    return res.status(500).json({ error: 'Error al eliminar el predio.' });
  }
});

/**
 * ==========================================
 * CRUD DE OBRAS Y FRENTES DE TRABAJO
 * ==========================================
 */

/**
 * GET /api/projects/obras
 * Listar todas las obras/frentes con proyecto y predios asociados
 */
router.get('/obras', authenticateJWT, async (req, res) => {
  try {
    const obras = await db.all(`
      SELECT o.*, p.nombre AS proyecto_nombre, p.ciclo AS proyecto_ciclo
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      ORDER BY o.nombre ASC
    `);

    for (const ob of obras) {
      ob.predios = await db.all(`
        SELECT pr.id, pr.nombre, pr.superficie_util_ha, pr.regimen
        FROM predio pr
        JOIN obra_predio op ON pr.id = op.predio_id
        WHERE op.obra_id = ?
        ORDER BY pr.nombre ASC
      `, [ob.id]);
    }

    return res.json({ obras });
  } catch (err) {
    console.error('Error al obtener obras:', err);
    return res.status(500).json({ error: 'Error al obtener obras.' });
  }
});

/**
 * POST /api/projects/obras
 * Crear nueva obra / frente (directamente o asociada a un proyecto)
 */
router.post('/obras', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { nombre, proyecto_id, fase_actual = 'operacion', estado = 'operacion', tg_thread_id, predio_ids = [] } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre del frente u obra es obligatorio.' });
    }

    if (!proyecto_id) {
      return res.status(400).json({ error: 'El proyecto asignado es obligatorio.' });
    }

    const proj = await db.get('SELECT nombre FROM proyecto WHERE id = ?', [parseInt(proyecto_id, 10)]);

    // Obtener nombres de los predios vinculados
    const pIds = Array.isArray(predio_ids) ? predio_ids : [predio_ids];
    let predioNombres = [];
    if (pIds.length > 0) {
      const placeholders = pIds.map(() => '?').join(',');
      const rows = await db.all(`SELECT nombre FROM predio WHERE id IN (${placeholders})`, pIds);
      predioNombres = rows.map(r => r.nombre);
    }

    // Creación automática del tema en Telegram si no se proporcionó manualmente
    let finalThreadId = tg_thread_id || null;
    if (!finalThreadId) {
      try {
        const { createObraForumTopic } = require('../bot/bot');
        const autoThreadId = await createObraForumTopic(nombre.trim(), proj?.nombre || 'General', predioNombres);
        if (autoThreadId) {
          finalThreadId = String(autoThreadId);
        }
      } catch (botErr) {
        console.warn('No se pudo generar el tema automático en Telegram:', botErr.message);
      }
    }

    const result = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre.trim(), parseInt(proyecto_id, 10), fase_actual, estado, finalThreadId]
    );

    const obraId = result.lastID;

    // Vincular predios seleccionados
    for (const pId of pIds) {
      if (pId) {
        await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [obraId, parseInt(pId, 10)]);
      }
    }

    const newObra = await db.get(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.id = ?
    `, [obraId]);

    newObra.predios = await db.all(`
      SELECT pr.id, pr.nombre, pr.superficie_util_ha
      FROM predio pr
      JOIN obra_predio op ON pr.id = op.predio_id
      WHERE op.obra_id = ?
    `, [obraId]);

    return res.status(201).json({ success: true, obra: newObra });
  } catch (err) {
    console.error('Error al crear obra:', err);
    return res.status(500).json({ error: 'Error al crear frente u obra.' });
  }
});

/**
 * POST /api/projects/obras/:id/create-telegram-topic
 * Forzar creación o sincronización de tema en Telegram para una obra existente
 */
router.post('/obras/:id/create-telegram-topic', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const obra = await db.get(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.id = ?
    `, [id]);

    if (!obra) {
      return res.status(404).json({ error: 'Frente u obra no encontrada.' });
    }

    const predios = await db.all(`
      SELECT pr.nombre FROM predio pr
      JOIN obra_predio op ON pr.id = op.predio_id
      WHERE op.obra_id = ?
    `, [id]);
    const predioNombres = predios.map(p => p.nombre);

    const { createObraForumTopic } = require('../bot/bot');
    const autoThreadId = await createObraForumTopic(obra.nombre, obra.proyecto_nombre, predioNombres);

    if (!autoThreadId) {
      return res.status(502).json({
        error: 'No se pudo crear el tema en Telegram. Verifica que el bot esté en el supergrupo como Administrador con permiso "Administrar Temas".'
      });
    }

    await db.run('UPDATE obra SET tg_thread_id = ? WHERE id = ?', [String(autoThreadId), id]);

    const updatedObra = await db.get(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.id = ?
    `, [id]);
    updatedObra.predios = predios;

    return res.json({
      success: true,
      message: `Tema creado exitosamente en Telegram con ID #${autoThreadId}`,
      tg_thread_id: String(autoThreadId),
      obra: updatedObra
    });
  } catch (err) {
    console.error('Error al crear tema de Telegram para la obra:', err);
    return res.status(500).json({ error: 'Error al crear tema en Telegram: ' + err.message });
  }
});

/**
 * POST /api/projects/sync-telegram-topics
 * Sincronizar y crear temas de Telegram para todas las obras que no tengan un tema real
 */
router.post('/sync-telegram-topics', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const obras = await db.all(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.estado = 'operacion'
      ORDER BY o.id ASC
    `);

    const { createObraForumTopic } = require('../bot/bot');
    const results = [];

    for (const obra of obras) {
      // Si el thread_id es nulo o corresponde a los valores de prueba semilla ("101", "102", ...)
      const isMockOrMissing = !obra.tg_thread_id || ['101', '102', '103', '104', '105', '106', '107'].includes(String(obra.tg_thread_id));
      
      if (isMockOrMissing) {
        const predios = await db.all(`
          SELECT pr.nombre FROM predio pr
          JOIN obra_predio op ON pr.id = op.predio_id
          WHERE op.obra_id = ?
        `, [obra.id]);
        const predioNombres = predios.map(p => p.nombre);

        const newThreadId = await createObraForumTopic(obra.nombre, obra.proyecto_nombre, predioNombres);
        if (newThreadId) {
          await db.run('UPDATE obra SET tg_thread_id = ? WHERE id = ?', [String(newThreadId), obra.id]);
          results.push({ id: obra.id, nombre: obra.nombre, status: 'creado', tg_thread_id: newThreadId });
        } else {
          results.push({ id: obra.id, nombre: obra.nombre, status: 'fallido', error: 'Sin permisos o error Telegram' });
        }
      } else {
        results.push({ id: obra.id, nombre: obra.nombre, status: 'omitido_existente', tg_thread_id: obra.tg_thread_id });
      }
    }

    return res.json({
      success: true,
      message: 'Sincronización de temas de Telegram completada.',
      results
    });
  } catch (err) {
    console.error('Error al sincronizar temas de Telegram:', err);
    return res.status(500).json({ error: 'Error al sincronizar temas: ' + err.message });
  }
});

/**
 * PATCH /api/projects/obras/:id
 * Editar obra / frente de trabajo existente
 */
router.patch('/obras/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, proyecto_id, fase_actual, estado, tg_thread_id, predio_ids } = req.body;

    const obra = await db.get('SELECT * FROM obra WHERE id = ?', [id]);
    if (!obra) {
      return res.status(404).json({ error: 'Frente u obra no encontrada.' });
    }

    // Actualizar predios vinculados si se proporcionaron
    if (predio_ids !== undefined) {
      const pIds = Array.isArray(predio_ids) ? predio_ids : [predio_ids];
      await db.run('DELETE FROM obra_predio WHERE obra_id = ?', [id]);
      for (const pId of pIds) {
        if (pId) {
          await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [id, parseInt(pId, 10)]);
        }
      }
    }

    let finalThreadId = tg_thread_id !== undefined ? (tg_thread_id ? String(tg_thread_id).trim() : null) : obra.tg_thread_id;
    const isMockOrMissing = !finalThreadId || ['101', '102', '103', '104', '105', '106', '107'].includes(String(finalThreadId));

    // Si aún no tiene un tema real en Telegram, crearlo automáticamente
    if (isMockOrMissing) {
      try {
        const projId = proyecto_id !== undefined ? parseInt(proyecto_id, 10) : obra.proyecto_id;
        const proj = await db.get('SELECT nombre FROM proyecto WHERE id = ?', [projId]);
        const predios = await db.all('SELECT pr.nombre FROM predio pr JOIN obra_predio op ON pr.id = op.predio_id WHERE op.obra_id = ?', [id]);
        const predioNombres = predios.map(p => p.nombre);

        const { createObraForumTopic } = require('../bot/bot');
        const autoThreadId = await createObraForumTopic(nombre !== undefined ? nombre.trim() : obra.nombre, proj?.nombre || 'General', predioNombres);
        if (autoThreadId) {
          finalThreadId = String(autoThreadId);
        }
      } catch (tgErr) {
        console.warn('⚠️ No se pudo auto-crear tema en Telegram durante PATCH obra:', tgErr.message);
      }
    }

    await db.run(
      `UPDATE obra
       SET nombre = ?, proyecto_id = ?, fase_actual = ?, estado = ?, tg_thread_id = ?
       WHERE id = ?`,
      [
        nombre !== undefined ? nombre.trim() : obra.nombre,
        proyecto_id !== undefined ? parseInt(proyecto_id, 10) : obra.proyecto_id,
        fase_actual !== undefined ? fase_actual : obra.fase_actual,
        estado !== undefined ? estado : obra.estado,
        finalThreadId,
        id
      ]
    );

    const updated = await db.get(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      LEFT JOIN proyecto p ON o.proyecto_id = p.id
      WHERE o.id = ?
    `, [id]);

    updated.predios = await db.all(`
      SELECT pr.id, pr.nombre, pr.superficie_util_ha, pr.regimen
      FROM predio pr
      JOIN obra_predio op ON pr.id = op.predio_id
      WHERE op.obra_id = ?
    `, [id]);

    return res.json({ success: true, obra: updated });
  } catch (err) {
    console.error('Error al actualizar obra:', err);
    return res.status(500).json({ error: 'Error al actualizar la obra: ' + err.message });
  }
});

/**
 * DELETE /api/projects/obras/:id
 * Eliminar obra / frente
 */
router.delete('/obras/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM obra_predio WHERE obra_id = ?', [id]);
    await db.run('DELETE FROM obra WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Frente u obra eliminada correctamente.' });
  } catch (err) {
    console.error('Error al eliminar obra:', err);
    return res.status(500).json({ error: 'Error al eliminar la obra.' });
  }
});

module.exports = router;
