const roleLabels = {
  operador: 'Operadores', operadores: 'Operadores',
  tecnico: 'Técnicos', tecnicos: 'Técnicos',
  auxiliar: 'Auxiliares', auxiliares: 'Auxiliares'
};

// Telegram utiliza Markdown clásico en los mensajes del bot.
const escapeMarkdown = value => String(value).replace(/[\\_*`\[]/g, '\\$&');

function formatCrew(crew = []) {
  if (!Array.isArray(crew) || !crew.length) return '';
  const lines = crew.map(group => {
    let employees = group.empleados || [];
    if (typeof employees === 'string') {
      try { employees = JSON.parse(employees); } catch { employees = []; }
    }
    if (!Array.isArray(employees)) employees = [];
    const names = employees.filter(employee => typeof employee?.nombre === 'string' && employee.nombre.trim())
      .map(employee => escapeMarkdown(employee.nombre.trim().replace(/\s+/g, ' ')));
    const count = names.length || Math.max(0, Number(group.headcount) || 0);
    if (!count) return null;
    const label = escapeMarkdown(roleLabels[group.rol_id] || group.role_text || group.rol_id || 'Personal');
    return `• *${label}: ${count}*${names.length ? '\n' + names.map(name => `  – ${name}`).join('\n') : ''}`;
  }).filter(Boolean);
  return lines.length ? `\n👥 *Cuadrilla:*\n${lines.join('\n')}` : '';
}

module.exports = { formatCrew };
