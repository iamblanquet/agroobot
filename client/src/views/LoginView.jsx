import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HardHat,
  Activity,
  BarChart3,
  Shield,
  Lock,
  User,
  AlertCircle,
  WifiOff,
  KeyRound,
  Delete,
  Sun,
  Moon
} from 'lucide-react';

export default function LoginView() {
  const { loginWithPin, login, quickLogin, isOnline, offlineSimulated, toggleOfflineSimulation } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  
  // Modo de ingreso: 'pin' (predeterminado y táctil para campo) | 'password' (para administradores)
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
    <div className="min-h-screen bg-[#f8faf2] dark:bg-[#0c1400] flex flex-col justify-center items-center px-4 py-6 relative overflow-hidden transition-colors duration-200">
      {/* Botón flotante para cambiar tema en pantalla de login */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 p-2.5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] text-[#2c4001] dark:text-[#a1c62e] hover:text-[#a87d13] transition shadow-sm"
        title="Alternar Modo Claro / Oscuro"
      >
        {isDark ? <Sun className="w-4 h-4 text-[#dfb75c]" /> : <Moon className="w-4 h-4 text-[#2c4001]" />}
      </button>

      {/* Sutil halo decorativo con verde lima y bosque */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#a1c62e]/15 dark:bg-[#2c4001]/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] rounded-3xl shadow-xl dark:shadow-2xl p-6 backdrop-blur-xl relative z-10 space-y-5">
        
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-black border-2 border-[#a1c62e] shadow-lg shadow-[#2c4001]/20 overflow-hidden mb-2 p-1">
            <img src="/logo.png" alt="AGROKOOL Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-xl font-black text-[#2c4001] dark:text-white tracking-wider font-serif">
            AGROKOOL
          </h2>
          <p className="text-[11px] text-[#5c6b4b] dark:text-[#a1c62e] font-bold uppercase tracking-wider mt-0.5">
            Operación de Campo · Acceso PIN
          </p>
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="p-2.5 rounded-xl bg-[#f9f2df] dark:bg-[#362409] border border-[#a87d13]/40 text-[#704f15] dark:text-[#f3e3ba] text-xs flex items-center justify-between gap-2 shadow-sm font-medium">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-[#a87d13] flex-shrink-0" />
              <span><strong>Modo Fuera de Línea:</strong> PIN validado en memoria local.</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-600/50 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2 animate-shake font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
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
                          ? 'bg-[#a1c62e] border-[#2c4001] dark:border-[#a1c62e] scale-125 shadow-md shadow-[#a1c62e]/50'
                          : 'border-[#d3e2be] dark:border-[#2f4509] bg-[#f8faf2] dark:bg-[#0c1400]'
                      }`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-[#5c6b4b] dark:text-[#a1c62e] font-bold">
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
                  className="h-12 sm:h-13 rounded-2xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#ebf3dc] dark:hover:bg-[#1f3004] active:bg-[#a1c62e] dark:active:bg-[#a1c62e] active:text-[#2c4001] border border-[#d3e2be] dark:border-[#2f4509] text-[#1c2d01] dark:text-white font-black text-xl transition shadow-sm flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              
              <button
                type="button"
                onClick={handlePinClear}
                disabled={isLoading || pin.length === 0}
                className="h-12 sm:h-13 rounded-2xl bg-[#f4f8ed] dark:bg-[#0c1400] hover:bg-[#e6f0d7] dark:hover:bg-[#152202] border border-[#d3e2be] dark:border-[#253905] text-[#5c6b4b] dark:text-[#a1c62e] text-xs font-bold transition"
              >
                Limpiar
              </button>

              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                disabled={isLoading}
                className="h-12 sm:h-13 rounded-2xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#ebf3dc] dark:hover:bg-[#1f3004] active:bg-[#a1c62e] dark:active:bg-[#a1c62e] active:text-[#2c4001] border border-[#d3e2be] dark:border-[#2f4509] text-[#1c2d01] dark:text-white font-black text-xl transition shadow-sm flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handlePinDelete}
                disabled={isLoading || pin.length === 0}
                className="h-12 sm:h-13 rounded-2xl bg-[#f4f8ed] dark:bg-[#0c1400] hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-[#d3e2be] dark:border-[#253905] text-rose-700 dark:text-rose-400 text-sm font-bold transition flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Alternar a contraseña */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setAuthMode('password'); setError(null); }}
                className="text-xs text-[#5c6b4b] dark:text-[#a1c62e] hover:text-[#2c4001] dark:hover:text-white underline transition font-medium"
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
              <label className="block text-xs font-bold text-[#1c2d01] dark:text-slate-300 uppercase tracking-wider mb-1">
                Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5c6b4b] absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ej. campo_user, sup_user..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] border border-[#d3e2be] dark:border-[#2f4509] text-[#1c2d01] dark:text-white placeholder-[#7a8a65] text-xs focus:outline-none focus:border-[#2c4001] dark:focus:border-[#a1c62e] transition font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1c2d01] dark:text-slate-300 uppercase tracking-wider mb-1">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#5c6b4b] absolute left-3 top-3" />
                <input
                  type="password"
                  required={isOnline}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] border border-[#d3e2be] dark:border-[#2f4509] text-[#1c2d01] dark:text-white placeholder-[#7a8a65] text-xs focus:outline-none focus:border-[#2c4001] dark:focus:border-[#a1c62e] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2c4001] hover:bg-[#203001] text-white font-bold text-xs transition shadow-md shadow-[#2c4001]/25"
            >
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setError(null); }}
                className="text-xs text-[#2c4001] dark:text-[#a1c62e] hover:underline flex items-center justify-center gap-1 mx-auto font-bold"
              >
                <KeyRound className="w-3.5 h-3.5" /> Volver al PIN Rápido
              </button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* ACCESOS RÁPIDOS DIRECTOS                                                  */}
        {/* ========================================================================= */}
        <div className="pt-3 border-t border-[#e2ebd3] dark:border-[#253905]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-[#5c6b4b] dark:text-[#a1c62e] uppercase tracking-wider">
              ⚡ Accesos de Demostración
            </p>
            <button
              type="button"
              onClick={toggleOfflineSimulation}
              className="text-[10px] text-[#a87d13] font-bold hover:underline"
            >
              {offlineSimulated ? '🟢 Online' : '🟠 Simular Offline'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleQuick('campo')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#ebf3dc] dark:hover:bg-[#1f3004] border border-[#d3e2be] dark:border-[#253905] text-left transition flex items-center gap-1.5"
            >
              <HardHat className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" />
              <div>
                <p className="text-[11px] font-black text-[#1c2d01] dark:text-slate-200">1. Campo</p>
                <p className="text-[9px] text-[#5c6b4b] font-mono">PIN: 1234</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('supervisor')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#f9f2df] dark:hover:bg-[#362409] border border-[#d3e2be] dark:border-[#253905] text-left transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-[#a87d13]" />
              <div>
                <p className="text-[11px] font-black text-[#1c2d01] dark:text-slate-200">2. Supervisor</p>
                <p className="text-[9px] text-[#5c6b4b] font-mono">PIN: 2345</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('direccion')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#ebf3dc] dark:hover:bg-[#1f3004] border border-[#d3e2be] dark:border-[#253905] text-left transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" />
              <div>
                <p className="text-[11px] font-black text-[#1c2d01] dark:text-slate-200">3. Dirección</p>
                <p className="text-[9px] text-[#5c6b4b] font-mono">PIN: 3456</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuick('it')}
              disabled={isLoading}
              className="p-2 rounded-xl bg-[#fbfdf7] dark:bg-[#0e1700] hover:bg-[#f9f2df] dark:hover:bg-[#362409] border border-[#d3e2be] dark:border-[#253905] text-left transition flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-[#a87d13]" />
              <div>
                <p className="text-[11px] font-black text-[#1c2d01] dark:text-slate-200">4. Admin IT</p>
                <p className="text-[9px] text-[#5c6b4b] font-mono">PIN: 9999</p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
