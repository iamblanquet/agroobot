process.env.SUPABASE_AUTH_ENABLED = 'true';
process.env.DB_PATH = ':memory:';
const assert = require('node:assert/strict');
const tables = { empleado: [], reporte: [], reporte_cuadrilla: [] };
const match = (row, filters) => Object.entries(filters).every(([key, value]) => !String(value).startsWith('eq.') || String(row[key]) === String(value).slice(3));
const supabasePath = require.resolve('./db/supabase');
require.cache[supabasePath] = {
  id: supabasePath, filename: supabasePath, loaded: true,
  exports: {
    isSupabaseConfigured: () => true,
    async selectRows(table, { filters = {} } = {}) { return tables[table].filter(row => match(row, filters)); },
    async insertRow(table, data) { const row = { id: tables[table].length + 1, ...data }; tables[table].push(row); return row; },
    async updateRows(table, filters, data) { const rows = tables[table].filter(row => match(row, filters)); rows.forEach(row => Object.assign(row, data)); return rows; },
    async deleteRows(table, filters) { const rows = tables[table].filter(row => match(row, filters)); tables[table] = tables[table].filter(row => !match(row, filters)); return rows; }
  }
};
const employees = require('./repositories/employeeRepository');
const reports = require('./repositories/reportRepository');
const { resolveCrew } = require('./services/crew');
async function run() {
  const employee = await employees.create({ nombre: 'Ana', roles: ['operadores', 'tecnicos'] });
  assert.deepEqual(await employees.findById(employee.id), employee);
  assert.deepEqual(await employees.findAll(), [employee]);
  const crew = await resolveCrew([{ rol_id: 'operador', empleados: [{ id: employee.id }], headcount: 99 }]);
  const reportId = await reports.syncReport({ client_uuid: 'cloud-crew-test', fecha_operativa: '2026-09-18', autor_nombre: 'Campo', cuadrilla: crew });
  const saved = await reports.findCrewByReportId(reportId);
  assert.equal(saved[0].headcount, 1);
  assert.deepEqual(saved[0].empleados, [{ id: employee.id, nombre: 'Ana' }]);
  assert.deepEqual((await employees.update(employee.id, { nombre: 'Ana María', roles: ['auxiliares'] })).roles, ['auxiliares']);
  assert.equal(await employees.remove(employee.id), true);
  assert.equal(await employees.remove(employee.id), false);
  assert.equal(await employees.findById(employee.id), null);
  assert.equal((await reports.findCrewByReportId(reportId))[0].empleados[0].nombre, 'Ana');
  console.log('Adaptador Supabase: empleados y cuadrillas verificados con servicio simulado, sin conexiones externas.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
