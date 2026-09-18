const { db } = require('../db/database');
const supabase = require('../db/supabase');
const useSupabase = () => process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
const normalize = row => row ? { id: Number(row.id), nombre: row.nombre, roles: typeof row.roles === 'string' ? JSON.parse(row.roles) : (row.roles || []) } : null;

module.exports = {
  async findAll() {
    const rows = useSupabase()
      ? await supabase.selectRows('empleado', { select: 'id,nombre,roles', filters: { order: 'nombre.asc,id.asc' } })
      : await db.all('SELECT id, nombre, roles FROM empleado ORDER BY nombre COLLATE NOCASE, id');
    return rows.map(normalize);
  },
  async findById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('empleado', { select: 'id,nombre,roles', filters: { id: `eq.${id}`, limit: '1' } });
      return normalize(rows[0]);
    }
    return normalize(await db.get('SELECT id, nombre, roles FROM empleado WHERE id = ?', [id]));
  },
  async create({ nombre, roles }) {
    if (useSupabase()) return normalize(await supabase.insertRow('empleado', { nombre, roles }));
    const result = await db.run('INSERT INTO empleado (nombre, puesto, roles) VALUES (?, ?, ?)', [nombre, '—', JSON.stringify(roles)]);
    return { id: result.lastID, nombre, roles };
  },
  async update(id, { nombre, roles }) {
    if (useSupabase()) return normalize((await supabase.updateRows('empleado', { id: `eq.${id}` }, { nombre, roles }))[0]);
    const result = await db.run('UPDATE empleado SET nombre = ?, roles = ? WHERE id = ?', [nombre, JSON.stringify(roles), id]);
    return result.changes ? { id, nombre, roles } : null;
  },
  async remove(id) {
    if (useSupabase()) return (await supabase.deleteRows('empleado', { id: `eq.${id}` })).length > 0;
    return (await db.run('DELETE FROM empleado WHERE id = ?', [id])).changes > 0;
  }
};
