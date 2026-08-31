require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
console.log('🤖 Probando conexión con el Bot Token de Telegram...');

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN no encontrado en .env');
  process.exit(1);
}

const bot = new TelegramBot(token);

bot.getMe()
  .then((botInfo) => {
    console.log('\n====================================================');
    console.log('✅ ¡CONEXIÓN EXITOSA CON TELEGRAM!');
    console.log(`🤖 Nombre del Bot: ${botInfo.first_name}`);
    console.log(`👤 Usuario de Telegram: @${botInfo.username}`);
    console.log(`🆔 Bot ID: ${botInfo.id}`);
    console.log('====================================================\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error al conectar con Telegram API:', err.message);
    process.exit(1);
  });
