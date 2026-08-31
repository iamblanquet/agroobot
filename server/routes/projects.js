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
 * POST /api/projects/:id/obras
 * Crear un nuevo frente/obra en un proyecto
 */
router.post('/:id/obras', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const proyecto_id = req.params.id;
    const { nombre, fase_actual = 'operacion', estado = 'operacion', predio_id } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre de la obra o frente es requerido.' });
    }

    const result = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado)
       VALUES (?, ?, ?, ?)`,
      [nombre.trim(), proyecto_id, fase_actual, estado]
    );

    const obraId = result.lastID;
    if (predio_id) {
      await db.run(`INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [obraId, predio_id]);
    }

    const newObra = await db.get('SELECT * FROM obra WHERE id = ?', [obraId]);
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
 * GET /api/projects/predios
 */
router.get('/predios', authenticateJWT, async (req, res) => {
  try {
    const predios = await db.all('SELECT * FROM predio ORDER BY nombre ASC');
    return res.json({ predios });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener predios.' });
  }
});

/**
 * GET /api/projects/obras
 */
router.get('/obras', authenticateJWT, async (req, res) => {
  try {
    const obras = await db.all(`
      SELECT o.*, p.nombre AS proyecto_nombre
      FROM obra o
      JOIN proyecto p ON o.proyecto_id = p.id
      ORDER BY o.nombre ASC
    `);
    return res.json({ obras });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener obras.' });
  }
});

module.exports = router;
