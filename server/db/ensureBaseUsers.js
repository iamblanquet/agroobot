const bcrypt = require('bcryptjs');
const { db } = require('./database');
const supabase = require('./supabase');

/**
 * Garantiza únicamente la existencia de los 5 usuarios canónicos
 * para permitir inicio de sesión (campo, supervisor, dirección, IT, maquinaria)
 * SIN sembrar proyectos de prueba, ni tareas, ni obras, ni interactuar con Telegram.
 */
async function ensureBaseUsers() {
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('demo123', saltRounds);

  const usuarios = [
    { username: 'campo_user', pin: '1234', nombre: 'Abner Díaz - Residente de Campo', rol: 'campo', tg_user_id: '12345678' },
    { username: 'sup_user', pin: '2345', nombre: 'Karen García - Supervisora de Operaciones', rol: 'supervisor', tg_user_id: '87654321' },
    { username: 'dir_user', pin: '3456', nombre: 'Luis - Dirección General', rol: 'direccion', tg_user_id: '11223344' },
    { username: 'admin_user', pin: '9999', nombre: 'Julio Silva - Administrador IT', rol: 'it', tg_user_id: '99887766' },
    { username: 'beche_user', pin: '5678', nombre: 'Beche Dorantes - Encargado de Maquinaria', rol: 'campo', tg_user_id: '55667788' }
  ];

  // 1. SQLite Local
  if (process.env.DISABLE_SQLITE !== 'true') {
    try {
      const userCount = await db.get('SELECT COUNT(*) as count FROM usuario');
      if (!userCount || userCount.count === 0) {
        console.log('👤 [ensureBaseUsers] Base de datos vacía. Registrando únicamente los 5 usuarios base para inicio de sesión...');
        for (const u of usuarios) {
          await db.run(
            `INSERT OR IGNORE INTO usuario (username, password_hash, pin, nombre, rol, tg_user_id, tg_chat_id, activo)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [u.username, passwordHash, u.pin, u.nombre, u.rol, u.tg_user_id, u.tg_user_id]
          );
        }
        console.log('✅ [ensureBaseUsers] Usuarios base registrados en SQLite (0 proyectos, 0 tareas, 0 temas de Telegram creados).');
      }

      // Entidades base necesarias para relaciones de maquinaria/contratos
      const entCount = await db.get('SELECT COUNT(*) as count FROM entidad');
      if (!entCount || entCount.count === 0) {
        await db.run("INSERT OR IGNORE INTO entidad (nombre, tipo, contacto) VALUES ('Aspromex', 'empresa', 'Corporativo Aspromex')");
        await db.run("INSERT OR IGNORE INTO entidad (nombre, tipo, contacto) VALUES ('Agrokool', 'empresa', 'Dirección General Agrokool')");
        await db.run("INSERT OR IGNORE INTO entidad (nombre, tipo, contacto) VALUES ('Particular / Tercero', 'externo', 'Arrendatarios de Zona')");
      }
    } catch (err) {
      console.warn('⚠️ [ensureBaseUsers] Aviso SQLite:', err.message);
    }
  }

  // 2. Supabase Cloud (si está configurado)
  if (supabase.isSupabaseConfigured()) {
    try {
      const sbUsers = await supabase.selectRows('usuario', { select: 'id,username' });
      if (!sbUsers || sbUsers.length === 0) {
        console.log('👤 [ensureBaseUsers] Supabase sin usuarios. Registrando usuarios base...');
        for (const u of usuarios) {
          await supabase.insertRow('usuario', {
            username: u.username,
            password_hash: passwordHash,
            pin: u.pin,
            nombre: u.nombre,
            rol: u.rol,
            tg_user_id: u.tg_user_id,
            tg_chat_id: u.tg_user_id,
            activo: 1
          });
        }
        console.log('✅ [ensureBaseUsers] Usuarios base registrados en Supabase.');
      }
    } catch (sbErr) {
      console.warn('⚠️ [ensureBaseUsers] Aviso Supabase:', sbErr.message);
    }
  }
}

module.exports = { ensureBaseUsers };
