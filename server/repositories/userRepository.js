const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const userRepository = {
  async findAll() {
    if (useSupabase()) {
      const rows = await supabase.selectRows('usuario', {
        select: 'id,username,pin,nombre,rol,activo,creado_en',
        filters: { order: 'id.asc' }
      });
      return rows;
    }
    return db.all(`
      SELECT id, username, pin, nombre, rol, activo, creado_en
      FROM usuario
      ORDER BY id ASC
    `);
  },

  async findById(id) {
    if (useSupabase()) {
      return supabase.findUserById(id);
    }
    return db.get(
      'SELECT id, username, nombre, rol, tg_user_id, tg_chat_id, activo FROM usuario WHERE id = ?',
      [id]
    );
  },

  async findByUsername(username) {
    if (useSupabase()) {
      return supabase.findUserByUsername(username);
    }
    return db.get(
      'SELECT id, username, password_hash, nombre, rol, tg_user_id, activo FROM usuario WHERE username = ?',
      [username]
    );
  },

  async findByPin(pin) {
    if (useSupabase()) {
      return supabase.findUserByPin(pin);
    }
    return db.get(
      'SELECT id, username, nombre, rol, pin, activo FROM usuario WHERE pin = ? AND activo = 1',
      [pin]
    );
  },

  async findByTelegramId(tgId) {
    if (useSupabase()) {
      return supabase.findUserByTelegramId(tgId);
    }
    return db.get(
      'SELECT id, username, nombre, rol, tg_user_id, activo FROM usuario WHERE tg_user_id = ? AND activo = 1',
      [tgId]
    );
  },

  async findExistingPin(pin, excludeId = null) {
    if (useSupabase()) {
      const filters = { pin: `eq.${pin}`, limit: '1' };
      if (excludeId) filters.id = `neq.${excludeId}`;
      const rows = await supabase.selectRows('usuario', {
        select: 'id,nombre',
        filters
      });
      return rows[0] || null;
    }
    if (excludeId) {
      return db.get('SELECT id, nombre FROM usuario WHERE pin = ? AND id != ?', [pin, excludeId]);
    }
    return db.get('SELECT id, nombre FROM usuario WHERE pin = ?', [pin]);
  },

  async create({ username, password_hash, pin, nombre, rol, activo = true }) {
    if (useSupabase()) {
      const created = await supabase.insertRow('usuario', {
        username,
        password_hash,
        pin,
        nombre,
        rol,
        activo
      });
      return created;
    }

    const res = await db.run(
      `INSERT INTO usuario (username, password_hash, pin, nombre, rol, activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, password_hash, pin, nombre, rol, activo ? 1 : 0]
    );

    return db.get(
      'SELECT id, username, pin, nombre, rol, activo, creado_en FROM usuario WHERE id = ?',
      [res.lastID]
    );
  },

  async updatePin(id, newPin) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('usuario', { id: `eq.${id}` }, { pin: newPin });
      return updated[0] || null;
    }
    await db.run('UPDATE usuario SET pin = ? WHERE id = ?', [newPin, id]);
    return db.get('SELECT id, username, pin, nombre, rol FROM usuario WHERE id = ?', [id]);
  },

  async update(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('usuario', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }
    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE usuario SET ${setClause} WHERE id = ?`, values);
    return this.findById(id);
  }
};

module.exports = userRepository;
