const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { parseFreeTextReport, KNOWN_PREDIOS } = require('./parser');

let botInstance = null;

/**
 * Función para enviar mensajes a un tema específico del supergrupo
 * @param {'reportes' | 'incidencias' | 'tablero' | 'general'} topicKey
 * @param {string} text
 * @param {object} extraOptions
 */
async function sendTopicMessage(topicKey, text, extraOptions = {}) {
  if (!botInstance) return null;

  const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;
  if (!supergroupId) return null;

  let threadId = null;
  if (topicKey === 'reportes' && process.env.TELEGRAM_THREAD_REPORTES) {
    threadId = parseInt(process.env.TELEGRAM_THREAD_REPORTES, 10);
  } else if (topicKey === 'incidencias' && process.env.TELEGRAM_THREAD_INCIDENCIAS) {
    threadId = parseInt(process.env.TELEGRAM_THREAD_INCIDENCIAS, 10);
  } else if (topicKey === 'tablero' && process.env.TELEGRAM_THREAD_TABLERO) {
    threadId = parseInt(process.env.TELEGRAM_THREAD_TABLERO, 10);
  }

  const sendOptions = {
    parse_mode: 'Markdown',
    ...(threadId ? { message_thread_id: threadId } : {}),
    ...extraOptions
  };

  try {
    return await botInstance.sendMessage(supergroupId, text, sendOptions);
  } catch (err) {
    console.warn(`⚠️ Error al enviar mensaje al tema [${topicKey}]:`, err.message);
    return null;
  }
}

/**
 * Notificar un nuevo reporte al tema #Reportes
 */
async function notifyReporte(reportData) {
  const {
    obraNombre,
    proyectoNombre,
    fechaOperativa,
    autorNombre,
    esSinActividad,
    motivoSinActividad,
    lineas = [],
    cuadrilla = [],
    maquinaria = [],
    clientUuid
  } = reportData;

  if (esSinActividad) {
    const text = `🌧️ *DÍA SIN ACTIVIDAD REPORTADO*\n\n` +
                 `🏢 *Obra:* ${obraNombre || 'General'}\n` +
                 `🌾 *Proyecto:* ${proyectoNombre || 'Maíz 2026'}\n` +
                 `📅 *Fecha Operativa:* \`${fechaOperativa}\`\n` +
                 `📝 *Motivo:* ${motivoSinActividad || 'Paro operativo'}\n` +
                 `👤 *Autor:* ${autorNombre || 'Operador'}\n` +
                 `💾 _Folio:_ \`${clientUuid || 'N/A'}\``;
    return sendTopicMessage('reportes', text);
  }

  let avanceTxt = '';
  if (lineas.length > 0) {
    avanceTxt = `\n📊 *Avance:* ` + lineas.map(l => `${l.predio_nombre ? l.predio_nombre + ' ' : ''}${l.cantidad_ha || l.cantidad} ${l.unidad || 'ha'} (${l.actividad_id || 'Labor'})`).join(' · ');
  }

  let cuadrillaTxt = '';
  if (cuadrilla.length > 0) {
    cuadrillaTxt = `\n👥 *Cuadrilla:* ` + cuadrilla.map(c => `${c.role_text || c.rol_id}: ${c.headcount}`).join(' · ');
  }

  let maqTxt = '';
  if (maquinaria && (maquinaria.length > 0 || maquinaria.codigo)) {
    const maqs = Array.isArray(maquinaria) ? maquinaria : [maquinaria];
    maqTxt = `\n🚜 *Maquinaria:* ` + maqs.map(m => `${m.codigo || 'Máquina'}: ${m.horas_trabajadas || 0} hrs (${m.litros_diesel || 0} L)`).join(', ');
  }

  const text = `📋 *REPORTE DE CAMPO OFICIAL*\n\n` +
               `🏢 *Obra:* ${obraNombre || 'General'}\n` +
               `🌾 *Proyecto:* ${proyectoNombre || 'Maíz 2026'}\n` +
               `📅 *Fecha Operativa:* \`${fechaOperativa}\`\n` +
               `👤 *Autor:* ${autorNombre || 'Operador'}` +
               avanceTxt +
               cuadrillaTxt +
               maqTxt +
               `\n\n💾 _Folio:_ \`${clientUuid || 'N/A'}\``;

  return sendTopicMessage('reportes', text);
}

