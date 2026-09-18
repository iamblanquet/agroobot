process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'employees-test-only';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, initDatabase, getDb } = require('./db/database');

async function run() {
  // Simular una base de la versión anterior con empleados ya registrados.
  await db.exec('CREATE TABLE empleado (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, puesto TEXT NOT NULL)');
  await db.run('INSERT INTO empleado (nombre, puesto) VALUES (?, ?)', ['Empleado anterior', 'Técnico']);
  await initDatabase();
  const migrated = await db.get('SELECT * FROM empleado WHERE id = 1');
  assert.equal(migrated.nombre, 'Empleado anterior');
  assert.equal(migrated.roles, '[]');
  await db.run('DELETE FROM empleado WHERE id = 1');
  const tokens = {};
  for (const rol of ['campo', 'supervisor', 'direccion', 'it']) {
    const result = await db.run('INSERT INTO usuario (username, password_hash, nombre, rol) VALUES (?, ?, ?, ?)', [rol, 'unused', rol, rol]);
    tokens[rol] = jwt.sign({ id: result.lastID }, process.env.JWT_SECRET);
  }
  const app = express();
  app.use(express.json());
  app.use('/api/employees', require('./routes/employees'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function request(method, path = '', body, role = 'supervisor') {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/employees${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    assert.equal((await request('GET', '', undefined, null)).status, 401);
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
      assert.equal((await request(method, ['PATCH', 'DELETE'].includes(method) ? '/1' : '', method === 'GET' ? undefined : { nombre: 'Ana', roles: ['operadores'] }, 'campo')).status, 403);
    }
    assert.deepEqual((await request('GET')).data.employees, []);
    for (const body of [{}, { nombre: ' ', puesto: 'Operador' }, { nombre: 123, puesto: 'Operador' }, { nombre: 'x'.repeat(151), roles: ['operadores'] }]) {
      assert.equal((await request('POST', '', body)).status, 400);
    }
    const created = await request('POST', '', { nombre: ' Ana Pérez ', roles: ['operadores', 'tecnicos'] });
    assert.equal(created.status, 201);
    assert.equal(created.data.employee.nombre, 'Ana Pérez');
    assert.deepEqual(created.data.employee.roles, ['operadores', 'tecnicos']);
    const id = created.data.employee.id;
    assert.equal((await request('PATCH', `/${id}`, { nombre: 'Ana Pérez', roles: ['tecnicos', 'auxiliares'] }, 'direccion')).status, 200);
    await initDatabase();
    const list = await request('GET', '', undefined, 'it');
    assert.equal('puesto' in list.data.employees[0], false);
    assert.deepEqual(list.data.employees[0].roles, ['tecnicos', 'auxiliares']);
    for (const roles of [[], ['administrador'], 'operadores', null, ['operadores', 1]]) {
      assert.equal((await request('POST', '', { nombre: 'Ana', roles })).status, 400);
      assert.equal((await request('PATCH', `/${id}`, { nombre: 'Ana', roles })).status, 400);
    }
    const allRoles = ['operadores', 'tecnicos', 'auxiliares'];
    assert.equal((await request('PATCH', `/${id}`, { nombre: 'Ana', roles: allRoles })).status, 200);
    assert.deepEqual((await request('GET')).data.employees[0].roles, allRoles);
    assert.equal((await request('DELETE', '/invalid')).status, 400);
    assert.equal((await request('DELETE', `/${id}`, undefined, 'it')).status, 200);
    assert.deepEqual((await request('GET')).data.employees, []);
    assert.equal((await request('DELETE', `/${id}`)).status, 404);
    assert.equal((await request('PATCH', '/99999', { nombre: 'Ana', roles: ['operadores'] })).status, 404);
    assert.equal((await request('PATCH', '/invalid', { nombre: 'Ana', roles: ['operadores'] })).status, 400);
    console.log('Empleados: CRUD, roles múltiples, validación, permisos y migración sin pérdida de datos correctos.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => getDb().close(err => err ? reject(err) : resolve()));
  }
}

run().catch(err => { console.error(err); process.exitCode = 1; });
