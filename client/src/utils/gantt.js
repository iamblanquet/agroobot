const DAY = 86400000;
export function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value ? stamp / DAY : null;
}
export const dayString = day => new Date(day * DAY).toISOString().slice(0, 10);
export const todayDay = () => {
  const now = new Date();
  return parseDay(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
};
export const displayDay = day => day == null ? 'Sin fecha' : new Date(day * DAY).toLocaleDateString('es-MX', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });
export const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const dependencies = value => {
  try { const list = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(list) ? list.map(Number) : []; } catch { return []; }
};
export function taskProgress(task) {
  if (task.estado === 'completada') return 100;
  const goal = Number(task.cantidad_meta);
  return goal > 0 ? Math.max(0, Math.min(100, Number(task.cantidad_acumulada || 0) / goal * 100)) : 0;
}
const average = tasks => tasks.length ? tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length : 0;

// Calcular antes de filtrar: la búsqueda nunca cambia fechas ni avances.
export function buildSchedule(projects, today = todayDay()) {
  return projects.map(project => {
    const pStart = parseDay(project.fecha_inicio) ?? today;
    const pEnd = Math.max(pStart, parseDay(project.fecha_fin) ?? pStart + 59);
    let previousEnd = pStart - 1;
    const milestones = [...(project.hitos || [])].sort((a, b) => a.orden - b.orden || a.id - b.id).map(hito => {
      const end = parseDay(hito.fecha_meta) ?? Math.min(pEnd, previousEnd + 20);
      const start = Math.min(end, Math.max(pStart, previousEnd + 1));
      previousEnd = end;
      const sourceTasks = [...(hito.tareas || [])].sort((a, b) => a.id - b.id);
      const duration = end - start + 1;
      const tasks = sourceTasks.map((task, index) => {
        const realStart = parseDay(task.fecha_inicio);
        const realEnd = parseDay(task.fecha_fin);
        const estimated = realStart == null || realEnd == null;
        const taskStart = realStart ?? start + Math.floor(index * duration / Math.max(1, sourceTasks.length));
        const taskEnd = Math.max(taskStart, realEnd ?? start + Math.max(0, Math.floor((index + 1) * duration / Math.max(1, sourceTasks.length)) - 1));
        const progress = taskProgress(task);
        return { ...task, key: `t-${task.id}`, type: 'task', projectId: project.id, milestoneId: hito.id, start: taskStart, end: taskEnd, estimated, progress, dependencias: dependencies(task.dependencias), overdue: !estimated && taskEnd < today && task.estado !== 'completada', warnings: [] };
      });
      return { ...hito, key: `h-${hito.id}`, type: 'milestone', start: Math.min(start, ...tasks.map(t => t.start)), end: Math.max(end, ...tasks.map(t => t.end)), target: parseDay(hito.fecha_meta), tasks, progress: average(tasks), estimated: true };
    });
    const tasks = milestones.flatMap(h => h.tasks);
    const taskMap = new Map(tasks.map(task => [Number(task.id), task]));
    tasks.forEach(task => {
      const hito = milestones.find(h => h.id === task.milestoneId);
      if (!task.estimated && hito.target != null && task.end > hito.target) task.warnings.push('Termina después de la meta del hito.');
      task.dependencias.forEach(id => {
        const previous = taskMap.get(id);
        if (!previous) task.warnings.push('Hay una dependencia que ya no existe.');
        else if (previous.estimated) task.warnings.push(`Faltan fechas confirmadas de «${previous.nombre}».`);
        else if (!task.estimated && task.start <= previous.end) task.warnings.push(`Debe comenzar después de «${previous.nombre}» (${displayDay(previous.end)}).`);
      });
    });
    return { ...project, key: `p-${project.id}`, type: 'project', start: Math.min(pStart, ...milestones.map(h => h.start)), end: Math.max(pEnd, ...milestones.map(h => h.end)), milestones, tasks, progress: average(tasks), estimated: parseDay(project.fecha_inicio) == null || parseDay(project.fecha_fin) == null };
  });
}

export function filterSchedule(schedule, query = '', status = 'all') {
  const q = normalizeText(query);
  const matches = row => normalizeText(`${row.nombre} ${row.responsable || ''} ${row.predio_nombre || ''}`).includes(q);
  const statusMatches = task => status === 'all' || (status === 'atrasada' ? task.overdue : task.estado === status);
  return schedule.map(project => {
    const projectMatch = matches(project);
    const milestones = project.milestones.map(hito => ({ ...hito, tasks: hito.tasks.filter(task => (projectMatch || matches(hito) || matches(task)) && statusMatches(task)) }))
      .filter(hito => hito.tasks.length || (status === 'all' && (projectMatch || matches(hito))));
    return { ...project, milestones };
  }).filter(project => project.milestones.length || (status === 'all' && matches(project)));
}

export function flattenSchedule(schedule, collapsed = {}, forceOpen = false) {
  return schedule.flatMap(project => [project, ...(!forceOpen && collapsed[project.key] ? [] : project.milestones.flatMap(hito => [hito, ...(!forceOpen && collapsed[hito.key] ? [] : hito.tasks)]))]);
}

export function timelineUnits(start, end, scale) {
  const units = [];
  for (let day = start; day <= end;) {
    const date = new Date(day * DAY);
    let next = day + 1;
    if (scale === 'semanas') next = day + (date.getUTCDay() === 1 ? 7 : (8 - date.getUTCDay()) % 7 || 7);
    if (scale === 'meses') next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / DAY;
    const label = scale === 'meses'
      ? date.toLocaleDateString('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      : date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const stop = Math.min(end + 1, next);
    units.push({ start: day, days: stop - day, label, weekend: [0, 6].includes(date.getUTCDay()) });
    day = stop;
  }
  return units;
}
