const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./database');

async function seed() {
  console.log('🌱 Iniciando siembra de datos de prueba (Seed)...');
  await initDatabase();

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('demo123', saltRounds);

  // Limpiar tablas para reseteo limpio en seed
  await db.run('DELETE FROM medicion');
  await db.run('DELETE FROM material');
  await db.run('DELETE FROM incidencia');
  await db.run('DELETE FROM lectura_maquina');
  await db.run('DELETE FROM maquina');
  await db.run('DELETE FROM reporte_cuadrilla');
  await db.run('DELETE FROM reporte_linea');
  await db.run('DELETE FROM reporte');
  await db.run('DELETE FROM obra_predio');
  await db.run('DELETE FROM obra');
  await db.run('DELETE FROM predio');
  await db.run('DELETE FROM tarea');
  await db.run('DELETE FROM hito');
  await db.run('DELETE FROM proyecto');
  await db.run('DELETE FROM usuario');
  try {
    await db.run("DELETE FROM sqlite_sequence");
  } catch (e) {
    // Ignorar si sqlite_sequence no existe aún
  }

  console.log('🧹 Tablas limpiadas.');

  // 1. Usuarios canónicos
  const usuarios = [
    { username: 'campo_user', nombre: 'Juan Pérez - Residente de Campo', rol: 'campo', tg_user_id: '12345678' },
    { username: 'sup_user', nombre: 'Ing. Carlos Mendoza - Supervisor de Obra', rol: 'supervisor', tg_user_id: '87654321' },
    { username: 'dir_user', nombre: 'Lic. Roberto Garza - Director General', rol: 'direccion', tg_user_id: '11223344' },
    { username: 'admin_user', nombre: 'Admin TI - Soporte Sistemas', rol: 'it', tg_user_id: '99887766' }
  ];

  const userMap = {};
  for (const u of usuarios) {
    const res = await db.run(
      `INSERT INTO usuario (username, password_hash, nombre, rol, tg_user_id, tg_chat_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [u.username, passwordHash, u.nombre, u.rol, u.tg_user_id, u.tg_user_id]
    );
    userMap[u.username] = res.lastID;
  }
  console.log('👤 4 Usuarios creados (campo_user, sup_user, dir_user, admin_user / pass: demo123).');

  const supervisorId = userMap['sup_user'];

  // 2. Proyectos
  const p1 = await db.run(
    `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Proyecto Maíz del Bajío', 'Granos', 'PV 2026', 150.0, 'Habilitación y Siembra', supervisorId, '2026-03-01', '2026-09-30']
  );
  const p1Id = p1.lastID;

  const p2 = await db.run(
    `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Proyecto Papaya Maradol Costa', 'Frutales', 'Anual 2026', 80.0, 'Preparación de Suelo', supervisorId, '2026-01-15', '2026-12-31']
  );
  const p2Id = p2.lastID;

  console.log('🌾 2 Proyectos creados (Maíz del Bajío y Papaya Maradol).');

  // 3. Predios con GeoJSON
  const predio1 = await db.run(
    `INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Predio El Molino - Lote A',
      85.5,
      80.0,
      'Propiedad Privada',
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[[-101.68, 20.88], [-101.65, 20.88], [-101.65, 20.85], [-101.68, 20.85], [-101.68, 20.88]]]
      })
    ]
  );
  const predio1Id = predio1.lastID;

  const predio2 = await db.run(
    `INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Predio Santa Lucía - Lote B',
      75.0,
      70.0,
      'Ejidal',
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[[-101.64, 20.87], [-101.61, 20.87], [-101.61, 20.84], [-101.64, 20.84], [-101.64, 20.87]]]
      })
    ]
  );
  const predio2Id = predio2.lastID;

  const predio3 = await db.run(
    `INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Predio Costa Bonita - Papaya 1',
      85.0,
      80.0,
      'Propiedad Privada',
      JSON.stringify({
        type: 'Polygon',
        coordinates: [[[-103.88, 18.95], [-103.85, 18.95], [-103.85, 18.92], [-103.88, 18.92], [-103.88, 18.95]]]
      })
    ]
  );
  const predio3Id = predio3.lastID;

  // 4. Hitos
  const hito1 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p1Id, 'Hito 1: Desmonte, Rastreo y Nivelación', 'Preparación primaria de 80 ha en Predio El Molino', 1, '2026-04-15', 80.0, 'en_proceso']
  );
  const hito1Id = hito1.lastID;

  const hito2 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p1Id, 'Hito 2: Trazo de Surcos y Riego', 'Instalación de cintilla y surcado profundo', 2, '2026-05-30', 70.0, 'pendiente']
  );
  const hito2Id = hito2.lastID;

  const hito3 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p2Id, 'Hito 1: Acondicionamiento de Camellones', 'Subsoleo y conformación de camas altas para papaya', 1, '2026-03-30', 80.0, 'en_proceso']
  );
  const hito3Id = hito3.lastID;

  // 5. Tareas
  const t1 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito1Id, p1Id, predio1Id, 'Subsoleo y Desfonde Profundo', 'subsoleo', 'ha', 80.0, 52.5, 'en_progreso', 'Juan Pérez']
  );
  const t1Id = t1.lastID;

  const t2 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito1Id, p1Id, predio1Id, 'Rastreo Cruzado Doble Paso', 'rastreo', 'ha', 80.0, 38.0, 'en_progreso', 'Juan Pérez']
  );
  const t2Id = t2.lastID;

  const t3 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito2Id, p1Id, predio2Id, 'Instalación de Cabezal de Riego', 'riego_cabezal', 'pza', 2.0, 0.0, 'pendiente', 'Ing. Mendoza']
  );

  const t4 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito3Id, p2Id, predio3Id, 'Conformación de Camellones 1.2m', 'camellonado', 'ha', 80.0, 24.0, 'en_progreso', 'Marcos Ruiz']
  );

  // 6. Obras (Frentes de Trabajo)
  const obra1 = await db.run(
    `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
     VALUES (?, ?, ?, ?, ?)`,
    ['Frente Norte - Desmonte y Nivelación', p1Id, 'Subsoleo y Rastreo', 'operacion', '101']
  );
  const obra1Id = obra1.lastID;

  const obra2 = await db.run(
    `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
     VALUES (?, ?, ?, ?, ?)`,
    ['Frente Sur - Instalación de Riego', p1Id, 'Preparación Cabezal', 'operacion', '102']
  );
  const obra2Id = obra2.lastID;

  const obra3 = await db.run(
    `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
     VALUES (?, ?, ?, ?, ?)`,
    ['Frente Costa - Habilitación Papaya', p2Id, 'Camellonado', 'operacion', '103']
  );
  const obra3Id = obra3.lastID;

  const obra4 = await db.run(
    `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
     VALUES (?, ?, ?, ?, ?)`,
    ['Frente Reserva - Mantenimiento Vial', p1Id, 'Terracerías', 'standby', '104']
  );
  const obra4Id = obra4.lastID;

  // 7. Relación Obra - Predio
  await db.run(`INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [obra1Id, predio1Id]);
  await db.run(`INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [obra2Id, predio2Id]);
  await db.run(`INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [obra3Id, predio3Id]);

  // 8. Máquinas (Una con 285h para disparar alerta preventiva >= 280h)
  const m1 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['CAT-D6T-01', 'Bulldozer Caterpillar D6T', 285.0, 0.0, 1] // 285 - 0 >= 280 -> ALERTA PREVENTIVA ACTIVA
  );
  const m1Id = m1.lastID;

  const m2 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['JD-8430-02', 'Tractor John Deere 8430', 415.5, 300.0, 0] // 415.5 - 300 = 115.5h (OK)
  );
  const m2Id = m2.lastID;

  const m3 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['CASE-580N-03', 'Retroexcavadora Case 580N', 95.0, 0.0, 0] // 95 - 0 = 95h (OK)
  );
  const m3Id = m3.lastID;

  console.log('🚜 3 Máquinas creadas (CAT-D6T-01 con 285h y alerta de mantenimiento preventiva).');

  // 9. Incidencias Abiertas
  await db.run(
    `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
     VALUES (?, ?, ?, ?, datetime('now', '-2 days'), NULL)`,
    ['INC-2026-001', 'Fuga hidráulica en manguera de alta presión', obra1Id, 'abierta']
  );

  await db.run(
    `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
     VALUES (?, ?, ?, ?, datetime('now', '-1 days'), NULL)`,
    ['INC-2026-002', 'Cintilla de riego dañada por roedores en cabezal secundario', obra2Id, 'diagnostico']
  );
  console.log('⚠️ 2 Incidencias abiertas creadas.');

  // 10. Materiales con retraso en ETA (bloqueos)
  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-3 days'))`,
    [obra2Id, 'Tubería PVC Hidráulico 6" Clase 7', 150.0, 45.0, 105.0, 'tramos']
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '+2 days'))`,
    [obra1Id, 'Diésel UBA para Maquinaria', 2000.0, 800.0, 1200.0, 'litros']
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '+5 days'))`,
    [obra3Id, 'Fertilizante Fosfato Monoamónico (MAP)', 5000.0, 5000.0, 0.0, 'kg']
  );
  console.log('📦 Materiales e insumos creados con faltantes y estado de ETA.');

  // 11. Mediciones Dron vs Campo
  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-1 days'), 'dron', 'https://storage.agritech.com/dron/ortomosaico_molino_2026.tif')`,
    [p1Id, 54.2]
  );

  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-3 days'), 'topografia', 'https://storage.agritech.com/topo/poligono_santa_lucia.dwg')`,
    [p1Id, 51.0]
  );

  // 12. Reportes anteriores de muestra
  const rep1 = await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, hito_id, tarea_id, obra_id, recibido_en, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'), date('now', '-1 days'), 'Juan Pérez', 'Jornada normal de subsoleo 8.5 ha', 'Buen rendimiento del suelo', 'confirmado', 0)`,
    ['uuid-sample-rep-001', p1Id, hito1Id, t1Id, obra1Id]
  );
  const rep1Id = rep1.lastID;

  await db.run(
    `INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [rep1Id, predio1Id, 'subsoleo', 8.5, 'ha', 8.5, 'campo']
  );

  await db.run(
    `INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`,
    [rep1Id, 'operador', 3]
  );
  await db.run(
    `INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`,
    [rep1Id, 'tecnico', 1]
  );

  await db.run(
    `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rep1Id, m1Id, 277.0, 285.0, 8.0, 140.0]
  );

  console.log('✅ Base de datos poblada exitosamente con datos de prueba realistas.');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error en seed:', err);
      process.exit(1);
    });
}

module.exports = seed;
