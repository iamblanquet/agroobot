import React from 'react';
import { useAuth } from '../context/AuthContext';
import OfflineBadge from './OfflineBadge';
import { LogOut, User, Send, Shield, Activity, BarChart3, HardHat, Settings } from 'lucide-react';

export default function Navbar({ currentView, onViewChange, onSyncComplete }) {
  const { user, logout, isTelegram, tgUser, quickLogin } = useAuth();

  const roleBadges = {
    campo: { label: 'Campo', color: 'bg-emerald-800 text-emerald-100 border-emerald-600', icon: HardHat },
    supervisor: { label: 'Supervisor', color: 'bg-blue-800 text-blue-100 border-blue-600', icon: Activity },
    direccion: { label: 'Dirección', color: 'bg-purple-800 text-purple-100 border-purple-600', icon: BarChart3 },
    it: { label: 'Admin / IT', color: 'bg-amber-800 text-amber-100 border-amber-600', icon: Shield }
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
    <header className="bg-[#064e3b] border-b border-emerald-800/60 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-black text-emerald-300 text-xs sm:text-sm tracking-wider shadow-inner flex-shrink-0">
              TESA
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-xs sm:text-sm font-bold text-white tracking-tight leading-none truncate">
                  Operación de Campo
                </h1>
                {isTelegram && (
                  <span className="flex items-center gap-1 text-[9px] sm:text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/30 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                    <Send className="w-2.5 h-2.5" /> MiniApp
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-200/80 font-normal leading-tight mt-0.5 truncate hidden xs:block">
                {user?.nombre || 'Usuario Conectado'}
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <OfflineBadge onSyncComplete={onSyncComplete} />

            {/* Rol Actual */}
            <div className={`flex items-center gap-1 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 rounded-md border font-semibold ${currentRoleInfo.color} shadow-sm`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="capitalize hidden sm:inline">{currentRoleInfo.label}</span>
            </div>

            {/* Switch rápido de rol */}
            <div className="relative group">
              <button
                type="button"
                className="p-1 sm:px-2 sm:py-1 rounded-lg bg-emerald-950/70 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-900 transition text-xs flex items-center gap-1"
                title="Cambiar rol rápido de prueba"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden md:inline text-[11px]">Rol</span>
              </button>
              <div className="absolute right-0 mt-1 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
                <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
                  Probar Rol Canónico
                </div>
                <button
                  type="button"
                  onClick={() => quickLogin('campo')}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-emerald-950/60 hover:text-emerald-300 flex items-center gap-2"
                >
                  <HardHat className="w-3.5 h-3.5 text-emerald-400" /> Campo
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('supervisor')}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-950/60 hover:text-blue-300 flex items-center gap-2"
                >
                  <Activity className="w-3.5 h-3.5 text-blue-400" /> Supervisor
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('direccion')}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-purple-950/60 hover:text-purple-300 flex items-center gap-2"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" /> Dirección
                </button>
                <button
                  type="button"
                  onClick={() => quickLogin('it')}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-amber-950/60 hover:text-amber-300 flex items-center gap-2"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-400" /> Admin / IT
                </button>
              </div>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="p-1 sm:p-1.5 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-800/40 hover:bg-rose-900/80 transition"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra de pestañas para roles con múltiples vistas */}
        {availableViews.length > 1 && (
          <nav className="flex items-center gap-1 mt-2 border-t border-emerald-800/40 pt-1.5 overflow-x-auto no-scrollbar py-0.5">
            {availableViews.map((v) => {
              const VIcon = v.icon;
              const isActive = currentView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => onViewChange(v.id)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/60 border border-emerald-700/30'
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
