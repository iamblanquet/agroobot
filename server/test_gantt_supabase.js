process.env.SUPABASE_AUTH_ENABLED = 'true';
process.env.DB_PATH = ':memory:';
const assert = require('node:assert/strict');
const tables = {
  proyecto: [{ id: 1, nombre: 'Proyecto' }],
  hito: [{ id: 1, proyecto_id: 1, orden: 1 }],
  predio: [{ id: 1, nombre: 'Predio' }],
  tarea: Array.from({ length: 1001 }, (_, index) => ({ id: index + 1, proyecto_id: 1, hito_id: 1, predio_id: 1, dependencias: [] }))
};
const calls = [];
const match = (row, filters) => Object.entries(filters).every(([key, value]) => String(row[key]) === String(value).slice(3));
const path = require.resolve('./db/supabase');
require.cache[path] = { id: path, filename: path, loaded: true, exports: {
  isSupabaseConfigured: () => true,
  async selectRows(table, { filters = {}, offset = 0, limit = 1000 } = {}) {
    calls.push({ table, offset });
    return tables[table].filter(row => match(row, filters)).slice(offset, offset + limit);
  },
  async updateRows(table, filters, fields) {
    const rows = tables[table].filter(row => match(row, filters));
    rows.forEach(row => Object.assign(row, fields));
    return rows;
  }
} };
const repository = require('./repositories/ganttRepository');
(async () => {
  const projects = await repository.projects();
  assert.equal(projects[0].hitos[0].tareas.length, 1001);
  assert.equal(projects[0].hitos[0].tareas[1000].predio_nombre, 'Predio');
  assert(calls.some(call => call.table === 'tarea' && call.offset === 1000));
  assert.equal((await repository.tasks(1)).length, 1001);
  assert.equal((await repository.tasks(2)).length, 0);
  const fields = { fecha_inicio: '2026-09-18', fecha_fin: '2026-09-20', responsable: 'Ana', dependencias: [1] };
  await repository.update(1001, fields);
  const task = await repository.task(1001);
  assert.deepEqual(task.dependencias, [1]);
  assert.equal(task.fecha_inicio, fields.fecha_inicio);
  assert.equal(await repository.task(1002), null);
  console.log('Gantt Supabase: paginación, agrupación y persistencia verificadas con servicio simulado.');
})().catch(error => { console.error(error); process.exitCode = 1; });
