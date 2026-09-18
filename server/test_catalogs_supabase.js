// Contract test: cloud routes must never touch SQLite or write links by REST.
process.env.SUPABASE_AUTH_ENABLED = 'true';
process.env.JWT_SECRET = 'catalog-cloud-test-secret-not-for-production-12345';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const calls = [];
const tables = {
  usuario: [{ id: 1, activo: true, rol: 'supervisor' }],
  hito: [], tarea: [], maquina: [], empleado: [],
  proyecto_predio: [{ proyecto_id: 1, predio_id: 1 }],
  proyecto: [{ id: 1, nombre: 'Proyecto cloud' }],
  predio: [{ id: 1, nombre: 'Predio cloud', tg_thread_id: '101', superficie_legal_ha: 10, superficie_util_ha: 0, regimen: 'Privada' }],
  obra: [{ id: 1, nombre: 'Frente cloud', proyecto_id: 1, estado: 'operacion', fase_actual: 'Operación', tg_thread_id: '101' }],
  obra_predio: [{ obra_id: 1, predio_id: 1 }]
};
function mock(module, exports) {
  const path = require.resolve(module);
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
}
function rows(table, filters = {}) {
  return tables[table].filter(row => Object.entries(filters).every(([key, value]) => ['order', 'limit'].includes(key) || String(row[key]) === String(value).slice(3)));
}
mock('./db/database', { db: new Proxy({}, { get() { return () => { throw new Error('SQLite accessed in cloud mode'); }; } }) });
let failRpc = false;
mock('./db/supabase', {
  isSupabaseConfigured: () => true,
  findUserById: async id => tables.usuario.find(user => user.id === Number(id)),
  async selectRows(table, { filters = {}, select = '*' } = {}) {
    const result = rows(table, filters);
    if (table === 'proyecto_predio' && select.startsWith('predio:')) return result.map(row => ({ predio: tables.predio.find(p => p.id === row.predio_id) }));
    if (table === 'obra_predio') return result.map(row => select.startsWith('predio:')
      ? { predio: tables.predio.find(p => p.id === row.predio_id) }
      : { obra: tables.obra.find(o => o.id === row.obra_id) });
    return result.map(row => ({ ...row }));
  },
  async insertRow() { throw new Error('Non-transactional REST insert attempted'); },
  async updateRows(table, filters, fields) {
    const result = rows(table, filters); result.forEach(row => Object.assign(row, fields)); return result;
  },
  async deleteRows(table, filters) {
    calls.push({ delete: table });
    const found = rows(table, filters);
    tables[table] = tables[table].filter(row => !found.includes(row));
  },
  async rpc(name, args) {
    calls.push({ name, args });
    assert.equal(name, 'save_catalog_entry');
    if (failRpc) throw new Error('RPC migration missing');
    const table = args.p_kind;
    let record = tables[table].find(row => row.id === args.p_id);
    if (!record) { record = { id: 20 + calls.length }; tables[table].push(record); }
    Object.assign(record, args.p_fields);
    if (table === 'proyecto' && args.p_predio_ids !== null) {
      tables.proyecto_predio = tables.proyecto_predio.filter(r => r.proyecto_id !== record.id);
      for (const pid of args.p_predio_ids) tables.proyecto_predio.push({ proyecto_id: record.id, predio_id: pid });
    }
    return { project: table === 'proyecto' ? { ...record } : null, predio: table === 'predio' ? { ...record } : null, obra: table === 'obra' ? { ...record } : null };
  }
});
let telegramCalls = 0;
mock('./bot/bot', { async createPredioForumTopic() { telegramCalls++; return null; } });

(async () => {
  const app = express(); app.use(express.json()); app.use('/api/projects', require('./routes/projects'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
  const request = async (method, path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/projects${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request('GET', '/cascade-options')).data.predios[0].nombre, 'Predio cloud');
    assert.equal((await request('GET', '/obras')).data.obras[0].predios[0].id, 1);
    assert.equal((await request('PATCH', '/obras/1', { nombre: 'Editado', predio_ids: [1, '1'] })).status, 200);
    assert.deepEqual(calls.at(-1).args.p_predio_ids, [1]);
    assert.equal(calls.at(-1).args.p_id, 1);
    assert.equal((await request('POST', '/predios/1/create-telegram-topic', {})).data.telegram_status, 'existente');
    assert.equal((await request('POST', '/sync-telegram-topics', {})).data.results[0].status, 'omitido_existente');
    assert.equal(telegramCalls, 0);
    assert.equal((await request('PATCH', '/predios/1', { superficie_util_ha: 0 })).status, 200);
    assert.equal(calls.at(-1).args.p_fields.superficie_util_ha, 0);
    const plot = await request('POST', '/predios', { nombre: 'Predio sin proyecto', superficie_legal_ha: 10, superficie_util_ha: 0 });
    assert.equal(plot.status, 201); assert.equal(plot.data.telegram_status, 'pendiente');
    assert.equal(calls.at(-1).args.p_kind, 'predio'); assert.equal(calls.at(-1).args.p_frente, null);
    const project = await request('POST', '/', { nombre: 'Segundo proyecto', tipo: 'maiz', ciclo: '2026', predio_ids: [1] });
    assert.equal(project.status, 201); assert.equal(calls.at(-1).args.p_kind, 'proyecto');
    assert.equal((await request('GET', '/cascade-options')).data.proyectos.filter(p => p.predio_ids.includes(1)).length, 2);
    const created = await request('POST', '/obras', { nombre: 'Nuevo', proyecto_id: project.data.project.id, predio_ids: [1] });
    assert.equal(created.status, 201); assert.equal(telegramCalls, 1);
    const before = telegramCalls;
    failRpc = true;
    const originalError = console.error;
    const expectedErrors = [];
    try {
      console.error = (...args) => expectedErrors.push(args);
      assert.equal((await request('POST', '/obras', { nombre: 'No guardar', proyecto_id: 1, predio_ids: [1] })).status, 500);
      assert.equal(expectedErrors.length, 1);
    } finally { console.error = originalError; }
    assert.equal(telegramCalls, before);
    assert.equal((await request('DELETE', '/obras/1')).status, 200);
    assert.equal(calls.at(-1).delete, 'obra');
    console.log('Catálogos Supabase: lecturas, edición, borrado, RPC y Telegram verificados con servicio simulado, sin SQLite.');
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
