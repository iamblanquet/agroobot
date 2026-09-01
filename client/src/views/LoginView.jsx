import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { HardHat, Activity, BarChart3, Shield, Lock, User, AlertCircle, WifiOff, KeyRound, Delete } from 'lucide-react';

export default function LoginView() {
  const { loginWithPin, login, loginOffline, quickLogin, isOnline, offlineSimulated, toggleOfflineSimulation } = useAuth();
  
  // Modo de ingreso: 'pin' (predeterminado y rápido para campo) | 'password' (para administradores)
  const [authMode, setAuthMode] = useState('pin'); 
  const [pin, setPin] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Manejo del teclado numérico PIN táctil
  const handlePinDigit = async (digit) => {
    if (isLoading) return;
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(null);

      // Si se completan los 4 dígitos, autenticar automáticamente
      if (newPin.length === 4) {
        setIsLoading(true);
        try {
          await loginWithPin(newPin);
        } catch (err) {
          setError(err.message || 'PIN incorrecto.');
          setPin('');
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      setError(null);
    }
  };

  const handlePinClear = () => {
    setPin('');
    setError(null);
  };

  // Submit tradicional por usuario y password
  const handlePasswordSubmit = async (e) => {
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
      setError(err.message || 'Error en acceso rápido.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-6 relative overflow-hidden">
      {/* Glow background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl p-6 backdrop-blur-xl relative z-10 space-y-5">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-950 border border-emerald-500/40 text-emerald-400 font-black text-xl mb-2 shadow-inner">
            🌾
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">Operación AGROK</h2>
          <p className="text-[11px] text-slate-400">Acceso Rápido por PIN con Sesión Recordada</p>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2 shadow">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span><strong>Modo Fuera de Línea:</strong> PIN validado en memoria local.</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODO 1: TECLADO PIN DE 4 DÍGITOS (RECOMENDADO PARA CAMPO)                 */}
        {/* ========================================================================= */}
        {authMode === 'pin' && (
          <div className="space-y-4">
            {/* Indicador de 4 dígitos */}
            <div className="flex flex-col items-center justify-center py-2 space-y-2">
              <div className="flex gap-4">
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                        isFilled
                          ? 'bg-emerald-400 border-emerald-400 scale-125 shadow-lg shadow-emerald-500/50'
                          : 'border-slate-600 bg-slate-950'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {isLoading ? 'Validando PIN...' : 'Digita tu PIN de 4 números'}
              </p>
            </div>

            {/* Teclado Numérico Táctil */}
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinDigit(String(num))}
                  disabled={isLoading}
                  className="h-13 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 active:bg-emerald-900 border border-slate-800 text-white font-bold text-lg transition shadow-sm flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handlePinClear}
                disabled={isLoading || pin.length === 0}
                className="h-13 py-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 text-slate-400 text-xs font-semibold transition"
              >
                Limpiar
              </button>

              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                disabled={isLoading}
                className="h-13 py-3 rounded-2xl bg-slate-950 hover:bg-slate-800 active:bg-emerald-900 border border-slate-800 text-white font-bold text-lg transition shadow-sm flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handlePinDelete}
                disabled={isLoading || pin.length === 0}
                className="h-13 py-3 rounded-2xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 text-rose-400 text-sm font-semibold transition flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Alternar a contraseña */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null); }}
                className="text-xs text-slate-400 hover:text-emerald-400 underline transition"
              >
                Ingreso con Usuario y Contraseña
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODO 2: FORMULARIO ADMINISTRATIVO TRADICIONAL                             */}
        {/* ========================================================================= */}
        {authMode === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
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
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
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
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/60"
            >
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setError(null); }}
                className="text-xs text-emerald-400 hover:underline flex items-center justify-center gap-1 mx-auto"
              >
                <KeyRound className="w-3.5 h-3.5" /> Volver al PIN Rápido
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* ACCESOS RÁPIDOS DIRECTOS                                                  */}
        {/* ========================================================================= */}
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              ⚡ Botones de Demo (1 Toque)
            </p>
            <button
              type="button"
              onClick={toggleOfflineSimulation}
              className="text-[10px] text-amber-400 hover:underline"
            >
              {offlineSimulated ? '🟢 Online' : '🟠 Probar Offline'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuick('campo')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-emerald-950/70 border border-slate-800 text-left transition flex items-center gap-1.5"
            >
              <HardHat className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">1. Campo</p>
                <p className="text-[9px] text-slate-500">PIN: 1234</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('supervisor')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-blue-950/70 border border-slate-800 text-left transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">2. Supervisor</p>
                <p className="text-[9px] text-slate-500">PIN: 2345</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('direccion')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-purple-950/70 border border-slate-800 text-left transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">3. Dirección</p>
                <p className="text-[9px] text-slate-500">PIN: 3456</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('it')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-950 hover:bg-amber-950/70 border border-slate-800 text-left transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <p className="text-[11px] font-bold text-slate-200">4. Admin IT</p>
                <p className="text-[9px] text-slate-500">PIN: 9999</p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
