const { db } = require('../db/database');
const supabase = require('../db/supabase');
const cloud = () => process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
async function all(table) {
  if (!cloud()) return db.all(`SELECT * FROM ${table}`);
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.selectRows(table, { select: '*', order: 'id.asc', limit: 1000, offset });
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const decode = task => ({ ...task, dependencias: typeof task.dependencias === 'string' ? JSON.parse(task.dependencias) : (task.dependencias || []) });
module.exports = {
  async projects() {
    const [projects, milestones, tasks, plots] = await Promise.all(['proyecto', 'hito', 'tarea', 'predio'].map(all));
    const plotsById = new Map(plots.map(plot => [Number(plot.id), plot.nombre]));
    const tasksByMilestone = new Map();
    tasks.forEach(task => {
      const key = Number(task.hito_id);
      if (!tasksByMilestone.has(key)) tasksByMilestone.set(key, []);
      tasksByMilestone.get(key).push({ ...decode(task), predio_nombre: plotsById.get(Number(task.predio_id)) || null });
    });
    const milestonesByProject = new Map();
    milestones.sort((a, b) => a.orden - b.orden || a.id - b.id).forEach(hito => {
      const key = Number(hito.proyecto_id);
      if (!milestonesByProject.has(key)) milestonesByProject.set(key, []);
      milestonesByProject.get(key).push({ ...hito, tareas: tasksByMilestone.get(Number(hito.id)) || [] });
    });
    return projects.map(project => ({ ...project, hitos: milestonesByProject.get(Number(project.id)) || [] }));
  },
  async tasks(projectId) {
    const rows = cloud()
      ? (await all('tarea')).filter(task => Number(task.proyecto_id) === Number(projectId))
      : await db.all('SELECT * FROM tarea WHERE proyecto_id = ?', [projectId]);
    return rows.map(decode);
  },
  async task(id) {
    const task = cloud() ? (await supabase.selectRows('tarea', { filters: { id: `eq.${id}` }, limit: 1 }))[0] : await db.get('SELECT * FROM tarea WHERE id = ?', [id]);
    return task ? decode(task) : null;
  },
  async update(id, fields) {
    if (cloud()) return decode((await supabase.updateRows('tarea', { id: `eq.${id}` }, fields))[0]);
    await db.run('UPDATE tarea SET fecha_inicio = ?, fecha_fin = ?, responsable = ?, dependencias = ? WHERE id = ?', [fields.fecha_inicio, fields.fecha_fin, fields.responsable, JSON.stringify(fields.dependencias), id]);
    return this.task(id);
  }
};
