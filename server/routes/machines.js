const express = require('express');
const router = express.Router();
const machineRepository = require('../repositories/machineRepository');
const validate = require('../services/catalogValidation');

async function validateMachine(body, current) {
  const fields = validate.machine(body, current);
  const entities = await machineRepository.findAllEntidades();
  for (const key of ['propietaria_id', 'operadora_id']) {
    if (fields[key] !== null && !entities.some(entity => Number(entity.id) === fields[key])) validate.invalid('La entidad seleccionada no existe.');
  }
  const duplicate = await machineRepository.findMachineByCode(fields.codigo);
  if (duplicate && Number(duplicate.id) !== Number(current?.id)) {
    const error = new Error('Ya existe una máquina con ese código.'); error.status = 409; throw error;
  }
  return fields;
}

function machineError(res, error) {
  const duplicate = /unique|duplicate/i.test(error.message);
  return res.status(error.status || (duplicate ? 409 : 500)).json({ error: error.status ? error.message : duplicate ? 'Ya existe una máquina con ese código.' : 'No se pudo guardar la máquina.' });
}
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/machines/entidades
 * Listado de entidades propietarias/operadoras (Aspromex, Agrokool, etc.)
 */
router.get('/entidades', authenticateJWT, async (req, res) => {
  try {
    const entidades = await machineRepository.findAllEntidades();
    return res.json({ entidades });
  } catch (err) {
    console.error('Error al consultar entidades:', err);
    return res.status(500).json({ error: 'Error al consultar entidades.' });
  }
});

/**
 * GET /api/machines
 * Listar máquinas con cálculos de horas para mantenimiento, estatus y datos de entidades
 */
router.get('/', authenticateJWT, async (req, res) => {
  try {
    const rows = await machineRepository.findAllMachines();

    const machines = rows.map((m) => {
      const umbral = m.umbral_servicio_hrs || 300;
      const hrsDesdeServicio = m.horometro_actual - (m.ultimo_servicio_hr || 0);
      const hrsRestantes = Math.max(0, umbral - hrsDesdeServicio);
      const alerta = hrsDesdeServicio >= (umbral - 20) ? 1 : 0;

      return {
        ...m,
        nombre: m.nombre || m.modelo,
        tipo: m.tipo || 'tractor',
        umbral_servicio_hrs: umbral,
        horas_desde_servicio: parseFloat(hrsDesdeServicio.toFixed(1)),
        horas_restantes: parseFloat(hrsRestantes.toFixed(1)),
        alerta_mantenimiento: alerta,
        estado_servicio: hrsDesdeServicio >= umbral
          ? 'vencido'
          : hrsDesdeServicio >= (umbral - 20)
          ? 'preventivo_urgente'
          : 'optimo'
      };
    });

    return res.json({ machines });
  } catch (err) {
    console.error('Error en GET /api/machines:', err);
    return res.status(500).json({ error: 'Error al consultar catálogo de maquinaria.' });
  }
});

/**
 * POST /api/machines
 * Registrar nueva máquina en el catálogo
 */
router.post('/', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const fields = await validateMachine(req.body);
    const newMachine = await machineRepository.createMachine(fields);

    return res.status(201).json({ success: true, machine: newMachine });
  } catch (err) {
    if (!err.status) console.error('Error en POST /api/machines:', err);
    return machineError(res, err);
  }
});

/**
 * PATCH /api/machines/:id
 * Editar máquina existente en el catálogo
 */
router.patch('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await machineRepository.findMachineById(id);
    if (!machine) {
      return res.status(404).json({ error: 'Máquina no encontrada.' });
    }

    const fields = await validateMachine(req.body, machine);
    const updated = await machineRepository.updateMachine(id, fields);

    return res.json({ success: true, machine: updated });
  } catch (err) {
    if (!err.status) console.error('Error al actualizar máquina:', err);
    return machineError(res, err);
  }
});

/**
 * DELETE /api/machines/:id
 * Eliminar máquina del catálogo
 */
router.delete('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await machineRepository.deleteMachine(id);
    return res.json({ success: true, message: 'Máquina eliminada del catálogo correctamente.' });
  } catch (err) {
    console.error('Error al eliminar máquina:', err);
    return res.status(500).json({ error: 'Error al eliminar máquina: ' + err.message });
  }
});

/**
 * POST /api/machines/:id/service
 * Registrar servicio de mantenimiento realizado (resetea contador)
 */
router.post('/:id/service', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await machineRepository.recordService(id);
    if (!updated) {
      return res.status(404).json({ error: 'Máquina no encontrada.' });
    }

    return res.json({
      success: true,
      message: `Mantenimiento preventivo aplicado a ${updated.nombre || updated.codigo}. Horómetro de servicio reseteado a ${updated.horometro_actual} hrs.`,
      machine: updated
    });
  } catch (err) {
    console.error('Error en POST /api/machines/:id/service:', err);
    return res.status(500).json({ error: 'Error al registrar servicio.' });
  }
});

module.exports = router;