/**
 * Notificar una nueva incidencia al tema #Incidencias
 */
async function notifyIncidencia(issueData) {
  const { folio, tipo, obraNombre, descripcion, estado } = issueData;

  const text = `⚠️ *ALERTA DE INCIDENCIA EN CAMPO*\n\n` +
               `📌 *Folio:* \`${folio}\` [${(estado || 'ABIERTA').toUpperCase()}]\n` +
               `🏢 *Obra:* ${obraNombre || 'General'}\n` +
               `🔧 *Tipo:* ${tipo}\n` +
               `📝 *Detalle:* ${descripcion || 'Sin descripción adicional'}\n\n` +
               `💬 _Responde (reply) a este mensaje dentro del tema para agregar seguimiento a la bitácora._\n` +
               `✅ _Para cerrar:_ \`/cerrar ${folio} [causa_raiz]\``;

  return sendTopicMessage('incidencias', text);
}

/**
 * Generar reporte detallado de Proyectos y Tareas en curso (Opción General)
 */
async function generateProyectosTareasText() {
  const proyectos = await db.all(`
    SELECT p.*, u.nombre AS gerente_nombre
    FROM proyecto p
    LEFT JOIN usuario u ON p.gerente_id = u.id
    ORDER BY p.id ASC
  `);

  if (!proyectos || proyectos.length === 0) {
    return '📁 *No hay proyectos registrados actualmente en el sistema.*';
  }

  let text = `🌾 *ESTATUS DE PROYECTOS Y TAREAS EN CURSO · AGROK*\n\n`;

  let totalMetaGlobal = 0;
  let totalHabilitadoGlobal = 0;
  let totalTareasEnProgreso = 0;

  for (const proj of proyectos) {
    totalMetaGlobal += proj.superficie_meta_ha || 0;

    // Obtener hitos de este proyecto
    const hitos = await db.all(`
      SELECT * FROM hito WHERE proyecto_id = ? ORDER BY orden ASC
    `, [proj.id]);

    let projAcumulado = 0;
    let hitosText = '';

    for (const h of hitos) {
      // Obtener tareas de este hito
      const tareas = await db.all(`
        SELECT t.*, p.nombre AS predio_nombre
        FROM tarea t
        LEFT JOIN predio p ON t.predio_id = p.id
        WHERE t.hito_id = ?
        ORDER BY t.id ASC
      `, [h.id]);

      let hitoAcumulado = tareas.reduce((sum, t) => sum + (t.cantidad_acumulada || 0), 0);
      projAcumulado += hitoAcumulado;

      const tareasEnProgreso = tareas.filter(t => t.estado === 'en_progreso' || t.estado === 'pendiente');
      totalTareasEnProgreso += tareasEnProgreso.length;

      if (tareas.length > 0) {
        hitosText += `   🔹 *Hito: ${h.nombre}* (${h.superficie_meta_ha || 0} ha)\n`;
        tareas.forEach(t => {
          const statusBadge = t.estado === 'completada' ? '✅ COMPLETADA' : t.estado === 'en_progreso' ? '🔄 EN CURSO' : '⏳ PENDIENTE';
          const pctTarea = t.cantidad_meta > 0 ? Math.min(100, Math.round((t.cantidad_acumulada / t.cantidad_meta) * 100)) : 0;
          hitosText += `      • *${t.nombre}*: ${t.cantidad_acumulada} / ${t.cantidad_meta} ${t.unidad} (${pctTarea}%) ➔ [${statusBadge}]\n`;
          if (t.predio_nombre || t.responsable) {
            hitosText += `        ↳ _Predio: ${t.predio_nombre || 'General'} | Resp: ${t.responsable || 'No asignado'}_\n`;
          }
        });
      }
    }

    totalHabilitadoGlobal += projAcumulado;
    const projPct = proj.superficie_meta_ha > 0 ? Math.min(100, Math.round((projAcumulado / proj.superficie_meta_ha) * 100)) : 0;

    text += `📁 *${proj.nombre} (${proj.ciclo})*\n`;
    text += `   📍 *Fase:* ${proj.fase_catalogo || 'Operativa'} | *Gerente:* ${proj.gerente_nombre || 'Sin asignar'}\n`;
    text += `   📊 *Avance:* *${projAcumulado.toFixed(1)} ha* de *${proj.superficie_meta_ha} ha* (${projPct}%)\n`;
    if (hitosText) {
      text += hitosText;
    } else {
      text += `   _Sin tareas detalladas registradas para este proyecto._\n`;
    }
    text += `\n`;
  }

  const pctGlobal = totalMetaGlobal > 0 ? Math.min(100, Math.round((totalHabilitadoGlobal / totalMetaGlobal) * 100)) : 0;

  text += `📈 *RESUMEN CONSOLIDADO:*\n`;
  text += `• *Proyectos Activos:* ${proyectos.length}\n`;
  text += `• *Superficie Ejecutada:* *${totalHabilitadoGlobal.toFixed(1)} ha* / *${totalMetaGlobal} ha* (${pctGlobal}%)\n`;
  text += `• *Tareas Activas en Curso:* ${totalTareasEnProgreso}\n\n`;
  text += `💡 _Para registrar avances o crear nuevas tareas, pulsa *🚀 ABRIR MINI APP*._`;

  return text;
}

