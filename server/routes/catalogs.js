const router = require('express').Router();
const projects = require('../repositories/projectRepository');
const catalog = require('../repositories/catalogRepository');
const validate = require('../services/catalogValidation');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const write = [authenticateJWT, requireRole('supervisor', 'it', 'direccion')];

function endpoint(handler) {
  return async (req, res) => {
    try { await handler(req, res); }
    catch (error) {
      if (!error.status) console.error('Error de catálogo:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el cambio de catálogo. Verifica la conexión y las migraciones de la base de datos.' });
    }
  };
}

async function existing(method, id, label) {
  const record = await projects[method](validate.id(id));
  if (!record) { const error = new Error(`${label} no encontrado.`); error.status = 404; throw error; }
  return record;
}

async function validateLinks(fields, ids) {
  await existing('findProjectById', fields.proyecto_id, 'Proyecto');
  if (ids !== null) {
    if (!ids.length) validate.invalid('Selecciona al menos un predio para el frente.');
    const assigned = await catalog.projectPredios(fields.proyecto_id);
    for (const id of ids) {
      await existing('findPredioById', id, 'Predio');
      if (!assigned.some(p => Number(p.id) === Number(id))) validate.invalid('El predio no está asignado al proyecto. Asígnalo desde el proyecto antes de crear el frente.');
    }
  }
}

async function hydrate(obra) {
  if (!obra) return null;
  const project = await projects.findProjectById(obra.proyecto_id);
  return { ...obra, proyecto_nombre: project?.nombre || '', predios: await projects.findPrediosByObraId(obra.id) };
}

async function validatePlotTopic(fields, currentId = null) {
  if (!fields.tg_thread_id) return;
  const duplicate = (await projects.findAllPredios()).find(p => String(p.tg_thread_id) === fields.tg_thread_id && String(p.id) !== String(currentId));
  if (duplicate) validate.invalid(`Ese grupo ya pertenece al predio ${duplicate.nombre}.`);
}

// A topic belongs to the plot, regardless of its projects and fronts.
const topicRequests = new Map();
function ensureTopic(predioId) {
  const key = String(predioId);
  if (topicRequests.has(key)) return topicRequests.get(key);
  const task = (async () => {
    const predio = await existing('findPredioById', predioId, 'Predio');
    if (predio.tg_thread_id) return { predio, telegram_status: 'existente' };
    let topicId;
    try {
      topicId = await require('../bot/bot').createPredioForumTopic(predio);
    } catch (error) { console.warn('Telegram pendiente:', error.message); }
    if (!topicId) return { predio, telegram_status: 'pendiente', warning: 'El predio está guardado. No se pudo crear su grupo en Telegram; puedes reintentarlo desde el catálogo de predios.' };
    try {
      await projects.updatePredio(predio.id, { tg_thread_id: String(topicId) });
      return { predio: { ...predio, tg_thread_id: String(topicId) }, telegram_status: 'creado' };
    } catch (error) {
      return { predio, telegram_status: 'vinculacion_pendiente', warning: `El grupo #${topicId} fue creado para el predio, pero no se pudo guardar su ID. Vincúlalo manualmente antes de sincronizar de nuevo.` };
    }
  })().finally(() => topicRequests.delete(key));
  topicRequests.set(key, task);
  return task;
}

router.get('/predios', authenticateJWT, endpoint(async (req, res) => {
  const predios = await projects.findAllPredios();
  for (const predio of predios) predio.obras = await projects.findObrasByPredioId(predio.id);
  res.json({ predios });
}));

router.post('/predios', ...write, endpoint(async (req, res) => {
  const fields = validate.predio(req.body);
  await validatePlotTopic(fields);
  const createTopic = req.body.crear_grupo_telegram ?? true;
  if (typeof createTopic !== 'boolean') validate.invalid('La creación del grupo debe ser verdadero o falso.');
  const saved = await catalog.save('predio', null, fields);
  const result = createTopic ? await ensureTopic(saved.predio.id) : { predio: saved.predio, telegram_status: 'no_solicitado' };
  res.status(201).json({ success: true, ...result, tg_thread_id: result.predio.tg_thread_id || null, message: result.warning || 'Predio registrado correctamente.' });
}));

