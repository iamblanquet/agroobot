const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'tesa_campo.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

function getDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
      } else {
        console.log('📦 Conectado a la base de datos SQLite:', dbPath);
      }
    });

    dbInstance.run('PRAGMA foreign_keys = ON;');
  }
  return dbInstance;
}

// Wrapper de promesas para SQLite
const db = {
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      getDb().get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      getDb().all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      getDb().run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  exec(sql) {
    return new Promise((resolve, reject) => {
      getDb().exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      const result = await callback(this);
      await this.run('COMMIT');
      return result;
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }
};

const DDL_SCHEMA = `
  PRAGMA foreign_keys = ON;

  -- 1. Tabla de Usuarios y Roles
  CREATE TABLE IF NOT EXISTS usuario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    pin TEXT,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL CHECK(rol IN ('campo', 'supervisor', 'direccion', 'it')),
    tg_user_id TEXT,
    tg_chat_id TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Tabla de Proyectos
  CREATE TABLE IF NOT EXISTS proyecto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    ciclo TEXT NOT NULL,
    superficie_meta_ha REAL NOT NULL DEFAULT 0,
    fase_catalogo TEXT,
    gerente_id INTEGER,
    fecha_inicio DATE,
    fecha_fin DATE,
    FOREIGN KEY (gerente_id) REFERENCES usuario(id) ON DELETE SET NULL
  );

  -- 3. Tabla de Hitos de Proyecto
  CREATE TABLE IF NOT EXISTS hito (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    orden INTEGER NOT NULL DEFAULT 1,
    fecha_meta DATE,
    superficie_meta_ha REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'en_proceso', 'completado', 'bloqueado')),
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE CASCADE
  );

  -- 4. Tabla de Tareas Operativas
  CREATE TABLE IF NOT EXISTS tarea (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hito_id INTEGER NOT NULL,
    proyecto_id INTEGER NOT NULL,
    predio_id INTEGER,
    nombre TEXT NOT NULL,
    actividad_id TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'ha',
    cantidad_meta REAL NOT NULL DEFAULT 0,
    cantidad_acumulada REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'en_progreso' CHECK(estado IN ('pendiente', 'en_progreso', 'completada', 'detenida')),
    responsable TEXT,
    FOREIGN KEY (hito_id) REFERENCES hito(id) ON DELETE CASCADE,
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE CASCADE,
    FOREIGN KEY (predio_id) REFERENCES predio(id) ON DELETE SET NULL
  );

  -- 5. Tabla de Predios
  CREATE TABLE IF NOT EXISTS predio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    superficie_legal_ha REAL NOT NULL DEFAULT 0,
    superficie_util_ha REAL NOT NULL DEFAULT 0,
    regimen TEXT,
    poligono_geojson TEXT
  );

  -- 6. Tabla de Obras (Frentes de Trabajo)
  CREATE TABLE IF NOT EXISTS obra (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    proyecto_id INTEGER NOT NULL,
    fase_actual TEXT,
    estado TEXT NOT NULL DEFAULT 'operacion' CHECK(estado IN ('prospeccion', 'habilitacion', 'operacion', 'mantenimiento', 'standby', 'cerrada')),
    tg_thread_id TEXT,
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE CASCADE
  );

  -- 7. Tabla Relacional Obra - Predio (M:N)
  CREATE TABLE IF NOT EXISTS obra_predio (
    obra_id INTEGER NOT NULL,
    predio_id INTEGER NOT NULL,
    PRIMARY KEY (obra_id, predio_id),
    FOREIGN KEY (obra_id) REFERENCES obra(id) ON DELETE CASCADE,
    FOREIGN KEY (predio_id) REFERENCES predio(id) ON DELETE CASCADE
  );

  -- 8. Tabla de Reportes Operativos
  CREATE TABLE IF NOT EXISTS reporte (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_uuid TEXT UNIQUE NOT NULL,
    proyecto_id INTEGER,
    hito_id INTEGER,
    tarea_id INTEGER,
    obra_id INTEGER,
    recibido_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_operativa DATE NOT NULL,
    autor_nombre TEXT NOT NULL,
    texto_original TEXT,
    nota TEXT,
    estado TEXT NOT NULL DEFAULT 'confirmado' CHECK(estado IN ('borrador', 'confirmado', 'corregido')),
    es_sin_actividad INTEGER NOT NULL DEFAULT 0,
    motivo_sin_actividad TEXT,
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE SET NULL,
    FOREIGN KEY (hito_id) REFERENCES hito(id) ON DELETE SET NULL,
    FOREIGN KEY (tarea_id) REFERENCES tarea(id) ON DELETE SET NULL,
    FOREIGN KEY (obra_id) REFERENCES obra(id) ON DELETE SET NULL
  );

  -- 9. Tabla de Líneas de Avance de Reporte
  CREATE TABLE IF NOT EXISTS reporte_linea (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporte_id INTEGER NOT NULL,
    predio_id INTEGER,
    actividad_id TEXT,
    cantidad REAL NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'ha',
    cantidad_ha REAL NOT NULL DEFAULT 0,
    fuente TEXT NOT NULL DEFAULT 'campo' CHECK(fuente IN ('campo', 'dron', 'topografia')),
    FOREIGN KEY (reporte_id) REFERENCES reporte(id) ON DELETE CASCADE,
    FOREIGN KEY (predio_id) REFERENCES predio(id) ON DELETE SET NULL
  );

  -- 10. Tabla de Cuadrilla de Reporte
  CREATE TABLE IF NOT EXISTS reporte_cuadrilla (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporte_id INTEGER NOT NULL,
    rol_id TEXT NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (reporte_id) REFERENCES reporte(id) ON DELETE CASCADE
  );

  -- 11. Tabla de Maquinaria y Equipos
  CREATE TABLE IF NOT EXISTS maquina (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    modelo TEXT NOT NULL,
    horometro_actual REAL NOT NULL DEFAULT 0,
    ultimo_servicio_hr REAL NOT NULL DEFAULT 0,
    alerta_mantenimiento INTEGER NOT NULL DEFAULT 0
  );

  -- 12. Tabla de Lecturas de Horómetro
  CREATE TABLE IF NOT EXISTS lectura_maquina (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporte_id INTEGER NOT NULL,
    maquina_id INTEGER NOT NULL,
    horometro_inicio REAL NOT NULL,
    horometro_fin REAL NOT NULL,
    horas_trabajadas REAL NOT NULL DEFAULT 0,
    litros_diesel REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (reporte_id) REFERENCES reporte(id) ON DELETE CASCADE,
    FOREIGN KEY (maquina_id) REFERENCES maquina(id) ON DELETE CASCADE
  );

  -- 13. Tabla de Incidencias Operativas
  CREATE TABLE IF NOT EXISTS incidencia (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL,
    obra_id INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierta' CHECK(estado IN ('abierta', 'diagnostico', 'reparacion', 'verificacion', 'cerrada')),
    abierta_en DATETIME DEFAULT CURRENT_TIMESTAMP,
    cerrada_en DATETIME,
    causa_raiz TEXT,
    FOREIGN KEY (obra_id) REFERENCES obra(id) ON DELETE CASCADE
  );

  -- 14. Tabla de Materiales e Insumos en Obra
  CREATE TABLE IF NOT EXISTS material (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    obra_id INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    requerido REAL NOT NULL DEFAULT 0,
    en_sitio REAL NOT NULL DEFAULT 0,
    pedido REAL NOT NULL DEFAULT 0,
    unidad TEXT NOT NULL DEFAULT 'pza',
    eta DATE,
    FOREIGN KEY (obra_id) REFERENCES obra(id) ON DELETE CASCADE
  );

  -- 15. Tabla de Mediciones de Validación (Dron / Topografía)
  CREATE TABLE IF NOT EXISTS medicion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proyecto_id INTEGER NOT NULL,
    hectareas REAL NOT NULL DEFAULT 0,
    fecha DATE NOT NULL,
    fuente TEXT NOT NULL DEFAULT 'dron' CHECK(fuente IN ('dron', 'topografia')),
    archivo_ruta TEXT,
    FOREIGN KEY (proyecto_id) REFERENCES proyecto(id) ON DELETE CASCADE
  );

  -- Índices de Rendimiento
  CREATE INDEX IF NOT EXISTS idx_tarea_hito ON tarea(hito_id);
  CREATE INDEX IF NOT EXISTS idx_tarea_proyecto ON tarea(proyecto_id);
  CREATE INDEX IF NOT EXISTS idx_reporte_obra ON reporte(obra_id);
  CREATE INDEX IF NOT EXISTS idx_reporte_fecha ON reporte(fecha_operativa);
  CREATE INDEX IF NOT EXISTS idx_incidencia_obra ON incidencia(obra_id);
  CREATE INDEX IF NOT EXISTS idx_incidencia_estado ON incidencia(estado);
  CREATE INDEX IF NOT EXISTS idx_material_obra ON material(obra_id);
`;

async function initDatabase() {
  try {
    await db.exec(DDL_SCHEMA);
    try {
      await db.run("ALTER TABLE usuario ADD COLUMN pin TEXT");
    } catch (e) {}
    console.log('✅ Esquema DDL de SQLite inicializado correctamente (15 tablas relacionales).');
  } catch (err) {
    console.error('❌ Error al inicializar esquema DDL:', err);
    throw err;
  }
}

module.exports = {
  db,
  getDb,
  initDatabase
};
