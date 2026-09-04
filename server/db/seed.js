const bcrypt = require('bcryptjs');
const { db, initDatabase } = require('./database');
const { createObraForumTopic } = require('../bot/bot');

async function seed() {
  console.log('🌱 Iniciando siembra y estructuración integral de datos de AGROKOOL...');
  await initDatabase();

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('demo123', saltRounds);

  // 1. Limpieza de tablas operativas para reseteo limpio (dejando catálogos base estructurados)
  await db.run('DELETE FROM lectura_activo_fijo');
  await db.run('DELETE FROM activo_fijo');
  await db.run('DELETE FROM reporte_foto');
  await db.run('DELETE FROM medicion');
  await db.run('DELETE FROM material');
  await db.run('DELETE FROM incidencia');
  await db.run('DELETE FROM lectura_maquina');
  await db.run('DELETE FROM reporte_cuadrilla');
  await db.run('DELETE FROM reporte_linea');
  await db.run('DELETE FROM reporte');
  await db.run('DELETE FROM obra_predio');
  await db.run('DELETE FROM obra');
  await db.run('DELETE FROM tarea');
  await db.run('DELETE FROM hito');
  await db.run('DELETE FROM proyecto');
  await db.run('DELETE FROM maquina');
  await db.run('DELETE FROM entidad');
  await db.run('DELETE FROM predio');
  await db.run('DELETE FROM usuario');
  try {
    await db.run("DELETE FROM sqlite_sequence");
  } catch (e) {}

  console.log('🧹 Tablas anteriores limpiadas correctamente.');

  // 2. Catálogo Oficial de Usuarios con PIN de acceso rápido (Docs 1 y 4)
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
  console.log('👤 5 Usuarios oficiales registrados con PIN (campo: 1234, supervisor: 2345, direccion: 3456, IT: 9999, maquinaria: 5678).');

  const supervisorId = userMap['sup_user'];

  // 3. Catálogo Canónico de Entidades (Aspromex y Agrokool)
  await db.run("INSERT INTO entidad (nombre, tipo, contacto) VALUES ('Aspromex', 'empresa', 'Corporativo Aspromex')");
  await db.run("INSERT INTO entidad (nombre, tipo, contacto) VALUES ('Agrokool', 'empresa', 'Dirección General Agrokool')");
  await db.run("INSERT INTO entidad (nombre, tipo, contacto) VALUES ('Particular / Tercero', 'externo', 'Arrendatarios de Zona')");
  const aspromex = await db.get("SELECT id FROM entidad WHERE nombre = 'Aspromex'");
  const agrokool = await db.get("SELECT id FROM entidad WHERE nombre = 'Agrokool'");

  // 4. Catálogo de Maquinaria Real de AGROKOOL y Aspromex (Docs 5)
  // Puma con 288.5h para disparar la alerta preventiva de 300h (<= 20h)
  const m1 = await db.run(
    `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TRACTOR-PUMA-01', 'Puma CASE IH 155', 'tractor', 'CASE IH Puma 155 CVX', aspromex.id, agrokool.id, 300, 288.5, 0.0, 1]
  );
  const m1Id = m1.lastID;

  const m2 = await db.run(
    `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['BULLDOZER-CAT-D6', 'Bulldozer Caterpillar D6', 'bulldozer', 'Caterpillar D6T XL', agrokool.id, agrokool.id, 500, 1420.0, 1250.0, 0]
  );
  const m2Id = m2.lastID;

  const m3 = await db.run(
    `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['RETRO-NEW-HOLLAND', 'Retroexcavadora New Holland (Alfredo)', 'retroexcavadora', 'New Holland B95B', agrokool.id, agrokool.id, 300, 286.5, 0.0, 1]
  );
  const m3Id = m3.lastID;

  const m4 = await db.run(
    `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['DRON-AGRAS-T70P', 'Dron Agrícola DJI Agras T70P (Abner)', 'dron', 'DJI Agras T70P', agrokool.id, agrokool.id, 100, 45.0, 0.0, 0]
  );
  const m4Id = m4.lastID;

  const m5 = await db.run(
    `INSERT INTO maquina (codigo, nombre, tipo, modelo, propietaria_id, operadora_id, umbral_servicio_hrs, horometro_actual, ultimo_servicio_hr, alerta_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['SEMBRADORA-CASE-PRO6', 'Sembradora Case PRO 6 Hileras', 'sembradora', 'Case IH Early Riser 2150', agrokool.id, agrokool.id, 250, 62.0, 0.0, 0]
  );
  const m5Id = m5.lastID;

  console.log('🚜 5 Equipos de Maquinaria registrados (Tractor Puma y Retroexcavadora con alerta preventiva activa de 300 hrs).');

  // 5. Catálogo Oficial de Predios de Campeche (Polígonos GeoJSON)
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
  console.log(`🗺️ ${prediosData.length} Predios del Catálogo Oficial registrados.`);

  // 6. Proyectos Dedicados para CADA Predio y Clúster Operativo
  const proyectosData = [
    {
      key: 'guayeme',
      nombre: 'Maíz Guayeme 2026',
      tipo: 'maiz',
      ciclo: 'Ciclo PV 2026',
      supMeta: 37.67,
      fase: 'Siembra y Manejo Fitosanitario',
      inicio: '2026-03-01',
      fin: '2026-10-31',
      obraNombre: 'Maíz Guayeme',
      faseObra: 'monitoreo y control de plaga',
      estadoObra: 'operacion',
      predios: ['Guayeme'],
      defaultThread: '101'
    },
    {
      key: 'teresita',
      nombre: 'Desmonte Santa Teresita 2026',
      tipo: 'habilitacion',
      ciclo: 'Ciclo 2026',
      supMeta: 450.0,
      fase: 'Despalme y Habilitación',
      inicio: '2026-02-15',
      fin: '2026-11-30',
      obraNombre: 'Desmonte Santa Teresita',
      faseObra: 'despalme con retro',
      estadoObra: 'operacion',
      predios: ['Santa Teresita'],
      defaultThread: '102'
    },
    {
      key: 'mangos',
      nombre: 'Clúster Mangos 2026',
      tipo: 'maiz',
      ciclo: 'Ciclo PV 2026',
      supMeta: 19.81,
      fase: 'Siembra y Fertilización',
      inicio: '2026-03-10',
      fin: '2026-10-15',
      obraNombre: 'Siembra Clúster Mangos',
      faseObra: 'siembra y fumigacion',
      estadoObra: 'operacion',
      predios: ['Los Mangos', 'Rach', 'Cristina'],
      defaultThread: '103'
    },
    {
      key: 'san_alberto',
      nombre: 'Riego y Granos San Alberto 2026',
      tipo: 'maiz',
      ciclo: 'Ciclo 2026',
      supMeta: 11.04,
      fase: 'Riego y Siembra',
      inicio: '2026-03-01',
      fin: '2026-09-30',
      obraNombre: 'Maíz San Alberto',
      faseObra: 'post-siembra y fertirriego',
      estadoObra: 'operacion',
      predios: ['San Alberto'],
      defaultThread: '104'
    },
    {
      key: 'san_luis',
      nombre: 'Preparación y Granos San Luis 2026',
      tipo: 'maiz',
      ciclo: 'Ciclo 2026',
      supMeta: 16.03,
      fase: 'Preparación de Suelos',
      inicio: '2026-04-01',
      fin: '2026-11-15',
      obraNombre: 'San Luis',
      faseObra: 'siembra pospuesta por lluvia',
      estadoObra: 'standby',
      predios: ['San Luis'],
      defaultThread: '105'
    },
    {
      key: 'jabin',
      nombre: 'Reforestación y Conservación Parque Jabin',
      tipo: 'reforestacion',
      ciclo: 'Ciclo 2026',
      supMeta: 80.0,
      fase: 'Mantenimiento y Brechas Cortafuego',
      inicio: '2026-01-15',
      fin: '2026-12-31',
      obraNombre: 'Reforestación Jabin',
      faseObra: 'mantenimiento forestal',
      estadoObra: 'operacion',
      predios: ['Parque Jabin'],
      defaultThread: '106'
    },
    {
      key: 'potrero',
      nombre: 'Infraestructura Ganadera Potrero Yeguas',
      tipo: 'ganaderia',
      ciclo: 'Anual 2026',
      supMeta: 120.0,
      fase: 'Cercado y Corrales',
      inicio: '2026-02-01',
      fin: '2026-12-15',
      obraNombre: 'Cercado Potrero Yeguas',
      faseObra: 'cercado y corral',
      estadoObra: 'operacion',
      predios: ['Potrero Yeguas'],
      defaultThread: '107'
    },
    {
      key: 'asuncion',
      nombre: 'Habilitación Agrícola La Asunción 2026',
      tipo: 'sorgo',
      ciclo: 'Ciclo 2026',
      supMeta: 140.0,
      fase: 'Desmonte Liviano y Nivelación',
      inicio: '2026-03-15',
      fin: '2026-11-30',
      obraNombre: 'Habilitación La Asunción',
      faseObra: 'nivelacion y surcado',
      estadoObra: 'operacion',
      predios: ['La Asunción'],
      defaultThread: '108'
    },
    {
      key: 'san_pedro',
      nombre: 'Prospección y Topografía San Pedro 2026',
      tipo: 'prospeccion',
      ciclo: 'Ciclo 2026',
      supMeta: 180.41,
      fase: 'Trazo Topográfico y Drenajes',
      inicio: '2026-02-01',
      fin: '2026-08-31',
      obraNombre: 'Prospección San Pedro',
      faseObra: 'trazo y drenajes',
      estadoObra: 'operacion',
      predios: ['San Pedro'],
      defaultThread: '109'
    }
  ];

  const projMap = {};
  const obraMap = {};

  console.log('📡 Creando Proyectos, Frentes y verificando temas en el Supergrupo de Telegram...');

  for (const pd of proyectosData) {
    const pRes = await db.run(
      `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pd.nombre, pd.tipo, pd.ciclo, pd.supMeta, pd.fase, supervisorId, pd.inicio, pd.fin]
    );
    const projId = pRes.lastID;
    projMap[pd.key] = projId;

    // Intentar crear/vincular el tema real en Telegram Supergrupo
    let threadId = pd.defaultThread;
    try {
      const tgThread = await createObraForumTopic(pd.obraNombre, pd.nombre, pd.predios);
      if (tgThread) {
        threadId = String(tgThread);
      }
    } catch (tgErr) {
      console.warn(`⚠️ No se pudo crear tema en Telegram para "${pd.obraNombre}": ${tgErr.message}. Usando thread ID: ${threadId}`);
    }

    const oRes = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?)`,
      [pd.obraNombre, projId, pd.faseObra, pd.estadoObra, threadId]
    );
    const obraId = oRes.lastID;
    obraMap[pd.obraNombre] = obraId;

    // Relación Obra - Predios
    for (const pName of pd.predios) {
      if (predioMap[pName]) {
        await db.run(`INSERT INTO obra_predio (obra_id, predio_id) VALUES (?, ?)`, [obraId, predioMap[pName]]);
      }
    }

    console.log(`  ✅ [${pd.nombre}] ➔ Frente: "${pd.obraNombre}" (Thread Telegram: #${threadId}, Predios: ${pd.predios.join(', ')})`);
  }

  // 7. Estructura WBS: Hitos y Tareas Operativas para cada Proyecto
  console.log('📋 Generando Estructura de Desglose de Trabajo (Hitos y Tareas)...');

  // Proyecto Guayeme
  const hGuayeme1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['guayeme'], 'Hito 1: Preparación y Subsoleo Profundo', 'Subsoleo y rastreo de predio Guayeme', 1, '2026-04-30', 37.67, 'completado'])).lastID;
  const hGuayeme2 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['guayeme'], 'Hito 2: Siembra Mecanizada e Inoculación', 'Siembra con Tractor Puma y Case Early Riser', 2, '2026-06-15', 37.67, 'en_proceso'])).lastID;
  const hGuayeme3 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['guayeme'], 'Hito 3: Manejo Fitosanitario y Control Cogollero', 'Fumigación con Dron DJI Agras T70P', 3, '2026-08-30', 37.67, 'en_proceso'])).lastID;

  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hGuayeme1, projMap['guayeme'], predioMap['Guayeme'], 'Subsoleo y Rastreo Profundo', 'subsoleo', 'ha', 37.67, 37.67, 'completada', 'Abner Díaz']);
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hGuayeme2, projMap['guayeme'], predioMap['Guayeme'], 'Siembra Mecanizada Puma', 'siembra', 'ha', 37.67, 25.0, 'en_progreso', 'Abner Díaz']);
  const tFumigacionGuayeme = (await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hGuayeme3, projMap['guayeme'], predioMap['Guayeme'], 'Fumigación y Control Fitosanitario Lote 1', 'fumigacion', 'ha', 37.67, 15.0, 'en_progreso', 'Abner Díaz'])).lastID;

  // Proyecto Santa Teresita
  const hTeresita1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['teresita'], 'Hito 1: Despalme y Desmonte Mecánico', 'Desmonte de monte alto y medio', 1, '2026-06-30', 150.0, 'en_proceso'])).lastID;
  const hTeresita2 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['teresita'], 'Hito 2: Subsoleo Pesado y Despedregado', 'Remoción de piedras y rastra pesada', 2, '2026-09-30', 150.0, 'pendiente'])).lastID;

  const tDespalmeTeresita = (await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hTeresita1, projMap['teresita'], predioMap['Santa Teresita'], 'Despalme con Retroexcavadora New Holland', 'despalme', 'ha', 150.0, 12.3, 'en_progreso', 'Beche Dorantes'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hTeresita1, projMap['teresita'], predioMap['Santa Teresita'], 'Rastreo y Apile Bulldozer D6', 'desmonte', 'ha', 150.0, 5.0, 'en_progreso', 'Beche Dorantes']);

  // Proyecto Clúster Mangos
  const hMangos1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['mangos'], 'Hito 1: Siembra Conjunta Clúster Mangos', 'Siembra en predios Cristina, Rach y Los Mangos', 1, '2026-07-15', 19.81, 'en_proceso'])).lastID;
  const hMangos2 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['mangos'], 'Hito 2: Fertilización de Cobertura', 'Aplicación Triple 16', 2, '2026-08-15', 19.81, 'en_proceso'])).lastID;

  const tSiembraMangos = (await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hMangos1, projMap['mangos'], predioMap['Los Mangos'], 'Siembra Mecanizada Case PRO 6', 'siembra', 'ha', 19.81, 17.81, 'en_progreso', 'Abner Díaz'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hMangos2, projMap['mangos'], predioMap['Cristina'], 'Aplicación Fertilizante Triple 16', 'fertilizacion', 'ha', 19.81, 19.81, 'completada', 'Abner Díaz']);

  // Proyecto San Alberto
  const hSanAlberto1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['san_alberto'], 'Hito 1: Habilitación de Pozo y Tubería', 'Revisión electromecánica bomba sumergible', 1, '2026-04-15', 11.04, 'completado'])).lastID;
  const hSanAlberto2 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['san_alberto'], 'Hito 2: Siembra Bajo Riego', 'Siembra y fertirriego por aspersión', 2, '2026-06-30', 11.04, 'en_proceso'])).lastID;

  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hSanAlberto1, projMap['san_alberto'], predioMap['San Alberto'], 'Mantenimiento Bomba Pozo #2', 'riego', 'ha', 11.04, 11.04, 'completada', 'Beche Dorantes']);
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hSanAlberto2, projMap['san_alberto'], predioMap['San Alberto'], 'Siembra e Inoculación Bajo Riego', 'siembra', 'ha', 11.04, 6.0, 'en_progreso', 'Abner Díaz']);

  // Proyecto San Luis
  const hSanLuis1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['san_luis'], 'Hito 1: Rastreo Pesado y Despedregado', 'Preparación de cama de siembra', 1, '2026-05-31', 16.03, 'pendiente'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hSanLuis1, projMap['san_luis'], predioMap['San Luis'], 'Rastreo Pesado con Tractor Puma', 'rastreo', 'ha', 16.03, 0.0, 'pendiente', 'Abner Díaz']);

  // Proyecto Parque Jabin
  const hJabin1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['jabin'], 'Hito 1: Brechas Cortafuego y Desmalece', 'Mantenimiento de perímetro forestal', 1, '2026-05-30', 80.0, 'en_proceso'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hJabin1, projMap['jabin'], predioMap['Parque Jabin'], 'Limpieza de Brechas Cortafuego', 'mantenimiento', 'ha', 80.0, 35.0, 'en_progreso', 'Karen García']);
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hJabin1, projMap['jabin'], predioMap['Parque Jabin'], 'Inspección de Veleta y Lindero Norte', 'mantenimiento', 'ha', 80.0, 80.0, 'completada', 'Beche Dorantes']);

  // Proyecto Potrero Yeguas
  const hPotrero1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['potrero'], 'Hito 1: Cercado Perimetral y Corrales', 'Colocación de postes y varengas', 1, '2026-06-30', 120.0, 'bloqueado'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hPotrero1, projMap['potrero'], predioMap['Potrero Yeguas'], 'Posteo y Colocación de Varengas', 'cercado', 'ha', 120.0, 40.0, 'detenida', 'Karen García']);
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hPotrero1, projMap['potrero'], predioMap['Potrero Yeguas'], 'Construcción de Bebederos y Presa', 'cercado', 'ha', 120.0, 10.0, 'detenida', 'Beche Dorantes']);

  // Proyecto La Asunción
  const hAsuncion1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['asuncion'], 'Hito 1: Desmonte Liviano y Nivelación', 'Habilitación para cultivo de sorgo', 1, '2026-07-31', 140.0, 'en_proceso'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hAsuncion1, projMap['asuncion'], predioMap['La Asunción'], 'Nivelación Láser y Surcado', 'subsoleo', 'ha', 140.0, 20.0, 'en_progreso', 'Abner Díaz']);

  // Proyecto San Pedro
  const hSanPedro1 = (await db.run(`INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projMap['san_pedro'], 'Hito 1: Trazo Topográfico y Drenajes', 'Levantamiento de curvas de nivel', 1, '2026-06-15', 180.41, 'en_proceso'])).lastID;
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hSanPedro1, projMap['san_pedro'], predioMap['San Pedro'], 'Vuelo de Dron Fotogrametría', 'fumigacion', 'ha', 180.41, 180.41, 'completada', 'Abner Díaz']);
  await db.run(`INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hSanPedro1, projMap['san_pedro'], predioMap['San Pedro'], 'Trazo de Canales de Drenaje', 'despalme', 'ha', 180.41, 30.0, 'en_progreso', 'Karen García']);

  // 8. Incidencias Canónicas (Docs 2 y 5) para probar el widget de Incidencias y cierre con causa raíz
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

  await db.run(
    `INSERT INTO incidencia (folio, tipo, obra_id, estado, abierta_en, causa_raiz)
     VALUES (?, ?, ?, ?, datetime('now', '-2 days'), NULL)`,
    ['INC-2026-003', 'Falta de agua en bebederos por corte en línea de conducción', obraMap['Cercado Potrero Yeguas'], 'abierta']
  );

  console.log('⚠️ 3 Incidencias operativas sembradas (F-14, F-21, INC-2026-003).');

  // 9. Materiales e Insumos para probar el widget 4 (Bloqueado por Material y Alertas de ETA)
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
    [obraMap['Siembra Clúster Mangos'], 'Fertilizante Triple 16', 150.0, 150.0, 0.0, 'bultos'] // ABASTECIDO
  );

  await db.run(
    `INSERT INTO material (obra_id, nombre, requerido, en_sitio, pedido, unidad, eta)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '+1 days'))`,
    [obraMap['Maíz Guayeme'], 'Semilla Híbrida Maíz DK-390', 40.0, 30.0, 10.0, 'sacos']
  );

  console.log('📦 Materiales e insumos registrados con control de faltantes y alertas de entrega.');

  // 10. Mediciones Oficiales de Dron vs Campo para Auditoría en Dirección
  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-2 days'), 'dron', 'https://storage.agrokool.com/dron/ortomosaico_teresita_2026.tif')`,
    [projMap['teresita'], 12.3] // Campo estimaba 16 ha -> Discrepancia detectable
  );

  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-4 days'), 'dron', 'https://storage.agrokool.com/dron/ortomosaico_guayeme_2026.tif')`,
    [projMap['guayeme'], 37.67] // Guayeme completado
  );

  await db.run(
    `INSERT INTO medicion (proyecto_id, hectareas, fecha, fuente, archivo_ruta)
     VALUES (?, ?, date('now', '-1 days'), 'dron', 'https://storage.agrokool.com/dron/ortomosaico_san_pedro_2026.tif')`,
    [projMap['san_pedro'], 180.41]
  );

  // 11. Reportes Operativos Históricos y Recientes
  // Rep 1: Clúster Mangos Multi-Predio con Tractor Puma
  const rep1 = await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, hito_id, tarea_id, obra_id, recibido_en, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'), date('now', '-1 days'), 'Abner Díaz', 'Siembra en predios Cristina, Rach y Los Mangos con sembradora Case PRO 6', 'Jornada fluida, suelo con humedad óptima', 'confirmado', 0)`,
    ['uuid-rep-mangos-001', projMap['mangos'], hMangos1, tSiembraMangos, obraMap['Siembra Clúster Mangos']]
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

  await db.run(
    `INSERT INTO reporte_foto (reporte_id, archivo_ruta, url, descripcion)
     VALUES (?, ?, ?, ?)`,
    [rep1Id, 'uploads/siembra_mangos_01.jpg', 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800', 'Siembra en línea con Case Early Riser']
  );

  // Rep 2: Paro Operativo por Lluvia con Hora Offline Registrada
  await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, obra_id, recibido_en, fecha_operativa, hora_offline, autor_nombre, texto_original, nota, estado, es_sin_actividad, motivo_sin_actividad)
     VALUES (?, ?, ?, datetime('now', '-2 days'), date('now', '-2 days'), '14:35', 'Abner Díaz', '/sin_actividad Lluvia torrencial en lote Santa Teresita', 'Paro de 2 retroexcavadoras por saturación de fango', 'confirmado', 1, 'Lluvia torrencial (precipitación 45mm)')`,
    ['uuid-rep-paro-002', projMap['teresita'], obraMap['Desmonte Santa Teresita']]
  );

  // Rep 3: Despalme Santa Teresita con Retroexcavadora New Holland
  const rep3 = await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, hito_id, tarea_id, obra_id, recibido_en, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-1 days'), date('now', '-1 days'), 'Beche Dorantes', 'Despalme de monte en Santa Teresita sector A', 'Avance conforme a lo programado', 'confirmado', 0)`,
    ['uuid-rep-teresita-003', projMap['teresita'], hTeresita1, tDespalmeTeresita, obraMap['Desmonte Santa Teresita']]
  );
  await db.run(`INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente) VALUES (?, ?, ?, ?, ?, ?, ?)`, [rep3.lastID, predioMap['Santa Teresita'], 'despalme', 12.3, 'ha', 12.3, 'campo']);
  await db.run(`INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel) VALUES (?, ?, ?, ?, ?, ?)`, [rep3.lastID, m3Id, 279.5, 286.5, 7.0, 55.0]);

  // Rep 4: Reporte en Borrador para Probar Autoconfirmación
  const repDraft = await db.run(
    `INSERT INTO reporte (client_uuid, proyecto_id, hito_id, tarea_id, obra_id, recibido_en, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
     VALUES (?, ?, ?, ?, ?, datetime('now', '-35 minutes'), date('now'), 'Abner Díaz', 'Fumigación foliar en Guayeme con Dron', 'Esperando confirmación interactiva', 'borrador', 0)`,
    ['uuid-rep-draft-004', projMap['guayeme'], hGuayeme3, tFumigacionGuayeme, obraMap['Maíz Guayeme']]
  );
  await db.run(`INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente) VALUES (?, ?, 'fumigacion', 15.0, 'ha', 15.0, 'campo')`, [repDraft.lastID, predioMap['Guayeme']]);

  // 12. Catálogo de Activos Fijos y Lecturas de Monitoreo (>30 días disparan alerta)
  const act1 = await db.run(
    `INSERT INTO activo_fijo (codigo, nombre, tipo, ubicacion, predio_id, obra_id, ultima_lectura_fecha, estado_operativo)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-35 days'), 'operativo')`,
    ['ACT-VELETA-01', 'Veleta Parque Jabin', 'veleta', 'Parque Jabin Sector Norte', predioMap['Parque Jabin'], obraMap['Reforestación Jabin']]
  );

  const act2 = await db.run(
    `INSERT INTO activo_fijo (codigo, nombre, tipo, ubicacion, predio_id, obra_id, ultima_lectura_fecha, estado_operativo)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-5 days'), 'operativo')`,
    ['ACT-BOMBA-01', 'Bomba Sumergible Pozo San Alberto', 'bomba', 'San Alberto Pozo #2', predioMap['San Alberto'], obraMap['Maíz San Alberto']]
  );

  const act3 = await db.run(
    `INSERT INTO activo_fijo (codigo, nombre, tipo, ubicacion, predio_id, obra_id, ultima_lectura_fecha, estado_operativo)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-12 days'), 'operativo')`,
    ['ACT-CISTERNA-01', 'Cisterna de Almacenamiento 10,000L', 'cisterna', 'Campamento Central Santa Teresita', predioMap['Santa Teresita'], obraMap['Desmonte Santa Teresita']]
  );

  const act4 = await db.run(
    `INSERT INTO activo_fijo (codigo, nombre, tipo, ubicacion, predio_id, obra_id, ultima_lectura_fecha, estado_operativo)
     VALUES (?, ?, ?, ?, ?, ?, date('now', '-42 days'), 'mantenimiento')`,
    ['ACT-CABANA-01', 'Cabaña y Bodega de Insumos', 'bodega', 'Base Operativa Guayeme', predioMap['Guayeme'], obraMap['Maíz Guayeme']]
  );

  // Registro de inspección para la bomba
  await db.run(
    `INSERT INTO lectura_activo_fijo (activo_fijo_id, fecha, inspeccionado_por, observaciones, estado_operativo)
     VALUES (?, date('now', '-5 days'), 'Abner Díaz', 'Presión de descarga normal (45 PSI), sin fugas en cople', 'operativo')`,
    [act2.lastID]
  );

  console.log('🏛️ 4 Activos Fijos registrados (Veleta y Cabaña con >30 días sin lectura para alerta matutina).');

  // 13. Sembrar Proyecto estructurado desde "Cronograma Maíz Mecanizado - Project.xlsx"
  const insertCronogramaProject = require('./insert_project_cronograma');
  await insertCronogramaProject();

  console.log('✅ Base de datos de AGROKOOL poblada exitosamente con proyectos dedicados por predio y frentes vinculados a Telegram.');
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
