const projects = require('../repositories/projectRepository');
const catalog = require('../repositories/catalogRepository');
const { id } = require('./catalogValidation');

async function resolveReportLocation({ predio_id, obra_id, proyecto_id, lineas = [] }) {
  const obra = await projects.findObraById(id(obra_id, 'El frente de obra'));
  if (!obra) throw new Error('Frente de obra no encontrado.');
  if (proyecto_id && Number(proyecto_id) !== Number(obra.proyecto_id)) throw new Error('El frente no pertenece al proyecto indicado.');
  const linked = await projects.findPrediosByObraId(obra.id);
  let pid = predio_id;
  if (!pid) {
    const lineIds = [...new Set(lineas.filter(l => l.predio_id).map(l => Number(l.predio_id)))];
    if (lineIds.length === 1) pid = lineIds[0];
    else if (!lineIds.length && linked.length === 1) pid = linked[0].id;
  }
  pid = id(pid, 'El predio del reporte');
  if (!linked.some(p => Number(p.id) === pid)) throw new Error('El frente no está vinculado al predio seleccionado.');
  const assigned = await catalog.projectPredios(obra.proyecto_id);
  if (!assigned.some(p => Number(p.id) === pid)) throw new Error('El proyecto no está asignado al predio seleccionado.');
  if (lineas.some(l => l.predio_id && Number(l.predio_id) !== pid)) throw new Error('Cada reporte debe corresponder a un solo predio. Separa los avances de otros predios en otro reporte.');
  const predio = await projects.findPredioById(pid);
  const project = await projects.findProjectById(obra.proyecto_id);
  return { predio, obra, project };
}

// Incoming Telegram reports must identify a unique front inside this plot.
async function resolveIncomingFront(threadId, frontName) {
  if (!threadId || !Number.isSafeInteger(Number(threadId)) || Number(threadId) <= 0) throw new Error('Envía el reporte dentro del grupo del predio.');
  const predios = (await projects.findAllPredios()).filter(p => String(p.tg_thread_id) === String(threadId));
  if (predios.length !== 1) throw new Error('Este tema no está vinculado a un único predio. Revisa el catálogo de predios.');
  const predio = predios[0];
  const obras = (await projects.findObrasByPredioId(predio.id)).filter(o => o.estado !== 'cerrada');
  const matches = frontName
    ? obras.filter(o => String(o.id) === String(frontName).replace(/^#/, '') || o.nombre.toLowerCase() === frontName.trim().toLowerCase())
    : obras;
  if (matches.length !== 1) throw new Error(`Indica el frente con "Frente: #ID" en una línea del reporte. Frentes disponibles: ${obras.map(o => `#${o.id} ${o.nombre}`).join(', ') || 'ninguno'}.`);
  return resolveReportLocation({ predio_id: predio.id, obra_id: matches[0].id });
}

module.exports = { resolveReportLocation, resolveIncomingFront };
