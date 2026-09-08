const http = require('http');
const app = require('./index');

function requestJson(url, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        headers
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ status: res.statusCode, data: json });
            } else {
              resolve({ status: res.statusCode, error: json.error || body });
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ status: res.statusCode, data: body });
            } else {
              resolve({ status: res.statusCode, error: body });
            }
          }
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runAuthTests() {
  console.log('\n🔐 ====================================================');
  console.log('🔐 VALIDACIÓN DE FLUJOS DE AUTENTICACIÓN (FASE 1)');
  console.log('🔐 ====================================================\n');

  const PORT = 3088;
  const server = app.listen(PORT, async () => {
    let passed = 0;
    let failed = 0;

    const assert = (condition, desc) => {
      if (condition) {
        console.log(`  ✅ [PASS] ${desc}`);
        passed++;
      } else {
        console.error(`  ❌ [FAIL] ${desc}`);
        failed++;
      }
    };

    try {
      // 1. PIN Login válido
      console.log('1. Probando PIN Login válido (PIN 1234)...');
      const pinSuccess = await requestJson(`http://localhost:${PORT}/api/auth/pin-login`, 'POST', { pin: '1234' });
      assert(pinSuccess.status === 200 && pinSuccess.data.token && pinSuccess.data.user.nombre, 'Login por PIN correcto devuelve token y usuario');

      // 2. PIN Login inválido
      console.log('2. Probando PIN Login inválido (PIN 0000)...');
      const pinFail = await requestJson(`http://localhost:${PORT}/api/auth/pin-login`, 'POST', { pin: '0000' });
      assert(pinFail.status === 401, 'PIN inexistente retorna HTTP 401');

      // 3. Login tradicional supervisor válido
      console.log('3. Probando Login supervisor (sup_user)...');
      const loginSuccess = await requestJson(`http://localhost:${PORT}/api/auth/login`, 'POST', {
        username: 'sup_user',
        password: 'demo123'
      });
      assert(loginSuccess.status === 200 && loginSuccess.data.token, 'Login con contraseña devuelve JWT');
      const token = loginSuccess.data.token;

      // 4. Login tradicional contraseña incorrecta
      console.log('4. Probando Login con contraseña incorrecta...');
      const loginWrongPass = await requestJson(`http://localhost:${PORT}/api/auth/login`, 'POST', {
        username: 'sup_user',
        password: 'wrongpassword'
      });
      assert(loginWrongPass.status === 401, 'Contraseña errónea retorna HTTP 401');

      // 5. Validar /api/auth/me con token
      console.log('5. Probando GET /api/auth/me con Bearer token...');
      const meRes = await requestJson(`http://localhost:${PORT}/api/auth/me`, 'GET', null, token);
      assert(meRes.status === 200 && meRes.data.user && meRes.data.user.username === 'sup_user', '/api/auth/me valida sesión y devuelve usuario');

      // 6. Validar /api/auth/me sin token
      console.log('6. Probando GET /api/auth/me sin token...');
      const meNoToken = await requestJson(`http://localhost:${PORT}/api/auth/me`, 'GET');
      assert(meNoToken.status === 401, '/api/auth/me sin token retorna HTTP 401');

      // 7. Telegram endpoint sin initData
      console.log('7. Probando POST /api/auth/telegram sin initData...');
      const tgNoData = await requestJson(`http://localhost:${PORT}/api/auth/telegram`, 'POST', {});
      assert(tgNoData.status === 400, '/api/auth/telegram sin initData retorna HTTP 400');

      console.log(`\n🏁 Resumen: ${passed} pruebas superadas, ${failed} fallidas.`);
      server.close();
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      console.error('Error durante la ejecución de pruebas:', err);
      server.close();
      process.exit(1);
    }
  });
}

runAuthTests();
