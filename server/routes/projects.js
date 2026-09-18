const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const projectRepository = require('../repositories/projectRepository');
const catalog = require('../repositories/catalogRepository');
const validate = require('../services/catalogValidation');
const employeeRepository = require('../repositories/employeeRepository');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/projects
 * Lista de proyectos con sus hitos, tareas y obras asociadas
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const projects = await projectRepository.findAllProjects();

    for (const p of projects) {
      p.predios = await catalog.projectPredios(p.id);
      p.predio_ids = p.predios.map(predio => predio.id);
      p.hitos = await projectRepository.findMilestonesByProjectId(p.id);
      for (const h of p.hitos) {
        h.tareas = await projectRepository.findTasksByMilestoneId(h.id);
      }
      p.obras = await projectRepository.findAllObras(p.id);
      for (const ob of p.obras) {
        ob.predios = await projectRepository.findPrediosByObraId(ob.id);
      }
      p.mediciones = await projectRepository.findMedicionesByProjectId(p.id);
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

    const predioIds = validate.predioIds(req.body.predio_ids ?? []);
    for (const pid of predioIds) if (!await projectRepository.findPredioById(pid)) validate.invalid('Predio no encontrado.');
    const saved = await catalog.save('proyecto', null, {
      nombre: nombre.trim(),
      tipo: tipo.trim(),
      ciclo: ciclo.trim(),
      superficie_meta_ha: parseFloat(superficie_meta_ha) || 0,
      fase_catalogo: fase_catalogo || 'Planificación Inicial',
      gerente_id: gerente,
      fecha_inicio: fecha_inicio || new Date().toISOString().split('T')[0],
      fecha_fin: fecha_fin || null,
      estado: 'activo'
    }, predioIds);
    const newProject = { ...saved.project, predio_ids: predioIds };

    return res.status(201).json({ success: true, project: newProject });
  } catch (err) {
    console.error('Error al crear proyecto:', err);
    return res.status(err.status || 500).json({ error: 'Error al crear el proyecto: ' + err.message });
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

    const proj = await projectRepository.findProjectById(validate.id(id));
    if (!proj) return res.status(404).json({ error: 'Proyecto no encontrado.' });
    const fields = {};
    for (const key of ['nombre', 'tipo', 'ciclo', 'fase_catalogo', 'gerente_id', 'fecha_inicio', 'fecha_fin', 'superficie_meta_ha']) {
      if (req.body[key] !== undefined) fields[key] = req.body[key] === '' && ['gerente_id', 'fecha_fin'].includes(key) ? null : req.body[key];
    }
    const predioIds = req.body.predio_ids === undefined ? null : validate.predioIds(req.body.predio_ids);
    if (predioIds !== null) for (const pid of predioIds) if (!await projectRepository.findPredioById(pid)) validate.invalid('Predio no encontrado.');
    const saved = await catalog.save('proyecto', proj.id, fields, predioIds);
    return res.json({ success: true, project: saved.project });
  } catch (err) {
    if (!err.status) console.error('Error al actualizar proyecto:', err);
    return res.status(err.status || 500).json({ error: err.status ? err.message : 'Error al actualizar proyecto.' });
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
 * GET /api/projects/cascade-options
 * Opciones para los selectores en cascada del rol Campo:
 * Proyectos -> Hitos -> Tareas (con meta y acumulado) + Obras + Predios
 */
router.get('/cascade-options', authenticateJWT, async (req, res) => {
  try {
    const options = await require('../repositories/catalogRepository').options();
    const empleados = await employeeRepository.findAll();
    return res.json({ ...options, empleados });
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

// Catálogo operativo: validación y persistencia compartidas para ambos motores.
router.use(require('./catalogs'));

module.exports = router;
