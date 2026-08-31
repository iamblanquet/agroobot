import { openDB } from 'idb';

const DB_NAME = 'tesa_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Almacén para reportes pendientes de sincronizar
        if (!db.objectStoreNames.contains('pending_reports')) {
          const reportStore = db.createObjectStore('pending_reports', { keyPath: 'client_uuid' });
          reportStore.createIndex('created_at', 'created_at');
        }

        // Almacén para caché local del catálogo (para uso offline de los selectores)
        if (!db.objectStoreNames.contains('catalog_cache')) {
          db.createObjectStore('catalog_cache', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Guarda un reporte en la cola offline de IndexedDB
 */
export async function saveReportOffline(report) {
  const db = await getOfflineDb();
  const reportWithMeta = {
    ...report,
    saved_at: new Date().toISOString(),
    sync_status: 'pending'
  };
  await db.put('pending_reports', reportWithMeta);
  console.log(`📦 Reporte ${report.client_uuid} guardado en IndexedDB local.`);
  return reportWithMeta;
}

/**
 * Obtiene todos los reportes pendientes
 */
export async function getPendingReports() {
  const db = await getOfflineDb();
  return db.getAll('pending_reports');
}

/**
 * Cuenta cuántos reportes están en cola
 */
export async function countPendingReports() {
  const db = await getOfflineDb();
  return db.count('pending_reports');
}

/**
 * Elimina un reporte de la cola tras sincronización exitosa
 */
export async function removePendingReport(client_uuid) {
  const db = await getOfflineDb();
  await db.delete('pending_reports', client_uuid);
}

/**
 * Guarda en caché el catálogo de opciones en cascada
 */
export async function cacheCatalogData(data) {
  try {
    const db = await getOfflineDb();
    await db.put('catalog_cache', { key: 'cascade_catalog', data, cached_at: new Date().toISOString() });
  } catch (err) {
    console.warn('Error al guardar caché de catálogo:', err);
  }
}

/**
 * Recupera el catálogo en caché si no hay conexión
 */
export async function getCachedCatalogData() {
  try {
    const db = await getOfflineDb();
    const entry = await db.get('catalog_cache', 'cascade_catalog');
    return entry ? entry.data : null;
  } catch (err) {
    console.warn('Error al leer caché de catálogo:', err);
    return null;
  }
}

/**
 * Sincroniza todos los reportes pendientes con el backend Standalone API
 */
export async function syncPendingReports(apiClient) {
  const pending = await getPendingReports();
  if (!pending || pending.length === 0) {
    return { count: 0, synced: 0, errors: [] };
  }

  console.log(`🚀 Iniciando sincronización de ${pending.length} reportes offline...`);

  try {
    const response = await apiClient.post('/reports/sync', { reports: pending });

    if (response.success && response.results) {
      // Eliminar de IndexedDB los que se sincronizaron o ya existían (idempotentes)
      for (const res of response.results) {
        if (res.status === 'synced' || res.status === 'ignored') {
          await removePendingReport(res.client_uuid);
        }
      }
    }

    return {
      count: pending.length,
      synced: response.syncedCount || 0,
      ignored: response.ignoredCount || 0,
      raw: response
    };
  } catch (err) {
    console.error('Error al sincronizar con el servidor:', err);
    throw err;
  }
}
