/**
 * Cliente mínimo para Supabase usando la API REST nativa de Node 18+.
 * Se mantiene separado de SQLite para permitir una migración gradual.
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function checkSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { configured: false, connected: false, message: 'SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY no están configuradas.' };
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase respondió ${response.status}: ${detail.slice(0, 200)}`);
  }

  return { configured: true, connected: true, message: 'Conexión REST a Supabase establecida.' };
}

async function selectRows(table, query = {}) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
  const { select, order, limit, offset, filters, ...rest } = query;
  const params = new URLSearchParams();
  params.set('select', select || '*');
  if (order) params.set('order', order);
  if (limit !== undefined) params.set('limit', String(limit));
  if (offset !== undefined) params.set('offset', String(offset));
  const filterEntries = Object.entries({ ...(filters || {}), ...rest });
  for (const [k, v] of filterEntries) {
    if (v !== undefined && v !== null) {
      params.set(k, String(v));
    }
  }
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function insertRow(table, data) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
  const payload = { ...data };
  if (payload.id === undefined) {
    try {
      const top = await selectRows(table, { select: 'id', order: 'id.desc', limit: '1' });
      if (top && top.length > 0 && top[0].id !== undefined && top[0].id !== null) {
        payload.id = Number(top[0].id) + 1;
      }
    } catch (_) {
      // Ignorar si la tabla no posee columna id o si es una tabla intermedia
    }
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json();
  return rows[0] || null;
}

async function updateRows(table, filters, data) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
  const params = new URLSearchParams(filters);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function deleteRows(table, filters) {
  if (!isSupabaseConfigured()) throw new Error('Supabase no está configurado.');
  const params = new URLSearchParams(filters);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation'
    }
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json();
}

async function findUserByPin(pin) {
  const rows = await selectRows('usuario', { select: 'id,username,nombre,rol,pin,activo', filters: { pin: `eq.${pin}`, activo: 'eq.true', limit: '1' } });
  return rows[0] || null;
}

async function findUserByUsername(username) {
  const rows = await selectRows('usuario', { select: 'id,username,password_hash,nombre,rol,tg_user_id,activo', filters: { username: `eq.${username}`, limit: '1' } });
  return rows[0] || null;
}

async function findUserByTelegramId(id) {
  const rows = await selectRows('usuario', { select: 'id,username,nombre,rol,tg_user_id,activo', filters: { tg_user_id: `eq.${id}`, activo: 'eq.true', limit: '1' } });
  return rows[0] || null;
}

async function findUserById(id) {
  const rows = await selectRows('usuario', { select: 'id,username,nombre,rol,tg_user_id,tg_chat_id,activo', filters: { id: `eq.${id}`, limit: '1' } });
  return rows[0] || null;
}

module.exports = {
  isSupabaseConfigured,
  checkSupabaseConnection,
  selectRows,
  insertRow,
  updateRows,
  deleteRows,
  findUserByPin,
  findUserByUsername,
  findUserByTelegramId,
  findUserById
};

