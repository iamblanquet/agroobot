const router = require('express').Router();
const employeeRepository = require('../repositories/employeeRepository');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.use(authenticateJWT, requireRole('supervisor', 'direccion', 'it'));

router.get('/', async (req, res) => {
  try {
    res.json({ employees: await employeeRepository.findAll() });
  } catch (err) {
    console.error('Error al consultar empleados:', err);
    res.status(500).json({ error: 'No se pudieron cargar los empleados.' });
  }
});

function validateEmployee(req, res, next) {
  const { nombre, roles } = req.body || {};
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 150) {
    return res.status(400).json({ error: 'El nombre del empleado es obligatorio (máximo 150 caracteres).' });
  }
  const allowedRoles = ['operadores', 'tecnicos', 'auxiliares'];
  if (!Array.isArray(roles) || !roles.length || roles.length > 3 || roles.some(role => !allowedRoles.includes(role))) {
    return res.status(400).json({ error: 'Selecciona uno o varios roles: operadores, técnicos o auxiliares.' });
  }
  req.employee = { nombre: nombre.trim(), roles: [...new Set(roles)] };
  next();
}

router.post('/', validateEmployee, async (req, res) => {
  try {
    res.status(201).json({ employee: await employeeRepository.create(req.employee) });
  } catch (err) {
    console.error('Error al crear empleado:', err);
    res.status(500).json({ error: 'No se pudo guardar el empleado.' });
  }
});

router.patch('/:id', validateEmployee, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    const employee = await employeeRepository.update(id, req.employee);
    if (!employee) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json({ employee });
  } catch (err) {
    console.error('Error al actualizar empleado:', err);
    res.status(500).json({ error: 'No se pudo actualizar el empleado.' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Identificador inválido.' });
  try {
    if (!await employeeRepository.remove(id)) return res.status(404).json({ error: 'Empleado no encontrado.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar empleado:', err);
    res.status(500).json({ error: 'No se pudo eliminar el empleado.' });
  }
});

module.exports = router;
