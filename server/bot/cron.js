const cron = require('node-cron');
const { db } = require('../db/database');
const { sendTopicMessage, generateTableroText, generateProyectosTareasText, getBotInstance } = require('./bot');

const TIMEZONE = process.env.TIMEZONE || 'America/Merida';

/**
 * 1. Reclamo de las 21:00: Avisar a cada obra en operación que no haya reportado hoy
 */
async function runEveningCheck() {
  console.log('⏰ Ejecutando cron de las 21:00: Verificación de obras sin reporte...');
  const today = new Date().toISOString().split('T')[0];
  const bot = getBotInstance();
  const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;

  try {
    const activeObras = await db.all("SELECT id, nombre, tg_thread_id FROM obra WHERE estado = 'operacion'");
    const sinReporte = [];

    for (const o of activeObras) {
      const rep = await db.get('SELECT id FROM reporte WHERE obra_id = ? AND fecha_operativa = ?', [o.id, today]);
      if (!rep) {
        sinReporte.push(o);

        // Si la obra tiene un tema específico en Telegram, enviar aviso directo a su tema
        if (bot && supergroupId && o.tg_thread_id) {
          const threadMsg = `🔴 *AVISO OPERATIVO DE LAS 21:00*\n` +
                            `🏢 *Frente:* ${o.nombre}\n\n` +
                            `⚠️ No se ha registrado reporte de actividades para el día de hoy (\`${today}\`).\n\n` +
                            `Por favor envía tu reporte o declara:\n` +
                            `• \`/sin_actividad [motivo]\` (ej. por lluvia o paro)\n` +
                            `• O pulsa *🚀 ABRIR MINI APP*`;

          bot.sendMessage(supergroupId, threadMsg, {
            parse_mode: 'Markdown',
            message_thread_id: parseInt(o.tg_thread_id, 10)
          }).catch(e => console.warn(`Aviso cron 21:00 para ${o.nombre}:`, e.message));
        }
      }
    }

    // Si hay obras sin reporte, enviar consolidado al tema #Reportes
    if (sinReporte.length > 0) {
      let repMsg = `🔴 *CORTE 21:00 · FRENTES SIN REPORTE HOY (${sinReporte.length}):*\n\n`;
      sinReporte.forEach(o => repMsg += `• *${o.nombre}*\n`);
      repMsg += `\n_Se requiere reporte de jornada o declaración de /sin_actividad._`;
      await sendTopicMessage('reportes', repMsg);
    }

    console.log(`✅ Cron 21:00 finalizado. Obras pendientes: ${sinReporte.length}`);
    return { success: true, pendingCount: sinReporte.length, obras: sinReporte.map(o => o.nombre) };
  } catch (err) {
    console.error('Error en cron 21:00:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 2. Corte de las 21:30: Publicar y fijar el Tablero de Control Oficial en #Tablero
 */
async function runNightlyTablero() {
  console.log('⏰ Ejecutando cron de las 21:30: Corte oficial del Tablero de Control...');
  try {
    const tableroTxt = await generateTableroText();
    const sentMsg = await sendTopicMessage('tablero', tableroTxt);

    // Intentar fijar el mensaje en el canal/tema del Tablero si el bot es admin
    const bot = getBotInstance();
    const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;
    if (bot && supergroupId && sentMsg?.message_id) {
      bot.pinChatMessage(supergroupId, sentMsg.message_id).catch(() => {});
    }

    console.log('✅ Cron 21:30 finalizado. Tablero publicado con éxito.');
    return { success: true, text: tableroTxt };
  } catch (err) {
    console.error('Error en cron 21:30:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. Alertas Matutinas 08:00: Seguimiento de incidencias abiertas y maquinaria en alerta 300h
 */
async function runMorningAlerts() {
  console.log('⏰ Ejecutando cron de las 08:00: Alertas matutinas de mantenimiento e incidencias...');
  try {
    // 1. Incidencias en verificación o abiertas > 3 días
    const incs = await db.all(`
      SELECT i.folio, i.tipo, i.estado, i.abierta_en, o.nombre AS obra_nombre,
             CAST((julianday('now') - julianday(i.abierta_en)) AS INTEGER) AS dias_abierta
      FROM incidencia i
      JOIN obra o ON i.obra_id = o.id
      WHERE i.estado != 'cerrada'
    `);

    if (incs.length > 0) {
      let incMsg = `🌅 *SEGUIMIENTO MATUTINO DE INCIDENCIAS (08:00)*\n\n`;
      incs.forEach(i => {
        incMsg += `• *\`${i.folio}\`* [${i.estado.toUpperCase()}] ➔ *${i.dias_abierta} días* en ${i.obra_nombre} (${i.tipo})\n`;
      });
      incMsg += `\n_Para cerrar formalmente:_ \`/cerrar [folio] [causa_raiz]\``;
      await sendTopicMessage('incidencias', incMsg);
    }

    // 2. Maquinaria próxima a servicio preventivo (280h+)
    const maqsAlert = await db.all(`
      SELECT codigo, modelo, horometro_actual, ultimo_servicio_hr
      FROM maquina
      WHERE (horometro_actual - ultimo_servicio_hr) >= 280
    `);

    if (maqsAlert.length > 0) {
      let maqMsg = `🚜 *ALERTA DE MANTENIMIENTO PREVENTIVO 300H (08:00)*\n\n`;
      maqsAlert.forEach(m => {
        const hrsRestantes = Math.max(0, 300 - (m.horometro_actual - m.ultimo_servicio_hr));
        maqMsg += `• *\`${m.codigo}\`* (${m.modelo}): *${m.horometro_actual} hrs* acumuladas ➔ Faltan *${hrsRestantes.toFixed(1)} hrs* para servicio obligatorio.\n`;
      });
      maqMsg += `\n_Por favor coordinar lubricación y cambio de filtros con Beche / Taller._`;
      await sendTopicMessage('tablero', maqMsg);
    }

    // 3. Activos Fijos sin lectura por más de 30 días (Plan Maestro §4.4 y §3.4)
    const activosSinLectura = await db.all(`
      SELECT codigo, nombre, tipo, ubicacion, ultima_lectura_fecha,
             CAST((julianday('now') - julianday(COALESCE(ultima_lectura_fecha, '2026-01-01'))) AS INTEGER) AS dias_sin_lectura
      FROM activo_fijo
      WHERE ultima_lectura_fecha IS NULL OR ultima_lectura_fecha < date('now', '-30 days')
    `);

    if (activosSinLectura.length > 0) {
      let actMsg = `🏛️ *ALERTA DE SUPERVISIÓN: ACTIVOS FIJOS SIN REVISIÓN > 30 DÍAS (08:00)*\n\n`;
      activosSinLectura.forEach(a => {
        actMsg += `• *\`${a.codigo}\`* (${a.nombre}): *${a.dias_sin_lectura} días* sin inspección en *${a.ubicacion}* (Última: ${a.ultima_lectura_fecha || 'Nunca'})\n`;
      });
      actMsg += `\n_Se requiere registro de inspección de estado operativo (Veleta, Bombas, Cisternas, Bodegas)._`;
      await sendTopicMessage('tablero', actMsg);
    }

    console.log('✅ Cron 08:00 finalizado.');
    return { success: true, incidenciasCount: incs.length, maqsAlertCount: maqsAlert.length, activosAlertCount: activosSinLectura.length };
  } catch (err) {
    console.error('Error en cron 08:00:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. Reporte Diario General de Proyectos y Tareas (07:30 diario)
 * Publica el estado de tareas y proyectos en curso en el tema #General del grupo
 */
async function runDailyGeneralReport() {
  console.log('⏰ Ejecutando cron diario: Reporte General de Proyectos y Tareas en curso...');
  try {
    const generalTxt = await generateProyectosTareasText();
    await sendTopicMessage('general', generalTxt);
    console.log('✅ Cron Reporte General de Proyectos finalizado y publicado en el tema General.');
    return { success: true, text: generalTxt };
  } catch (err) {
    console.error('Error en cron general diario:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 5. Autoconfirmación a los 30 Minutos (Plan Maestro §1.4 y §3.3)
 * Si un reporte en estado 'borrador' supera los 30 minutos desde su recepción en el servidor,
 * se confirma automáticamente con la marca 'auto' y se notifica al tema #Reportes.
 */
async function runAutoConfirmDrafts() {
  try {
    const expiredDrafts = await db.all(`
      SELECT r.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre
      FROM reporte r
      LEFT JOIN obra o ON r.obra_id = o.id
      LEFT JOIN proyecto p ON r.proyecto_id = p.id
      WHERE r.estado = 'borrador'
        AND r.recibido_en <= datetime('now', '-30 minutes')
    `);

    if (expiredDrafts.length === 0) return { confirmed: 0 };

    console.log(`⏰ Autoconfirmando ${expiredDrafts.length} reporte(s) en borrador con más de 30 minutos...`);

    for (const draft of expiredDrafts) {
      // 1. Actualizar estado a confirmado con nota de autoconfirmación
      await db.run(`
        UPDATE reporte
        SET estado = 'confirmado',
            nota = COALESCE(nota, '') || ' [Autoconfirmado automáticamente por sistema tras 30 min (marca auto)]'
        WHERE id = ?
      `, [draft.id]);

      // 2. Obtener líneas, cuadrilla y fotos para notificar al tema #Reportes
      const lineas = await db.all(`
        SELECT rl.*, pr.nombre AS predio_nombre
        FROM reporte_linea rl
        LEFT JOIN predio pr ON rl.predio_id = pr.id
        WHERE rl.reporte_id = ?
      `, [draft.id]);

      const cuadrilla = await db.all(`
        SELECT * FROM reporte_cuadrilla WHERE reporte_id = ?
      `, [draft.id]);

      const maquinaria = await db.all(`
        SELECT lm.*, m.codigo, m.modelo
        FROM lectura_maquina lm
        JOIN maquina m ON lm.maquina_id = m.id
        WHERE lm.reporte_id = ?
      `, [draft.id]);

      const { notifyReporte } = require('./bot');
      await notifyReporte({
        obraNombre: draft.obra_nombre,
        proyectoNombre: draft.proyecto_nombre,
        fechaOperativa: draft.fecha_operativa,
        horaOffline: draft.hora_offline,
        autorNombre: `${draft.autor_nombre} (auto)`,
        esSinActividad: draft.es_sin_actividad === 1,
        motivoSinActividad: draft.motivo_sin_actividad,
        lineas,
        cuadrilla,
        maquinaria,
        clientUuid: draft.client_uuid
      });
    }

    return { confirmed: expiredDrafts.length };
  } catch (err) {
    console.error('Error en runAutoConfirmDrafts:', err);
    return { error: err.message };
  }
}

/**
 * Inicializar todos los Cron Jobs programados
 */
function initScheduler() {
  console.log(`🕒 Inicializando planificador de tareas Cron (Zona horaria: ${TIMEZONE})...`);

  // 1. Reporte General de Proyectos y Tareas a las 07:30 diario
  cron.schedule('30 7 * * *', () => {
    runDailyGeneralReport();
  }, { timezone: TIMEZONE });

  // 2. Alertas matutinas a las 08:00 diario (incidencias, maquinaria 300h, activos fijos 30d)
  cron.schedule('0 8 * * *', () => {
    runMorningAlerts();
  }, { timezone: TIMEZONE });

  // 3. Reclamo de las 21:00 diario
  cron.schedule('0 21 * * *', () => {
    runEveningCheck();
  }, { timezone: TIMEZONE });

  // 4. Corte del Tablero a las 21:30 diario
  cron.schedule('30 21 * * *', () => {
    runNightlyTablero();
  }, { timezone: TIMEZONE });

  // 5. Verificación de autoconfirmación de reportes cada 5 minutos (Plan Maestro §1.4)
  cron.schedule('*/5 * * * *', () => {
    runAutoConfirmDrafts();
  }, { timezone: TIMEZONE });

  console.log('✅ Programador Cron activo: [07:30 General] · [08:00 Alertas Matutinas] · [21:00 Reclamos] · [21:30 Tablero] · [*/5 Autoconfirm 30m]');
}

module.exports = {
  initScheduler,
  runEveningCheck,
  runNightlyTablero,
  runMorningAlerts,
  runDailyGeneralReport,
  runAutoConfirmDrafts
};
