const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./database');

async function seed() {
  console.log('🌱 Iniciando siembra de datos reales de AGROK (Catálogo Oficial)...');
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
  } catch (e) {}

  console.log('🧹 Tablas limpiadas.');

  // 1. Usuarios canónicos con PIN de acceso rápido (Docs 1 y 4)
  const usuarios = [
    { username: 'campo_user', pin: '1234', nombre: 'Abner Díaz - Residente de Campo', rol: 'campo', tg_user_id: '12345678' },
    { username: 'sup_user', pin: '2345', nombre: 'Karen García - Supervisora de Operaciones', rol: 'supervisor', tg_user_id: '87654321' },
    { username: 'dir_user', pin: '3456', nombre: 'Luis - Dirección General', rol: 'direccion', tg_user_id: '11223344' },
    { username: 'admin_user', pin: '9999', nombre: 'Julio Silva - Administrador IT', rol: 'it', tg_user_id: '99887766' },
    { username: 'beche_user', pin: '5678', nombre: 'Beche Dorantes - Encargado de Maquinaria', rol: 'campo', tg_user_id: '55667788' }
  ];

  const userMap = {};
  for (const u of usuarios) {
    const res = await db.run(
      `INSERT INTO usuario (username, password_hash, pin, nombre, rol, tg_user_id, tg_chat_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [u.username, passwordHash, u.pin, u.nombre, u.rol, u.tg_user_id, u.tg_user_id]
    );
    userMap[u.username] = res.lastID;
  }
  console.log('👤 5 Usuarios reales creados (campo_user: 1234, sup_user: 2345, dir_user: 3456, admin_user: 9999, beche_user: 5678).');

  const supervisorId = userMap['sup_user'];

  // 2. Proyectos Reales de AGROK (Docs 1 y 5)
  const p1 = await db.run(
    `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Maíz 2026', 'maiz', 'Ciclo PV 2026', 230.0, 'Habilitación y Siembra', supervisorId, '2026-03-01', '2026-10-31']
  );
  const p1Id = p1.lastID;

  const p2 = await db.run(
    `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Reforestación 2026', 'reforestacion', 'Ciclo 2026', 80.0, 'Mantenimiento y Riego', supervisorId, '2026-01-15', '2026-12-31']
  );
  const p2Id = p2.lastID;

  const p3 = await db.run(
    `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Infraestructura Ganadera', 'ganaderia', 'Anual 2026', 120.0, 'Cercado y Corrales', supervisorId, '2026-02-01', '2026-12-15']
  );
  const p3Id = p3.lastID;

  console.log('🌾 3 Proyectos creados (Maíz 2026: 230 ha, Reforestación: 80 ha, Infraestructura Ganadera: 120 ha).');

  // 3. Predios Reales de Campeche con Superficies del Catálogo Oficial (Docs 5)
  const prediosData = [
    { nombre: 'Guayeme', supLegal: 37.67, supUtil: 37.67, regimen: 'Propiedad Privada', coords: [[[-90.28, 19.78], [-90.25, 19.78], [-90.25, 19.75], [-90.28, 19.75], [-90.28, 19.78]]] },
    { nombre: 'San Alberto', supLegal: 11.04, supUtil: 11.04, regimen: 'Propiedad Privada', coords: [[[-90.24, 19.77], [-90.22, 19.77], [-90.22, 19.75], [-90.24, 19.75], [-90.24, 19.77]]] },
    { nombre: 'Los Mangos', supLegal: 12.47, supUtil: 10.47, regimen: 'Propiedad Privada', coords: [[[-90.23, 19.76], [-90.21, 19.76], [-90.21, 19.74], [-90.23, 19.74], [-90.23, 19.76]]] },
    { nombre: 'Rach', supLegal: 1.83, supUtil: 1.83, regimen: 'Propiedad Privada', coords: [[[-90.22, 19.76], [-90.21, 19.76], [-90.21, 19.75], [-90.22, 19.75], [-90.22, 19.76]]] },
    { nombre: 'Cristina', supLegal: 5.51, supUtil: 5.51, regimen: 'Propiedad Privada', coords: [[[-90.21, 19.76], [-90.20, 19.76], [-90.20, 19.75], [-90.21, 19.75], [-90.21, 19.76]]] },
    { nombre: 'Santa Teresita', supLegal: 521.00, supUtil: 450.00, regimen: 'Propiedad Privada', coords: [[[-90.35, 19.82], [-90.28, 19.82], [-90.28, 19.76], [-90.35, 19.76], [-90.35, 19.82]]] },
    { nombre: 'San Luis', supLegal: 16.03, supUtil: 16.03, regimen: 'Propiedad Privada', coords: [[[-90.20, 19.74], [-90.18, 19.74], [-90.18, 19.72], [-90.20, 19.72], [-90.20, 19.74]]] },
    { nombre: 'La Asunción', supLegal: 146.48, supUtil: 140.00, regimen: 'Propiedad Privada', coords: [[[-90.18, 19.73], [-90.12, 19.73], [-90.12, 19.68], [-90.18, 19.68], [-90.18, 19.73]]] },
    { nombre: 'San Pedro', supLegal: 180.41, supUtil: 180.41, regimen: 'En trámite RPP', coords: [[[-90.15, 19.70], [-90.08, 19.70], [-90.08, 19.65], [-90.15, 19.65], [-90.15, 19.70]]] },
    { nombre: 'Parque Jabin', supLegal: 80.00, supUtil: 80.00, regimen: 'Patrimonial', coords: [[[-90.26, 19.79], [-90.23, 19.79], [-90.23, 19.77], [-90.26, 19.77], [-90.26, 19.79]]] },
    { nombre: 'Potrero Yeguas', supLegal: 120.00, supUtil: 120.00, regimen: 'Patrimonial', coords: [[[-90.30, 19.80], [-90.26, 19.80], [-90.26, 19.76], [-90.30, 19.76], [-90.30, 19.80]]] }
  ];

  const predioMap = {};
  for (const p of prediosData) {
    const res = await db.run(
      `INSERT INTO predio (nombre, superficie_legal_ha, superficie_util_ha, regimen, poligono_geojson)
       VALUES (?, ?, ?, ?, ?)`,
      [
        p.nombre,
        p.supLegal,
        p.supUtil,
        p.regimen,
        JSON.stringify({ type: 'Polygon', coordinates: p.coords })
      ]
    );
    predioMap[p.nombre] = res.lastID;
  }
  console.log(`🗺️ ${prediosData.length} Predios reales registrados con polígonos GeoJSON.`);

  // 4. Hitos de Proyecto (WBS)
  const hito1 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p1Id, 'Hito 1: Habilitación y Desmonte (Santa Teresita y Guayeme)', 'Despalme, subsoleo y nivelación de frentes', 1, '2026-05-30', 90.0, 'en_proceso']
  );
  const hito1Id = hito1.lastID;

  const hito2 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p1Id, 'Hito 2: Siembra Mecanizada y Fertilización (Clúster Mangos y San Alberto)', 'Siembra Case PRO 6 e inoculación de semilla', 2, '2026-07-15', 70.0, 'en_proceso']
  );
  const hito2Id = hito2.lastID;

  const hito3 = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p1Id, 'Hito 3: Manejo Fitosanitario y Monitoreo con Dron', 'Control de cogollero y fertilización foliar', 3, '2026-09-15', 70.0, 'en_proceso']
  );
  const hito3Id = hito3.lastID;

  const hitoGan = await db.run(
    `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [p3Id, 'Hito 1: Cercado Perimetral y Corrales Potrero Yeguas', 'Colocación de postes y varengas', 1, '2026-06-30', 120.0, 'bloqueado']
  );
  const hitoGanId = hitoGan.lastID;

  // 5. Tareas Operativas
  const t1 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito1Id, p1Id, predioMap['Santa Teresita'], 'Despalme con Retroexcavadora', 'despalme', 'ha', 50.0, 12.3, 'en_progreso', 'Beche Dorantes']
  );
  const t1Id = t1.lastID;

  const t2 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito1Id, p1Id, predioMap['Guayeme'], 'Subsoleo y Rastreo Profundo', 'subsoleo', 'ha', 37.67, 37.67, 'completada', 'Abner Díaz']
  );
  const t2Id = t2.lastID;

  const t3 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito2Id, p1Id, predioMap['Los Mangos'], 'Siembra Mecanizada Case PRO 6', 'siembra', 'ha', 20.0, 19.81, 'en_progreso', 'Abner Díaz']
  );
  const t3Id = t3.lastID;

  const t4 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hito3Id, p1Id, predioMap['Guayeme'], 'Monitoreo y Control Fitosanitario L1', 'fumigacion', 'ha', 37.67, 15.0, 'en_progreso', 'Abner Díaz']
  );
  const t4Id = t4.lastID;

  const t5 = await db.run(
    `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hitoGanId, p3Id, predioMap['Potrero Yeguas'], 'Posteo y Colocación de Varengas', 'cercado', 'ha', 120.0, 40.0, 'detenida', 'Karen García']
  );

  // 6. Obras Reales de AGROK (Docs 5)
  const obrasData = [
    { nombre: 'Maíz Guayeme', projId: p1Id, fase: 'monitoreo y control de plaga', estado: 'operacion', thread: '101', predios: ['Guayeme'] },
    { nombre: 'Desmonte Santa Teresita', projId: p1Id, fase: 'despalme con retro', estado: 'operacion', thread: '102', predios: ['Santa Teresita'] },
    { nombre: 'Siembra clúster Mangos', projId: p1Id, fase: 'siembra y fumigacion', estado: 'operacion', thread: '103', predios: ['Los Mangos', 'Rach', 'Cristina'] },
    { nombre: 'Maíz San Alberto', projId: p1Id, fase: 'post-siembra', estado: 'operacion', thread: '104', predios: ['San Alberto'] },
    { nombre: 'San Luis', projId: p1Id, fase: 'siembra pospuesta por lluvia', estado: 'standby', thread: '105', predios: ['San Luis'] },
    { nombre: 'Reforestación Jabin', projId: p2Id, fase: 'mantenimiento', estado: 'operacion', thread: '106', predios: ['Parque Jabin'] },
    { nombre: 'Cercado Potrero Yeguas', projId: p3Id, fase: 'cercado y corral', estado: 'operacion', thread: '107', predios: ['Potrero Yeguas'] }
  ];

  const obraMap = {};
  for (const o of obrasData) {
    const res = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?)`,
      [o.nombre, o.projId, o.fase, o.estado, o.thread]
    );
    const oId = res.lastID;
    obraMap[o.nombre] = oId;

    for (const pName of o.predios) {
      if (predioMap[pName]) {
        await db.run(`INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [oId, predioMap[pName]]);
      }
    }
  }
  console.log(`🏢 ${obrasData.length} Obras reales creadas y vinculadas a sus predios.`);

  // 7. Maquinaria Real de AGROK y Aspromex (Docs 5)
  // Puma con 288.5h para disparar la alerta preventiva de 300h (<= 20h)
  const m1 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['TRACTOR-PUMA-01', 'Tractor CASE IH Puma 155 (Aspromex)', 288.5, 0.0, 1]
  );
  const m1Id = m1.lastID;

  const m2 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['BULLDOZER-CAT-D6', 'Bulldozer Caterpillar D6', 1420.0, 1250.0, 0]
  );
  const m2Id = m2.lastID;

  const m3 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['RETRO-NEW-HOLLAND', 'Retroexcavadora New Holland (Alfredo)', 286.5, 0.0, 1]
  );
  const m3Id = m3.lastID;

  const m4 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['DRON-AGRAS-T70P', 'Dron Agrícola DJI Agras T70P (Abner)', 45.0, 0.0, 0]
  );
  const m4Id = m4.lastID;

  const m5 = await db.run(
    `INSERT INTO maquina (codigo, modelo, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?)`,
    ['SEMBRADORA-CASE-PRO6', 'Sembradora Case PRO 6 Hileras', 62.0, 0.0, 0]
  );

  console.log('🚜 5 Máquinas reales creadas (Tractor Puma y Retroexcavadora en alerta preventiva 300h).');

  // 8. Incidencias Abiertas Reales del Corpus (Docs 2 y 5)
  await db.run(
    `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
     VALUES (?, ?, ?, ?, datetime('now', '-3 days'), NULL)`,
    ['F-14', 'Falla mecánica: Bulldozer D6 se sobrecalienta en sistema hidráulico', obraMap['Desmonte Santa Teresita'], 'diagnostico']
  );

  await db.run(
    `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
     VALUES (?, ?, ?, ?, datetime('now', '-1 days'), NULL)`,
    ['F-21', 'Plaga fitosanitaria: Brote de gusano cogollero en Lote 1', obraMap['Maíz Guayeme'], 'abierta']
  );
  console.log('⚠️ 2 Incidencias canónicas abiertas (F-14 y F-21).');

  // 9. Materiales con Bloqueos Reales (Docs 2 y 5)
  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-5 days'))`,
    [obraMap['Cercado Potrero Yeguas'], 'Varengas de madera tratada', 90.0, 40.0, 50.0, 'pza'] // DÉFICIT 50 (ATRASADO)
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    [obraMap['Cercado Potrero Yeguas'], 'Postes de concreto 2.5m reforzado', 80.0, 60.0, 20.0, 'pza'] // DÉFICIT 20 (SIN FECHA)
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '+2 days'))`,
    [obraMap['Desmonte Santa Teresita'], 'Diésel UBA para Maquinaria', 2000.0, 800.0, 1200.0, 'litros']
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '+4 days'))`,
    [obraMap['Siembra clúster Mangos'], 'Fertilizante Triple 16', 150.0, 150.0, 0.0, 'bultos'] // ABASTECIDO
  );
  console.log('📦 Materiales e insumos creados con faltantes y estado de ETA.');

  // 10. Mediciones Oficiales de Dron vs Campo (Docs 2 y 5)
  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-2 days'), 'dron', 'https://storage.agrokool.com/dron/ortomosaico_teresita_2026.tif')`,
    [p1Id, 12.3] // Cifra oficial del DJI T70P para Santa Teresita (el campo estimaba 16 ha)
  );

  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-4 days'), 'dron', 'https://storage.agrokool.com/dron/ortomosaico_guayeme_2026.tif')`,
    [p1Id, 37.67] // Guayeme completado
  );

  // 11. Reportes Operativos Históricos de Muestra (Clúster Mangos y Guayeme)
  const rep1 = await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, hito_id, tarea_id, obra_id, recibido_en, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'), date('now', '-1 days'), 'Abner Díaz', 'Siembra en predios Cristina, Rach y Los Mangos con sembradora Case PRO 6', 'Jornada fluida, suelo con humedad óptima', 'confirmado', 0)`,
    ['uuid-rep-mangos-001', p1Id, hito2Id, t3Id, obraMap['Siembra clúster Mangos']]
  );
  const rep1Id = rep1.lastID;

  await db.run(`INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente) VALUES (?, ?, ?, ?, ?, ?, ?)`, [rep1Id, predioMap['Cristina'], 'siembra', 5.51, 'ha', 5.51, 'campo']);
  await db.run(`INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente) VALUES (?, ?, ?, ?, ?, ?, ?)`, [rep1Id, predioMap['Rach'], 'siembra', 1.83, 'ha', 1.83, 'campo']);
  await db.run(`INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente) VALUES (?, ?, ?, ?, ?, ?, ?)`, [rep1Id, predioMap['Los Mangos'], 'siembra', 10.47, 'ha', 10.47, 'campo']);

  await db.run(`INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`, [rep1Id, 'operador_tractor', 1]);
  await db.run(`INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`, [rep1Id, 'tecnico', 1]);
  await db.run(`INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`, [rep1Id, 'auxiliar', 2]);

  await db.run(
    `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [rep1Id, m1Id, 280.5, 288.5, 8.0, 65.0]
  );

  console.log('✅ Base de datos de AGROK poblada exitosamente con el catálogo oficial.');
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
