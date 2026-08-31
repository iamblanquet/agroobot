import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { countPendingReports, syncPendingReports } from '../db/indexedDb';
import api from '../api/client';

export default function OfflineBadge({ onSyncComplete }) {
  const { offlineSimulated, toggleOfflineSimulation } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  const effectiveOnline = isOnline && !offlineSimulated;

  const updateCount = async () => {
    try {
      const count = await countPendingReports();
      setPendingCount(count);
    } catch (e) {
      console.warn('Error contando pendientes:', e);
    }
  };

  useEffect(() => {
    updateCount();
    const interval = setInterval(updateCount, 3000);

    const handleOnline = async () => {
      setIsOnline(true);
      if (!offlineSimulated) {
        handleManualSync();
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [offlineSimulated]);

  const handleManualSync = async () => {
    if (!effectiveOnline) {
      setSyncFeedback({ type: 'warning', text: 'Modo sin conexión activo. Desactiva la simulación para sincronizar.' });
      setTimeout(() => setSyncFeedback(null), 4000);
      return;
    }

    setIsSyncing(true);
    try {
      const result = await syncPendingReports(api);
      await updateCount();
      if (result.count > 0) {
        setSyncFeedback({
          type: 'success',
          text: `Sincronizados ${result.synced} reportes (${result.ignored} ya existentes).`
        });
        if (onSyncComplete) onSyncComplete();
      } else {
        setSyncFeedback({ type: 'info', text: 'Todos los datos están al día en el servidor.' });
      }
    } catch (err) {
      setSyncFeedback({ type: 'error', text: 'Fallo al sincronizar con el servidor.' });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 4000);
    }
  };

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

      {/* Cola de Pendientes y Sincronización Manual */}
      {pendingCount > 0 && (
        <button
          type="button"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/80 text-blue-300 border border-blue-500/40 hover:bg-blue-900/60 transition shadow-sm"
        >
          <Database className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-semibold">{pendingCount} pendiente{pendingCount > 1 ? 's' : ''}</span>
          <RefreshCw className={`w-3 h-3 text-blue-300 ml-0.5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Feedback Toast */}
      {syncFeedback && (
        <div className={`px-3 py-1 rounded-lg text-xs font-medium ${
          syncFeedback.type === 'success' ? 'bg-emerald-900 text-emerald-100 border border-emerald-600' :
          syncFeedback.type === 'warning' ? 'bg-amber-900 text-amber-100 border border-amber-600' :
          syncFeedback.type === 'error' ? 'bg-rose-900 text-rose-100 border border-rose-600' :
          'bg-slate-800 text-slate-200 border border-slate-700'
        }`}>
          {syncFeedback.text}
        </div>
      )}
    </div>
  );
}
