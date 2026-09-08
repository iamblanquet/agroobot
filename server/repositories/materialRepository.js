const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const materialRepository = {
  async findAll({ obra_id } = {}) {
    if (useSupabase()) {
      const filters = { order: 'obra_id.asc,nombre.asc' };
      if (obra_id) filters.obra_id = `eq.${obra_id}`;
      const rows = await supabase.selectRows('material', {
        select: '*,obra:obra_id(id,nombre,proyecto:proyecto_id(id,nombre))',
        filters
      });
      return (rows || []).map(m => ({
        ...m,
        obra_nombre: m.obra ? m.obra.nombre : null,
        proyecto_nombre: m.obra && m.obra.proyecto ? m.obra.proyecto.nombre : null
      }));
    }

    let query = `
      SELECT m.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM material m
      JOIN obra o ON m.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE 1=1
    `;
    const params = [];
    if (obra_id) {
      query += ' AND m.obra_id = ?';
      params.push(obra_id);
    }
    query += ' ORDER BY m.obra_id ASC, m.nombre ASC';
    return db.all(query, params);
  },

  async findById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('material', {
        select: '*,obra:obra_id(id,nombre,proyecto:proyecto_id(id,nombre))',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      if (!rows || rows.length === 0) return null;
      const m = rows[0];
      return {
        ...m,
        obra_nombre: m.obra ? m.obra.nombre : null,
        proyecto_nombre: m.obra && m.obra.proyecto ? m.obra.proyecto.nombre : null
      };
    }

    return db.get(`
      SELECT m.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM material m
      JOIN obra o ON m.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE m.id = ?
    `, [id]);
  },

  async create(data) {
    if (useSupabase()) {
      const created = await supabase.insertRow('material', data);
      return this.findById(created.id);
    }

    const res = await db.run(`
      INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.obra_id,
      data.nombre,
      data.requerido || 0,
      data.en_sitio || 0,
      data.pedido || 0,
      data.unidad || 'pza',
      data.eta || null
    ]);

    return this.findById(res.lastID);
  },

  async update(id, fields) {
    if (useSupabase()) {
      await supabase.updateRows('material', { id: `eq.${id}` }, fields);
      return this.findById(id);
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE material SET ${setClause} WHERE id = ?`, values);
    return this.findById(id);
  },

  async receive(id, cantidad) {
    const m = await this.findById(id);
    if (!m) return null;
    const newEnSitio = (m.en_sitio || 0) + cantidad;
    const newPedido = Math.max(0, (m.pedido || 0) - cantidad);
    return this.update(id, { en_sitio: newEnSitio, pedido: newPedido });
  },

  async delete(id) {
    if (useSupabase()) {
      await supabase.deleteRows('material', { id: `eq.${id}` });
      return true;
    }
    await db.run('DELETE FROM material WHERE id = ?', [id]);
    return true;
  }
};

module.exports = materialRepository;