/**
 * Generar texto del Tablero de Control
 */
async function generateTableroText() {
  const today = new Date().toISOString().split('T')[0];

  // 1. Obras sin reporte hoy
  const activeObras = await db.all("SELECT id, nombre FROM obra WHERE estado = 'operacion'");
  const sinReporte = [];
  for (const o of activeObras) {
    const rep = await db.get('SELECT id FROM reporte WHERE obra_id = ? AND fecha_operativa = ?', [o.id, today]);
    if (!rep) sinReporte.push(o.nombre);
  }

  // 2. Incidencias abiertas
  const incs = await db.all("SELECT folio, tipo, estado FROM incidencia WHERE estado != 'cerrada'");

  // 3. Materiales bloqueados
  const mats = await db.all("SELECT o.nombre AS obra, m.nombre AS insumo, (m.requerido - m.en_sitio) AS deficit, m.eta FROM material m JOIN obra o ON m.obra_id = o.id WHERE (m.requerido - m.en_sitio) > 0");

  // 4. Maquinaria en alerta
  const maqs = await db.all('SELECT codigo, modelo, horometro_actual FROM maquina WHERE alerta_mantenimiento = 1');

  let text = `📊 *TABLERO DE CONTROL AGROK · CORTE DIARIO*\n📅 \`${today}\`\n\n`;

  text += `🔴 *OBRAS SIN REPORTE HOY (${sinReporte.length}):*\n`;
  if (sinReporte.length === 0) {
    text += `  ✅ Todas las obras han reportado hoy.\n`;
  } else {
    sinReporte.forEach(n => text += `  • *${n}*\n`);
  }

  text += `\n⚠️ *INCIDENCIAS ABIERTAS (${incs.length}):*\n`;
  if (incs.length === 0) {
    text += `  ✅ Cero incidencias pendientes.\n`;
  } else {
    incs.forEach(i => text += `  • \`${i.folio}\` [${i.estado.toUpperCase()}] ➔ ${i.tipo}\n`);
  }

  text += `\n📦 *BLOQUEADO POR MATERIAL (${mats.length}):*\n`;
  if (mats.length === 0) {
    text += `  ✅ Abastecimiento completo en sitio.\n`;
  } else {
    mats.forEach(m => {
      const etaStr = m.eta ? `(ETA: ${m.eta})` : `(Sin fecha)`;
      text += `  • *${m.obra}:* Falta ${m.deficit} de ${m.insumo} ${etaStr}\n`;
    });
  }

  text += `\n🚜 *MAQUINARIA EN ALERTA 300H (${maqs.length}):*\n`;
  if (maqs.length === 0) {
    text += `  ✅ Todo el parque opera en parámetros normales.\n`;
  } else {
    maqs.forEach(m => text += `  • \`${m.codigo}\` (${m.modelo}): *${m.horometro_actual} hrs* (Próximo a servicio)\n`);
  }

  return text;
}

