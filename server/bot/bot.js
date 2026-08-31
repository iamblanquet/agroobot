const TelegramBot = require('node-telegram-bot-api');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/database');
const { parseFreeTextReport } = require('./parser');

let botInstance = null;

function initTelegramBot(app) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const miniAppUrl = process.env.TELEGRAM_MINI_APP_URL || 'http://localhost:3000';
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const isProduction = process.env.NODE_ENV === 'production' && webhookUrl;

  if (!token || token.trim() === '' || token.includes('your_token')) {
    console.log('ℹ️ Bot de Telegram no iniciado: TELEGRAM_BOT_TOKEN no configurado (Modo Standalone / Mini App Web activa).');
    return null;
  }

  try {
    if (isProduction) {
      botInstance = new TelegramBot(token);
      const webhookPath = `/api/telegram/webhook/${token}`;
      botInstance.setWebHook(`${webhookUrl}${webhookPath}`).catch(err => {
        console.warn('Aviso al configurar Webhook:', err.message);
      });
      app.post(webhookPath, (req, res) => {
        botInstance.processUpdate(req.body);
        res.sendStatus(200);
      });
      console.log(`🤖 Bot de Telegram iniciado en MODO WEBHOOK: ${webhookUrl}${webhookPath}`);
    } else {
      botInstance = new TelegramBot(token, { polling: true });
      console.log('🤖 Bot de Telegram iniciado en MODO POLLING (Desarrollo).');
    }

    const hasHttps = miniAppUrl && miniAppUrl.startsWith('https://');

    // Configurar Botón de Menú Oficial de Telegram apuntando a la Mini App si tiene HTTPS
    if (hasHttps) {
      botInstance.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '🚀 Operación TESA',
          web_app: { url: miniAppUrl }
        }
      }).catch(err => console.log('Aviso setChatMenuButton:', err.message));
    }

    // Teclado persistente para la interacción rápida en chat (respetando requisito de HTTPS)
    const appButton = hasHttps
      ? [{ text: '🚀 ABRIR MINI APP', web_app: { url: miniAppUrl } }]
      : [{ text: '🚀 Abrir Mini App (Web)' }];

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

    // 1. Comando /start y /menu
    botInstance.onText(/\/(start|menu)/, async (msg) => {
      const chatId = msg.chat.id;
      const firstName = msg.from.first_name || 'Operador';
      const tgUserId = String(msg.from.id);

      // Vincular tg_chat_id si el usuario existe
      try {
        await db.run('UPDATE usuario SET tg_chat_id = ? WHERE tg_user_id = ?', [String(chatId), tgUserId]);
      } catch (e) {
        console.warn('Aviso al vincular tg_chat_id:', e.message);
      }

      const welcomeMsg = `👋 *¡Bienvenido al Sistema de Operación TESA, ${firstName}!*

🚜 *Entorno Agrícola & Control de Maquinaria*
Utiliza este bot para reportar avances rápidos, registrar lecturas de horómetros o consultar el estatus de obra.

📱 *Opciones disponibles:*
• Pulsa *🚀 ABRIR MINI APP* para el formulario completo y modo sin conexión.
• Envía reportes en texto libre:
  \`Obra: Norte | Avance: 8.5 ha | Cuadrilla: 4 op\`
• Reporta paros con: \`/sin_actividad [motivo]\`
• Cierra incidencias con: \`/cerrar [folio] [causa_raiz]\``;

      botInstance.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', ...mainKeyboard })
        .catch(err => console.error('Error enviando welcomeMsg:', err.message));
    });

    // 2. Comando /sin_actividad [motivo]
    botInstance.onText(/\/sin_actividad(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const motivo = match[1] || 'Sin actividad declarada por el operador';
      const author = `${msg.from.first_name || 'Usuario'} (Telegram ID: ${msg.from.id})`;

      try {
        const clientUuid = `tg-paro-${uuidv4()}`;
        const today = new Date().toISOString().split('T')[0];

        await db.run(
          `INSERT INTO reporte (
            client_uuid, fecha_operativa, autor_nombre, texto_original,
            nota, estado, es_sin_actividad, motivo_sin_actividad
          ) VALUES (?, ?, ?, ?, ?, 'confirmado', 1, ?)`,
          [clientUuid, today, author, msg.text, 'Reportado vía Telegram Bot', motivo]
        );

        botInstance.sendMessage(
          chatId,
          `🌧️ *DÍA SIN ACTIVIDAD REGISTRADO*\n\n📅 *Fecha:* \`${today}\`\n📝 *Motivo:* ${motivo}\n👤 *Autor:* ${author}\n\n✅ Guardado en base de datos central.`,
          { parse_mode: 'Markdown', ...mainKeyboard }
        ).catch(err => console.error('Error sendMessage:', err.message));
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error al registrar paro: ${err.message}`)
          .catch(e => console.error('Error sendMessage:', e.message));
      }
    });

    // 3. Comando /cerrar [folio] [causa_raiz]
    botInstance.onText(/\/cerrar(?:\s+([A-Za-z0-9_-]+))?(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const folio = match[1];
      const causaRaiz = match[2];

      if (!folio) {
        return botInstance.sendMessage(
          chatId,
          `ℹ️ *Uso correcto:* \`/cerrar [FOLIO] [Causa Raíz detallada (min 10 caracteres)]\`\nEjemplo: \`/cerrar INC-2026-001 Se reemplazó la manguera hidráulica fracturada\``,
          { parse_mode: 'Markdown' }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      if (!causaRaiz || causaRaiz.trim().length < 10) {
        return botInstance.sendMessage(
          chatId,
          `❌ *Rechazado:* La causa raíz es obligatoria y debe contener al menos 10 caracteres de justificación técnica.`,
          { parse_mode: 'Markdown' }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      try {
        const issue = await db.get('SELECT * FROM incidencia WHERE folio = ? OR id = ?', [folio, folio]);
        if (!issue) {
          return botInstance.sendMessage(chatId, `❌ Incidencia con folio *${folio}* no encontrada.`, { parse_mode: 'Markdown' })
            .catch(err => console.error('Error sendMessage:', err.message));
        }

        if (issue.estado === 'cerrada') {
          return botInstance.sendMessage(chatId, `⚠️ La incidencia *${folio}* ya estaba cerrada previamente.`, { parse_mode: 'Markdown' })
            .catch(err => console.error('Error sendMessage:', err.message));
        }

        await db.run(
          `UPDATE incidencia
           SET estado = 'cerrada',
               cerrada_en = datetime('now'),
               causa_raiz = ?
           WHERE id = ?`,
          [causaRaiz.trim(), issue.id]
        );

        botInstance.sendMessage(
          chatId,
          `✅ *INCIDENCIA CERRADA EXITOSAMENTE*\n\n📌 *Folio:* \`${issue.folio}\`\n🔍 *Causa Raíz:* ${causaRaiz.trim()}\n⏰ *Fecha Cierre:* \`${new Date().toISOString()}\``,
          { parse_mode: 'Markdown', ...mainKeyboard }
        ).catch(err => console.error('Error sendMessage:', err.message));
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error al cerrar incidencia: ${err.message}`)
          .catch(e => console.error('Error sendMessage:', e.message));
      }
    });

    // 4. Comando /horometro [maquina] [inicio] [fin] [litros]
    botInstance.onText(/\/horometro(?:\s+([A-Za-z0-9_-]+))?(?:\s+([\d.,]+))?(?:\s+([\d.,]+))?(?:\s+([\d.,]+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const codigo = match[1];
      const hInicio = match[2] ? parseFloat(match[2].replace(',', '.')) : null;
      const hFin = match[3] ? parseFloat(match[3].replace(',', '.')) : null;
      const litros = match[4] ? parseFloat(match[4].replace(',', '.')) : 0;

      if (!codigo || hInicio === null || hFin === null) {
        return botInstance.sendMessage(
          chatId,
          `ℹ️ *Uso correcto:* \`/horometro [CODIGO_MAQUINA] [INICIO] [FIN] [LITROS]\`\nEjemplo: \`/horometro CAT-D6T-01 285.0 293.0 140\``,
          { parse_mode: 'Markdown' }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      try {
        const maq = await db.get('SELECT * FROM maquina WHERE codigo = ?', [codigo.toUpperCase()]);
        if (!maq) {
          return botInstance.sendMessage(chatId, `❌ Máquina con código *${codigo}* no encontrada.`, { parse_mode: 'Markdown' })
            .catch(err => console.error('Error sendMessage:', err.message));
        }

        const hrsTrabajadas = Math.max(0, hFin - hInicio);
        const clientUuid = `tg-horo-${uuidv4()}`;
        const today = new Date().toISOString().split('T')[0];
        const author = `${msg.from.first_name || 'Usuario'} (Telegram)`;

        // Crear reporte base
        const repRes = await db.run(
          `INSERT INTO reporte (client_uuid, fecha_operativa, autor_nombre, texto_original, nota, estado, es_sin_actividad)
           VALUES (?, ?, ?, ?, 'Lectura directa de horómetro vía bot', 'confirmado', 0)`,
          [clientUuid, today, author, msg.text]
        );

        await db.run(
          `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [repRes.lastID, maq.id, hInicio, hFin, hrsTrabajadas, litros]
        );

        const nuevoHorometro = Math.max(maq.horometro_actual, hFin);
        const hrsDesdeServicio = nuevoHorometro - (maq.ultimo_servicio_hr || 0);
        const alerta = hrsDesdeServicio >= 280 ? 1 : 0;

        await db.run(
          `UPDATE maquina SET horometro_actual = ?, alerta_mantenimiento = ? WHERE id = ?`,
          [nuevoHorometro, alerta, maq.id]
        );

        let alertText = alerta ? `\n🚨 *ALERTA DE MANTENIMIENTO:* Acumulado: ${hrsDesdeServicio} hrs (Faltan ≤ ${Math.max(0, 300 - hrsDesdeServicio)} hrs para servicio 300h)` : '';

        botInstance.sendMessage(
          chatId,
          `🚜 *HORÓMETRO REGISTRADO*\n\n🚜 *Máquina:* \`${maq.codigo}\` (${maq.modelo})\n⏱️ *Inicio:* ${hInicio} hrs ➔ *Fin:* ${hFin} hrs\n⚡ *Horas Trabajadas:* ${hrsTrabajadas} hrs\n⛽ *Diésel:* ${litros} L${alertText}`,
          { parse_mode: 'Markdown', ...mainKeyboard }
        ).catch(err => console.error('Error sendMessage:', err.message));
      } catch (err) {
        botInstance.sendMessage(chatId, `❌ Error al guardar horómetro: ${err.message}`)
          .catch(e => console.error('Error sendMessage:', e.message));
      }
    });

    // 5. Manejador de Botones del Teclado y Texto Libre
    botInstance.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;

      const chatId = msg.chat.id;
      const text = msg.text.trim();

      // Botón: 🚀 Abrir Mini App (Web) (cuando no hay HTTPS)
      if (text === '🚀 Abrir Mini App (Web)') {
        return botInstance.sendMessage(
          chatId,
          `📱 *PLATAFORMA WEB TESA*\nPuedes acceder al sistema desde tu navegador en:\n👉 ${miniAppUrl}\n\n💡 _Nota: Para abrir la Mini App directamente incrustada en Telegram, necesitas configurar una URL con HTTPS en tu archivo .env (usando localtunnel o ngrok)._`,
          { parse_mode: 'Markdown', ...mainKeyboard }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      // Botón: 📊 Tablero Hoy
      if (text === '📊 Tablero Hoy') {
        const today = new Date().toISOString().split('T')[0];
        const reportsCount = await db.get('SELECT COUNT(*) as total FROM reporte WHERE fecha_operativa = ?', [today]);
        const issuesCount = await db.get("SELECT COUNT(*) as total FROM incidencia WHERE estado != 'cerrada'");
        const alertMaqs = await db.get('SELECT COUNT(*) as total FROM maquina WHERE alerta_mantenimiento = 1');

        return botInstance.sendMessage(
          chatId,
          `📊 *ESTADO GENERAL DEL DÍA (${today})*\n\n📝 *Reportes recibidos hoy:* ${reportsCount?.total || 0}\n⚠️ *Incidencias abiertas:* ${issuesCount?.total || 0}\n🚨 *Máquinas en alerta preventiva:* ${alertMaqs?.total || 0}\n\nPara ver gráficos detallados abre la Mini App.`,
          { parse_mode: 'Markdown', ...mainKeyboard }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      // Botón: ⚠️ Incidencias
      if (text === '⚠️ Incidencias') {
        const openIssues = await db.all(`
          SELECT i.folio, i.tipo, i.estado, o.nombre AS obra_nombre
          FROM incidencia i
          JOIN obra o ON i.obra_id = o.id
          WHERE i.estado != 'cerrada'
          ORDER BY i.abierta_en DESC LIMIT 5
        `);

        if (openIssues.length === 0) {
          return botInstance.sendMessage(chatId, '✅ *Excelente:* No hay incidencias activas pendientes en este momento.', { parse_mode: 'Markdown' })
            .catch(err => console.error('Error sendMessage:', err.message));
        }

        let resp = `⚠️ *INCIDENCIAS ACTIVAS (${openIssues.length})*\n\n`;
        openIssues.forEach(i => {
          resp += `📌 *${i.folio}* [${i.estado.toUpperCase()}]\n🏢 *Obra:* ${i.obra_nombre}\n📝 ${i.tipo}\n\n`;
        });
        resp += `_Para cerrar una incidencia usa:_ \`/cerrar [FOLIO] [Causa Raíz]\``;

        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', ...mainKeyboard })
          .catch(err => console.error('Error sendMessage:', err.message));
      }

      // Botón: 🚜 Horómetro
      if (text === '🚜 Horómetro') {
        const maqs = await db.all('SELECT codigo, modelo, horometro_actual, alerta_mantenimiento FROM maquina ORDER BY codigo ASC');
        let resp = `🚜 *PARQUE DE MAQUINARIA*\n\n`;
        maqs.forEach(m => {
          const statusIcon = m.alerta_mantenimiento ? '🚨 *ALERTA*' : '✅ OK';
          resp += `• \`${m.codigo}\` - ${m.horometro_actual} hrs [${statusIcon}]\n`;
        });
        resp += `\n_Para registrar lectura:_ \`/horometro [CODIGO] [INICIO] [FIN] [LITROS]\``;
        return botInstance.sendMessage(chatId, resp, { parse_mode: 'Markdown', ...mainKeyboard })
          .catch(err => console.error('Error sendMessage:', err.message));
      }

      // Botón: 🌧️ Sin Actividad
      if (text === '🌧️ Sin Actividad') {
        return botInstance.sendMessage(
          chatId,
          `🌧️ Para registrar paro de operaciones, escribe:\n\`/sin_actividad [motivo por el que no se laboró]\`\n\nEjemplo: \`/sin_actividad Lluvia en el predio El Molino\``,
          { parse_mode: 'Markdown' }
        ).catch(err => console.error('Error sendMessage:', err.message));
      }

      // 6. Procesar Texto Libre con Regex NLP Parser
      const parsed = parseFreeTextReport(text);
      if (parsed.isValid) {
        try {
          const clientUuid = `tg-nlp-${uuidv4()}`;
          const today = new Date().toISOString().split('T')[0];
          const author = `${msg.from.first_name || 'Operador'} (Telegram)`;

          // Buscar obra por similitud de nombre
          let obra = null;
          if (parsed.obra_nombre) {
            obra = await db.get(
              `SELECT o.*, p.id AS proyecto_id FROM obra o JOIN proyecto p ON o.proyecto_id = p.id WHERE o.nombre LIKE ? LIMIT 1`,
              [`%${parsed.obra_nombre}%`]
            );
          }
          if (!obra) {
            obra = await db.get('SELECT o.*, p.id AS proyecto_id FROM obra o JOIN proyecto p ON o.proyecto_id = p.id LIMIT 1');
          }

          const repRes = await db.run(
            `INSERT INTO reporte (
              client_uuid, proyecto_id, obra_id, fecha_operativa, autor_nombre,
              texto_original, nota, estado, es_sin_actividad, motivo_sin_actividad
            ) VALUES (?, ?, ?, ?, ?, ?, 'Procesado automáticamente vía NLP Regex Parser', 'confirmado', ?, ?)`,
            [
              clientUuid,
              obra?.proyecto_id || null,
              obra?.id || null,
              today,
              author,
              text,
              parsed.es_sin_actividad ? 1 : 0,
              parsed.motivo_sin_actividad || null
            ]
          );

          const repId = repRes.lastID;

          if (!parsed.es_sin_actividad) {
            // Guardar línea de avance
            if (parsed.avance_ha > 0) {
              await db.run(
                `INSERT INTO reporte_linea (reporte_id, actividad_id, cantidad, unidad, cantidad_ha, fuente)
                 VALUES (?, ?, ?, 'ha', ?, 'campo')`,
                [repId, parsed.actividad, parsed.avance_ha, parsed.avance_ha]
              );
            }

            // Guardar cuadrilla
            if (parsed.cuadrilla_count > 0) {
              await db.run(
                `INSERT INTO reporte_cuadrilla (reporte_id, rol_id, headcount)
                 VALUES (?, 'operador', ?)`,
                [repId, parsed.cuadrilla_count]
              );
            }

            // Guardar maquinaria si venía en el texto
            if (parsed.maquinaria?.codigo) {
              const maq = await db.get('SELECT * FROM maquina WHERE codigo = ?', [parsed.maquinaria.codigo.toUpperCase()]);
              if (maq) {
                const hIni = parsed.maquinaria.horometro_inicio || maq.horometro_actual;
                const hFin = parsed.maquinaria.horometro_fin || hIni;
                const hTrab = Math.max(0, hFin - hIni);
                await db.run(
                  `INSERT INTO lectura_maquina (reporte_id, maquina_id, horometro_inicio, horometro_fin, horas_trabajadas, litros_diesel)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [repId, maq.id, hIni, hFin, hTrab, parsed.maquinaria.litros_diesel || 0]
                );

                const nuevoHoro = Math.max(maq.horometro_actual, hFin);
                const alerta = (nuevoHoro - maq.ultimo_servicio_hr) >= 280 ? 1 : 0;
                await db.run('UPDATE maquina SET horometro_actual = ?, alerta_mantenimiento = ? WHERE id = ?', [nuevoHoro, alerta, maq.id]);
              }
            }
          }

          let confirmMsg = `✅ *REPORTE ESTRUCTURADO GUARDADO*\n\n`;
          if (parsed.es_sin_actividad) {
            confirmMsg += `🌧️ *Sin Actividad:* ${parsed.motivo_sin_actividad}\n`;
          } else {
            confirmMsg += `🏢 *Obra:* ${obra?.nombre || 'General'}\n`;
            confirmMsg += `🌾 *Avance:* ${parsed.avance_ha} ha (${parsed.actividad})\n`;
            confirmMsg += `👥 *Cuadrilla:* ${parsed.cuadrilla_count} operador(es)\n`;
            if (parsed.maquinaria?.codigo) {
              confirmMsg += `🚜 *Máquina:* ${parsed.maquinaria.codigo} (${parsed.maquinaria.horas_trabajadas} hrs trab.)\n`;
            }
          }
          confirmMsg += `\n💾 _Folio de sincronización:_ \`${clientUuid}\``;

          botInstance.sendMessage(chatId, confirmMsg, { parse_mode: 'Markdown', ...mainKeyboard })
            .catch(err => console.error('Error sendMessage:', err.message));
        } catch (err) {
          botInstance.sendMessage(chatId, `❌ Error al estructurar reporte: ${err.message}`)
            .catch(e => console.error('Error sendMessage:', e.message));
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
  getBotInstance: () => botInstance
};
