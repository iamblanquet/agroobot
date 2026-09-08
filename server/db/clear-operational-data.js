/**
 * Script de limpieza de datos operativos
 * Conserva únicamente la tabla 'usuario' para permitir el inicio de sesión.
 */
require('dotenv').config();
const { db, initDatabase } = require('./database');
const supabase = require('./supabase');

async function clearOperationalData() {
  console.log('\n🧹 ====================================================');
  console.log('🧹 VACIADO DE DATOS OPERATIVOS (SQLITE Y SUPABASE)');
  console.log('🧹 ====================================================\n');

  await initDatabase();

  const tablesToClear = [
    'lectura_activo_fijo',
    'activo_fijo',
    'reporte_foto',
    'medicion',
    'material',
    'incidencia',
    'lectura_maquina',
    'reporte_cuadrilla',
    'reporte_linea',
    'reporte',
    'maquina',
    'obra_predio',
    'obra',
    'predio',
    'tarea',
    'hito',
    'proyecto',
    'entidad'
  ];

  // 1. Limpieza en SQLite
  console.log('1. Limpiando base de datos SQLite local...');
  for (const table of tablesToClear) {
    try {
      const res = await db.run(`DELETE FROM ${table}`);
      console.log(`   ✓ SQLite: ${table} vaciada (${res.changes} registros eliminados)`);
    } catch (err) {
      console.warn(`   ⚠️ SQLite: Error al vaciar ${table}:`, err.message);
    }
  }

  // 2. Limpieza en Supabase Cloud
  if (supabase.isSupabaseConfigured()) {
    console.log('\n2. Limpiando datos en Supabase Cloud...');
    for (const table of tablesToClear) {
      try {
        let deleted;
        if (table === 'obra_predio') {
          deleted = await supabase.deleteRows(table, { obra_id: 'gt.0' });
        } else {
          deleted = await supabase.deleteRows(table, { id: 'gt.0' });
        }
        console.log(`   ✓ Supabase: ${table} vaciada (${deleted ? deleted.length : 0} registros eliminados)`);
      } catch (sbErr) {
        console.warn(`   ⚠️ Supabase: Error al vaciar ${table}:`, sbErr.message);
      }
    }
  }

  // 3. Verificar estado de usuarios
  const localUsers = await db.all('SELECT id, username, rol, pin FROM usuario');
  console.log(`\n👥 Usuarios conservados en SQLite: ${localUsers.length}`);
  localUsers.forEach(u => console.log(`   - ${u.username} (${u.rol}) | PIN: ${u.pin || 'N/A'}`));

  if (supabase.isSupabaseConfigured()) {
    try {
      const sbUsers = await supabase.selectRows('usuario', { select: 'id,username,rol,pin' });
      console.log(`👥 Usuarios conservados en Supabase: ${sbUsers.length}`);
    } catch (e) {
      console.warn('   ⚠️ Error consultando usuarios en Supabase:', e.message);
    }
  }

  console.log('\n✅ Limpieza completada con éxito. Listo para registrar el proyecto de prueba.');
}

clearOperationalData().catch(err => {
  console.error('❌ Error durante la limpieza:', err);
  process.exitCode = 1;
});