function initTelegramBot(app) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  let miniAppUrl = process.env.RENDER_EXTERNAL_URL || process.env.TELEGRAM_MINI_APP_URL || 'http://localhost:3000';
  if (miniAppUrl && miniAppUrl.includes('localhost') && process.env.RENDER_EXTERNAL_URL) {
    miniAppUrl = process.env.RENDER_EXTERNAL_URL;
  }

  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.RENDER_EXTERNAL_URL;
  const isProduction = process.env.NODE_ENV === 'production' && webhookUrl;

  if (!token || token.trim() === '' || token.includes('your_token')) {
    console.log('ℹ️ Bot de Telegram no iniciado: TELEGRAM_BOT_TOKEN no configurado.');
    return null;
  }

  try {
    if (isProduction) {
      botInstance = new TelegramBot(token, { polling: false });
      const webhookPath = `/api/telegram/webhook/${token}`;
      botInstance.setWebHook(`${webhookUrl}${webhookPath}`).catch(err => {
        console.warn('Aviso al configurar Webhook:', err.message);
      });
      app.post(webhookPath, (req, res) => {
        try {
          botInstance.processUpdate(req.body);
        } catch (e) {
          console.warn('Error al procesar update Telegram:', e.message);
        }
        res.sendStatus(200);
      });
      console.log(`🤖 Bot de Telegram iniciado en MODO WEBHOOK: ${webhookUrl}${webhookPath}`);
    } else {
      botInstance = new TelegramBot(token, { polling: true });
      console.log('🤖 Bot de Telegram iniciado en MODO POLLING.');
    }

    botInstance.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.message && error.message.includes('409 Conflict')) {
        console.warn('⚠️ Telegram Polling 409 Conflict (instancia anterior cerrando)...');
      } else {
        console.warn('⚠️ Telegram Polling Error:', error.message || error);
      }
    });

    botInstance.on('error', (error) => console.warn('⚠️ Telegram Bot Error:', error.message || error));
    botInstance.on('webhook_error', (error) => console.warn('⚠️ Telegram Webhook Error:', error.message || error));

    const hasHttps = miniAppUrl && miniAppUrl.startsWith('https://');

    if (hasHttps) {
      botInstance.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '🚀 Abrir Mini App',
          web_app: { url: miniAppUrl }
        }
      }).catch(err => console.log('Aviso setChatMenuButton:', err.message));
    }

    const appButton = hasHttps
      ? [{ text: '🚀 ABRIR MINI APP', web_app: { url: miniAppUrl } }]
      : [{ text: '🚀 Abrir Mini App' }];

    const mainKeyboard = {
      reply_markup: {
        keyboard: [
          appButton,
          [{ text: '📁 Proyectos & Tareas' }, { text: '📊 Tablero Hoy' }],
          [{ text: '⚠️ Incidencias' }, { text: '🚜 Horómetro' }],
          [{ text: '🌧️ Sin Actividad' }]
        ],
        resize_keyboard: true,
        persistent: true
      }
    };

    // 1. Comando /id o /tema
    botInstance.onText(/\/(id|tema|info_tema)/, async (msg) => {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const chatType = msg.chat.type;

      const infoMsg = `📌 *INFORMACIÓN DE ESTE CHAT / TEMA*\n\n` +
                      `• *Chat ID:* \`${chatId}\`\n` +
                      `• *Tipo:* \`${chatType}\`\n` +
                      `• *Tema (message_thread_id):* \`${threadId || 'General (Sin tema)'}\`\n\n` +
                      `💡 *Variables para tu .env:*\n` +
                      `\`TELEGRAM_SUPERGROUP_ID=${chatId}\`\n` +
                      (threadId ? `\`TELEGRAM_THREAD_REPORTES=${threadId}\` (o INCIDENCIAS/TABLERO)` : `_Este mensaje fue enviado en el tema General._`);

      botInstance.sendMessage(chatId, infoMsg, {
        parse_mode: 'Markdown',
        message_thread_id: threadId
      }).catch(e => console.error('Error enviando /id:', e.message));
    });

    // 2. Comando /start y /menu
    botInstance.onText(/\/(start|menu|ayuda)/, async (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from.first_name || 'Operador';
      const tgUserId = String(msg.from.id);

      try {
        await db.run('UPDATE usuario SET tg_chat_id = ? WHERE tg_user_id = ?', [String(chatId), tgUserId]);
      } catch (e) {}

      const welcomeMsg = `👋 *¡Bienvenido al Asistente de Operación AGROK, ${firstName}!*

🌾 *Control de Jornadas, Proyectos, Maquinaria e Incidencias*
Este bot canaliza automáticamente cada mensaje a su tema correspondiente:
• 🌐 *#General* ➔ Consulta de proyectos y tareas en curso.
• 📋 *#Reportes* ➔ Nuevos reportes y paros operativos.
• ⚠️ *#Incidencias* ➔ Folios de fallas y seguimiento.
• 📊 *#Tablero* ➔ Resumen diario del ciclo agrícola.

🔘 *Opciones Rápidas:*
• *📁 Proyectos & Tareas* ➔ Ver tareas activas y avance de proyectos.
• *🚀 ABRIR MINI APP* ➔ Formulario interactivo completo (con o sin señal).
• *📊 Tablero Hoy* ➔ Consultar métricas del día.
• *⚠️ Incidencias* ➔ Ver folios activos en campo.
• *🚜 Horómetro* ➔ Consultar horómetros de maquinaria.
• *🌧️ Sin Actividad* ➔ Reportar paro por lluvia de inmediato.

💡 _Tip:_ Escribe \`/general\` o \`/proyectos\` para ver el reporte de proyectos y tareas en curso.`;

      const welcomeInline = {
        reply_markup: {
          inline_keyboard: hasHttps
            ? [
                [{ text: '🚀 ABRIR MINI APP', web_app: { url: miniAppUrl } }],
                [{ text: '🌐 Abrir en Navegador', url: miniAppUrl }]
              ]
            : [
                [{ text: '🌐 Abrir en Navegador Web', url: miniAppUrl }]
              ]
        }
      };

      botInstance.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        message_thread_id: msg.message_thread_id,
        ...welcomeInline,
        ...mainKeyboard
      }).catch(err => console.error('Error welcomeMsg:', err.message));
    });

    // 3. Callback Query Handler (Confirmación / Corrección interactiva)
    botInstance.on('callback_query', async (query) => {
      const { id, data, message } = query;
      const chatId = message.chat.id;
      const threadId = message.message_thread_id;

      try {
        if (data.startsWith('confirm_rep:')) {
          const repId = parseInt(data.replace('confirm_rep:', ''), 10);
          const rep = await db.get('SELECT r.*, o.nombre AS obra_nombre, p.nombre AS proyecto_nombre FROM reporte r LEFT JOIN obra o ON r.obra_id = o.id LEFT JOIN proyecto p ON r.proyecto_id = p.id WHERE r.id = ?', [repId]);

          if (rep) {
            await db.run("UPDATE reporte SET estado = 'confirmado' WHERE id = ?", [repId]);

            // Obtener líneas y cuadrilla
            const lineas = await db.all('SELECT rl.*, p.nombre AS predio_nombre FROM reporte_linea rl LEFT JOIN predio p ON rl.predio_id = p.id WHERE rl.reporte_id = ?', [repId]);
            const cuadrilla = await db.all('SELECT * FROM reporte_cuadrilla WHERE reporte_id = ?', [repId]);
            const maqs = await db.all('SELECT lm.*, m.codigo FROM lectura_maquina lm LEFT JOIN maquina m ON lm.maquina_id = m.id WHERE lm.reporte_id = ?', [repId]);

            // Actualizar el mensaje del chat para reflejar confirmación
            botInstance.editMessageText(
              `✅ *REPORTE CONFIRMADO OFICIALMENTE*\n\n` +
              `🏢 *Obra:* ${rep.obra_nombre || 'General'}\n` +
              `📅 *Fecha:* \`${rep.fecha_operativa}\`\n` +
              `👤 *Autor:* ${rep.autor_nombre || 'Operador'}\n` +
              `📊 *Avance:* ` + lineas.map(l => `${l.predio_nombre ? l.predio_nombre + ' ' : ''}${l.cantidad_ha} ha (${l.actividad_id})`).join(' · ') + `\n\n` +
              `💾 _Folio:_ \`${rep.client_uuid}\``,
              {
                chat_id: chatId,
                message_id: message.message_id,
                parse_mode: 'Markdown'
              }
            );

            // Publicar automáticamente en el tema #Reportes
            notifyReporte({
              obraNombre: rep.obra_nombre,
              proyectoNombre: rep.proyecto_nombre,
              fechaOperativa: rep.fecha_operativa,
              autorNombre: rep.autor_nombre,
              esSinActividad: !!rep.es_sin_actividad,
              motivoSinActividad: rep.motivo_sin_actividad,
              lineas,
              cuadrilla,
              maquinaria: maqs,
              clientUuid: rep.client_uuid
            });

            botInstance.answerCallbackQuery(id, { text: '¡Reporte confirmado exitosamente!' });
          }
        } else if (data.startsWith('edit_rep:')) {
          botInstance.answerCallbackQuery(id, { text: 'Por favor envía el texto corregido en tu siguiente mensaje.' });
          botInstance.sendMessage(chatId, '✏️ *Modo Corrección:* Pega el reporte con los datos corregidos para actualizarlo.', { parse_mode: 'Markdown', message_thread_id: threadId });
        }
      } catch (cbErr) {
        console.warn('Error en callback_query:', cbErr.message);
        botInstance.answerCallbackQuery(id, { text: 'Error procesando la acción.' });
      }
    });

    // 4. Manejador Principal de Mensajes
    botInstance.on('message', async (msg) => {
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const text = msg.text.trim();

      // Opción General: 📁 Proyectos & Tareas en curso (o comandos /general, /proyectos, /tareas)
      if (
        text === '📁 Proyectos & Tareas' ||
        text.toLowerCase() === '/general' ||
        text.toLowerCase() === '/proyectos' ||
        text.toLowerCase() === '/tareas' ||
        text.toLowerCase() === 'general'
      ) {
        const proyectosTxt = await generateProyectosTareasText();
        return botInstance.sendMessage(chatId, proyectosTxt, {
          parse_mode: 'Markdown',
          message_thread_id: threadId,
          ...mainKeyboard
        });
      }

      // Botón 1: 📊 Tablero Hoy o /hoy
      if (text === '📊 Tablero Hoy' || text.toLowerCase() === '/tablero' || text.toLowerCase() === '/hoy') {
        const tableroTxt = await generateTableroText();
        botInstance.sendMessage(chatId, tableroTxt, {
          parse_mode: 'Markdown',
          message_thread_id: threadId,
          ...mainKeyboard
        });
        if (process.env.TELEGRAM_THREAD_TABLERO && String(threadId) !== String(process.env.TELEGRAM_THREAD_TABLERO)) {
          sendTopicMessage('tablero', tableroTxt);
        }
        return;
      }

      // Botón 2: ⚠️ Incidencias o /pendientes
      if (text === '⚠️ Incidencias' || text.toLowerCase().startsWith('/incidencias') || text.toLowerCase() === '/pendientes') {
        const incs = await db.all("SELECT i.folio, i.tipo, i.estado, o.nombre AS obra_nombre FROM incidencia i JOIN obra o ON i.obra_id = o.id WHERE i.estado != 'cerrada'");
        if (incs.length === 0) {
          return botInstance.sendMessage(chatId, '✅ *Cero Incidencias:* Todos los frentes operan con normalidad.', { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
        }
        let resp = `⚠️ *INCIDENCIAS ABIERTAS (${incs.length}):*\n\n`;
        incs.forEach(i => resp += `• *${i.folio}* [${i.estado.toUpperCase()}] ➔ ${i.tipo} (${i.obra_nombre})\n`);
        resp += `\n_Para agregar seguimiento, responda (reply) a la notificación de la incidencia en el tema #Incidencias._`;
        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
      }

      // Botón 3: 🚜 Horómetro o /maquina
      if (text === '🚜 Horómetro' || text.toLowerCase() === '/horometro' || text.toLowerCase() === '/maquinaria' || text.toLowerCase().startsWith('/maquina')) {
        const maqs = await db.all('SELECT codigo, modelo, horometro_actual, alerta_mantenimiento FROM maquina');
        let resp = `🚜 *PARQUE DE MAQUINARIA AGROK:*\n\n`;
        maqs.forEach(m => {
          const alertBadge = m.alerta_mantenimiento ? '🚨 *ALERTA 300H*' : '✅ ÓPTIMO';
          resp += `• \`${m.codigo}\` (${m.modelo}): *${m.horometro_actual} hrs* ➔ ${alertBadge}\n`;
        });
        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
      }

      // Botón 4: 🌧️ Sin Actividad
      if (text === '🌧️ Sin Actividad' || text.toLowerCase().startsWith('/sin_actividad')) {
        let motivo = 'Lluvia / Paro operativo reportado';
        if (text.toLowerCase().startsWith('/sin_actividad') && text.length > 15) {
          motivo = text.replace(/^\/sin_actividad\s*/i, '').trim();
        }

        const author = `${msg.from.first_name || 'Operador'}`;
        const obra = await db.get("SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.estado = 'operacion' LIMIT 1");

        const clientUuid = `tg-paro-${uuidv4()}`;
        const today = new Date().toISOString().split('T')[0];

        try {
          await db.run(
            `INSERT INTO reporte (
              client_uuid, obra_id, fecha_operativa, autor_nombre, texto_original,
              nota, estado, es_sin_actividad, motivo_sin_actividad, tg_chat_id, tg_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, 'confirmado', 1, ?, ?, ?)`,
            [clientUuid, obra?.id || null, today, author, msg.text, 'Declarado vía Telegram', motivo, String(chatId), msg.message_id]
          );

          botInstance.sendMessage(
            chatId,
            `🌧️ *DÍA SIN ACTIVIDAD REGISTRADO*\n\n🏢 *Obra:* ${obra?.nombre || 'General'}\n📅 *Fecha:* \`${today}\`\n📝 *Motivo:* ${motivo}\n👤 *Autor:* ${author}`,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
          );

          notifyReporte({
            obraNombre: obra?.nombre,
            proyectoNombre: obra?.proyecto_nombre,
            fechaOperativa: today,
            autorNombre: author,
            esSinActividad: true,
            motivoSinActividad: motivo,
            clientUuid
          });

          return;
        } catch (e) {
          return botInstance.sendMessage(chatId, `❌ Error al registrar paro: ${e.message}`, { message_thread_id: threadId });
        }
      }

      // Consulta /avance
      if (text.toLowerCase().startsWith('/avance')) {
        const obras = await db.all(`
          SELECT o.nombre AS obra_nombre, p.nombre AS proyecto_nombre,
                 COALESCE(SUM(rl.cantidad_ha), 0) AS total_ha,
                 pr.superficie_meta_ha
          FROM obra o
          JOIN proyecto pr ON o.proyecto_id = pr.id
          LEFT JOIN reporte r ON r.obra_id = o.id
          LEFT JOIN reporte_linea rl ON rl.reporte_id = r.id
          LEFT JOIN predio p ON rl.predio_id = p.id
          WHERE o.estado = 'operacion'
          GROUP BY o.id
        `);

        let resp = `📊 *AVANCE DE OBRAS ACTIVAS:*\n\n`;
        obras.forEach(o => {
          resp += `• *${o.obra_nombre}:* ${o.total_ha} ha habilitadas / ${o.superficie_meta_ha} ha meta\n`;
        });
        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
      }

      // Reply a Incidencia
      if (msg.reply_to_message?.text) {
        const rText = msg.reply_to_message.text;
        const folioMatch = rText.match(/Folio:\s*`?(INC-[\w-]+|F-\d+)`?/i);
        if (folioMatch) {
          const folio = folioMatch[1];
          const inc = await db.get('SELECT * FROM incidencia WHERE folio = ?', [folio]);
          if (inc) {
            await db.run(`UPDATE incidencia SET causa_raiz = ? WHERE id = ?`, [text, inc.id]);
            return botInstance.sendMessage(
              chatId,
              `📝 *SEGUIMIENTO REGISTRADO EN INCIDENCIA ${folio}*\n\n_${text}_`,
              { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
            );
          }
        }
      }

      // 5. Parser Avanzado de Texto Libre (Multi-predio y Confirmación interactiva)
      const parsed = parseFreeTextReport(text, new Date(msg.date * 1000));
      if (parsed.isValid) {
        try {
          const clientUuid = `tg-rep-${uuidv4()}`;
          const author = `${msg.from.first_name || 'Operador'}`;
          const opDate = parsed.fecha_operativa || new Date().toISOString().split('T')[0];

          // Buscar obra correspondiente por nombre o por thread
          let obra = null;
          if (parsed.obra_nombre) {
            obra = await db.get('SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.nombre LIKE ?', [`%${parsed.obra_nombre}%`]);
          }
          if (!obra && threadId) {
            obra = await db.get('SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.tg_thread_id = ?', [String(threadId)]);
          }
          if (!obra) {
            obra = await db.get("SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.estado = 'operacion' LIMIT 1");
          }

          // Guardar reporte en estado 'borrador'
          const repRes = await db.run(
            `INSERT INTO reporte (
              client_uuid, obra_id, proyecto_id, fecha_operativa, autor_nombre,
              texto_original, nota, estado, es_sin_actividad, motivo_sin_actividad, tg_chat_id, tg_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'borrador', ?, ?, ?, ?)`,
            [
              clientUuid,
              obra?.id || null,
              obra?.proyecto_id || null,
              opDate,
              author,
              text,
              parsed.nota || 'Reportado vía Telegram',
              parsed.es_sin_actividad ? 1 : 0,
              parsed.motivo_sin_actividad || null,
              String(chatId),
              msg.message_id
            ]
          );

          const reporteId = repRes.lastID;

          // Guardar líneas multi-predio
          for (const line of parsed.lineas) {
            let predio = null;
            if (line.predio_nombre) {
              predio = await db.get('SELECT id FROM predio WHERE nombre LIKE ?', [`%${line.predio_nombre}%`]);
            }
            if (!predio && obra) {
              const op = await db.get('SELECT predio_id FROM obra_predio WHERE obra_id = ? LIMIT 1', [obra.id]);
              if (op) predio = { id: op.predio_id };
            }

            await db.run(
              `INSERT INTO reporte_linea (reporte_id, predio_id, actividad_id, cantidad, unidad, cantidad_ha, fuente)
               VALUES (?, ?, ?, ?, ?, ?, 'campo')`,
              [reporteId, predio?.id || null, line.actividad_id || 'siembra', line.cantidad, line.unidad, line.cantidad_ha]
            );
          }

          // Guardar cuadrilla
          for (const c of parsed.cuadrilla) {
            await db.run(
              `INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount) VALUES (?, ?, ?)`,
              [reporteId, c.rol_id, c.headcount]
            );
          }

          // Guardar maquinaria si viene
          if (parsed.maquinaria && parsed.maquinaria.codigo) {
            const maq = await db.get('SELECT id FROM maquina WHERE codigo LIKE ? OR modelo LIKE ?', [`%${parsed.maquinaria.codigo}%`, `%${parsed.maquinaria.codigo}%`]);
            if (maq) {
              await db.run(
                `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [reporteId, maq.id, parsed.maquinaria.horometro_inicio || 0, parsed.maquinaria.horometro_fin || 0, parsed.maquinaria.horas_trabajadas || 0, parsed.maquinaria.litros_diesel || 0]
              );
            }
          }

          // Ficha de Confirmación según especificación (Docs 2 §2)
          let cuadrillaTxt = parsed.cuadrilla.map(c => `${c.role_text || c.rol_id} ${c.headcount}`).join(' · ');
          let actividadesTxt = parsed.actividades.length > 0 ? parsed.actividades.map(a => a.actividad_id).join(' · ') : 'labores de campo';
          let avanceTxt = parsed.lineas.map(l => `${l.predio_nombre ? l.predio_nombre + ' ' : ''}${l.cantidad_ha || l.cantidad} ${l.unidad}`).join(' · ');

          const confirmMsg = `📋 *Reporte · ${obra?.nombre || 'General'} · ${opDate} · ${author}*\n\n` +
                             `👥 *Cuadrilla:* ${cuadrillaTxt}\n` +
                             `🌾 *Actividades:* ${actividadesTxt}\n` +
                             `📊 *Avance:* ${avanceTxt || 'Sin avance de superficie'}\n` +
                             `💾 _Estado:_ Borrador pendiente de confirmación`;

          const confirmInline = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Confirmar', callback_data: `confirm_rep:${reporteId}` },
                  { text: '✏️ Corregir', callback_data: `edit_rep:${reporteId}` }
                ]
              ]
            }
          };

          botInstance.sendMessage(chatId, confirmMsg, {
            parse_mode: 'Markdown',
            message_thread_id: threadId,
            reply_to_message_id: msg.message_id,
            ...confirmInline
          });

        } catch (err) {
          botInstance.sendMessage(chatId, `❌ Error procesando reporte: ${err.message}`, { message_thread_id: threadId });
        }
      }
    });

  } catch (err) {
    console.error('Error al inicializar TelegramBot:', err);
  }

  return botInstance;
}

module.exports = {
  initTelegramBot,
  getBotInstance: () => botInstance,
  sendTopicMessage,
  notifyReporte,
  notifyIncidencia,
  generateTableroText,
  generateProyectosTareasText
};