router.patch('/predios/:id', ...write, endpoint(async (req, res) => {
  const current = await existing('findPredioById', req.params.id, 'Predio');
  const fields = validate.predio(req.body, current);
  await validatePlotTopic(fields, current.id);
  const saved = await catalog.save('predio', current.id, fields);
  res.json({ success: true, predio: saved.predio });
}));

router.delete('/predios/:id', ...write, endpoint(async (req, res) => {
  const current = await existing('findPredioById', req.params.id, 'Predio');
  await projects.deletePredio(current.id);
  res.json({ success: true, message: 'Predio eliminado correctamente.' });
}));

router.get('/obras', authenticateJWT, endpoint(async (req, res) => {
  const obras = await projects.findAllObras();
  res.json({ obras: await Promise.all(obras.map(hydrate)) });
}));

async function createObra(req, res) {
  const fields = validate.obra({ ...req.body, proyecto_id: req.params.id || req.body.proyecto_id });
  const ids = validate.predioIds(req.body.predio_ids ?? []);
  if (req.body.predio_id != null && req.body.predio_id !== '') ids.push(validate.id(req.body.predio_id, 'El predio'));
  await validateLinks(fields, ids);
  const saved = await catalog.save('obra', null, fields, [...new Set(ids)]);
  res.status(201).json({ success: true, obra: await hydrate(saved.obra) });
}
router.post('/obras', ...write, endpoint(createObra));
router.post('/:id/obras', ...write, endpoint(createObra));

router.patch('/obras/:id', ...write, endpoint(async (req, res) => {
  const current = await existing('findObraById', req.params.id, 'Frente');
  const fields = validate.obra(req.body, current);
  const ids = req.body.predio_ids === undefined ? null : validate.predioIds(req.body.predio_ids);
  await validateLinks(fields, ids ?? (await projects.findPrediosByObraId(current.id)).map(p => Number(p.id)));
  const saved = await catalog.save('obra', current.id, fields, ids);
  // Editing a front is a database operation. Topic retries are explicit.
  res.json({ success: true, obra: await hydrate(saved.obra) });
}));

router.delete('/obras/:id', ...write, endpoint(async (req, res) => {
  const current = await existing('findObraById', req.params.id, 'Frente');
  await projects.deleteObra(current.id);
  res.json({ success: true, message: 'Frente eliminado correctamente.' });
}));

router.post('/predios/:id/create-telegram-topic', ...write, endpoint(async (req, res) => {
  const result = await ensureTopic(validate.id(req.params.id));
  res.json({ success: !result.warning, ...result, tg_thread_id: result.predio.tg_thread_id, message: result.warning || `Grupo del predio vinculado: #${result.predio.tg_thread_id}` });
}));

// Do not let stale clients create another topic for a front.
router.post('/obras/:id/create-telegram-topic', ...write, (req, res) => {
  res.status(409).json({ error: 'Los grupos pertenecen a los predios. Crea o vincula el grupo desde el catálogo de predios.' });
});

router.post('/sync-telegram-topics', ...write, endpoint(async (req, res) => {
  const results = [];
  for (const predio of await projects.findAllPredios()) {
    try {
      const result = await ensureTopic(predio.id);
      results.push({ id: predio.id, nombre: predio.nombre, status: result.warning ? 'fallido' : result.telegram_status === 'creado' ? 'creado' : 'omitido_existente', tg_thread_id: result.predio.tg_thread_id, error: result.warning });
    } catch (error) { results.push({ id: predio.id, nombre: predio.nombre, status: 'fallido', error: error.message }); }
  }
  res.json({ success: true, results });
}));

module.exports = router;
