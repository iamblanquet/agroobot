/*
 * Migración inicial SQLite -> Supabase REST.
 * Ejecutar con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY configuradas.
 * No borra datos en ningún motor.
 */
require('dotenv').config();
const { db, initDatabase } = require('./database');

const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

async function upsert(table, rows, conflictColumns = 'id') {
  if (!rows.length) return;
  const conflictParam = conflictColumns ? `?on_conflict=${conflictColumns}` : '';
  const response = await fetch(`${url}/rest/v1/${table}${conflictParam}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`${table}: ${response.status} ${await response.text()}`);
  console.log(`✓ ${table}: ${rows.length} registros sincronizados`);
}

async function migrate() {
  await initDatabase();
  const usuarios = await db.all('SELECT id, username, password_hash, nombre, rol, pin, activo, tg_user_id, tg_chat_id, creado_en FROM usuario');
  const proyectos = await db.all('SELECT id, nombre, tipo, ciclo, fecha_inicio, fecha_fin, superficie_meta_ha, gerente_id FROM proyecto');
  const hitos = await db.all('SELECT id, proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado FROM hito');
  const tareas = await db.all('SELECT id, hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable FROM tarea');
  const predios = await db.all('SELECT id, nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson FROM predio');
  const obras = await db.all('SELECT id, nombre, proyecto_id, fase_actual, estado, tg_thread_id FROM obra');
  const obraPredios = await db.all('SELECT * FROM obra_predio');
  const entidades = await db.all('SELECT id, nombre, tipo, contacto, activo FROM entidad');
  const maquinas = await db.all('SELECT id, codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento FROM maquina');
  const reportes = await db.all('SELECT * FROM reporte');
  const lineas = await db.all('SELECT * FROM reporte_linea');
  const cuadrillas = await db.all('SELECT * FROM reporte_cuadrilla');
  const lecturasMaquinas = await db.all('SELECT * FROM lectura_maquina');
  const incidencias = await db.all('SELECT * FROM incidencia');
  const materiales = await db.all('SELECT id, obra_id, nombre, requerido, en_sitio, pedido, unidad, eta FROM material');
  const mediciones = await db.all('SELECT * FROM medicion');
  const fotos = await db.all('SELECT * FROM reporte_foto');
  const activos = await db.all('SELECT * FROM activo_fijo');
  const lecturasActivos = await db.all('SELECT * FROM lectura_activo_fijo');

  await upsert('usuario', usuarios.map((row) => ({ ...row, activo: Boolean(row.activo) })));
  await upsert('proyecto', proyectos);
  await upsert('hito', hitos);
  await upsert('tarea', tareas);
  await upsert('predio', predios);
  await upsert('entidad', entidades.map((row) => ({ ...row, activo: Boolean(row.activo) })));
  await upsert('obra', obras);
  await upsert('obra_predio', obraPredios, 'obra_id,predio_id');
  await upsert('maquina', maquinas.map((row) => ({ ...row, alerta_mantenimiento: Boolean(row.alerta_mantenimiento) })));
  await upsert('reporte', reportes.map((row) => ({ ...row, es_sin_actividad: Boolean(row.es_sin_actividad) })));
  await upsert('reporte_linea', lineas);
  await upsert('reporte_cuadrilla', cuadrillas);
  await upsert('lectura_maquina', lecturasMaquinas);
  await upsert('incidencia', incidencias);
  await upsert('material', materiales);
  await upsert('medicion', mediciones);
  await upsert('reporte_foto', fotos);
  await upsert('activo_fijo', activos);
  await upsert('lectura_activo_fijo', lecturasActivos);
  console.log('Migración inicial completada. SQLite permanece sin cambios.');
}

migrate().catch((error) => {
  console.error('Migración fallida:', error.message);
  process.exitCode = 1;
});
