const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { parseFreeTextReport, KNOWN_PREDIOS } = require('./parser');
const { getOperationalDate } = require('../utils/operationalDate');
const { formatCrew } = require('./formatCrew');

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
  } else if (topicKey === 'general' && process.env.TELEGRAM_THREAD_GENERAL) {
    threadId = parseInt(process.env.TELEGRAM_THREAD_GENERAL, 10);
  }

  // Dividir en fragmentos si excede 4000 caracteres
  const CHUNK_SIZE = 3800;
  const chunks = [];
  if (text.length > CHUNK_SIZE) {
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= CHUNK_SIZE) {
        chunks.push(remaining);
        break;
      }
      let splitIdx = remaining.lastIndexOf('\n\n', CHUNK_SIZE);
      if (splitIdx === -1 || splitIdx < 1000) {
        splitIdx = remaining.lastIndexOf('\n', CHUNK_SIZE);
      }
      if (splitIdx === -1 || splitIdx < 1000) {
        splitIdx = CHUNK_SIZE;
      }
      chunks.push(remaining.substring(0, splitIdx));
      remaining = remaining.substring(splitIdx).trimStart();
    }
  } else {
    chunks.push(text);
  }

  let lastSentMsg = null;
  for (const chunk of chunks) {
    const sendOptions = {
      parse_mode: 'Markdown',
      ...(threadId ? { message_thread_id: threadId } : {}),
      ...extraOptions
    };

    try {
      lastSentMsg = await botInstance.sendMessage(supergroupId, chunk, sendOptions);
    } catch (err) {
      // Si falló por error de parsing Markdown, intentar sin parse_mode
      try {
        const plainOptions = { ...(threadId ? { message_thread_id: threadId } : {}), ...extraOptions };
        delete plainOptions.parse_mode;
        lastSentMsg = await botInstance.sendMessage(supergroupId, chunk, plainOptions);
      } catch (retryErr) {
        console.warn(`⚠️ Error al enviar mensaje al tema [${topicKey}]:`, retryErr.message);
      }
    }
  }

  return lastSentMsg;
}

/**
 * Notificar un reporte exclusivamente al tema del predio seleccionado
 */
