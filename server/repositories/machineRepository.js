const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const machineRepository = {
  async findAllEntidades() {
    if (useSupabase()) {
      return supabase.selectRows('entidad', {
        select: '*',
        filters: { order: 'nombre.asc' }
      });
    }
    return db.all('SELECT * FROM entidad ORDER BY nombre ASC');
  },

  async findAllMachines() {
    if (useSupabase()) {
      const rows = await supabase.selectRows('maquina', {
        select: '*,propietaria:propietaria_id(id,nombre),operadora:operadora_id(id,nombre)',
        filters: { order: 'id.asc' }
      });
      return (rows || []).map(m => ({
        ...m,
        propietaria_nombre: m.propietaria ? m.propietaria.nombre : null,
        operadora_nombre: m.operadora ? m.operadora.nombre : null
      }));
    }

    return db.all(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      ORDER BY m.id ASC
    `);
  },

  async findMachineById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('maquina', {
        select: '*,propietaria:propietaria_id(id,nombre),operadora:operadora_id(id,nombre)',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      if (!rows || rows.length === 0) return null;
      const m = rows[0];
      return {
        ...m,
        propietaria_nombre: m.propietaria ? m.propietaria.nombre : null,
        operadora_nombre: m.operadora ? m.operadora.nombre : null
      };
    }

    return db.get(`
      SELECT m.*,
             ep.nombre AS propietaria_nombre,
             eo.nombre AS operadora_nombre
      FROM maquina m
      LEFT JOIN entidad ep ON m.propietaria_id = ep.id
      LEFT JOIN entidad eo ON m.operadora_id = eo.id
      WHERE m.id = ?
    `, [id]);
  },

  async createMachine(data) {
    if (useSupabase()) {
      return supabase.insertRow('maquina', data);
    }
    const res = await db.run(`
      INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.codigo,
      data.nombre || '',
      data.tipo || 'tractor',
      data.modelo,
      data.propietaria_id,
      data.operadora_id,
      data.umbral_servicio_hrs || 300,
      data.horometro_actual || 0,
      data.ultimo_servicio_hr || 0,
      data.alerta_mantenimiento ? 1 : 0
    ]);
    return this.findMachineById(res.lastID);
  },

  async updateMachine(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('maquina', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findMachineById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE maquina SET ${setClause} WHERE id = ?`, values);
    return this.findMachineById(id);
  },

  async deleteMachine(id) {
    if (useSupabase()) {
      await supabase.deleteRows('lectura_maquina', { maquina_id: `eq.${id}` });
      await supabase.deleteRows('maquina', { id: `eq.${id}` });
      return true;
    }
    await db.run('DELETE FROM lectura_maquina WHERE maquina_id = ?', [id]);
    await db.run('DELETE FROM maquina WHERE id = ?', [id]);
    return true;
  },

  async recordService(id) {
    const machine = await this.findMachineById(id);
    if (!machine) return null;

    if (useSupabase()) {
      await supabase.updateRows(
        'maquina',
        { id: `eq.${id}` },
        { ultimo_servicio_hr: machine.horometro_actual, alerta_mantenimiento: false }
      );
      return this.findMachineById(id);
    }

    await db.run(`
      UPDATE maquina
      SET ultimo_servicio_hr = horometro_actual,
          alerta_mantenimiento = 0
      WHERE id = ?
    `, [id]);
    return this.findMachineById(id);
  }
};

module.exports = machineRepository;
