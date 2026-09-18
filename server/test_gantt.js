process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'gantt-tests-secret-not-for-production-12345';
process.env.SUPABASE_AUTH_ENABLED = 'false';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { db, initDatabase, getDb } = require('./db/database');
async function run() {
  await initDatabase();
  await db.run('INSERT INTO usuario (id, username, password_hash, nombre, rol, pin) VALUES (1, ?, ?, ?, ?, ?)', ['gantt-test', await bcrypt.hash('gantt-preview', 4), 'Supervisor de prueba', 'supervisor', '4567']);
  await db.run('INSERT INTO usuario (id, username, password_hash, nombre, rol) VALUES (2, ?, ?, ?, ?)', ['campo-test', 'unused', 'Campo', 'campo']);
  await db.run("INSERT INTO proyecto (id,nombre,tipo,ciclo,fecha_inicio,fecha_fin) VALUES (1,'Maíz · Prueba de planificación','maiz','2026','2026-09-01','2026-10-30')");
  await db.run("INSERT INTO hito (id,proyecto_id,nombre,orden,fecha_meta) VALUES (1,1,'Preparación de suelo',1,'2026-09-20'),(2,1,'Siembra',2,'2026-10-20')");
  for (const [id, name, hito, unit, goal, actual] of [[1,'Análisis de suelo',1,'pza',1,1],[2,'Preparar terreno',1,'ha',100,50],[3,'Sembrar maíz',2,'ha',100,0]]) {
    await db.run('INSERT INTO tarea (id,hito_id,proyecto_id,nombre,actividad_id,unidad,cantidad_meta,cantidad_acumulada) VALUES (?,?,1,?,?,?,?,?)', [id,hito,name,'prueba',unit,goal,actual]);
  }
  const app = express(); app.use(express.json());
  app.use('/api/gantt', require('./routes/gantt'));
  app.use('/api/auth', require('./routes/auth'));
  app.use(express.static(path.join(__dirname, '../client/dist')));
  const preview = process.argv.includes('--preview');
  const server = app.listen(preview ? 3107 : 0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  if (preview) { console.log('Vista de prueba: http://127.0.0.1:3107/#gantt · PIN 4567 · SQLite en memoria, sin bot.'); return; }
  async function request(method, suffix = '', body, userId = 1) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/gantt${suffix}`, { method, headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const fields = { fecha_inicio: '2026-09-01', fecha_fin: '2026-09-03', responsable: 'Ana', dependencias: [] };
  try {
    assert.equal((await request('GET', '', null, null)).status, 401);
    assert.equal((await request('GET', '', null, 2)).status, 403);
    assert.equal((await request('PATCH', '/tasks/1', fields, 2)).status, 403);
    assert.equal((await request('GET')).data.projects[0].hitos.length, 2);
    for (const invalid of [{ ...fields, fecha_fin: '2026-02-30' }, { ...fields, fecha_fin: '2026-08-01' }, { ...fields, fecha_inicio: null }, { ...fields, dependencias: [1] }, { ...fields, dependencias: [999] }, { ...fields, responsable: 'x'.repeat(151) }]) assert.equal((await request('PATCH', '/tasks/1', invalid)).status, 400);
    assert.equal((await request('PATCH', '/tasks/999', fields)).status, 404);
    assert.equal((await request('PATCH', '/tasks/1', fields)).status, 200);
    assert.equal((await request('PATCH', '/tasks/2', { ...fields, dependencias: [1] })).status, 200);
    assert.equal((await request('PATCH', '/tasks/1', { ...fields, dependencias: [2] })).status, 400);
    await initDatabase();
    const saved = (await request('GET')).data.projects[0].hitos[0].tareas;
    assert.equal(saved.find(task => task.id === 1).fecha_inicio, '2026-09-01');
    assert.deepEqual(saved.find(task => task.id === 2).dependencias, [1]);
    assert.equal((await request('PATCH', '/tasks/1', { ...fields, fecha_inicio: null, fecha_fin: null })).status, 200);
    console.log('Gantt API: persistencia, migración repetible, fechas inválidas, permisos y ciclos verificados.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => getDb().close(error => error ? reject(error) : resolve()));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
