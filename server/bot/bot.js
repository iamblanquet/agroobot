const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { parseFreeTextReport } = require('./parser');

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
  if (!supergroupId) {
    // Si no hay supergrupo configurado, no enviamos notificación a grupo
    return null;
  }

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
                 `🌾 *Proyecto:* ${proyectoNombre || 'No especificado'}\n` +
                 `📅 *Fecha Operativa:* \`${fechaOperativa}\`\n` +
                 `📝 *Motivo:* ${motivoSinActividad || 'Paro operativo'}\n` +
                 `👤 *Autor:* ${autorNombre || 'Operador'}\n` +
                 `💾 _Folio:_ \`${clientUuid || 'N/A'}\``;
    return sendTopicMessage('reportes', text);
  }

  let avanceTxt = '';
  if (lineas.length > 0) {
    avanceTxt = `\n🌾 *Avance:* ` + lineas.map(l => `${l.cantidad_ha || l.cantidad} ${l.unidad || 'ha'} (${l.actividad_id || 'Labor'})`).join(', ');
  }

  let cuadrillaTxt = '';
  if (cuadrilla.length > 0) {
    cuadrillaTxt = `\n👥 *Cuadrilla:* ` + cuadrilla.map(c => `${c.rol_id}: ${c.headcount}`).join(' · ');
  }

  let maqTxt = '';
  if (maquinaria.length > 0) {
    maqTxt = `\n🚜 *Maquinaria:* ` + maquinaria.map(m => `${m.codigo || 'Máq'}: ${m.horas_trabajadas || 0} hrs (${m.litros_diesel || 0} L)`).join(', ');
  }

  const text = `📋 *NUEVO REPORTE DE CAMPO*\n\n` +
               `🏢 *Obra:* ${obraNombre || 'General'}\n` +
               `🌾 *Proyecto:* ${proyectoNombre || 'General'}\n` +
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
  const mats = await db.all("SELECT o.nombre AS obra, m.insumo, (m.requerido - m.en_sitio) AS deficit FROM material m JOIN obra o ON m.obra_id = o.id WHERE (m.requerido - m.en_sitio) > 0");

  // 4. Maquinaria en alerta
  const maqs = await db.all('SELECT codigo, horometro_actual FROM maquina WHERE alerta_mantenimiento = 1');

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

  text += `\n📦 *MATERIALES EN DÉFICIT (${mats.length}):*\n`;
  if (mats.length === 0) {
    text += `  ✅ Abastecimiento completo en sitio.\n`;
  } else {
    mats.forEach(m => text += `  • *${m.obra}:* Falta ${m.deficit} de ${m.insumo}\n`);
  }

  text += `\n🚜 *MAQUINARIA EN ALERTA 300H (${maqs.length}):*\n`;
  if (maqs.length === 0) {
    text += `  ✅ Todo el parque opera en parámetros normales.\n`;
  } else {
    maqs.forEach(m => text += `  • \`${m.codigo}\`: ${m.horometro_actual} hrs (Próximo a servicio)\n`);
  }

  return text;
}

function initTelegramBot(app) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  
  // Priorizar URL pública de Render (HTTPS) sobre localhost para evitar errores en móviles
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

    // Manejadores de error para evitar que caídas de red o conflictos detengan el proceso
    botInstance.on('polling_error', (error) => {
      if (error.code === 'ETELEGRAM' && error.message && error.message.includes('409 Conflict')) {
        console.warn('⚠️ Telegram Polling 409 Conflict (instancia anterior cerrando, esperando relevo)...');
      } else {
        console.warn('⚠️ Telegram Polling Error:', error.message || error);
      }
    });

    botInstance.on('error', (error) => {
      console.warn('⚠️ Telegram Bot Error:', error.message || error);
    });

    botInstance.on('webhook_error', (error) => {
      console.warn('⚠️ Telegram Webhook Error:', error.message || error);
    });

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
          [{ text: '📊 Tablero Hoy' }, { text: '⚠️ Incidencias' }],
          [{ text: '🚜 Horómetro' }, { text: '🌧️ Sin Actividad' }]
        ],
        resize_keyboard: true,
        persistent: true
      }
    };

    // 1. Comando /id o /tema para obtener fácilmente los IDs de los topics
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

