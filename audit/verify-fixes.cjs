// Isolated verification of the repaired audit findings.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'audit-verification-secret-with-more-than-32-characters';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const { db, initDatabase, getDb } = require('../server/db/database');
require.cache[require.resolve('../server/bot/bot')] = { exports: { notifyReporte() {} } };

async function main() {
  await initDatabase();
  await db.run("INSERT INTO usuario (username,password_hash,pin,nombre,rol) VALUES ('admin','x','4829','Admin','it')");
  await db.run("INSERT INTO proyecto (nombre,tipo,ciclo) VALUES ('Audit','maiz','2026')");
  await db.run("INSERT INTO hito (proyecto_id,nombre) VALUES (1,'Hito')");
  await db.run("INSERT INTO tarea (hito_id,proyecto_id,nombre,actividad_id,cantidad_meta) VALUES (1,1,'Tarea','siembra',100)");
  await db.run("INSERT INTO maquina (codigo,modelo,umbral_servicio_hrs) VALUES ('AUDIT','Audit',100)");
  const app = express(); app.use(express.json());
  for (const name of ['auth', 'reports', 'machines', 'stats']) app.use(`/api/${name}`, require(`../server/routes/${name}`));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  let token;
  const request = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, {
      method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {})
    });
    const text = await response.text();
    return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null };
  };
  try {
    assert.equal((await request('auth/operators')).status, 404);
    token = (await request('auth/pin-login', { pin: '4829' })).body.token;
    const bad = await request('reports/sync', { reports: [{ client_uuid: 'bad', tarea_id: 1, maquinaria: [{ maquina_id: 999 }] }] });
    assert.equal(bad.body.results[0].status, 'error');
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM reporte')).count, 0);
    const good = await request('reports/sync', { reports: [{ client_uuid: 'good', proyecto_id: 1, hito_id: 1, tarea_id: 1, lineas: [{ cantidad: 5, cantidad_ha: 5 }] }] });
    assert.equal(good.body.results[0].status, 'synced');
    assert.equal((await db.get('SELECT cantidad_acumulada AS amount FROM tarea WHERE id = 1')).amount, 5);
    await request('reports/sync', { reports: [{ client_uuid: 'machine', maquinaria: [{ maquina_id: 1, horometro_fin: 90 }] }] });
    assert.equal((await request('stats/supervisor')).body.maquinaria[0].alerta_activa, true);
    const data = new URLSearchParams({ auth_date: '1', user: JSON.stringify({ id: 1 }) });
    const secret = crypto.createHmac('sha256', 'WebAppData').update('bot-token').digest();
    data.set('hash', crypto.createHmac('sha256', secret).update([...data].map(([key, value]) => `${key}=${value}`).sort().join('\n')).digest('hex'));
    assert.equal(require('../server/middleware/auth').verifyTelegramWebAppData(data.toString(), 'bot-token').isValid, false);
    console.log('Audit fixes verified.');
  } finally { await new Promise(resolve => server.close(resolve)); await new Promise(resolve => getDb().close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
