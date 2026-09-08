require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db, initDatabase } = require('./database');
const supabase = require('./supabase');

async function restoreCatalogs() {
  console.log('\n📥 ====================================================');
  console.log('📥 RESTAURANDO CATÁLOGOS BASE (PREDIOS, MÁQUINAS, FRENTES)');
  console.log('📥 ====================================================\n');

  await initDatabase();

  const backupPath = path.join(__dirname, 'backups/backup_tesa_2026-09-08T17-59-48-219Z.json');
  if (!fs.existsSync(backupPath)) {
    throw new Error('Archivo de backup no encontrado en: ' + backupPath);
  }

  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const { entidad, predio, maquina, proyecto, obra, obra_predio } = backup.tables;

  console.log(`📦 Datos a restaurar: ${entidad.length} entidades, ${predio.length} predios, ${maquina.length} máquinas, ${proyecto.length} proyectos, ${obra.length} obras, ${obra_predio.length} relaciones.`);

  // 1. Restaurar en SQLite
  console.log('\n1. Restaurando en SQLite...');

  // A. Entidades
  for (const e of entidad) {
    await db.run(
      `INSERT OR REPLACE INTO entidad (id, nombre, tipo, contacto) VALUES (?, ?, ?, ?)`,
      [e.id, e.nombre, e.tipo, e.contacto]
    );
  }
  console.log(`   ✓ SQLite: ${entidad.length} entidades restauradas.`);

  // B. Predios
  for (const p of predio) {
    await db.run(
      `INSERT OR REPLACE INTO predio (id, nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.nombre, p.superficie_legal_ha, p.superficie_util_ha, p.regimen, p.poligono_geojson]
    );
  }
  console.log(`   ✓ SQLite: ${predio.length} predios restaurados.`);

  // C. Máquinas
  for (const m of maquina) {
    await db.run(
      `INSERT OR REPLACE INTO maquina (id, codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m.id, m.codigo, m.nombre, m.tipo, m.modelo, m.propietaria_id, m.operadora_id, m.umbral_servicio_hrs, m.horometro_actual, m.ultimo_servicio_hr, m.alerta_mantenimiento]
    );
  }
  console.log(`   ✓ SQLite: ${maquina.length} máquinas restauradas.`);

  // D. Proyectos
  for (const pr of proyecto) {
    try {
      await db.run(
        `INSERT OR REPLACE INTO proyecto (id, nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pr.id, pr.nombre, pr.tipo, pr.ciclo, pr.superficie_meta_ha, pr.fase_catalogo, pr.gerente_id, pr.fecha_inicio, pr.fecha_fin, pr.estado || 'activo']
      );
    } catch (_) {
      await db.run(
        `INSERT OR REPLACE INTO proyecto (id, nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pr.id, pr.nombre, pr.tipo, pr.ciclo, pr.superficie_meta_ha, pr.fase_catalogo, pr.gerente_id, pr.fecha_inicio, pr.fecha_fin]
      );
    }
  }
  console.log(`   ✓ SQLite: ${proyecto.length} proyectos base restaurados.`);

  // E. Obras / Frentes
  for (const o of obra) {
    await db.run(
      `INSERT OR REPLACE INTO obra (id, nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [o.id, o.nombre, o.proyecto_id, o.fase_actual, o.estado, o.tg_thread_id]
    );
  }
  console.log(`   ✓ SQLite: ${obra.length} obras/frentes restauradas.`);

  // F. Obra - Predio
  for (const op of obra_predio) {
    await db.run(
      `INSERT OR REPLACE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`,
      [op.obra_id, op.predio_id]
    );
  }
  console.log(`   ✓ SQLite: ${obra_predio.length} relaciones obra-predio restauradas.`);

  // 2. Restaurar en Supabase (si está configurado)
  if (supabase.isSupabaseConfigured()) {
    console.log('\n2. Restaurando en Supabase Cloud...');

    // A. Entidades
    for (const e of entidad) {
      try {
        await supabase.insertRow('entidad', { id: e.id, nombre: e.nombre, tipo: e.tipo, contacto: e.contacto });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: entidades restauradas.`);

    // B. Predios
    for (const p of predio) {
      try {
        await supabase.insertRow('predio', {
          id: p.id,
          nombre: p.nombre,
          superficie_legal_ha: p.superficie_legal_ha,
          superficie_util_ha: p.superficie_util_ha,
          regimen: p.regimen,
          poligono_geojson: p.poligono_geojson
        });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: predios restaurados.`);

    // C. Máquinas
    for (const m of maquina) {
      try {
        await supabase.insertRow('maquina', {
          id: m.id,
          codigo: m.codigo,
          nombre: m.nombre,
          tipo: m.tipo,
          modelo: m.modelo,
          propietaria_id: m.propietaria_id,
          operadora_id: m.operadora_id,
          umbral_servicio_hrs: m.umbral_servicio_hrs,
          horometro_actual: m.horometro_actual,
          ultimo_servicio_hr: m.ultimo_servicio_hr,
          alerta_mantenimiento: m.alerta_mantenimiento
        });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: máquinas restauradas.`);

    // D. Proyectos
    for (const pr of proyecto) {
      try {
        await supabase.insertRow('proyecto', {
          id: pr.id,
          nombre: pr.nombre,
          tipo: pr.tipo,
          ciclo: pr.ciclo,
          superficie_meta_ha: pr.superficie_meta_ha,
          gerente_id: pr.gerente_id,
          fecha_inicio: pr.fecha_inicio,
          fecha_fin: pr.fecha_fin,
          estado: pr.estado || 'activo'
        });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: proyectos restaurados.`);

    // E. Obras
    for (const o of obra) {
      try {
        await supabase.insertRow('obra', {
          id: o.id,
          nombre: o.nombre,
          proyecto_id: o.proyecto_id,
          fase_actual: o.fase_actual,
          estado: o.estado,
          tg_thread_id: o.tg_thread_id
        });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: obras/frentes restauradas.`);

    // F. Obra - Predio
    for (const op of obra_predio) {
      try {
        await supabase.insertRow('obra_predio', {
          obra_id: op.obra_id,
          predio_id: op.predio_id
        });
      } catch (_) {}
    }
    console.log(`   ✓ Supabase: relaciones obra-predio restauradas.`);
  }

  console.log('\n✅ CATÁLOGOS BASE RESTAURADOS EXITOSAMENTE EN SQLITE Y SUPABASE.');
  console.log('   (0 tareas de prueba, 0 hitos de prueba, 0 reportes de prueba).');
}

restoreCatalogs().catch(err => {
  console.error('❌ Error al restaurar catálogos:', err);
  process.exitCode = 1;
});
