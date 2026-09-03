import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import OfflineBadge from './OfflineBadge';
import {
  LogOut,
  User,
  Send,
  Shield,
  Activity,
  BarChart3,
  HardHat,
  Settings,
  Sun,
  Moon
} from 'lucide-react';

export default function Navbar({ currentView, onViewChange, onSyncComplete }) {
  const { user, logout, isTelegram, quickLogin } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const roleBadges = {
    campo: { label: 'Campo', color: 'bg-[#a1c62e]/20 text-[#a1c62e] border-[#a1c62e]/40', icon: HardHat },
    supervisor: { label: 'Supervisor', color: 'bg-[#a87d13]/25 text-[#f3e3ba] border-[#a87d13]/50', icon: Activity },
    direccion: { label: 'Dirección', color: 'bg-white/10 text-white border-white/25', icon: BarChart3 },
    it: { label: 'Admin / IT', color: 'bg-[#a87d13] text-white border-[#dfb75c]', icon: Shield }
  };

  const currentRoleInfo = roleBadges[user?.rol] || roleBadges.campo;
  const RoleIcon = currentRoleInfo.icon;

  const views = [
    { id: 'campo', label: 'Campo', icon: HardHat, roles: ['campo', 'supervisor', 'direccion', 'it'] },
    { id: 'supervisor', label: 'Supervisor', icon: Activity, roles: ['supervisor', 'direccion', 'it'] },
    { id: 'direccion', label: 'Dirección', icon: BarChart3, roles: ['direccion', 'it'] },
    { id: 'it', label: 'Admin IT', icon: Settings, roles: ['it'] }
  ];

  const availableViews = views.filter(v => v.roles.includes(user?.rol));

  return (
    <header className="bg-[#2c4001] border-b border-[#3e5606] sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-white border-2 border-[#a1c62e] flex items-center justify-center font-black text-lg shadow-sm flex-shrink-0">
              🌽
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-white tracking-wide leading-none truncate font-serif">
                  AGROKOOL
                </h1>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#a1c62e] text-[#2c4001] font-black uppercase tracking-wider hidden xs:inline-block">
                  Operación
                </span>
                {isTelegram && (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-[#a87d13] text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0 shadow-sm">
                    <Send className="w-2.5 h-2.5" /> MiniApp
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#d4e6b5] font-medium leading-tight mt-0.5 truncate hidden xs:block">
                {user?.nombre || 'Operador Conectado'}
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <OfflineBadge onSyncComplete={onSyncComplete} />

            {/* Selector de Modo Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-[#1e2d01] text-[#a1c62e] hover:text-white hover:bg-[#152000] border border-[#3e5606] transition text-xs flex items-center gap-1.5 shadow-sm"
              title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-[#dfb75c]" />
                  <span className="hidden md:inline text-[11px] font-bold">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-[#a1c62e]" />
                  <span className="hidden md:inline text-[11px] font-bold">Oscuro</span>
                </>
              )}
            </button>

            {/* Rol Actual */}
            <div className={`flex items-center gap-1 text-[11px] sm:text-xs px-2.5 py-1 rounded-lg border font-bold ${currentRoleInfo.color} shadow-sm`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{currentRoleInfo.label}</span>
            </div>

            {/* Switch rápido de rol */}
            <div className="relative group">
              <button
                type="button"
                className="p-1.5 sm:px-2 sm:py-1 rounded-xl bg-[#1e2d01] text-[#d4e6b5] border border-[#3e5606] hover:bg-[#152000] hover:text-white transition text-xs flex items-center gap-1 shadow-sm"
                title="Cambiar rol rápido de prueba"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px] font-semibold">Rol</span>
              </button>
              <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] rounded-2xl shadow-2xl py-2 hidden group-hover:block z-50">
                <div className="px-3 py-1 text-[10px] text-[#5c6b4b] dark:text-[#a1c62e] font-bold uppercase tracking-wider border-b border-[#e2ebd3] dark:border-[#253905]">
                  Probar Rol Canónico
                </div>
                <button
                  type="button"
                  onClick={() => quickLogin('campo')}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#1c2d01] dark:text-slate-200 hover:bg-[#f4f8ed] dark:hover:bg-[#1f3004] hover:text-[#2c4001] dark:hover:text-[#a1c62e] flex items-center gap-2 font-medium"
                >
                  <HardHat className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" /> Campo (Abner)
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('supervisor')}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#1c2d01] dark:text-slate-200 hover:bg-[#f4f8ed] dark:hover:bg-[#1f3004] hover:text-[#a87d13] flex items-center gap-2 font-medium"
                >
                  <Activity className="w-3.5 h-3.5 text-[#a87d13]" /> Supervisor (Karen)
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('direccion')}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#1c2d01] dark:text-slate-200 hover:bg-[#f4f8ed] dark:hover:bg-[#1f3004] hover:text-[#2c4001] flex items-center gap-2 font-medium"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" /> Dirección (Luis B.)
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('it')}
                  className="w-full text-left px-3 py-1.5 text-xs text-[#1c2d01] dark:text-slate-200 hover:bg-[#f4f8ed] dark:hover:bg-[#1f3004] hover:text-[#a87d13] flex items-center gap-2 font-medium"
                >
                  <Shield className="w-3.5 h-3.5 text-[#a87d13]" /> Admin / IT (Julio)
                </button>
              </div>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="p-1.5 sm:p-2 rounded-xl bg-rose-950/80 text-rose-200 border border-rose-800/60 hover:bg-rose-900 transition shadow-sm"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra de pestañas para roles con múltiples vistas */}
        {availableViews.length > 1 && (
          <nav className="flex items-center gap-2 mt-2.5 border-t border-[#3e5606]/80 pt-2 overflow-x-auto no-scrollbar py-0.5">
            {availableViews.map((v) => {
              const VIcon = v.icon;
              const isActive = currentView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onViewChange(v.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-[#a1c62e] text-[#2c4001] shadow-md shadow-[#a1c62e]/30 scale-[1.02]'
                      : 'bg-[#1e2d01]/80 text-[#d4e6b5] hover:bg-[#152000] hover:text-white border border-[#3e5606]'
                  }`}
                >
                  <VIcon className="w-3.5 h-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
