process.env.SUPABASE_AUTH_ENABLED = 'false';
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'crew-test-only-secret-at-least-32-characters';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, initDatabase, getDb } = require('./db/database');

async function run() {
  await initDatabase();
  const user = await db.run('INSERT INTO usuario (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)', ['crew-test', 'unused', 'Campo', 'campo']);
  await db.run("INSERT INTO proyecto(id,nombre,tipo,ciclo) VALUES(1,'Proyecto','maiz','2026')");
  await db.run("INSERT INTO predio(id,nombre) VALUES(1,'Predio')");
  await db.run("INSERT INTO obra(id,nombre,proyecto_id) VALUES(1,'Frente',1)");
  await db.run('INSERT INTO proyecto_predio VALUES(1,1)');
  await db.run('INSERT INTO obra_predio VALUES(1,1)');
  const token = jwt.sign({ id: user.lastID }, process.env.JWT_SECRET);
  const employee = await db.run('INSERT INTO empleado (nombre, puesto, roles) VALUES (?, ?, ?)', ['Ana Pérez', 'Maquinaria', '["operadores","tecnicos"]']);
  const employeeId = employee.lastID;
  // Evitar cualquier notificación externa durante las pruebas HTTP.
  require.cache[require.resolve('./bot/bot')] = { id: require.resolve('./bot/bot'), filename: require.resolve('./bot/bot'), loaded: true, exports: { notifyReporte() {} } };
  const app = express();
  app.use(express.json());
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/reports', require('./routes/reports'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(path, body) {
    if (path === '/reports/sync' && body) body = { obra_id: 1, proyecto_id: 1, predio_id: 1, ...body };
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    assert.equal(response.status, 200);
    return response.json();
  }
  try {
    const catalog = await request('/projects/cascade-options');
    assert.deepEqual(catalog.empleados[0].roles, ['operadores', 'tecnicos']);
    const valid = { client_uuid: 'named-crew', cuadrilla: [{ rol_id: 'operador', headcount: 999, empleados: [{ id: employeeId, nombre: 'Nombre alterado' }] }] };
    assert.equal((await request('/reports/sync', valid)).syncedCount, 1);
    assert.equal((await request('/reports/sync', valid)).ignoredCount, 1);
    const saved = (await request('/reports')).reports[0].cuadrilla[0];
    assert.equal(saved.headcount, 1);
    assert.deepEqual(saved.empleados, [{ id: employeeId, nombre: 'Ana Pérez' }]);

    for (const [uuid, cuadrilla] of [
      ['duplicate', [{ rol_id: 'operador', empleados: [{ id: employeeId }] }, { rol_id: 'tecnico', empleados: [{ id: employeeId }] }]],
      ['wrong-role', [{ rol_id: 'auxiliar', empleados: [{ id: employeeId }] }]],
      ['missing', [{ rol_id: 'operador', empleados: [{ id: 99999 }] }]],
      ['bad-id', [{ rol_id: 'operador', empleados: [{ id: '1' }] }]]
    ]) {
      assert.equal((await request('/reports/sync', { client_uuid: uuid, cuadrilla })).results[0].status, 'error');
      assert.equal(await db.get('SELECT id FROM reporte WHERE client_uuid = ?', [uuid]), undefined);
    }
    assert.equal((await request('/reports/sync', { client_uuid: 'legacy', cuadrilla: [{ rol_id: 'operador', headcount: 3 }] })).syncedCount, 1);
    assert.equal((await request('/reports/sync', { client_uuid: 'stopped', es_sin_actividad: true, cuadrilla: valid.cuadrilla })).syncedCount, 1);
    await db.run('DELETE FROM empleado WHERE id = ?', [employeeId]);
    await initDatabase();
    const historic = (await request('/reports')).reports.find(report => report.client_uuid === 'named-crew');
    assert.equal(historic.cuadrilla[0].empleados[0].nombre, 'Ana Pérez');
    console.log('Cuadrilla: catálogo para campo, roles, duplicados, totales, persistencia histórica, idempotencia y compatibilidad correctos.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => getDb().close(error => error ? reject(error) : resolve()));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
