const fs = require('fs');
const path = require('path');
const { db, initDatabase } = require('./database');

async function exportBackup() {
  console.log('\n📦 ====================================================');
  console.log('📦 RESPALDO Y EXPORTACIÓN DE BASE DE DATOS LOCAL');
  console.log('📦 ====================================================\n');

  await initDatabase();

  const tables = [
    'usuario',
    'proyecto',
    'hito',
    'tarea',
    'predio',
    'obra',
    'obra_predio',
    'entidad',
    'maquina',
    'reporte',
    'reporte_linea',
    'reporte_cuadrilla',
    'lectura_maquina',
    'incidencia',
    'material',
    'medicion',
    'reporte_foto',
    'activo_fijo',
    'lectura_activo_fijo'
  ];

  const backupData = {
    exported_at: new Date().toISOString(),
    engine: 'sqlite',
    tables: {}
  };

  let totalRows = 0;

  for (const t of tables) {
    try {
      const rows = await db.all(`SELECT * FROM ${t}`);
      backupData.tables[t] = rows;
      totalRows += rows.length;
      console.log(`  ✓ Tabla "${t}": ${rows.length} registros extraídos.`);
    } catch (err) {
      console.warn(`  ⚠️ No se pudo extraer la tabla "${t}": ${err.message}`);
      backupData.tables[t] = [];
    }
  }

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_tesa_${timestamp}.json`;
  const backupPath = path.join(backupDir, filename);

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n💾 Respaldo generado con éxito:`);
  console.log(`   Ruta: ${backupPath}`);
  console.log(`   Tablas respaldadas: ${Object.keys(backupData.tables).length}`);
  console.log(`   Total de registros: ${totalRows}\n`);

  return backupPath;
}

if (require.main === module) {
  exportBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error al exportar respaldo:', err);
      process.exit(1);
    });
}

module.exports = exportBackup;
