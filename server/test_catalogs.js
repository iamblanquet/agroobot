process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'catalog-tests-secret-not-for-production-12345';
process.env.SUPABASE_AUTH_ENABLED = 'false';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_SUPERGROUP_ID = '-100-test';
process.env.DISABLE_TELEGRAM_TOPIC_CREATION = 'false';
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, initDatabase, getDb } = require('./db/database');
const catalog = require('./repositories/catalogRepository');
const { resolveIncomingFront } = require('./services/reportLocation');
const telegramMessages = [];
let telegramCalls = 0;
let available = true;
const telegramPath = require.resolve('node-telegram-bot-api');
require.cache[telegramPath] = { id: telegramPath, filename: telegramPath, loaded: true, exports: class FakeBot {
  async createForumTopic(chat, title) { telegramCalls++; if (!available) throw new Error('Telegram unavailable'); return { message_thread_id: 100 + telegramCalls }; }
  async sendMessage(chat, text, options) { telegramMessages.push({ chat, text, options }); return { message_id: telegramMessages.length }; }
  async pinChatMessage() {}
} };
async function run() {
  await initDatabase();
  await db.run("INSERT INTO usuario(id,username,password_hash,nombre,rol) VALUES(1,'supervisor','unused','Supervisor','supervisor'),(2,'campo','unused','Campo','campo')");
  const app = express(); app.use(express.json());
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/machines', require('./routes/machines'));
  app.use('/api/reports', require('./routes/reports'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  async function request(method, path, body, user = 1) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${jwt.sign({ id: user }, process.env.JWT_SECRET)}` } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });
    return { status: response.status, data: await response.json() };
  }
  try {
    const base = { nombre: 'Predio A', superficie_legal_ha: 15, superficie_util_ha: 0 };
    assert.equal((await request('POST', '/projects/predios', base, null)).status, 401);
    assert.equal((await request('POST', '/projects/predios', base, 2)).status, 403);
    for (const fields of [{ superficie_legal_ha: -1 }, { superficie_util_ha: 16 }, { superficie_util_ha: '1abc' }, { nombre: '  ' }, { crear_grupo_telegram: 'false' }]) {
      assert.equal((await request('POST', '/projects/predios', { ...base, ...fields })).status, 400);
    }
    const plot = await request('POST', '/projects/predios', base);
    assert.equal(plot.status, 201); assert.equal(plot.data.predio.superficie_util_ha, 0);
    const pid = plot.data.predio.id;
    assert.equal(plot.data.tg_thread_id, '101'); assert.equal(telegramCalls, 1);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM obra')).n, 0);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM proyecto')).n, 0);
    const secondPlot = await request('POST', '/projects/predios', { ...base, nombre: 'Predio B' });
    const pid2 = secondPlot.data.predio.id;
    const createProject = async nombre => request('POST', '/projects', { nombre, tipo: 'Granos', ciclo: '2026', predio_ids: [pid] });
    const projectA = await createProject('Proyecto A');
    const projectB = await createProject('Proyecto B');
    assert.equal(projectA.status, 201); assert.equal(projectB.status, 201);
    const aid = projectA.data.project.id, bid = projectB.data.project.id;
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM proyecto_predio WHERE predio_id = ?', [pid])).n, 2);
    assert.equal(telegramCalls, 2);
    assert.equal((await request('POST', '/projects/obras', { nombre: 'Incorrecto', proyecto_id: aid, predio_ids: [pid2] })).status, 400);
    const frontA = await request('POST', '/projects/obras', { nombre: 'Frente A', proyecto_id: aid, predio_ids: [pid, String(pid)] });
    const frontB = await request('POST', `/projects/${bid}/obras`, { nombre: 'Frente B', predio_ids: [pid] });
    assert.equal(frontA.status, 201); assert.equal(frontB.status, 201);
    const oid = frontA.data.obra.id, oid2 = frontB.data.obra.id;
    assert.equal(telegramCalls, 2, 'Projects and fronts must not create Telegram topics');
    assert.equal((await request('POST', `/projects/obras/${oid}/create-telegram-topic`, {})).status, 409);
    assert.equal((await request('PATCH', `/projects/${aid}`, { predio_ids: [] })).status, 400);
    await assert.rejects(catalog.save('obra', oid, { nombre: 'Rollback' }, [pid2]));
    assert.equal((await db.get('SELECT nombre FROM obra WHERE id=?', [oid])).nombre, 'Frente A');
    await assert.rejects(resolveIncomingFront(undefined));
    await assert.rejects(resolveIncomingFront('101'), /Indica el frente/);
    assert.equal((await resolveIncomingFront('101', `#${oid2}`)).project.id, bid);
    await assert.rejects(resolveIncomingFront('102', `#${oid}`));
    const report = { client_uuid: 'report-A', obra_id: oid, proyecto_id: aid, predio_id: pid, lineas: [{ predio_id: pid, cantidad: 2, cantidad_ha: 2, unidad: 'ha' }] };
    assert.equal((await request('POST', '/reports/sync', report)).data.syncedCount, 1);
    let sent = telegramMessages.at(-1);
    assert.equal(sent.options.message_thread_id, 101);
    assert(sent.text.includes('Predio A') && sent.text.includes('Proyecto A') && sent.text.includes('Frente A'));
    assert.equal((await request('POST', '/reports/sync', { ...report, client_uuid: 'report-B', obra_id: oid2, proyecto_id: bid })).data.syncedCount, 1);
    sent = telegramMessages.at(-1); assert.equal(sent.options.message_thread_id, 101); assert(sent.text.includes('Frente B'));
    assert.equal((await request('POST', '/reports/sync', { ...report, client_uuid: 'stopped', es_sin_actividad: true, lineas: [] })).data.syncedCount, 1);
    assert.equal(telegramMessages.at(-1).options.message_thread_id, 101);
    assert.equal((await db.get("SELECT predio_id FROM reporte WHERE client_uuid='stopped'")).predio_id, pid);
    const messageCount = telegramMessages.length;
    assert.equal((await request('POST', '/reports/sync', report)).data.ignoredCount, 1);
    for (const bad of [{ predio_id: pid2 }, { proyecto_id: bid }, { lineas: [{ predio_id: pid2 }] }, { obra_id: null }]) {
      assert.equal((await request('POST', '/reports/sync', { ...report, ...bad, client_uuid: `bad-${JSON.stringify(bad)}` })).data.results[0].status, 'error');
    }
    assert.equal(telegramMessages.length, messageCount);
    available = false;
    const pending = await request('POST', '/projects/predios', { ...base, nombre: 'Pendiente' });
    assert.equal(pending.status, 201); assert.equal(pending.data.telegram_status, 'pendiente');
    available = true;
    const countBeforeRetry = telegramCalls;
    await Promise.all([1,2].map(() => request('POST', `/projects/predios/${pending.data.predio.id}/create-telegram-topic`, {})));
    assert.equal(telegramCalls, countBeforeRetry + 1);
    const options = (await request('GET', '/projects/cascade-options')).data;
    assert.equal(options.proyectos.filter(p => p.predio_ids.includes(pid)).length, 2);
    assert.equal(options.obras.find(o => o.id === oid).predios[0].id, pid);
    const machine = { codigo: 'maq-001', nombre: 'Tractor', horometro_actual: 100, ultimo_servicio_hr: 80, propietaria_id: 1 };
    for (const fields of [{ horometro_actual: -1 }, { ultimo_servicio_hr: 101 }, { umbral_servicio_hrs: 0 }, { horometro_actual: 'Infinity' }, { horometro_actual: '1x' }, { nombre: ' ' }, { tipo: 'desconocido' }, { propietaria_id: 999 }]) {
      assert.equal((await request('POST', '/machines', { ...machine, ...fields })).status, 400);
    }
    const created = await request('POST', '/machines', machine);
    assert.equal(created.status, 201); assert.equal(created.data.machine.codigo, 'MAQ-001');
    assert.equal((await request('POST', '/machines', machine)).status, 409);
    assert.equal((await request('PATCH', `/machines/${created.data.machine.id}`, { ultimo_servicio_hr: 101 })).status, 400);
    assert.equal((await request('PATCH', `/machines/${created.data.machine.id}`, { ultimo_servicio_hr: 100 })).status, 200);

    // Simulate upgrading legacy fronts: only unambiguous topics are copied.
    await db.run("INSERT INTO predio(id,nombre) VALUES(101,'Legacy C'),(102,'Legacy D'),(103,'Legacy E'),(104,'Legacy F')");
    await db.run("INSERT INTO obra(id,nombre,proyecto_id,tg_thread_id) VALUES(101,'Compartido',?, '501'),(102,'E A',?, '601'),(103,'E B',?, '601'),(104,'F A',?, '701'),(105,'F B',?, '702')", [aid,aid,bid,aid,bid]);
    await db.run('INSERT INTO obra_predio VALUES(101,101),(101,102),(102,103),(103,103),(104,104),(105,104)');
    await db.run("DELETE FROM schema_migration WHERE name='predio_topics_v1'");
    await initDatabase();
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM proyecto_predio WHERE predio_id=?', [pid])).n, 2);
    assert.equal((await db.get('SELECT tg_thread_id FROM predio WHERE id=103')).tg_thread_id, '601');
    for (const id of [101,102,104]) assert.equal((await db.get('SELECT tg_thread_id FROM predio WHERE id=?', [id])).tg_thread_id, null);
    assert.equal((await db.get('SELECT COUNT(*) AS n FROM proyecto_predio WHERE predio_id=103')).n, 2);
    await initDatabase();
    assert.equal((await db.get('SELECT tg_thread_id FROM predio WHERE id=103')).tg_thread_id, '601');
    console.log('Predios: múltiples proyectos, frentes sin grupos nuevos, reportes y paros al grupo correcto, ambigüedad, permisos, validaciones y reintentos verificados.');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await new Promise((resolve, reject) => getDb().close(error => error ? reject(error) : resolve()));
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
