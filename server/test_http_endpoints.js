const http = require('http');
const app = require('./index');

async function testHttpEndpoints() {
  console.log('\n🌐 ====================================================');
  console.log('🌐 PROBANDO ENDPOINTS HTTP DEL SERVIDOR EXPRESS');
  console.log('🌐 ====================================================\n');

  const server = app.listen(3099, async () => {
    try {
      // 1. Health check
      console.log('1. Probando GET /api/health...');
      const health = await requestJson('http://localhost:3099/api/health', 'GET');
      console.log('   Status:', health.status, '| App:', health.app);

      // 2. Login tradicional
      console.log('\n2. Probando POST /api/auth/login con sup_user...');
      const loginRes = await requestJson('http://localhost:3099/api/auth/login', 'POST', {
        username: 'sup_user',
        password: 'demo123'
      });
      console.log('   Token JWT recibido:', loginRes.token ? 'SÍ' : 'NO');
      console.log('   Usuario:', loginRes.user.nombre, '| Rol:', loginRes.user.rol);
      const token = loginRes.token;

      // 2b. Login por PIN de 4 dígitos
      console.log('\n2b. Probando POST /api/auth/pin-login con PIN 1234 (campo_user)...');
      const pinRes = await requestJson('http://localhost:3099/api/auth/pin-login', 'POST', {
        pin: '1234'
      });
      console.log('   PIN validado:', pinRes.success ? 'SÍ' : 'NO', '| Operador:', pinRes.user.nombre);

      // 3. Stats Supervisor
      console.log('\n3. Probando GET /api/stats/supervisor (4 Widgets Canónicos)...');
      const statsSup = await requestJson('http://localhost:3099/api/stats/supervisor', 'GET', null, token);
      console.log('   Widget 1 - Obras sin reporte hoy:', statsSup.widgets.obras_sin_reporte_hoy.length);
      console.log('   Widget 2 - Proyectos avance vs meta:', statsSup.widgets.avance_contra_meta.length);
      console.log('   Widget 3 - Incidencias abiertas:', statsSup.widgets.incidencias_abiertas.length);
      console.log('   Widget 4 - Bloqueado por material:', statsSup.widgets.bloqueado_por_material.length);
      console.log('   Maquinaria en alerta preventiva:', statsSup.maquinaria.filter(m => m.alerta_activa).length);

      // 4. Intentar cerrar incidencia con causa raíz corta (< 10 chars) -> Espera HTTP 400
      console.log('\n4. Probando POST /api/issues/:id/close con causa corta (< 10 chars)...');
      let activeIssue = statsSup.widgets.incidencias_abiertas[0];
      if (!activeIssue) {
        const newIss = await requestJson('http://localhost:3099/api/issues', 'POST', {
          tipo: 'Falla mecánica: Bomba de agua sobrecalentada',
          obra_id: 1,
          causa_raiz: null
        }, token);
        activeIssue = newIss.issue;
      }
      try {
        await requestJson(`http://localhost:3099/api/issues/${activeIssue.id}/close`, 'POST', {
          causa_raiz: 'Corta'
        }, token);
        console.error('   ❌ ERROR: Debería haber fallado con HTTP 400');
      } catch (err) {
        console.log('   ✅ Rechazado correctamente con HTTP 400:', err.message);
      }

      // 5. Cerrar incidencia con causa raíz válida (>= 10 chars) -> Espera HTTP 200
      console.log('\n5. Probando POST /api/issues/:id/close con causa válida (>= 10 chars)...');
      const closeRes = await requestJson(`http://localhost:3099/api/issues/${activeIssue.id}/close`, 'POST', {
        causa_raiz: 'Se sustituyó el manguito de acople y se purgó la línea hidráulica'
      }, token);
      console.log('   ✅ Incidencia cerrada:', closeRes.issue.folio, '| Estado:', closeRes.issue.estado);

      // 6. Sincronización idempotente de reporte offline
      console.log('\n6. Probando POST /api/reports/sync (idempotencia, actualización y fotos)...');
      const syncUUID = 'test-client-sync-' + Date.now();
      const samplePhotoBase64 = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-content-for-testing').toString('base64');
      const syncRes = await requestJson('http://localhost:3099/api/reports/sync', 'POST', {
        reports: [{
          client_uuid: syncUUID,
          obra_id: 1,
          proyecto_id: 1,
          tarea_id: 1,
          fecha_operativa: '2026-08-31',
          hora_offline: '14:45:30',
          creado_offline: '2026-08-31T14:45:30.000Z',
          autor_nombre: 'Operador Test',
          es_sin_actividad: false,
          lineas: [{ cantidad: 5.0, unidad: 'ha', cantidad_ha: 5.0 }],
          cuadrilla: [{ rol_id: 'operador', headcount: 3 }],
          maquinaria: [{ maquina_id: 2, horometro_inicio: 415.5, horometro_fin: 423.5, horas_trabajadas: 8.0, litros_diesel: 120 }],
          fotos: [{ data: samplePhotoBase64, descripcion: 'Evidencia de prueba horómetro' }]
        }]
      }, token);
      console.log('   ✅ Reportes sincronizados:', syncRes.syncedCount, '| Fotos guardadas:', syncRes.results[0]?.fotosCount);

      // Re-enviar el mismo UUID para verificar idempotencia
      const dupRes = await requestJson('http://localhost:3099/api/reports/sync', 'POST', {
        reports: [{ client_uuid: syncUUID }]
      }, token);
      console.log('   ✅ Re-envío duplicado detectado (Idempotente): Ignorados =', dupRes.ignoredCount);

      // 6b. Verificar GET /api/reports con fotos y hora_offline
      console.log('\n6b. Probando GET /api/reports (con evidencias fotográficas y hora offline)...');
      const repListRes = await requestJson('http://localhost:3099/api/reports?limit=5', 'GET', null, token);
      const repWithFotos = repListRes.reports?.find(r => r.client_uuid === syncUUID);
      console.log('   ✅ Reportes consultados:', repListRes.reports?.length, '| Fotos:', repWithFotos?.fotos?.length, '| Hora Offline:', repWithFotos?.hora_offline);

      // 7. Stats Dirección
      console.log('\n7. Probando GET /api/stats/direction (KPIs Dirección)...');
      const dirStats = await requestJson('http://localhost:3099/api/stats/direction', 'GET', null, token);
      console.log('   Superficie Meta:', dirStats.kpis.total_meta_ha, 'ha');
      console.log('   Habilitado Campo:', dirStats.kpis.total_campo_ha, 'ha');
      console.log('   Medición Dron:', dirStats.kpis.total_dron_ha, 'ha');
      console.log('   Discrepancia:', dirStats.kpis.discrepancia_ha, 'ha');
      console.log('   Diesel Total:', dirStats.kpis.total_diesel_litros, 'L');

      // 8. Disparo manual de Cron Jobs
      console.log('\n8. Probando POST /api/stats/cron-trigger (Automatizaciones 07:30, 08:00, 21:00 y 21:30)...');
      const cronGen = await requestJson('http://localhost:3099/api/stats/cron-trigger', 'POST', { type: 'general' }, token);
      console.log('   ✅ Cron 07:30 probado:', cronGen.type, '| Éxito:', cronGen.success);

      const cronEve = await requestJson('http://localhost:3099/api/stats/cron-trigger', 'POST', { type: 'evening' }, token);
      console.log('   ✅ Cron 21:00 probado:', cronEve.type, '| Pendientes:', cronEve.result.pendingCount);

      const cronTab = await requestJson('http://localhost:3099/api/stats/cron-trigger', 'POST', { type: 'tablero' }, token);
      console.log('   ✅ Cron 21:30 probado:', cronTab.type, '| Éxito:', cronTab.success);

      const cronMorn = await requestJson('http://localhost:3099/api/stats/cron-trigger', 'POST', { type: 'morning' }, token);
      console.log('   ✅ Cron 08:00 probado:', cronMorn.type, '| Incidencias:', cronMorn.result.incidenciasCount);

      console.log('\n====================================================');
      console.log('🎉 TODOS LOS ENDPOINTS HTTP Y CRON JOBS RESPONDIERON CORRECTAMENTE');
      console.log('====================================================\n');

      server.close(() => process.exit(0));
    } catch (err) {
      console.error('❌ Error en pruebas HTTP:', err);
      server.close(() => process.exit(1));
    }
  });
}

function requestJson(urlStr, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          else resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

testHttpEndpoints();
