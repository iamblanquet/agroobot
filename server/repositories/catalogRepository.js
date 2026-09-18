const { db } = require('../db/database');
const supabase = require('../db/supabase');
const projects = require('./projectRepository');

// One database operation owns the record and all its links. Never fall back to
// sequential REST writes: a missing cloud migration must fail before writing.
async function save(kind, id, fields, predioIds = null) {
  if (process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured()) {
    try {
      return await supabase.rpc('save_catalog_entry', {
        p_kind: kind, p_id: id, p_fields: fields, p_predio_ids: predioIds, p_frente: null
      });
    } catch (error) {
      if (/No se puede quitar un predio|Predio no asignado al proyecto/.test(error.message)) {
        throw Object.assign(new Error('No se puede quitar o cambiar la asignación de un predio utilizado por los frentes del proyecto.'), { status: 400 });
      }
      throw error;
    }
  }
  return db.transaction(async () => {
    let project = null;
    if (kind === 'proyecto') {
      project = id ? await projects.updateProject(id, fields) : await projects.createProject(fields);
      if (predioIds !== null) {
        const used = await db.all('SELECT DISTINCT op.predio_id FROM obra_predio op JOIN obra o ON o.id = op.obra_id WHERE o.proyecto_id = ?', [project.id]);
        if (used.some(row => !predioIds.includes(Number(row.predio_id)))) throw Object.assign(new Error('No se puede quitar un predio que tiene frentes del proyecto.'), { status: 400 });
        await db.run('DELETE FROM proyecto_predio WHERE proyecto_id = ?', [project.id]);
        for (const pid of new Set(predioIds)) await db.run('INSERT INTO proyecto_predio(proyecto_id,predio_id) VALUES (?,?)', [project.id, pid]);
      }
      return { project };
    }
    let predio = null;
    let obra = null;
    if (kind === 'predio') {
      predio = id ? await projects.updatePredio(id, fields) : await projects.createPredio(fields);

    } else {
      const projectId = fields.proyecto_id ?? (await projects.findObraById(id))?.proyecto_id;
      const links = predioIds ?? (await projects.findPrediosByObraId(id)).map(p => Number(p.id));
      const assigned = await projectPredios(projectId);
      if (links.some(pid => !assigned.some(p => Number(p.id) === Number(pid)))) throw Object.assign(new Error('Predio no asignado al proyecto.'), { status: 400 });
      obra = id ? await projects.updateObra(id, fields) : await projects.createObra(fields);
      if (predioIds !== null) await replaceLinks(obra.id, predioIds);
    }
    return { predio, obra };
  });
}

async function replaceLinks(obraId, predioIds) {
  await db.run('DELETE FROM obra_predio WHERE obra_id = ?', [obraId]);
  for (const id of new Set(predioIds)) {
    await db.run('INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [obraId, id]);
  }
}

async function options() {
  const cloud = process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
  async function read(table) {
    if (!cloud) return db.all(`SELECT * FROM ${table} ORDER BY id ASC`);
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await supabase.selectRows(table, { order: 'id.asc', limit: 1000, offset });
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }
  const [proyectos, hitos, tareas, obras, predios, maquinas] = await Promise.all(
    ['proyecto', 'hito', 'tarea', 'obra', 'predio', 'maquina'].map(read)
  );
  const names = new Map(predios.map(predio => [String(predio.id), predio.nombre]));
  const relations = cloud
    ? await supabase.selectRows('proyecto_predio', { order: 'proyecto_id.asc,predio_id.asc' })
    : await db.all('SELECT * FROM proyecto_predio');
  for (const obra of obras) obra.predios = await projects.findPrediosByObraId(obra.id);
  for (const project of proyectos) project.predio_ids = relations.filter(r => String(r.proyecto_id) === String(project.id)).map(r => r.predio_id);
  return { proyectos, proyecto_predios: relations, hitos, tareas: tareas.map(task => ({ ...task, predio_nombre: names.get(String(task.predio_id)) || null })), obras, predios, maquinas };
}

async function projectPredios(projectId) {
  if (process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured()) {
    const rows = await supabase.selectRows('proyecto_predio', { select: 'predio:predio_id(*)', filters: { proyecto_id: `eq.${projectId}` } });
    return rows.map(row => row.predio).filter(Boolean);
  }
  return db.all('SELECT p.* FROM predio p JOIN proyecto_predio pp ON pp.predio_id = p.id WHERE pp.proyecto_id = ?', [projectId]);
}
module.exports = { save, options, projectPredios };
