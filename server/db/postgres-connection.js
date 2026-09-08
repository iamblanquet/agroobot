/**
 * Módulo de Conexión y Portabilidad PostgreSQL (Amazon RDS / Aurora / Supabase Pooler)
 * 
 * Permite usar SQL estándar de PostgreSQL y conectarse mediante DATABASE_URL
 * sin depender exclusivamente de clientes propietarios.
 */
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || '';

function isPostgresConfigured() {
  return Boolean(DATABASE_URL && DATABASE_URL.startsWith('postgres'));
}

/**
 * Pautas de exportación e importación para Amazon RDS / Aurora:
 * 
 * 1. Exportar datos desde Supabase / PostgreSQL estándar:
 *    pg_dump -h db.hhnuyhskmdklkpesghrg.supabase.co -U postgres -d postgres -F c -b -v -f backup_agrokool.dump
 * 
 * 2. Restaurar en Amazon RDS / Aurora PostgreSQL:
 *    pg_restore -h tu-cluster-rds.rds.amazonaws.com -p 5432 -U postgres -d tu_base_datos -v backup_agrokool.dump
 * 
 * 3. Actualizar la variable DATABASE_URL en .env:
 *    DATABASE_URL=postgresql://usuario:password@tu-cluster-rds.rds.amazonaws.com:5432/tu_base_datos?sslmode=require
 */

function getPostgresConfig() {
  if (!isPostgresConfigured()) {
    return {
      configured: false,
      message: 'DATABASE_URL no está configurada.'
    };
  }

  try {
    const url = new URL(DATABASE_URL);
    return {
      configured: true,
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.replace(/^\//, ''),
      user: url.username,
      ssl: url.searchParams.get('sslmode') || 'require'
    };
  } catch (err) {
    return {
      configured: false,
      message: 'DATABASE_URL inválida: ' + err.message
    };
  }
}

module.exports = {
  isPostgresConfigured,
  getPostgresConfig
};
