const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

/**
 * GET /api/machines/entidades
 * Listado de entidades propietarias/operadoras (Aspromex, Agrokool, etc.)
 */
router.get('/entidades', authenticateJWT, async (req, res) => {
  try {
    const entidades = await db.all('SELECT * FROM entidad ORDER BY nombre ASC');
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
    const rows = await db.all(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      ORDER BY m.id ASC
    `);

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
    const {
      codigo,
      nombre,
      tipo = 'tractor',
      modelo,
      propietaria_id,
      operadora_id,
      umbral_servicio_hrs = 300,
      horometro_actual = 0,
      ultimo_servicio_hr = 0
    } = req.body;

    if (!nombre) {
      return res.status(400).json({ error: 'El nombre descriptivo de la máquina es obligatorio.' });
    }

    const codFinal = codigo?.trim() ? codigo.trim().toUpperCase() : `MAQ-${Date.now().toString().slice(-4)}`;
    const modFinal = modelo?.trim() || nombre.trim();
    const hActual = parseFloat(horometro_actual) || 0;
    const uServicio = parseFloat(ultimo_servicio_hr) || 0;
    const umbral = parseFloat(umbral_servicio_hrs) || 300;
    const alerta = (hActual - uServicio) >= (umbral - 20) ? 1 : 0;

    const result = await db.run(
      `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codFinal,
        nombre.trim(),
        tipo,
        modFinal,
        propietaria_id ? parseInt(propietaria_id, 10) : null,
        operadora_id ? parseInt(operadora_id, 10) : null,
        umbral,
        hActual,
        uServicio,
        alerta
      ]
    );

    const newMachine = await db.get(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      WHERE m.id = ?
    `, [result.lastID]);

    return res.status(201).json({ success: true, machine: newMachine });
  } catch (err) {
    console.error('Error en POST /api/machines:', err);
    return res.status(500).json({ error: 'Error al registrar máquina: ' + err.message });
  }
});

/**
 * PATCH /api/machines/:id
 * Editar máquina existente en el catálogo
 */
router.patch('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    const machine = await db.get('SELECT * FROM maquina WHERE id = ?', [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Máquina no encontrada.' });
    }

    const {
      codigo,
      nombre,
      tipo,
      modelo,
      propietaria_id,
      operadora_id,
      umbral_servicio_hrs,
      horometro_actual,
      ultimo_servicio_hr
    } = req.body;

    const codFinal = codigo !== undefined ? codigo.trim().toUpperCase() : machine.codigo;
    const nomFinal = nombre !== undefined ? nombre.trim() : (machine.nombre || machine.modelo);
    const tipoFinal = tipo !== undefined ? tipo : (machine.tipo || 'tractor');
    const modFinal = modelo !== undefined ? modelo.trim() : machine.modelo;
    const propId = propietaria_id !== undefined ? (propietaria_id ? parseInt(propietaria_id, 10) : null) : machine.propietaria_id;
    const operId = operadora_id !== undefined ? (operadora_id ? parseInt(operadora_id, 10) : null) : machine.operadora_id;
    const umbral = umbral_servicio_hrs !== undefined ? parseFloat(umbral_servicio_hrs) : (machine.umbral_servicio_hrs || 300);
    const hActual = horometro_actual !== undefined ? parseFloat(horometro_actual) : machine.horometro_actual;
    const uServicio = ultimo_servicio_hr !== undefined ? parseFloat(ultimo_servicio_hr) : machine.ultimo_servicio_hr;
    const alerta = (hActual - uServicio) >= (umbral - 20) ? 1 : 0;

    await db.run(
      `UPDATE maquina
       SET codigo = ?, nombre = ?, tipo = ?, modelo = ?, propietaria_id = ?, operadora_id = ?,
           umbral_servicio_hrs = ?, horometro_actual = ?, ultimo_servicio_hr = ?, alerta_mantenimiento = ?
       WHERE id = ?`,
      [codFinal, nomFinal, tipoFinal, modFinal, propId, operId, umbral, hActual, uServicio, alerta, id]
    );

    const updated = await db.get(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      WHERE m.id = ?
    `, [id]);

    return res.json({ success: true, machine: updated });
  } catch (err) {
    console.error('Error al actualizar máquina:', err);
    return res.status(500).json({ error: 'Error al actualizar máquina: ' + err.message });
  }
});

/**
 * DELETE /api/machines/:id
 * Eliminar máquina del catálogo
 */
router.delete('/:id', authenticateJWT, requireRole('supervisor', 'it', 'direccion'), async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM lectura_maquina WHERE maquina_id = ?', [id]);
    await db.run('DELETE FROM maquina WHERE id = ?', [id]);
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
    const machine = await db.get('SELECT * FROM maquina WHERE id = ?', [id]);
    if (!machine) {
      return res.status(404).json({ error: 'Máquina no encontrada.' });
    }

    await db.run(
      `UPDATE maquina
       SET ultimo_servicio_hr = horometro_actual,
           alerta_mantenimiento = 0
       WHERE id = ?`,
      [id]
    );

    const updated = await db.get(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      WHERE m.id = ?
    `, [id]);

    return res.json({
      success: true,
      message: `Mantenimiento preventivo aplicado a ${machine.nombre || machine.codigo}. Horómetro de servicio reseteado a ${machine.horometro_actual} hrs.`,
      machine: updated
    });
  } catch (err) {
    console.error('Error en POST /api/machines/:id/service:', err);
    return res.status(500).json({ error: 'Error al registrar servicio.' });
  }
});

module.exports = router;
