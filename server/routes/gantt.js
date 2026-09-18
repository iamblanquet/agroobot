const router = require('express').Router();
const { authenticateJWT, requireRole } = require('../middleware/auth');
const repository = require('../repositories/ganttRepository');
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
router.use(authenticateJWT, requireRole('supervisor', 'direccion', 'it'));
router.get('/', async (req, res) => {
  try { res.json({ projects: await repository.projects() }); }
  catch (error) { console.error('Gantt:', error); res.status(500).json({ error: 'No se pudo cargar el cronograma.' }); }
});

// Evitar que dos cambios de dependencias en este proceso se validen simultáneamente.
let queue = Promise.resolve();
router.patch('/tasks/:id', async (req, res) => {
  const operation = async () => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Tarea inválida.' });
    const { fecha_inicio, fecha_fin, responsable, dependencias } = req.body || {};
    const unset = fecha_inicio === null && fecha_fin === null;
    if (!unset && (!validDate(fecha_inicio) || !validDate(fecha_fin) || fecha_fin < fecha_inicio)) return res.status(400).json({ error: 'Indica fechas válidas; el fin no puede ser anterior al inicio.' });
    if (typeof responsable !== 'string' || responsable.trim().length > 150) return res.status(400).json({ error: 'Responsable inválido (máximo 150 caracteres).' });
    if (!Array.isArray(dependencias) || dependencias.length > 100 || dependencias.some(value => !Number.isSafeInteger(value) || value < 1 || value === id)) return res.status(400).json({ error: 'Dependencias inválidas.' });
    const task = await repository.task(id);
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada.' });
    const tasks = await repository.tasks(task.proyecto_id);
    const graph = new Map(tasks.map(item => [Number(item.id), item.dependencias.map(Number)]));
    if (dependencias.some(value => !graph.has(value))) return res.status(400).json({ error: 'Las dependencias deben pertenecer al mismo proyecto.' });
    graph.set(id, [...new Set(dependencias)]);
    const visiting = new Set(), visited = new Set();
    function cyclic(node) {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      if ((graph.get(node) || []).some(cyclic)) return true;
      visiting.delete(node); visited.add(node); return false;
    }
    if ([...graph.keys()].some(cyclic)) return res.status(400).json({ error: 'Las dependencias forman un ciclo. Revisa las tareas predecesoras.' });
    const updated = await repository.update(id, { fecha_inicio, fecha_fin, responsable: responsable.trim(), dependencias: graph.get(id) });
    res.json({ task: updated });
  };
  const pending = queue.then(operation);
  queue = pending.catch(() => {});
  try { await pending; } catch (error) { console.error('Guardar Gantt:', error); res.status(500).json({ error: 'No se pudo guardar la planificación.' }); }
});
module.exports = router;
