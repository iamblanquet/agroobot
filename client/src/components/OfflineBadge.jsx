import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, Database, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { countPendingReports, syncPendingReports } from '../db/indexedDb';
import api from '../api/client';

export default function OfflineBadge({ onSyncComplete }) {
  const { offlineSimulated, toggleOfflineSimulation } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncInFlight = useRef(false);
  const attemptedPendingCount = useRef(null);

  const effectiveOnline = isOnline && !offlineSimulated;

  const updateCount = useCallback(async () => {
    try {
      const count = await countPendingReports();
      setPendingCount(count);
    } catch (e) {
      console.warn('Error contando pendientes:', e);
    }
  }, []);

  const syncSavedReports = useCallback(async () => {
    if (!navigator.onLine || offlineSimulated || syncInFlight.current) return;
    syncInFlight.current = true;
    setIsSyncing(true);
    try {
      const result = await syncPendingReports(api);
      await updateCount();
      if (result.synced > 0) onSyncComplete?.();
    } catch (error) {
      console.warn('Los reportes guardados localmente siguen pendientes:', error);
    } finally {
      syncInFlight.current = false;
      setIsSyncing(false);
    }
  }, [offlineSimulated, onSyncComplete, updateCount]);

  useEffect(() => {
    updateCount();
    const interval = setInterval(updateCount, 3000);

    const handleOnline = () => {
      setIsOnline(true);
      attemptedPendingCount.current = null;
      syncSavedReports();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineSimulated, syncSavedReports, updateCount]);

  useEffect(() => {
    if (effectiveOnline && pendingCount > 0 && attemptedPendingCount.current !== pendingCount) {
      attemptedPendingCount.current = pendingCount;
      syncSavedReports();
    }
  }, [effectiveOnline, pendingCount, syncSavedReports]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {/* Botón / Indicador de Conexión */}
      <button
        type="button"
        onClick={toggleOfflineSimulation}
        title="Haz clic para alternar la simulación de modo Sin Señal"
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-all shadow-sm ${
          effectiveOnline
            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400'
            : 'bg-amber-950/90 text-amber-300 border border-amber-500/50 hover:border-amber-400 animate-pulse'
        }`}
      >
        {effectiveOnline ? (
          <>
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>En Línea</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            <span>{offlineSimulated ? 'Sin Señal (Simulado)' : 'Sin Conexión'}</span>
          </>
        )}
      </button>

      {/* Cola local: se sincroniza al recuperar conexión. */}
      {pendingCount > 0 && (
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/40 shadow-sm">
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
          {isSyncing && <RefreshCw className="w-3 h-3 text-blue-300 animate-spin" />}
        </span>
      )}
    </div>
  );
}
