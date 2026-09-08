const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const issueRepository = {
  async findAll({ estado, obra_id } = {}) {
    if (useSupabase()) {
      const filters = {};
      if (estado) filters.estado = `eq.${estado}`;
      if (obra_id) filters.obra_id = `eq.${obra_id}`;
      filters.order = 'abierta_en.desc';

      const rows = await supabase.selectRows('incidencia', {
        select: '*,obra:obra_id(id,nombre,proyecto:proyecto_id(id,nombre))',
        filters
      });

      return (rows || []).map(i => ({
        ...i,
        obra_nombre: i.obra ? i.obra.nombre : null,
        proyecto_nombre: i.obra && i.obra.proyecto ? i.obra.proyecto.nombre : null
      }));
    }

    let query = `
      SELECT i.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      query += ` AND i.estado = ?`;
      params.push(estado);
    }
    if (obra_id) {
      query += ` AND i.obra_id = ?`;
      params.push(obra_id);
    }

    query += ` ORDER BY CASE WHEN i.estado = 'cerrada' THEN 1 ELSE 0 END, i.abierta_en DESC`;
    return db.all(query, params);
  },

  async findById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('incidencia', {
        select: '*,obra:obra_id(id,nombre,proyecto:proyecto_id(id,nombre))',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      if (!rows || rows.length === 0) return null;
      const i = rows[0];
      return {
        ...i,
        obra_nombre: i.obra ? i.obra.nombre : null,
        proyecto_nombre: i.obra && i.obra.proyecto ? i.obra.proyecto.nombre : null
      };
    }

    return db.get(`
      SELECT i.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      JOIN proyecto p ON o.proyecto_id = p.id
      WHERE i.id = ?
    `, [id]);
  },

  async generateNextFolio() {
    const year = new Date().getFullYear();
    if (useSupabase()) {
      const rows = await supabase.selectRows('incidencia', {
        select: 'folio',
        filters: { folio: `like.INC-${year}-%`, order: 'folio.desc', limit: '1' }
      });
      let nextSeq = 1;
      if (rows && rows.length > 0) {
        const parts = rows[0].folio.split('-');
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
      }
      return `INC-${year}-${String(nextSeq).padStart(3, '0')}`;
    }

    const last = await db.get(
      'SELECT folio FROM incidencia WHERE folio LIKE ? ORDER BY folio DESC LIMIT 1',
      [`INC-${year}-%`]
    );
    let nextSeq = 1;
    if (last && last.folio) {
      const parts = last.folio.split('-');
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) nextSeq = lastNum + 1;
    }
    return `INC-${year}-${String(nextSeq).padStart(3, '0')}`;
  },

  async create({ folio, tipo, obra_id, causa_raiz = null, estado = 'abierta' }) {
    if (useSupabase()) {
      const created = await supabase.insertRow('incidencia', {
        folio,
        tipo,
        obra_id,
        causa_raiz,
        estado,
        abierta_en: new Date().toISOString()
      });
      return this.findById(created.id);
    }

    const res = await db.run(`
      INSERT INTO incidencia (folio, tipo, obra_id, causa_raiz, estado, abierta_en)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `, [folio, tipo, obra_id, causa_raiz || null, estado]);

    return this.findById(res.lastID);
  },

  async close(id, causa_raiz) {
    if (useSupabase()) {
      await supabase.updateRows(
        'incidencia',
        { id: `eq.${id}` },
        { estado: 'cerrada', cerrada_en: new Date().toISOString(), causa_raiz }
      );
      return this.findById(id);
    }

    await db.run(`
      UPDATE incidencia
      SET estado = 'cerrada',
          cerrada_en = datetime('now'),
          causa_raiz = ?
      WHERE id = ?
    `, [causa_raiz, id]);

    return this.findById(id);
  },

  async updateStatus(id, estado) {
    if (useSupabase()) {
      await supabase.updateRows(
        'incidencia',
        { id: `eq.${id}` },
        { estado }
      );
      return this.findById(id);
    }

    await db.run('UPDATE incidencia SET estado = ? WHERE id = ?', [estado, id]);
    return this.findById(id);
  }
};

module.exports = issueRepository;