async function notifyReporte(reportData) {
  let {
    obraNombre,
    proyectoNombre,
    obraThreadId,
    fechaOperativa,
    horaOffline,
    creadoOffline,
    autorNombre,
    esSinActividad,
    motivoSinActividad,
    lineas = [],
    cuadrilla = [],
    maquinaria = [],
    fotos = [],
    clientUuid
  } = reportData;

  const projectRepository = require('../repositories/projectRepository');
  const predio = reportData.predioId ? await projectRepository.findPredioById(reportData.predioId) : null;
  if (!predio || !predio.tg_thread_id) {
    console.warn('Reporte sin destino Telegram: el predio no tiene grupo vinculado.');
    return null;
  }
  obraThreadId = predio.tg_thread_id;
  const horaTxt = horaOffline ? `\n⏰ *Hora Captura (Sin Internet):* \`${horaOffline} hrs\`` : '';

  let text = '';
  if (esSinActividad) {
    text = `🌧️ *DÍA SIN ACTIVIDAD REPORTADO*\n\n` +
           `📍 *Predio:* ${predio.nombre}\n` +
           `🏢 *Frente de obra:* ${obraNombre || 'General'}\n` +
           `🌾 *Proyecto:* ${proyectoNombre || 'Sin proyecto'}\n` +
           `📅 *Fecha Operativa:* \`${fechaOperativa}\`` +
           horaTxt + `\n` +
           `📝 *Motivo:* ${motivoSinActividad || 'Paro operativo'}\n` +
           `👤 *Autor:* ${autorNombre || 'Operador'}\n` +
           `💾 _Folio:_ \`${clientUuid || 'N/A'}\``;
  } else {
    let avanceTxt = '';
    if (lineas.length > 0) {
      avanceTxt = `\n📊 *Avance:* ` + lineas.map(l => `${l.predio_nombre ? l.predio_nombre + ' ' : ''}${l.cantidad_ha || l.cantidad} ${l.unidad || 'ha'} (${l.actividad_id || 'Labor'})`).join(' · ');
    }

    const cuadrillaTxt = formatCrew(cuadrilla);

    let maqTxt = '';
    if (maquinaria && (Array.isArray(maquinaria) ? maquinaria.length > 0 : (typeof maquinaria === 'object' && maquinaria.codigo))) {
      const maqs = Array.isArray(maquinaria) ? maquinaria : [maquinaria];
      maqTxt = `\n🚜 *Maquinaria:* ` + maqs.map(m => `${m.codigo || 'Máquina'}: ${m.horas_trabajadas || 0} hrs (${m.litros_diesel || 0} L)`).join(', ');
    }

    const fotosTxt = fotos.length > 0 ? `\n📷 *Evidencias fotográficas:* ${fotos.length} adjunta(s)` : '';

    text = `📋 *REPORTE DE CAMPO OFICIAL*\n\n` +
           `📍 *Predio:* ${predio.nombre}\n` +
           `🏢 *Frente de obra:* ${obraNombre || 'General'}\n` +
           `🌾 *Proyecto:* ${proyectoNombre || 'Sin proyecto'}\n` +
           `📅 *Fecha Operativa:* \`${fechaOperativa}\`` +
           horaTxt + `\n` +
           `👤 *Autor:* ${autorNombre || 'Operador'}` +
           avanceTxt +
           cuadrillaTxt +
           maqTxt +
           fotosTxt +
           `\n\n💾 _Folio:_ \`${clientUuid || 'N/A'}\``;
  }

  const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;
  const targetThreadId = obraThreadId ? parseInt(obraThreadId, 10) : (process.env.TELEGRAM_THREAD_REPORTES ? parseInt(process.env.TELEGRAM_THREAD_REPORTES, 10) : null);

  // Si hay bot y supergrupo configurado, enviar al tema específico de la obra
  if (botInstance && supergroupId) {
    const fs = require('fs');
    const validFiles = (fotos || []).filter(f => (f.filePath && fs.existsSync(f.filePath)) || (f.url && f.url.startsWith('http')));
    if (validFiles.length > 0) {
      try {
        // Las listas de personal pueden superar el límite de pie de foto.
        const separateText = text.length > 1000;
        const caption = separateText ? '📷 Evidencias del reporte de campo' : text;
        const getMediaSource = (f) => (f.filePath && fs.existsSync(f.filePath)) ? f.filePath : f.url;
        if (validFiles.length === 1) {
          const sent = await botInstance.sendPhoto(supergroupId, getMediaSource(validFiles[0]), {
            caption,
            parse_mode: 'Markdown',
            ...(targetThreadId ? { message_thread_id: targetThreadId } : {})
          });
          if (!separateText) return sent;
        } else {
          // Grupo de fotos (álbum)
          const mediaGroup = validFiles.slice(0, 10).map((f, idx) => ({
            type: 'photo',
            media: getMediaSource(f),
            caption: idx === 0 ? caption : undefined,
            parse_mode: 'Markdown'
          }));
          const sent = await botInstance.sendMediaGroup(supergroupId, mediaGroup, {
            ...(targetThreadId ? { message_thread_id: targetThreadId } : {})
          });
          if (!separateText) return sent;
        }
      } catch (err) {
        console.warn('⚠️ Error al enviar fotos a Telegram, enviando texto alternativo:', err.message);
      }
    }

    return sendTopicMessage('reportes', text, targetThreadId ? { message_thread_id: targetThreadId } : {});
  }

  return sendTopicMessage('reportes', text);
}

/**
 * Notificar una nueva incidencia al tema del frente o #Incidencias
 */
