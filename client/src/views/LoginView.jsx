import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Activity, BarChart3, Shield, Send, Lock, User, AlertCircle, WifiOff, CheckCircle2 } from 'lucide-react';

export default function LoginView() {
  const { login, loginOffline, quickLogin, loginWithTelegram, isTelegram, tgUser, isOnline, offlineSimulated, toggleOfflineSimulation } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuick = async (role) => {
    setError(null);
    setIsLoading(true);
    try {
      await quickLogin(role);
    } catch (err) {
      setError(err.message || 'Error en acceso.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflineDirect = () => {
    loginOffline(username || 'campo_user');
  };

  const handleTelegramAuth = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithTelegram();
    } catch (err) {
      setError(err.message || 'Fallo de autenticación con Telegram.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Glow background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 font-black text-2xl mb-3 shadow-inner">
            TESA
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Operación de Campo & Tablero</h2>
          <p className="text-xs text-slate-400 mt-1">Patrón TESA: Telegram Entry • Standalone API • Offline Storage</p>
        </div>

        {/* Offline Status Alert */}
        {!isOnline && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-md">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span><strong>Sin Conexión:</strong> Modo Fuera de Línea activo.</span>
            </div>
            <button
              type="button"
              onClick={handleOfflineDirect}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] transition shadow"
            >
              Entrar Offline
            </button>
          </div>
        )}

        {/* Telegram WebApp Auto Login */}
        {isTelegram && isOnline && (
          <div className="mb-6 p-4 rounded-xl bg-sky-950/60 border border-sky-600/40 text-center">
            <div className="flex items-center justify-center gap-2 text-sky-400 text-sm font-semibold mb-1">
              <Send className="w-4 h-4" /> Telegram WebApp Detectado
            </div>
            <p className="text-xs text-sky-200/80 mb-3">
              {tgUser ? `Conectado como ${tgUser.first_name} (ID: ${tgUser.id})` : 'Sesión activa de Telegram'}
            </p>
            <button
              type="button"
              onClick={handleTelegramAuth}
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition shadow-md shadow-sky-950/50 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" /> Ingresar con Firma Telegram (HMAC-SHA256)
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulario Tradicional */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Usuario
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ej. campo_user, sup_user..."
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                required={isOnline}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-sm transition shadow-lg shadow-emerald-950/60"
          >
            {isLoading ? 'Iniciando sesión...' : !isOnline ? 'Ingresar en Modo Fuera de Línea' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Accesos Rápidos (1-Clic) */}
        <div className="mt-6 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              ⚡ Acceso Rápido {!isOnline && '(Offline)'}
            </p>
            <button
              type="button"
              onClick={toggleOfflineSimulation}
              className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
            >
              <WifiOff className="w-3 h-3" /> {offlineSimulated ? 'Modo Online' : 'Simular Offline'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuick('campo')}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500/40 text-left transition flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded bg-emerald-950 text-emerald-400 group-hover:scale-110 transition">
                <HardHat className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">1. Campo</p>
                <p className="text-[10px] text-slate-500">campo_user</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('supervisor')}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-500/40 text-left transition flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded bg-blue-950 text-blue-400 group-hover:scale-110 transition">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">2. Supervisor</p>
                <p className="text-[10px] text-slate-500">sup_user</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('direccion')}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/40 text-left transition flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded bg-purple-950 text-purple-400 group-hover:scale-110 transition">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">3. Dirección</p>
                <p className="text-[10px] text-slate-500">dir_user</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('it')}
              disabled={isLoading}
              className="p-2.5 rounded-lg bg-slate-950 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500/40 text-left transition flex items-center gap-2 group"
            >
              <div className="p-1.5 rounded bg-amber-950 text-amber-400 group-hover:scale-110 transition">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">4. Admin IT</p>
                <p className="text-[10px] text-slate-500">admin_user</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
