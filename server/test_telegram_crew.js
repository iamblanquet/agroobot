const assert = require('node:assert/strict');
const { formatCrew } = require('./bot/formatCrew');

assert.equal(formatCrew([]), '');
assert.equal(formatCrew([{ rol_id: 'auxiliar', headcount: 0, empleados: [] }]), '');
const crew = [
  { rol_id: 'operador', headcount: 2, empleados: [{ nombre: 'Ana Pérez' }, { nombre: 'Juan López' }] },
  { rol_id: 'tecnico', headcount: 1, empleados: [{ nombre: 'Luis García' }] }
];
assert.equal(formatCrew(crew), '\n👥 *Cuadrilla:*\n• *Operadores: 2*\n  – Ana Pérez\n  – Juan López\n• *Técnicos: 1*\n  – Luis García');
assert.equal(formatCrew([{ ...crew[0], empleados: JSON.stringify(crew[0].empleados) }]), formatCrew([crew[0]]));
assert.equal(formatCrew([{ rol_id: 'auxiliar', headcount: 3 }]), '\n👥 *Cuadrilla:*\n• *Auxiliares: 3*');
assert.equal(formatCrew([{ rol_id: 'auxiliar', headcount: 3, empleados: 'invalid' }]), '\n👥 *Cuadrilla:*\n• *Auxiliares: 3*');
assert.equal(formatCrew([{ rol_id: 'operador', empleados: [{ nombre: 'Ana_*[TI]`\\\nPérez' }] }]), '\n👥 *Cuadrilla:*\n• *Operadores: 1*\n  – Ana\\_\\*\\[TI]\\`\\\\ Pérez');
console.log('Telegram: nombres agrupados por rol, totales, formato seguro y reportes históricos correctos.');