async function notifyIncidencia(issueData) {
  let { folio, tipo, obraNombre, obraThreadId, descripcion, estado } = issueData;

  if (!obraThreadId && obraNombre) {
    try {
      const o = await db.get('SELECT tg_thread_id FROM obra WHERE nombre = ? LIMIT 1', [obraNombre]);
      if (o && o.tg_thread_id) {
        obraThreadId = o.tg_thread_id;
      }
    } catch (e) {}
  }

  const text = `⚠️ *ALERTA DE INCIDENCIA EN CAMPO*\n\n` +
               `📌 *Folio:* \`${folio}\` [${(estado || 'ABIERTA').toUpperCase()}]\n` +
               `🏢 *Obra:* ${obraNombre || 'General'}\n` +
               `🔧 *Tipo:* ${tipo}\n` +
               `📝 *Detalle:* ${descripcion || 'Sin descripción adicional'}\n\n` +
               `💬 _Responde (reply) a este mensaje dentro del tema para agregar seguimiento a la bitácora._\n` +
               `✅ _Para cerrar:_ \`/cerrar ${folio} [causa_raiz]\``;

  const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;
  const targetThreadId = obraThreadId ? parseInt(obraThreadId, 10) : (process.env.TELEGRAM_THREAD_INCIDENCIAS ? parseInt(process.env.TELEGRAM_THREAD_INCIDENCIAS, 10) : null);

  if (botInstance && supergroupId && targetThreadId) {
    try {
      return await botInstance.sendMessage(supergroupId, text, {
        parse_mode: 'Markdown',
        message_thread_id: targetThreadId
      });
    } catch (err) {
      console.warn(`⚠️ Error al enviar incidencia al tema [thread_id: ${targetThreadId}]:`, err.message);
    }
  }

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
  const today = getOperationalDate();

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

    const unauthKeyboard = {
      reply_markup: {
        keyboard: [
          appButton,
          [{ text: '🔐 Iniciar Sesión (PIN)' }]
        ],
        resize_keyboard: true,
        persistent: true
      }
    };

    async function getAuthUser(msg) {
      const tgUserId = String(msg.from?.id || '');
      if (!tgUserId) return null;
      try {
        const u = await db.get('SELECT * FROM usuario WHERE tg_user_id = ? AND activo = 1', [tgUserId]);
        return u || null;
      } catch (err) {
        console.error('Error getAuthUser:', err.message);
        return null;
      }
    }

    const mainKeyboard = {
      reply_markup: {
        keyboard: [
          appButton,
          [{ text: '📁 Proyectos & Tareas' }, { text: '📊 Tablero Hoy' }],
          [{ text: '⚠️ Incidencias' }, { text: '🚜 Horómetro' }],
          [{ text: '🌧️ Sin Actividad' }, { text: '🔒 Cerrar Sesión' }]
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

    // Comando /login [PIN] o /pin [PIN]
    botInstance.onText(/\/(login|pin)\s*(\d{4})?/i, async (msg, match) => {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const tgUserId = String(msg.from.id);
      const pin = match[2];

      if (!pin) {
        return botInstance.sendMessage(
          chatId,
          `🔐 *INICIO DE SESIÓN AGROK*\n\nPor favor escribe tu PIN de 4 dígitos:\nEjemplo: \`/login 1234\` o \`/pin 1234\`\n\n_O pulsa el botón 🚀 ABRIR MINI APP para identificarte visualmente._`,
          { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
        );
      }

      try {
        const u = await db.get('SELECT * FROM usuario WHERE pin = ? AND activo = 1', [pin]);
        if (!u) {
          return botInstance.sendMessage(
            chatId,
            '❌ *PIN incorrecto o usuario inactivo.*\nVerifica tu clave de 4 dígitos o contacta al Administrador IT.',
            { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
          );
        }

        // Vincular usuario a este Telegram
        await db.run('UPDATE usuario SET tg_user_id = ?, tg_chat_id = ? WHERE id = ?', [tgUserId, String(chatId), u.id]);

        return botInstance.sendMessage(
          chatId,
          `✅ *¡Sesión iniciada con éxito!*\n\n👤 *Bienvenido(a):* ${u.nombre}\n🏷️ *Rol:* \`${u.rol.toUpperCase()}\`\n\nYa tienes acceso completo al teclado de operaciones y reportes.`,
          { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
        );
      } catch (err) {
        return botInstance.sendMessage(chatId, `❌ Error al autenticar: ${err.message}`, { message_thread_id: threadId });
      }
    });

    // Comando /logout o /salir
    botInstance.onText(/\/(logout|salir|cerrar_sesion)/i, async (msg) => {
      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;

      try {
        const u = await getAuthUser(msg);
        if (u) {
          await db.run('UPDATE usuario SET tg_user_id = NULL WHERE id = ?', [u.id]);
          return botInstance.sendMessage(
            chatId,
            `🔒 *Sesión finalizada para ${u.nombre}.*\nLos accesos rápidos han sido bloqueados hasta que vuelvas a iniciar sesión.`,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
          );
        } else {
          return botInstance.sendMessage(
            chatId,
            'ℹ️ No tenías ninguna sesión activa vinculada.',
            { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
          );
        }
      } catch (err) {
        return botInstance.sendMessage(chatId, `❌ Error al cerrar sesión: ${err.message}`, { message_thread_id: threadId });
      }
    });

    // 2. Comando /start y /menu
    botInstance.onText(/\/(start|menu|ayuda)/, async (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from.first_name || 'Operador';
      const tgUserId = String(msg.from.id);

      try {
        await db.run('UPDATE usuario SET tg_chat_id = ? WHERE tg_user_id = ?', [String(chatId), tgUserId]);
      } catch (e) {}

      const authUser = await getAuthUser(msg);

      let welcomeMsg = '';
      let keyboardToUse = mainKeyboard;

      if (authUser) {
        welcomeMsg = `👋 *¡Bienvenido al Asistente de Operación AGROK, ${authUser.nombre}!*\n\n` +
                     `🌾 *Sesión Activa:* Rol \`${authUser.rol.toUpperCase()}\`\n\n` +
                     `🔘 *Opciones Rápidas Habilitadas:*\n` +
                     `• *📁 Proyectos & Tareas* ➔ Ver tareas activas y avance de proyectos.\n` +
                     `• *🚀 ABRIR MINI APP* ➔ Formulario interactivo completo (con o sin señal).\n` +
                     `• *📊 Tablero Hoy* ➔ Consultar métricas del día.\n` +
                     `• *⚠️ Incidencias* ➔ Ver folios activos en campo.\n` +
                     `• *🚜 Horómetro* ➔ Consultar horómetros de maquinaria.\n` +
                     `• *🌧️ Sin Actividad* ➔ Reportar paro por lluvia de inmediato.\n\n` +
                     `_Para cerrar sesión escribe: /logout_`;
        keyboardToUse = mainKeyboard;
      } else {
        welcomeMsg = `👋 *¡Hola ${firstName}! Bienvenido al Asistente de Operación AGROK.*\n\n` +
                     `🔒 *Acceso Protegido:* Los botones de consulta y reportes operativos requieren una sesión iniciada.\n\n` +
                     `🔑 *Para iniciar sesión:*\n` +
                     `1. Escribe: \`/login [tu_PIN]\` (ejemplo: \`/login 1234\`)\n` +
                     `2. O pulsa el botón *🚀 ABRIR MINI APP* e ingresa tu PIN en pantalla.`;
        keyboardToUse = unauthKeyboard;
      }

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
        ...keyboardToUse
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
          const reportRepository = require('../repositories/reportRepository');
          const rep = await reportRepository.findById(repId);

          if (rep && rep.estado === 'borrador') {
            await reportRepository.confirmTelegramDraft(repId);

            // Obtener líneas y cuadrilla
            const lineas = await reportRepository.findLinesByReportId(repId);
            const cuadrilla = await reportRepository.findCrewByReportId(repId);
            const maqs = await reportRepository.findMachineReadingsByReportId(repId);

            // Actualizar el mensaje del chat para reflejar confirmación
            botInstance.editMessageText(
              `✅ *REPORTE CONFIRMADO OFICIALMENTE*\n\n` +
              `🌾 *Proyecto:* ${rep.proyecto_nombre || 'Sin proyecto'}\n` +
              `🏢 *Frente de obra:* ${rep.obra_nombre || 'General'}\n` +
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
            await notifyReporte({
              predioId: rep.predio_id,
              obraId: rep.obra_id,
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
      // Auto-registrar supergrupo si el mensaje proviene de un supergrupo o grupo
      if (msg.chat && (msg.chat.type === 'supergroup' || msg.chat.type === 'group')) {
        if (!process.env.TELEGRAM_SUPERGROUP_ID) {
          process.env.TELEGRAM_SUPERGROUP_ID = String(msg.chat.id);
          console.log(`📡 [Telegram] TELEGRAM_SUPERGROUP_ID auto-detectado y configurado: ${msg.chat.id} (${msg.chat.title})`);
        }
      }

      if (!msg.text) return;

      const chatId = msg.chat.id;
      const threadId = msg.message_thread_id;
      const text = msg.text.trim();

      // Botón del teclado: 🔒 Cerrar Sesión
      if (text === '🔒 Cerrar Sesión' || text.toLowerCase() === 'cerrar sesion' || text.toLowerCase() === 'salir') {
        const u = await getAuthUser(msg);
        if (u) {
          await db.run('UPDATE usuario SET tg_user_id = NULL WHERE id = ?', [u.id]);
          return botInstance.sendMessage(
            chatId,
            `🔒 *Sesión finalizada para ${u.nombre}.*\nLos accesos rápidos han sido bloqueados hasta que vuelvas a iniciar sesión.`,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
          );
        } else {
          return botInstance.sendMessage(
            chatId,
            'ℹ️ No tienes ninguna sesión activa.',
            { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
          );
        }
      }

      // Botón del teclado de no autenticado: 🔐 Iniciar Sesión (PIN)
      if (text === '🔐 Iniciar Sesión (PIN)') {
        return botInstance.sendMessage(
          chatId,
          '🔐 *INICIO DE SESIÓN AGROK*\n\nPor favor ingresa tu clave escribiendo:\n`/login [PIN]` (ejemplo: `/login 1234`)\n\nO pulsa el botón *🚀 ABRIR MINI APP* para identificarte en pantalla.',
          { parse_mode: 'Markdown', message_thread_id: threadId, ...unauthKeyboard }
        );
      }

      // Identificar si la acción corresponde a los botones rápidos o comandos del sistema
      const isQuickButtonAction =
        text === '📁 Proyectos & Tareas' ||
        text.toLowerCase() === '/general' ||
        text.toLowerCase() === '/proyectos' ||
        text.toLowerCase() === '/tareas' ||
        text.toLowerCase() === 'general' ||
        text === '📊 Tablero Hoy' ||
        text.toLowerCase() === '/tablero' ||
        text.toLowerCase() === '/hoy' ||
        text === '⚠️ Incidencias' ||
        text.toLowerCase().startsWith('/incidencias') ||
        text.toLowerCase() === '/pendientes' ||
        text === '🚜 Horómetro' ||
        text.toLowerCase() === '/horometro' ||
        text.toLowerCase() === '/maquinaria' ||
        text.toLowerCase().startsWith('/maquina') ||
        text === '🌧️ Sin Actividad' ||
        text.toLowerCase().startsWith('/sin_actividad') ||
        text.toLowerCase().startsWith('/avance');

      // Comandos que no requieren sesión previa
      const isPublicCommand =
        text.toLowerCase().startsWith('/start') ||
        text.toLowerCase().startsWith('/menu') ||
        text.toLowerCase().startsWith('/ayuda') ||
        text.toLowerCase().startsWith('/login') ||
        text.toLowerCase().startsWith('/pin') ||
        text.toLowerCase().startsWith('/logout') ||
        text.toLowerCase().startsWith('/salir') ||
        text.toLowerCase().startsWith('/id') ||
        text.toLowerCase().startsWith('/tema') ||
        text.toLowerCase().startsWith('/info_tema');

      // 🛡️ PROTECCIÓN DE ACCESO: Si el usuario pulsa un botón rápido o intenta reportar sin sesión
      if (isQuickButtonAction || (!isPublicCommand && !msg.reply_to_message?.text)) {
        const user = await getAuthUser(msg);
        if (!user) {
          return botInstance.sendMessage(
            chatId,
            '🔒 *Acceso Protegido - Sesión Requerida*\n\n' +
            'No tienes una sesión activa vinculada a tu cuenta de Telegram.\n' +
            'Los botones de operación, consulta y reportes están bloqueados.\n\n' +
            '👉 Para desbloquear, escribe: `/login [tu_PIN]` (ej: `/login 1234`)\n' +
            'O pulsa **🚀 ABRIR MINI APP** para identificarte.',
            {
              parse_mode: 'Markdown',
              message_thread_id: threadId,
              ...unauthKeyboard
            }
          );
        }
      }

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

        const authUser = await getAuthUser(msg);
        const author = authUser?.nombre || `${msg.from.first_name || 'Operador'}`;
        let location;
        try {
          const front = text.match(/^\s*frente(?: de obra)?\s*:\s*(.+)$/im)?.[1]?.trim();
          location = await require('../services/reportLocation').resolveIncomingFront(threadId, front);
        } catch (error) {
          return botInstance.sendMessage(chatId, error.message, { message_thread_id: threadId });
        }
        const obra = { ...location.obra, proyecto_nombre: location.project.nombre };

        const clientUuid = `tg-paro-${uuidv4()}`;
        const today = getOperationalDate();

        try {
          await require('../repositories/reportRepository').syncReport({
            client_uuid: clientUuid, obra_id: obra.id, proyecto_id: obra.proyecto_id, predio_id: location.predio.id,
            fecha_operativa: today, autor_nombre: author, texto_original: msg.text,
            nota: 'Declarado vía Telegram', es_sin_actividad: true, motivo_sin_actividad: motivo
          });

          botInstance.sendMessage(
            chatId,
            `🌧️ *DÍA SIN ACTIVIDAD REGISTRADO*\n\n📍 *Predio:* ${location.predio.nombre}\n🌾 *Proyecto:* ${location.project.nombre}\n🏢 *Frente de obra:* ${obra?.nombre || 'General'}\n📅 *Fecha:* \`${today}\`\n📝 *Motivo:* ${motivo}\n👤 *Autor:* ${author}`,
            { parse_mode: 'Markdown', message_thread_id: threadId, ...mainKeyboard }
          );

          await notifyReporte({
            predioId: location.predio.id,
            obraId: obra.id,
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
          const authUser = await getAuthUser(msg);
          const author = authUser?.nombre || `${msg.from.first_name || 'Operador'}`;
          const opDate = parsed.fecha_operativa || getOperationalDate();

          let location;
          try {
            const explicitFront = text.match(/^\s*frente(?: de obra)?\s*:\s*(.+)$/im)?.[1]?.trim();
            location = await require('../services/reportLocation').resolveIncomingFront(threadId, explicitFront || parsed.obra_nombre);
          } catch (error) {
            await botInstance.sendMessage(chatId, error.message, { message_thread_id: threadId, reply_to_message_id: msg.message_id });
            return;
          }
          const obra = { ...location.obra, proyecto_nombre: location.project.nombre };
          const conflictingPlot = parsed.lineas.find(line => line.predio_nombre && line.predio_nombre.toLowerCase() !== location.predio.nombre.toLowerCase());
          if (conflictingPlot) {
            await botInstance.sendMessage(chatId, 'El reporte menciona otro predio. Envíalo en el grupo correspondiente o corrige el predio.', { message_thread_id: threadId });
            return;
          }
          const reporteId = await require('../repositories/reportRepository').createTelegramDraft({
            client_uuid: clientUuid, location, parsed, fecha_operativa: opDate, autor_nombre: author, texto_original: text
          });

          // Ficha de Confirmación según especificación (Docs 2 §2)
          let cuadrillaTxt = parsed.cuadrilla.map(c => `${c.role_text || c.rol_id} ${c.headcount}`).join(' · ');
          let actividadesTxt = parsed.actividades.length > 0 ? parsed.actividades.map(a => a.actividad_id).join(' · ') : 'labores de campo';
          let avanceTxt = parsed.lineas.map(l => `${l.predio_nombre ? l.predio_nombre + ' ' : ''}${l.cantidad_ha || l.cantidad} ${l.unidad}`).join(' · ');

          const confirmMsg = `📋 *Reporte · ${location.predio.nombre} · ${opDate} · ${author}*\n\n` +
                             `🌾 *Proyecto:* ${location.project.nombre}\n🏢 *Frente de obra:* ${obra.nombre} (#${obra.id})\n` +
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

/** Crear un tema por predio, compartido por todos sus proyectos y frentes. */
async function createPredioForumTopic(predio) {
  if (predio.tg_thread_id) return Number(predio.tg_thread_id);
  if (process.env.DISABLE_TELEGRAM_TOPIC_CREATION === 'true') return null;
  if (!botInstance && process.env.TELEGRAM_BOT_TOKEN) botInstance = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  const supergroupId = process.env.TELEGRAM_SUPERGROUP_ID;
  if (!botInstance || !supergroupId) return null;
  const topic = await botInstance.createForumTopic(supergroupId, `Predio · ${predio.nombre}`.substring(0, 128));
  const threadId = topic?.message_thread_id;
  if (!threadId) return null;
  // The topic already exists even if its welcome message or pin fails.
  try {
    const welcome = await botInstance.sendMessage(supergroupId,
      `PREDIO: ${predio.nombre}\n\nEste grupo reúne los reportes de todos los proyectos del predio.\nIndica el frente de obra en cada reporte con una línea: Frente: #ID.`,
      { message_thread_id: threadId });
    if (welcome?.message_id) await botInstance.pinChatMessage(supergroupId, welcome.message_id);
  } catch (error) { console.warn('Grupo creado; bienvenida pendiente:', error.message); }
  return threadId;
}

module.exports = {
  initTelegramBot,
  getBotInstance: () => botInstance,
  sendTopicMessage,
  createPredioForumTopic,
  notifyReporte,
  notifyIncidencia,
  generateTableroText,
  generateProyectosTareasText
};