🌾 *Control de Jornadas, Maquinaria e Incidencias en Supergrupo*
Este bot canaliza automáticamente cada mensaje a su tema correspondiente:
• 📋 *#Reportes* ➔ Nuevos reportes y paros operativos.
• ⚠️ *#Incidencias* ➔ Folios de fallas y seguimiento.
• 📊 *#Tablero* ➔ Resumen diario del ciclo agrícola.

🔘 *Opciones Rápidas:*
• *🚀 ABRIR MINI APP* ➔ Formulario interactivo completo (con o sin señal).
• *📊 Tablero Hoy* ➔ Consultar métricas del día.
• *⚠️ Incidencias* ➔ Ver folios activos en campo.
• *🚜 Horómetro* ➔ Consultar horómetros de maquinaria.
• *🌧️ Sin Actividad* ➔ Reportar paro por lluvia de inmediato.

💡 _Tip para Administradores:_ Escribe \`/id\` dentro de cualquier tema del supergrupo para obtener su ID numérico.`;

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
        ...welcomeInline
      }).catch(err => console.error('Error welcomeMsg:', err.message));
    });

    // 3. Manejador de Botones y Mensajes
    botInstance.on('message', async (msg) => {
      if (!msg.text) return;

      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const text = msg.text.trim();

      // Log informativo para ver qué tema envió el mensaje
      if (msg.chat.type === 'supergroup') {
        console.log(`📌 Mensaje en Supergrupo: ChatID = ${chatId} | ThreadID = ${threadId || 'General'} | Texto = "${text}"`);
      }

      // Botón 1: 📊 Tablero Hoy
      if (text === '📊 Tablero Hoy' || text.toLowerCase() === '/tablero' || text.toLowerCase() === '/hoy') {
        const tableroTxt = await generateTableroText();
        // Responder en el chat actual
        botInstance.sendMessage(chatId, tableroTxt, {
          parse_mode: 'Markdown',
          message_thread_id: threadId,
          ...mainKeyboard
        });
        // Si no estamos en el tema de tablero, publicar también en #Tablero
        if (process.env.TELEGRAM_THREAD_TABLERO && String(threadId) !== String(process.env.TELEGRAM_THREAD_TABLERO)) {
          sendTopicMessage('tablero', tableroTxt);
        }
        return;
      }

      // Botón 2: ⚠️ Incidencias
      if (text === '⚠️ Incidencias' || text.toLowerCase().startsWith('/incidencias')) {
        const incs = await db.all("SELECT i.folio, i.tipo, i.estado, o.nombre AS obra_nombre FROM incidencia i JOIN obra o ON i.obra_id = o.id WHERE i.estado != 'cerrada'");
        if (incs.length === 0) {
          return botInstance.sendMessage(chatId, '✅ *Cero Incidencias:* Todos los frentes operan con normalidad.', { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
        }
        let resp = `⚠️ *INCIDENCIAS ABIERTAS (${incs.length}):*\n\n`;
        incs.forEach(i => resp += `• *${i.folio}* [${i.estado.toUpperCase()}] ➔ ${i.tipo} (${i.obra_nombre})\n`);
        resp += `\n_Para agregar seguimiento, responda (reply) a la notificación de la incidencia en el tema #Incidencias._`;
        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard });
      }

      // Botón 3: 🚜 Horómetro
      if (text === '🚜 Horómetro' || text.toLowerCase() === '/horometro' || text.toLowerCase() === '/maquinaria') {
        const maqs = await db.all('SELECT codigo, modelo, horometro_actual, alerta_mantenimiento FROM maquina');
        let resp = `🚜 *PARQUE DE MAQUINARIA:*\n\n`;
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

          // Confirmar en el chat actual
          botInstance.sendMessage(
            chatId,
            `🌧️ *DÍA SIN ACTIVIDAD REGISTRADO*\n\n🏢 *Obra:* ${obra?.nombre || 'General'}\n📅 *Fecha:* \`${today}\`\n📝 *Motivo:* ${motivo}\n👤 *Autor:* ${author}`,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
          );

          // Notificar automáticamente al tema #Reportes
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

      // Reply a Incidencia
      if (msg.reply_to_message?.text) {
        const rText = msg.reply_to_message.text;
        const folioMatch = rText.match(/Folio:\s*`?(INC-[\w-]+|F-\d+)`?/i);
        if (folioMatch) {
          const folio = folioMatch[1];
          const inc = await db.get('SELECT * FROM incidencia WHERE folio = ?', [folio]);
          if (inc) {
            await db.run(
              `UPDATE incidencia SET causa_raiz = ? WHERE id = ?`,
              [text, inc.id]
            );
            return botInstance.sendMessage(
              chatId,
              `📝 *SEGUIMIENTO REGISTRADO EN INCIDENCIA ${folio}*\n\n_${text}_`,
              { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
            );
          }
        }
      }

      // Parser de Texto Libre
      const parsed = parseFreeTextReport(text);
      if (parsed.isValid) {
        try {
          const clientUuid = `tg-rep-${uuidv4()}`;
          const author = `${msg.from.first_name || 'Operador'}`;
          const today = new Date().toISOString().split('T')[0];

          let obra = null;
          if (parsed.obra_nombre) {
            obra = await db.get('SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.nombre LIKE ?', [`%${parsed.obra_nombre}%`]);
          }
          if (!obra) {
            obra = await db.get("SELECT o.*, p.nombre AS proyecto_nombre FROM obra o LEFT JOIN proyecto p ON o.proyecto_id = p.id WHERE o.estado = 'operacion' LIMIT 1");
          }

          const repRes = await db.run(
            `INSERT INTO reporte (
              client_uuid, obra_id, proyecto_id, fecha_operativa, autor_nombre,
              texto_original, nota, estado, es_sin_actividad, motivo_sin_actividad, tg_chat_id, tg_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmado', ?, ?, ?, ?)`,
            [
              clientUuid,
              obra?.id || null,
              obra?.proyecto_id || null,
              today,
              author,
              text,
              'Reportado vía Telegram',
              parsed.es_sin_actividad ? 1 : 0,
              parsed.motivo_sin_actividad || null,
              String(chatId),
              msg.message_id
            ]
          );

          // Confirmar en el chat actual
          botInstance.sendMessage(
            chatId,
            `✅ *REPORTE REGISTRADO CON ÉXITO*\n\n🏢 *Obra:* ${obra?.nombre || 'General'}\n🌾 *Avance:* ${parsed.avance_ha} ha (${parsed.actividad})\n👥 *Cuadrilla:* ${parsed.cuadrilla_count} op\n👤 *Autor:* ${author}\n\n💾 _Folio:_ \`${clientUuid}\``,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
          );

          // Notificar automáticamente al tema #Reportes
          notifyReporte({
            obraNombre: obra?.nombre,
            proyectoNombre: obra?.proyecto_nombre,
            fechaOperativa: today,
            autorNombre: author,
            esSinActividad: parsed.es_sin_actividad,
            motivoSinActividad: parsed.motivo_sin_actividad,
            lineas: [{ cantidad_ha: parsed.avance_ha, actividad_id: parsed.actividad }],
            cuadrilla: [{ rol_id: 'operador', headcount: parsed.cuadrilla_count }],
            clientUuid
          });

        } catch (err) {
          botInstance.sendMessage(chatId, `❌ Error al registrar reporte: ${err.message}`, { message_thread_id: threadId, ...mainKeyboard });
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
  generateTableroText
};
