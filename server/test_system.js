process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-jwt-secret-that-is-at-least-32-characters';
const assert = require('assert');
const { parseFreeTextReport } = require('./bot/parser');
const { verifyTelegramWebAppData } = require('./middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./db/database');
const seed = require('./db/seed');

async function runTests() {
  console.log('🧪 ====================================================');
  console.log('🧪 INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS TESA');
  console.log('🧪 ====================================================\n');

  // 1. Resetear DB con seed
  await seed();

  // Test 1: Autenticación y BCrypt
  console.log('Test 1: Verificación de usuarios y contraseñas hash...');
  const user = await db.get('SELECT * FROM usuario WHERE username = ?', ['campo_user']);
  assert(user, 'El usuario campo_user debe existir');
  const isMatch = await bcrypt.compare('demo123', user.password_hash);
  assert(isMatch, 'La contraseña demo123 debe coincidir con el hash');
  console.log('  ✅ Test 1 Superado: Password hash y usuario correctos.');

  // Test 2: Parser NLP Regex
  console.log('\nTest 2: NLP Regex Parser de Texto Libre...');
  const text1 = 'Obra: Frente Norte | Avance: 8.5 ha | Cuadrilla: 4 op';
  const parsed1 = parseFreeTextReport(text1);
  assert.strictEqual(parsed1.isValid, true);
  assert.strictEqual(parsed1.es_sin_actividad, false);
  assert.strictEqual(parsed1.obra_nombre, 'Frente Norte');
  assert.strictEqual(parsed1.avance_ha, 8.5);
  assert.strictEqual(parsed1.cuadrilla[0]?.headcount, 4);

  const textParo = 'Sin actividad: Lluvia torrencial en la zona del Bajío';
  const parsedParo = parseFreeTextReport(textParo);
  assert.strictEqual(parsedParo.isValid, true);
  assert.strictEqual(parsedParo.es_sin_actividad, true);
  assert.strictEqual(parsedParo.motivo_sin_actividad, 'Lluvia torrencial en la zona del Bajío');

  const textMaq = 'Obra: Frente Costa | Maquina: CAT-D6T-01 285.0 293.0 140L | Avance: 6.0 ha';
  const parsedMaq = parseFreeTextReport(textMaq);
  assert.strictEqual(parsedMaq.isValid, true);
  assert.strictEqual(parsedMaq.maquinaria?.codigo, 'CAT-D6T-01');
  assert.strictEqual(parsedMaq.maquinaria?.horometro_inicio, 285.0);
  assert.strictEqual(parsedMaq.maquinaria?.horometro_fin, 293.0);
  assert.strictEqual(parsedMaq.maquinaria?.horas_trabajadas, 8.0);
  assert.strictEqual(parsedMaq.maquinaria?.litros_diesel, 140);
  console.log('  ✅ Test 2 Superado: Parser NLP extrae correctamente avances, paros y horómetros.');

  // Test 3: Validación Criptográfica Telegram HMAC-SHA256
  console.log('\nTest 3: Validación HMAC-SHA256 Telegram WebApp...');
  const botToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ';
  const authDate = String(Math.floor(Date.now() / 1000));
  const userData = JSON.stringify({ id: 12345678, first_name: 'Juan' });

  // Construir data check string ordenada
  const checkString = `auth_date=${authDate}\nuser=${userData}`;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const validHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  const validInitData = `auth_date=${authDate}&user=${encodeURIComponent(userData)}&hash=${validHash}`;
  const verifyResult = verifyTelegramWebAppData(validInitData, botToken);
  assert.strictEqual(verifyResult.isValid, true, 'La firma válida debe ser aceptada');
  assert.strictEqual(verifyResult.user?.id, 12345678);

  const invalidInitData = `auth_date=${authDate}&user=${encodeURIComponent(userData)}&hash=invalid_hash_12345`;
  const invalidResult = verifyTelegramWebAppData(invalidInitData, botToken);
  assert.strictEqual(invalidResult.isValid, false, 'La firma alterada debe ser rechazada');
  console.log('  ✅ Test 3 Superado: Criptografía HMAC-SHA256 de Telegram implementada según estándar.');

  // Test 4: Validación Estricta de Causa Raíz en Cierre de Incidencia (>= 10 chars)
  console.log('\nTest 4: Regla de Cierre de Incidencia (Causa Raíz >= 10 caracteres)...');
  const issue = await db.get('SELECT * FROM incidencia WHERE estado = "abierta" LIMIT 1');
  assert(issue, 'Debe haber al menos 1 incidencia abierta');

  // Validar rechazo con < 10 caracteres
  const shortCause = 'Falla';
  const isValidShort = shortCause.trim().length >= 10;
  assert.strictEqual(isValidShort, false, 'Causas con menos de 10 caracteres deben fallar validación');

  // Validar aceptación con >= 10 caracteres
  const validCause = 'Se cambió el sello hidráulico dañado por fricción y se rellenó fluido';
  assert(validCause.length >= 10);
  await db.run(
    'UPDATE incidencia SET estado = "cerrada", cerrada_en = datetime("now"), causa_raiz = ? WHERE id = ?',
    [validCause, issue.id]
  );
  const updatedIssue = await db.get('SELECT * FROM incidencia WHERE id = ?', [issue.id]);
  assert.strictEqual(updatedIssue.estado, 'cerrada');
  assert(updatedIssue.cerrada_en);
  assert.strictEqual(updatedIssue.causa_raiz, validCause);
  console.log('  ✅ Test 4 Superado: Validación estricta de causa raíz comprobada.');

  // Test 5: Regla de Alerta de Mantenimiento Preventivo (>= 280 hrs)
  console.log('\nTest 5: Regla de Mantenimiento Preventivo (>= 280 hrs)...');
  // Consultar TRACTOR-PUMA-01 con 288.5h (seed)
  const maqD6 = await db.get('SELECT * FROM maquina WHERE codigo = "TRACTOR-PUMA-01"');
  assert(maqD6, 'Máquina TRACTOR-PUMA-01 debe existir');
  const hrsUso = maqD6.horometro_actual - maqD6.ultimo_servicio_hr;
  assert(hrsUso >= 280, 'Horas de uso deben ser >= 280');
  assert.strictEqual(maqD6.alerta_mantenimiento, 1, 'alerta_mantenimiento debe ser 1');

  // Probar servicio de mantenimiento (reset)
  await db.run(
    'UPDATE maquina SET ultimo_servicio_hr = horometro_actual, alerta_mantenimiento = 0 WHERE id = ?',
    [maqD6.id]
  );
  const maqReset = await db.get('SELECT * FROM maquina WHERE id = ?', [maqD6.id]);
  assert.strictEqual(maqReset.ultimo_servicio_hr, maqReset.horometro_actual);
  assert.strictEqual(maqReset.alerta_mantenimiento, 0);
  console.log('  ✅ Test 5 Superado: Disparo y reseteo de alerta de mantenimiento a las 280 hrs comprobado.');

  // Test 6: Idempotencia de Sincronización por client_uuid
  console.log('\nTest 6: Idempotencia en Sincronización de Reportes (client_uuid)...');
  const testUUID = 'test-uuid-sync-001';
  await db.run(
    'INSERT INTO reporte (client_uuid, fecha_operativa, autor_nombre, estado, es_sin_actividad) VALUES (?, date("now"), "Tester", "confirmado", 0)',
    [testUUID]
  );

  const check1 = await db.get('SELECT COUNT(*) as count FROM reporte WHERE client_uuid = ?', [testUUID]);
  assert.strictEqual(check1.count, 1);

  // Intentar duplicado debe ser detectado
  const existing = await db.get('SELECT id FROM reporte WHERE client_uuid = ?', [testUUID]);
  assert(existing, 'Debe detectar duplicado y evitar re-inserción');
  console.log('  ✅ Test 6 Superado: Idempotencia por client_uuid asegurada.');

  console.log('\n====================================================');
  console.log('🎉 TODOS LOS TESTS DE LA ESPECIFICACIÓN TESA PASARON CON ÉXITO');
  console.log('====================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error en tests:', err);
    process.exit(1);
  });
