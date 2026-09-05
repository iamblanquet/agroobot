import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AlertCircle, ArrowRight, CheckCircle2, Delete, Eye, EyeOff, KeyRound, Lock, Moon, ShieldCheck, Sun, User, WifiOff } from 'lucide-react';

const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

export default function LoginView() {
  const { loginWithPin, login, isOnline, offlineSimulated, toggleOfflineSimulation } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [authMode, setAuthMode] = useState(desktop ? 'password' : 'pin');
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectMode = (mode) => { setAuthMode(mode); setError(null); };
  const handlePinDigit = async (digit) => {
    if (isLoading || pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);
    if (nextPin.length !== 4) return;
    setIsLoading(true);
    try { await loginWithPin(nextPin); } catch (err) { setError(err.message || 'PIN incorrecto.'); setPin(''); } finally { setIsLoading(false); }
  };
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try { await login(username.trim(), password); } catch (err) { setError(err.message || 'No fue posible iniciar sesión.'); } finally { setIsLoading(false); }
  };

  return (
    <main className="min-h-screen bg-[#f4f7ed] p-4 sm:p-6 lg:p-8 transition-colors dark:bg-[#0a1000]">
      <button type="button" onClick={toggleTheme} className="fixed right-5 top-5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d9e5c7] bg-white/90 text-[#2c4001] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#304315] dark:bg-[#162305] dark:text-[#c8e76a]" title="Cambiar tema">
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <section className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-[#dce8ca] bg-white shadow-2xl shadow-[#405415]/10 dark:border-[#2d4012] dark:bg-[#132000] lg:grid-cols-[1.12fr_0.88fr]">
        <aside className="relative hidden overflow-hidden bg-[#2c4001] p-10 text-white lg:flex lg:flex-col">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border border-[#b4d650]/30" />
          <div className="absolute -bottom-28 right-[-4rem] h-96 w-96 rounded-full border-[32px] border-[#a1c62e]/10" />
          <div className="relative flex items-center gap-3">
            <img src="/logo.png" alt="AGROKOOL" className="h-12 w-auto object-contain" />
            <span className="border-l border-white/25 pl-3 text-xs font-semibold tracking-[0.16em] text-[#d8ed9a]">SISTEMA OPERATIVO</span>
          </div>
          <div className="relative my-auto max-w-md">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-[#b9d960]">Control de operación agrícola</p>
            <h1 className="text-4xl font-black leading-tight tracking-tight">Tu operación, clara desde el primer acceso.</h1>
            <p className="mt-5 text-sm leading-7 text-[#e5f0c5]">Consulta avances, reporta jornadas y toma decisiones con la información del campo en un solo lugar.</p>
          </div>
          <div className="relative grid grid-cols-3 gap-3 text-xs text-[#e5f0c5]">
            {[["Acceso seguro", ShieldCheck], ["Datos al día", CheckCircle2], ["Operación móvil", KeyRound]].map(([label, Icon]) => <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-3"><Icon className="mb-2 h-4 w-4 text-[#b9d960]" /><span>{label}</span></div>)}
          </div>
        </aside>

        <section className="flex min-h-full items-center justify-center p-6 sm:p-10 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden"><img src={isDark ? '/logo.png' : '/AGROKOOL_verde.png'} alt="AGROKOOL" className="h-16 w-auto" /></div>
            <header className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#839166] dark:text-[#b7cf76]">Bienvenido a AGROKOOL</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-[#223400] dark:text-white">Inicia sesión</h2>
              <p className="mt-2 text-sm text-[#687458] dark:text-[#bacaa1]">Usa tu cuenta de trabajo para continuar.</p>
            </header>

            {!isOnline && <div className="mb-5 flex gap-2 rounded-xl border border-[#d8b867]/50 bg-[#fff8e4] p-3 text-xs text-[#76591b] dark:border-[#9a7929] dark:bg-[#37290c] dark:text-[#f4dfaa]"><WifiOff className="h-4 w-4 shrink-0" /><span>No hay conexión. Podrás iniciar sesión al recuperar Internet.</span></div>}

            <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f1f5e8] p-1 dark:bg-[#0b1400]">
              <button type="button" onClick={() => selectMode('password')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMode === 'password' ? 'bg-white text-[#2c4001] shadow-sm dark:bg-[#2c4001] dark:text-white' : 'text-[#778467] dark:text-[#abbc8d]'}`}>Cuenta</button>
              <button type="button" onClick={() => selectMode('pin')} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${authMode === 'pin' ? 'bg-white text-[#2c4001] shadow-sm dark:bg-[#2c4001] dark:text-white' : 'text-[#778467] dark:text-[#abbc8d]'}`}>PIN de campo</button>
            </div>

            {error && <div className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

            {authMode === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#394b20] dark:text-[#d3e5af]">Usuario</span><span className="relative block"><User className="absolute left-3 top-3 h-4 w-4 text-[#87956f]" /><input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Tu usuario" className="input-surface w-full py-2.5 pl-10 pr-3 text-sm" /></span></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#394b20] dark:text-[#d3e5af]">Contraseña</span><span className="relative block"><Lock className="absolute left-3 top-3 h-4 w-4 text-[#87956f]" /><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" className="input-surface w-full py-2.5 pl-10 pr-10 text-sm" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-2.5 text-[#71805d] hover:text-[#2c4001] dark:hover:text-[#b9d960]" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
                <button type="submit" disabled={isLoading || !isOnline} className="btn-primary flex w-full items-center justify-center gap-2 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">{isLoading ? 'Verificando acceso...' : <>Entrar al sistema <ArrowRight className="h-4 w-4" /></>}</button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#e0ebd0] bg-[#fbfdf7] p-5 text-center dark:border-[#304315] dark:bg-[#0d1700]"><div className="mb-3 flex justify-center gap-3">{[0, 1, 2, 3].map((index) => <span key={index} className={`h-3 w-3 rounded-full border-2 transition ${pin.length > index ? 'scale-110 border-[#2c4001] bg-[#a1c62e] dark:border-[#b9d960]' : 'border-[#cadcb1]'}`} />)}</div><p className="text-xs font-semibold text-[#667653] dark:text-[#c3d3a6]">{isLoading ? 'Validando PIN...' : 'Escribe tu PIN de cuatro dígitos'}</p></div>
                <div className="grid grid-cols-3 gap-2">{[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => <button key={number} type="button" onClick={() => handlePinDigit(String(number))} disabled={isLoading || !isOnline} className="h-12 rounded-xl border border-[#d4e4bd] bg-white text-lg font-black text-[#243600] transition hover:bg-[#eff6df] active:scale-95 disabled:opacity-40 dark:border-[#34491a] dark:bg-[#152300] dark:text-white">{number}</button>)}<button type="button" onClick={() => { setPin(''); setError(null); }} disabled={!pin || isLoading} className="h-12 rounded-xl border border-[#d4e4bd] text-xs font-bold text-[#667653] dark:border-[#34491a] dark:text-[#c4d6a6]">Limpiar</button><button type="button" onClick={() => handlePinDigit('0')} disabled={isLoading || !isOnline} className="h-12 rounded-xl border border-[#d4e4bd] bg-white text-lg font-black text-[#243600] dark:border-[#34491a] dark:bg-[#152300] dark:text-white">0</button><button type="button" onClick={() => { setPin((value) => value.slice(0, -1)); setError(null); }} disabled={!pin || isLoading} className="flex h-12 items-center justify-center rounded-xl border border-[#d4e4bd] text-rose-600 dark:border-[#34491a] dark:text-rose-300"><Delete className="h-5 w-5" /></button></div>
              </div>
            )}
            <footer className="mt-8 flex items-center justify-between border-t border-[#e1ebd2] pt-4 text-[11px] text-[#728061] dark:border-[#304315] dark:text-[#a9bd88]"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Acceso protegido</span><button type="button" onClick={toggleOfflineSimulation} className="font-bold text-[#9a7112] hover:underline dark:text-[#e3bd54]">{offlineSimulated ? 'Restaurar conexión' : 'Probar sin señal'}</button></footer>
          </div>
        </section>
      </section>
    </main>
  );
}
