const { db } = require('../db/database');
const supabase = require('../db/supabase');

function useSupabase() {
  return process.env.SUPABASE_AUTH_ENABLED === 'true' && supabase.isSupabaseConfigured();
}

const projectRepository = {
  async findAllProjects() {
    if (useSupabase()) {
      const projects = await supabase.selectRows('proyecto', {
        select: '*,gerente:gerente_id(id,nombre)',
        filters: { order: 'id.asc' }
      });
      // Map Supabase relation format to match SQLite response structure
      return (projects || []).map(p => ({
        ...p,
        gerente_nombre: p.gerente ? p.gerente.nombre : null
      }));
    }

    return db.all(`
      SELECT p.*, u.nombre AS gerente_nombre,
             (SELECT COUNT(*) FROM hito WHERE proyecto_id = p.id) AS total_hitos,
             (SELECT COUNT(*) FROM obra WHERE proyecto_id = p.id) AS total_obras
      FROM proyecto p
      LEFT JOIN usuario u ON p.gerente_id = u.id
      ORDER BY p.id ASC
    `);
  },

  async findProjectById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('proyecto', {
        select: '*,gerente:gerente_id(id,nombre)',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      if (!rows || rows.length === 0) return null;
      const p = rows[0];
      return {
        ...p,
        gerente_nombre: p.gerente ? p.gerente.nombre : null
      };
    }

    return db.get(`
      SELECT p.*, u.nombre AS gerente_nombre
      FROM proyecto p
      LEFT JOIN usuario u ON p.gerente_id = u.id
      WHERE p.id = ?
    `, [id]);
  },

  async createProject({ nombre, tipo, ciclo, superficie_meta_ha = 0, gerente_id = null, fecha_inicio = null, fecha_fin = null, estado = 'activo' }) {
    if (useSupabase()) {
      return supabase.insertRow('proyecto', {
        nombre,
        tipo,
        ciclo,
        superficie_meta_ha,
        gerente_id: gerente_id || null,
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        estado
      });
    }

    const res = await db.run(`
      INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, gerente_id, fecha_inicio, fecha_fin, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [nombre, tipo, ciclo, superficie_meta_ha, gerente_id, fecha_inicio, fecha_fin, estado]);

    return this.findProjectById(res.lastID);
  },

  async updateProject(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('proyecto', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findProjectById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE proyecto SET ${setClause} WHERE id = ?`, values);
    return this.findProjectById(id);
  },

  async findMilestonesByProjectId(projectId) {
    if (useSupabase()) {
      return supabase.selectRows('hito', {
        select: '*',
        filters: { proyecto_id: `eq.${projectId}`, order: 'orden.asc,id.asc' }
      });
    }

    return db.all('SELECT * FROM hito WHERE proyecto_id = ? ORDER BY orden ASC, id ASC', [projectId]);
  },

  async createMilestone({ proyecto_id, nombre, descripcion = '', orden = 1, fecha_meta = null, superficie_meta_ha = 0, estado = 'pendiente' }) {
    if (useSupabase()) {
      return supabase.insertRow('hito', {
        proyecto_id,
        nombre,
        descripcion,
        orden,
        fecha_meta: fecha_meta || null,
        superficie_meta_ha,
        estado
      });
    }

    const res = await db.run(`
      INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado]);

    return db.get('SELECT * FROM hito WHERE id = ?', [res.lastID]);
  },

  async findTasksByMilestoneId(hitoId) {
    if (useSupabase()) {
      const tasks = await supabase.selectRows('tarea', {
        select: '*,predio:predio_id(id,nombre)',
        filters: { hito_id: `eq.${hitoId}`, order: 'id.asc' }
      });
      return (tasks || []).map(t => ({
        ...t,
        predio_nombre: t.predio ? t.predio.nombre : null
      }));
    }

    return db.all(`
      SELECT t.*, pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      WHERE t.hito_id = ?
      ORDER BY t.id ASC
    `, [hitoId]);
  },

  async createTask({ hito_id, proyecto_id, predio_id = null, nombre, actividad_id = null, unidad = 'ha', cantidad_meta = 0, cantidad_acumulada = 0, estado = 'pendiente', responsable = null }) {
    if (useSupabase()) {
      return supabase.insertRow('tarea', {
        hito_id,
        proyecto_id,
        predio_id: predio_id || null,
        nombre,
        actividad_id,
        unidad,
        cantidad_meta,
        cantidad_acumulada,
        estado,
        responsable
      });
    }

    const res = await db.run(`
      INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable]);

    return db.get(`
      SELECT t.*, pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      WHERE t.id = ?
    `, [res.lastID]);
  },

  async updateTask(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('tarea', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return db.get('SELECT * FROM tarea WHERE id = ?', [id]);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE tarea SET ${setClause} WHERE id = ?`, values);
    return db.get(`
      SELECT t.*, pr.nombre AS predio_nombre
      FROM tarea t
      LEFT JOIN predio pr ON t.predio_id = pr.id
      WHERE t.id = ?
    `, [id]);
  },

  async findAllPredios() {
    if (useSupabase()) {
      return supabase.selectRows('predio', {
        select: '*',
        filters: { order: 'nombre.asc' }
      });
    }

    return db.all('SELECT * FROM predio ORDER BY nombre ASC');
  },

  async findPredioById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('predio', {
        select: '*',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      return rows[0] || null;
    }

    return db.get('SELECT * FROM predio WHERE id = ?', [id]);
  },

  async createPredio({ nombre, superficie_legal_ha = 0, superficie_util_ha = 0, regimen = '', poligono_geojson = null }) {
    if (useSupabase()) {
      return supabase.insertRow('predio', {
        nombre,
        superficie_legal_ha,
        superficie_util_ha,
        regimen,
        poligono_geojson
      });
    }

    const res = await db.run(`
      INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
      VALUES (?, ?, ?, ?, ?)
    `, [nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson]);

    return this.findPredioById(res.lastID);
  },

  async updatePredio(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('predio', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findPredioById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE predio SET ${setClause} WHERE id = ?`, values);
    return this.findPredioById(id);
  },

  async deletePredio(id) {
    if (useSupabase()) {
      await supabase.deleteRows('predio', { id: `eq.${id}` });
      return true;
    }

    await db.run('DELETE FROM predio WHERE id = ?', [id]);
    return true;
  },

  async findAllObras(projectId = null) {
    if (useSupabase()) {
      const filters = { order: 'id.asc' };
      if (projectId) filters.proyecto_id = `eq.${projectId}`;
      return supabase.selectRows('obra', {
        select: '*',
        filters
      });
    }

    if (projectId) {
      return db.all('SELECT * FROM obra WHERE proyecto_id = ? ORDER BY id ASC', [projectId]);
    }
    return db.all('SELECT * FROM obra ORDER BY id ASC');
  },

  async findObraById(id) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('obra', {
        select: '*',
        filters: { id: `eq.${id}`, limit: '1' }
      });
      return rows[0] || null;
    }

    return db.get('SELECT * FROM obra WHERE id = ?', [id]);
  },

  async createObra({ nombre, proyecto_id, fase_actual = 'Inicio', estado = 'operacion', tg_thread_id = null }) {
    if (useSupabase()) {
      return supabase.insertRow('obra', {
        nombre,
        proyecto_id,
        fase_actual,
        estado,
        tg_thread_id
      });
    }

    const res = await db.run(`
      INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
      VALUES (?, ?, ?, ?, ?)
    `, [nombre, proyecto_id, fase_actual, estado, tg_thread_id]);

    return this.findObraById(res.lastID);
  },

  async updateObra(id, fields) {
    if (useSupabase()) {
      const updated = await supabase.updateRows('obra', { id: `eq.${id}` }, fields);
      return updated[0] || null;
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) return this.findObraById(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await db.run(`UPDATE obra SET ${setClause} WHERE id = ?`, values);
    return this.findObraById(id);
  },

  async deleteObra(id) {
    if (useSupabase()) {
      await supabase.deleteRows('obra', { id: `eq.${id}` });
      return true;
    }

    await db.run('DELETE FROM obra WHERE id = ?', [id]);
    return true;
  },

  async findPrediosByObraId(obraId) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('obra_predio', {
        select: 'predio:predio_id(id,nombre,superficie_util_ha,regimen)',
        filters: { obra_id: `eq.${obraId}` }
      });
      return (rows || []).map(r => r.predio).filter(Boolean);
    }

    return db.all(`
      SELECT pr.id, pr.nombre, pr.superficie_util_ha, pr.regimen
      FROM predio pr
      JOIN obra_predio op ON pr.id = op.predio_id
      WHERE op.obra_id = ?
      ORDER BY pr.nombre ASC
    `, [obraId]);
  },

  async setObraPredios(obraId, predioIds = []) {
    if (useSupabase()) {
      await supabase.deleteRows('obra_predio', { obra_id: `eq.${obraId}` });
      for (const pid of predioIds) {
        await supabase.insertRow('obra_predio', { obra_id: obraId, predio_id: pid });
      }
      return this.findPrediosByObraId(obraId);
    }

    await db.run('DELETE FROM obra_predio WHERE obra_id = ?', [obraId]);
    for (const pid of predioIds) {
      await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [obraId, pid]);
    }
    return this.findPrediosByObraId(obraId);
  },

  async findObrasByPredioId(predioId) {
    if (useSupabase()) {
      const rows = await supabase.selectRows('obra_predio', {
        select: 'obra:obra_id(id,nombre,fase_actual,estado)',
        filters: { predio_id: `eq.${predioId}` }
      });
      return (rows || []).map(r => r.obra).filter(Boolean);
    }

    return db.all(`
      SELECT o.id, o.nombre, o.fase_actual, o.estado
      FROM obra o
      JOIN obra_predio op ON o.id = op.obra_id
      WHERE op.predio_id = ?
      ORDER BY o.nombre ASC
    `, [predioId]);
  },

  async findMedicionesByProjectId(projectId) {
    if (useSupabase()) {
      return supabase.selectRows('medicion', {
        select: '*',
        filters: { proyecto_id: `eq.${projectId}`, order: 'fecha.desc' }
      });
    }

    return db.all('SELECT * FROM medicion WHERE proyecto_id = ? ORDER BY fecha DESC', [projectId]);
  }
};

module.exports = projectRepository;

