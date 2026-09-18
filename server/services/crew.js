const { db } = require('../db/database');
const roleMap = { operador: 'operadores', tecnico: 'tecnicos', auxiliar: 'auxiliares' };

// Mantener compatibilidad con reportes antiguos y capturas agregadas de Telegram.
async function resolveCrew(crew) {
  if (!Array.isArray(crew)) throw new Error('La cuadrilla debe ser una lista.');
  const selectedIds = new Set();
  const resolved = [];
  for (const group of crew) {
    if (!group || typeof group !== 'object') throw new Error('Grupo de cuadrilla inválido.');
    if (group.empleados === undefined) {
      resolved.push(group);
      continue;
    }
    if (!roleMap[group.rol_id] || !Array.isArray(group.empleados)) throw new Error('Rol o selección de empleados inválidos.');
    const employees = [];
    for (const selection of group.empleados) {
      const id = selection?.id;
      if (!Number.isSafeInteger(id) || id < 1 || selectedIds.has(id)) throw new Error('Cada empleado debe seleccionarse una sola vez en la cuadrilla.');
      const employee = await db.get('SELECT id, nombre, roles FROM empleado WHERE id = ?', [id]);
      if (!employee) throw new Error('Un empleado seleccionado ya no está registrado. Actualiza el catálogo y revisa la cuadrilla.');
      if (!JSON.parse(employee.roles).includes(roleMap[group.rol_id])) throw new Error(`${employee.nombre} no tiene el rol seleccionado. Revisa la cuadrilla.`);
      selectedIds.add(id);
      employees.push({ id: employee.id, nombre: employee.nombre });
    }
    resolved.push({ rol_id: group.rol_id, headcount: employees.length, empleados: employees });
  }
  return resolved;
}

module.exports = { resolveCrew };
