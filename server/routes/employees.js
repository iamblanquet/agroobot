const router = require('express').Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.use(authenticateJWT, requireRole('supervisor', 'direccion', 'it'));

router.get('/', async (req, res) => {
  try {
    const employees = await db.all('SELECT id, nombre, puesto, roles FROM empleado ORDER BY nombre COLLATE NOCASE, id');
    res.json({ employees: employees.map(employee => ({ ...employee, roles: JSON.parse(employee.roles) })) });
  } catch (err) {
    console.error('Error al consultar empleados:', err);
    res.status(500).json({ error: 'No se pudieron cargar los empleados.' });
  }
});

function validateEmployee(req, res, next) {
  const { nombre, puesto, roles } = req.body || {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150 ||
      typeof puesto !== 'string' || !puesto.trim() || puesto.trim().length > 100) {
    return res.status(400).json({ error: 'Nombre y puesto son obligatorios (máximo 150 y 100 caracteres, respectivamente).' });
  }
  const allowedRoles = ['operadores', 'tecnicos', 'auxiliares'];
  if (!Array.isArray(roles) || !roles.length || roles.length > 3 || roles.some(role => !allowedRoles.includes(role))) {
    return res.status(400).json({ error: 'Selecciona uno o varios roles: operadores, técnicos o auxiliares.' });
  }
  req.employee = { nombre: nombre.trim(), puesto: puesto.trim(), roles: [...new Set(roles)] };
  next();
}

router.post('/', validateEmployee, async (req, res) => {
  try {
    const { nombre, puesto, roles } = req.employee;
    const result = await db.run('INSERT INTO empleado (nombre, puesto, roles) VALUES (?, ?, ?)', [nombre, puesto, JSON.stringify(roles)]);
    res.status(201).json({ employee: { id: result.lastID, nombre, puesto, roles } });
  } catch (err) {
    console.error('Error al crear empleado:', err);
    res.status(500).json({ error: 'No se pudo guardar el empleado.' });
  }
});

router.patch('/:id', validateEmployee, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const { nombre, puesto, roles } = req.employee;
    const result = await db.run('UPDATE empleado SET nombre = ?, puesto = ?, roles = ? WHERE id = ?', [nombre, puesto, JSON.stringify(roles), id]);
    if (!result.changes) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json({ employee: { id, nombre, puesto, roles } });
  } catch (err) {
    console.error('Error al actualizar empleado:', err);
    res.status(500).json({ error: 'No se pudo actualizar el empleado.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const result = await db.run('DELETE FROM empleado WHERE id = ?', [id]);
    if (!result.changes) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar empleado:', err);
    res.status(500).json({ error: 'No se pudo eliminar el empleado.' });
  }
});

module.exports = router;
