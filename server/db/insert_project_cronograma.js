const { db, initDatabase } = require('./database');
const { createObraForumTopic } = require('../bot/bot');

async function insertCronogramaProject() {
  console.log('🌾 Insertando Proyecto estructurado desde "Cronograma Maíz Mecanizado - Project.xlsx"...');
  await initDatabase();

  // 1. Obtener supervisor y predio objetivo
  const supervisor = await db.get("SELECT id FROM usuario WHERE rol = 'supervisor' LIMIT 1");
  const supervisorId = supervisor ? supervisor.id : 1;

  let predio = await db.get("SELECT id, nombre, superficie_util_ha FROM predio WHERE nombre = 'Guayeme'");
  if (!predio) {
    predio = await db.get("SELECT id, nombre, superficie_util_ha FROM predio LIMIT 1");
  }
  const predioId = predio.id;
  const supMeta = predio.superficie_util_ha || 37.67;

  // 2. Crear Proyecto Principal
  const projNombre = 'Maíz Mecanizado (Cronograma Project)';
  const projTipo = 'maiz';
  const projCiclo = 'Ciclo PV 2026';
  const projFase = 'Fase 2: Preparación Mecanizada del Terreno';
  const fechaInicio = '2026-03-01';
  const fechaFin = '2026-06-26';

  // Verificar si ya existe para actualizar o insertar
  let proj = await db.get('SELECT id FROM proyecto WHERE nombre = ?', [projNombre]);
  let projId = null;

  if (proj) {
    projId = proj.id;
    await db.run(
      `UPDATE proyecto
       SET tipo = ?, ciclo = ?, superficie_meta_ha = ?, fase_catalogo = ?, gerente_id = ?, fecha_inicio = ?, fecha_fin = ?
       WHERE id = ?`,
      [projTipo, projCiclo, supMeta, projFase, supervisorId, fechaInicio, fechaFin, projId]
    );
    // Limpiar hitos y tareas anteriores de este proyecto para reconstruir limpiamente
    await db.run('DELETE FROM tarea WHERE proyecto_id = ?', [projId]);
    await db.run('DELETE FROM hito WHERE proyecto_id = ?', [projId]);
    console.log(`🔄 Proyecto existente [ID: ${projId}] actualizado con WBS nuevo.`);
  } else {
    const pRes = await db.run(
      `INSERT INTO proyecto (nombre, tipo, ciclo, superficie_meta_ha, fase_catalogo, gerente_id, fecha_inicio, fecha_fin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [projNombre, projTipo, projCiclo, supMeta, projFase, supervisorId, fechaInicio, fechaFin]
    );
    projId = pRes.lastID;
    console.log(`✨ Proyecto creado exitosamente [ID: ${projId}] "${projNombre}".`);
  }

  // 3. Crear o Vincular Frente (Obra)
  const obraNombre = 'Frente Maíz Mecanizado Project';
  let obra = await db.get('SELECT id, tg_thread_id FROM obra WHERE nombre = ?', [obraNombre]);
  let obraId = null;
  let threadId = '101';

  try {
    const newThread = await createObraForumTopic(obraNombre, projNombre, [predio.nombre]);
    if (newThread) threadId = String(newThread);
  } catch (e) {
    console.warn('⚠️ No se pudo crear tema en Telegram:', e.message);
  }

  if (obra) {
    obraId = obra.id;
    await db.run('UPDATE obra SET proyecto_id = ?, fase_actual = ?, estado = ? WHERE id = ?',
      [projId, 'preparacion mecanizada y siembra', 'operacion', obraId]);
  } else {
    const oRes = await db.run(
      `INSERT INTO obra (nombre, proyecto_id, fase_actual, estado, tg_thread_id)
       VALUES (?, ?, ?, ?, ?)`,
      [obraNombre, projId, 'preparacion mecanizada y siembra', 'operacion', threadId]
    );
    obraId = oRes.lastID;
    await db.run('INSERT OR IGNORE INTO obra_predio (obra_id, predio_id) VALUES (?, ?)', [obraId, predioId]);
  }

  console.log(`🏢 Frente "${obraNombre}" vinculado al Proyecto [ID: ${projId}] y Predio "${predio.nombre}".`);

  // 4. Inserción de las 6 Fases (Hitos) y sus 22 Tareas de acuerdo a "Cronograma Maíz Mecanizado - Project.xlsx"
  const wbsStructure = [
    {
      orden: 1,
      nombre: 'FASE 1: PLANIFICACIÓN Y ANÁLISIS',
      descripcion: 'Entregable: Plan de siembra aprobado y análisis físico-químico de suelo (Duración: 15 días)',
      fechaMeta: '2026-03-15',
      superficieMeta: supMeta,
      estado: 'completado',
      tareas: [
        {
          nombre: 'Muestreo y análisis de suelo físico-químico',
          actividad_id: 'muestreo',
          unidad: 'ha',
          meta: supMeta,
          acumulado: supMeta,
          estado: 'completada',
          responsable: 'Técnico Agrónomo'
        },
        {
          nombre: 'HITO: Plan de Fertilización y Presupuesto Aprobado',
          actividad_id: 'planificacion',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 1.0,
          estado: 'completada',
          responsable: 'Gerente Agrícola / Agrónomo'
        },
        {
          nombre: 'Adquisición de insumos (Semilla híbrida, fertilizantes, agroquímicos)',
          actividad_id: 'insumos',
          unidad: 'ha',
          meta: supMeta,
          acumulado: supMeta,
          estado: 'completada',
          responsable: 'Compras / Logística'
        }
      ]
    },
    {
      orden: 2,
      nombre: 'FASE 2: PREPARACIÓN MECANIZADA DEL TERRENO',
      descripcion: 'Entregable: Cama de siembra óptima a 40-50 cm (Duración: 16 días)',
      fechaMeta: '2026-04-05',
      superficieMeta: supMeta,
      estado: 'en_proceso',
      tareas: [
        {
          nombre: 'Subsoleo / Descompactación profunda (40-50 cm)',
          actividad_id: 'subsoleo',
          unidad: 'ha',
          meta: supMeta,
          acumulado: supMeta,
          estado: 'completada',
          responsable: 'Operador de Maquinaria (Tractor Puma)'
        },
        {
          nombre: 'Pase de arado de discos o vertedera',
          actividad_id: 'arado',
          unidad: 'ha',
          meta: supMeta,
          acumulado: supMeta,
          estado: 'completada',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'Pase de rastra pesada (rastreo primario)',
          actividad_id: 'rastreo',
          unidad: 'ha',
          meta: supMeta,
          acumulado: supMeta,
          estado: 'completada',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'Pase de rastra niveladora / afine',
          actividad_id: 'nivelacion',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 28.0,
          estado: 'en_progreso',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'HITO: Terreno Acondicionado para Siembra',
          actividad_id: 'inspeccion',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Agrónomo Residente'
        }
      ]
    },
    {
      orden: 3,
      nombre: 'FASE 3: SIEMBRA MECANIZADA Y ESTABLECIMIENTO',
      descripcion: 'Entregable: Lote sembrado con densidad calibrada de 60,000-75,000 plantas/ha (Duración: 7 días)',
      fechaMeta: '2026-04-12',
      superficieMeta: supMeta,
      estado: 'en_proceso',
      tareas: [
        {
          nombre: 'Siembra mecanizada y fertilización de fondo simultánea',
          actividad_id: 'siembra',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 15.0,
          estado: 'en_progreso',
          responsable: 'Operador de Sembradora (Case PRO 6)'
        },
        {
          nombre: 'HITO: Siembra Concluida y Calibración',
          actividad_id: 'siembra',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Gerente Agrícola'
        },
        {
          nombre: 'Aplicación de herbicida pre-emergente',
          actividad_id: 'fumigacion',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Aspersora (Dron Agras T70P)'
        }
      ]
    },
    {
      orden: 4,
      nombre: 'FASE 4: MANEJO AGRONÓMICO Y LABORES CULTURALES',
      descripcion: 'Entregable: Cultivo en floración óptima (R1) y llenado activo de espiga (Duración: 55 días)',
      fechaMeta: '2026-06-06',
      superficieMeta: supMeta,
      estado: 'pendiente',
      tareas: [
        {
          nombre: 'Monitoreo de germinación y evaluación de emergencia (V2)',
          actividad_id: 'monitoreo',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Agrónomo de Campo'
        },
        {
          nombre: 'Cultivada / Escarda mecánica y aporque temprano (V4-V6)',
          actividad_id: 'escarda',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'Fertilización nitrogenada complementaria en bandas (V6)',
          actividad_id: 'fertilizacion',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'Monitoreo y control fitosanitario (cogollero y plagas foliares)',
          actividad_id: 'fumigacion',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Aspersora / Dron DJI Agras T70P'
        },
        {
          nombre: 'HITO: Floración y Polinización Completada (R1)',
          actividad_id: 'monitoreo',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Agrónomo Residente'
        }
      ]
    },
    {
      orden: 5,
      nombre: 'FASE 5: COSECHA MECANIZADA Y LOGÍSTICA',
      descripcion: 'Entregable: Grano cosechado al 14-18% de humedad y entregado en silos (Duración: 14 días)',
      fechaMeta: '2026-06-20',
      superficieMeta: supMeta,
      estado: 'pendiente',
      tareas: [
        {
          nombre: 'Monitoreo de madurez fisiológica y humedad de grano (R6)',
          actividad_id: 'muestreo',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Agrónomo de Campo'
        },
        {
          nombre: 'HITO: Grano en Punto Óptimo de Cosecha',
          actividad_id: 'cosecha',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Gerente Agrícola'
        },
        {
          nombre: 'Cosecha mecanizada (Trilla y desgranado simultáneo)',
          actividad_id: 'cosecha',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Cosechadora'
        },
        {
          nombre: 'Acarreo y transporte a centro de acopio / silos',
          actividad_id: 'transporte',
          unidad: 'ton',
          meta: supMeta * 6.5, // Estimado 6.5 ton/ha
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Logística / Choferes'
        },
        {
          nombre: 'HITO: Cierre de Ciclo Productivo y Liquidación',
          actividad_id: 'cierre',
          unidad: 'pza',
          meta: 1.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Gerente de Operaciones'
        }
      ]
    },
    {
      orden: 6,
      nombre: 'FASE 6: POST-COSECHA Y ACONDICIONAMIENTO DE RASTROJO',
      descripcion: 'Entregable: Incorporación de materia orgánica y maquinaria en resguardo (Duración: 6 días)',
      fechaMeta: '2026-06-26',
      superficieMeta: supMeta,
      estado: 'pendiente',
      tareas: [
        {
          nombre: 'Desmenuzado / Triturado mecánico de rastrojo',
          actividad_id: 'triturado',
          unidad: 'ha',
          meta: supMeta,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Operador de Maquinaria'
        },
        {
          nombre: 'Mantenimiento mayor y lavado de maquinaria',
          actividad_id: 'mantenimiento',
          unidad: 'pza',
          meta: 5.0,
          acumulado: 0.0,
          estado: 'pendiente',
          responsable: 'Mecánico Agrícola (Beche Dorantes)'
        }
      ]
    }
  ];

  let totalTareas = 0;
  for (const hData of wbsStructure) {
    const hRes = await db.run(
      `INSERT INTO hito (proyecto_id, nombre, descripcion, orden, fecha_meta, superficie_meta_ha, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projId, hData.nombre, hData.descripcion, hData.orden, hData.fechaMeta, hData.superficieMeta, hData.estado]
    );
    const hitoId = hRes.lastID;

    for (const t of hData.tareas) {
      await db.run(
        `INSERT INTO tarea (hito_id, proyecto_id, predio_id, nombre, actividad_id, unidad, cantidad_meta, cantidad_acumulada, estado, responsable)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hitoId, projId, predioId, t.nombre, t.actividad_id, t.unidad, t.meta, t.acumulado, t.estado, t.responsable]
      );
      totalTareas++;
    }
    console.log(`  📌 ${hData.nombre} (${hData.tareas.length} tareas registradas)`);
  }

  console.log(`\n🎉 PROYECTO MAÍZ MECANIZADO INYECTADO CON ÉXITO:`);
  console.log(`   • Proyecto: ${projNombre} (ID: ${projId})`);
  console.log(`   • Frente: ${obraNombre} (ID: ${obraId})`);
  console.log(`   • Predio: ${predio.nombre} (${supMeta} ha)`);
  console.log(`   • Hitos (Fases): ${wbsStructure.length}`);
  console.log(`   • Tareas Operativas: ${totalTareas}`);
  console.log(`   • Duración Total: 113 días (${fechaInicio} ➔ ${fechaFin})\n`);

  return { projId, obraId, predioId, totalFases: wbsStructure.length, totalTareas };
}

if (require.main === module) {
  insertCronogramaProject()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error al insertar cronograma:', err);
      process.exit(1);
    });
}

module.exports = insertCronogramaProject;
