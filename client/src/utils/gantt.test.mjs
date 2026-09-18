import assert from 'node:assert/strict';
import { parseDay, dayString, displayDay, buildSchedule, filterSchedule, timelineUnits, taskProgress } from './gantt.js';

process.env.TZ = 'America/Mexico_City';
assert.equal(dayString(parseDay('2026-03-01')), '2026-03-01');
assert.match(displayDay(parseDay('2026-03-01')), /01.*mar.*2026/);
assert.equal(parseDay('2026-02-30'), null);
assert.equal(parseDay('2024-02-29') + 1, parseDay('2024-03-01'));
const projects = [{ id: 1, nombre: 'Maíz', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-20', hitos: [
  { id: 1, orden: 1, nombre: 'Preparación', fecha_meta: '2026-03-04', tareas: Array.from({ length: 5 }, (_, i) => ({ id: i + 1, nombre: `Labor ${i}`, estado: 'en_progreso', cantidad_meta: 100, cantidad_acumulada: 50, unidad: 'ha' })) },
  { id: 2, orden: 2, nombre: 'Siembra', fecha_meta: '2026-03-20', tareas: [{ id: 6, nombre: 'Semilla', estado: 'en_progreso', cantidad_meta: 1, cantidad_acumulada: 0, unidad: 'pza', fecha_inicio: '2026-03-08', fecha_fin: '2026-03-10', dependencias: [1] }] }
] }];
const model = buildSchedule(projects, parseDay('2026-03-12'));
assert.equal(model[0].progress, 250 / 6);
assert.equal(model[0].tasks[5].overdue, true);
assert.equal(model[0].tasks[5].start, parseDay('2026-03-08'));
assert.ok(model[0].tasks[5].warnings.length);
assert.ok(model[0].milestones[0].tasks.every(task => task.start <= task.end && task.end <= parseDay('2026-03-04')));
const filtered = filterSchedule(model, 'semilla');
assert.equal(filtered[0].milestones.length, 1);
assert.equal(filtered[0].milestones[0].start, model[0].milestones[1].start);
assert.equal(filtered[0].milestones[0].tasks[0].start, model[0].tasks[5].start);
assert.equal(filtered[0].progress, model[0].progress);
assert.equal(filterSchedule(model, 'labor 2')[0].milestones[0].tasks.length, 1);
assert.equal(filterSchedule(model, '', 'atrasada')[0].milestones[0].tasks[0].id, 6);
assert.equal(taskProgress({ cantidad_meta: 0, cantidad_acumulada: 10 }), 0);
for (const scale of ['dias', 'semanas', 'meses']) {
  const units = timelineUnits(parseDay('2026-03-04'), parseDay('2026-04-02'), scale);
  assert.equal(units.reduce((sum, unit) => sum + unit.days, 0), 30);
  units.slice(1).forEach((unit, i) => assert.equal(units[i].start + units[i].days, unit.start));
}
const stress = Array.from({ length: 100 }, (_, i) => ({ ...projects[0], id: i + 1 }));
assert.equal(buildSchedule(stress).length, 100);
console.log('Gantt: fechas México, bisiestos, filtros estables, avances mixtos, estimaciones y escalas verificados.');
