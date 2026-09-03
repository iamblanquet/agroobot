import React, { useState } from 'react';
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
  Moon,
  Menu,
  X,
  TrendingUp,
  Layers,
  MapPin,
  Camera,
  RefreshCw
} from 'lucide-react';

export default function Navbar({
  currentView,
  onViewChange,
  activeSubTab,
  onSubTabChange,
  onRefresh,
  subTabCounts,
  onSyncComplete
}) {
  const { user, logout, isTelegram, quickLogin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

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
    <header className="bg-[#2c4001] border-b border-[#3e5606] sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2">
        {/* FILA PRINCIPAL: LOGO + SUB-PESTAÑAS (CENTRAL/DESKTOP) + BOTÓN HAMBURGUESA / HERRAMIENTAS */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* 1. Logo Oficial AGROKOOL */}
          <div className="flex items-center min-w-0 flex-shrink-0">
            <img
              src="/logo.png"
              alt="AGROKOOL"
              className="h-10 sm:h-12 md:h-13 w-auto object-contain transition-transform"
            />
          </div>

          {/* 2. SUB-PESTAÑAS (BARRA DEL SEGUNDO LUGAR ADAPTADA EN LA NAVBAR) */}
          {currentView === 'supervisor' && onSubTabChange && (
            <div className="hidden md:flex items-center gap-1.5 bg-white dark:bg-[#152202] p-1 rounded-2xl border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
              <button
                type="button"
                onClick={() => onSubTabChange('tablero')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSubTab === 'tablero'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>4 Widgets Canónicos</span>
              </button>

              <button
                type="button"
                onClick={() => onSubTabChange('proyectos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSubTab === 'proyectos'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Proyectos & Hitos</span>
                {subTabCounts?.proyectos !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/50">
                    {subTabCounts.proyectos}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSubTabChange('catalogos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSubTab === 'catalogos'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Catálogo Predios & Frentes</span>
                {subTabCounts?.predios !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-500/50">
                    {subTabCounts.predios}P / {subTabCounts.obras || 0}F
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSubTabChange('reportes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeSubTab === 'reportes'
                    ? 'bg-[#a87d13] text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Bitácora & Evidencias</span>
                {subTabCounts?.reportes !== undefined && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#362409] text-[#dfb75c] border border-[#a87d13]/50">
                    {subTabCounts.reportes}
                  </span>
                )}
              </button>

              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                  title="Refrescar datos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* 3. HERRAMIENTAS DIRECTAS + BOTÓN MENÚ HAMBURGUESA RESPONSIVO */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <OfflineBadge onSyncComplete={onSyncComplete} />

            {/* Tema Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[#1e2d01] text-[#a1c62e] hover:text-white hover:bg-[#152000] border border-[#3e5606] transition text-xs flex items-center shadow-sm"
              title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            >
              {isDark ? <Sun className="w-4 h-4 text-[#dfb75c]" /> : <Moon className="w-4 h-4 text-[#a1c62e]" />}
            </button>

            {/* Rol Actual Pill (Desktop) */}
            <div className={`hidden lg:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-bold ${currentRoleInfo.color} shadow-sm`}>
              <RoleIcon className="w-3.5 h-3.5" />
              <span className="capitalize">{currentRoleInfo.label}</span>
            </div>

            {/* BOTÓN HAMBURGUESA (MÓVILES Y WEB) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#d4e6b5] hover:text-white border border-[#3e5606] transition flex items-center justify-center shadow-sm"
              aria-label="Abrir menú de navegación"
              title="Menú de opciones"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5 text-[#a1c62e]" />}
            </button>
          </div>
        </div>

        {/* SUB-BARRA EN MÓVILES (HORIZONTAL SCROLLABLE SI ES SUPERVISOR) */}
        {currentView === 'supervisor' && onSubTabChange && (
          <div className="md:hidden flex items-center gap-1.5 mt-2 pt-2 border-t border-[#3e5606]/80 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => onSubTabChange('tablero')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 ${
                activeSubTab === 'tablero'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-[#1e2d01] text-[#d4e6b5] border border-[#3e5606]'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Widgets</span>
            </button>

            <button
              type="button"
              onClick={() => onSubTabChange('proyectos')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 ${
                activeSubTab === 'proyectos'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[#1e2d01] text-[#d4e6b5] border border-[#3e5606]'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Proyectos</span>
              {subTabCounts?.proyectos !== undefined && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-emerald-950 text-emerald-300">
                  {subTabCounts.proyectos}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSubTabChange('catalogos')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 ${
                activeSubTab === 'catalogos'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-[#1e2d01] text-[#d4e6b5] border border-[#3e5606]'
              }`}
            >
              <MapPin className="w-3 h-3" />
              <span>Predios & Frentes</span>
              {subTabCounts?.predios !== undefined && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-purple-950 text-purple-300">
                  {subTabCounts.predios}P
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onSubTabChange('reportes')}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 flex-shrink-0 ${
                activeSubTab === 'reportes'
                  ? 'bg-[#a87d13] text-white shadow-sm'
                  : 'bg-[#1e2d01] text-[#d4e6b5] border border-[#3e5606]'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Bitácora</span>
              {subTabCounts?.reportes !== undefined && (
                <span className="ml-0.5 px-1 py-0.2 rounded-full text-[9px] bg-[#362409] text-[#dfb75c]">
                  {subTabCounts.reportes}
                </span>
              )}
            </button>
          </div>
        )}

        {/* DESPLEGABLE DEL MENÚ DE HAMBURGUESA (MÓVIL Y WEB) */}
        {mobileMenuOpen && (
          <div className="mt-2.5 pt-3 border-t border-[#3e5606] space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* 1. Módulos y Vistas Disponibles */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#a1c62e] block mb-2 px-1">
                Módulos del Sistema AGROKOOL
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableViews.map((v) => {
                  const VIcon = v.icon;
                  const isActive = currentView === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onViewChange(v.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition ${
                        isActive
                          ? 'bg-[#a1c62e] text-[#2c4001] shadow-md shadow-[#a1c62e]/30 scale-[1.02]'
                          : 'bg-[#1e2d01] text-[#d4e6b5] hover:bg-[#152000] hover:text-white border border-[#3e5606]'
                      }`}
                    >
                      <VIcon className="w-4 h-4" />
                      <span>{v.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Switch Rápido de Roles Canónicos */}
            {(user?.rol === 'it' || user?.rol === 'direccion') && (
              <div className="pt-2 border-t border-[#3e5606]/60">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#dfb75c] block mb-2 px-1">
                  Probar Rol Canónico
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => { quickLogin('campo'); setMobileMenuOpen(false); }}
                    className="p-2 rounded-xl bg-[#1e2d01] text-slate-200 hover:bg-[#152000] border border-[#3e5606] text-xs font-medium flex items-center gap-2"
                  >
                    <HardHat className="w-3.5 h-3.5 text-[#a1c62e]" />
                    <span>Abner (Campo)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { quickLogin('supervisor'); setMobileMenuOpen(false); }}
                    className="p-2 rounded-xl bg-[#1e2d01] text-slate-200 hover:bg-[#152000] border border-[#3e5606] text-xs font-medium flex items-center gap-2"
                  >
                    <Activity className="w-3.5 h-3.5 text-[#a87d13]" />
                    <span>Karen (Supervisor)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { quickLogin('direccion'); setMobileMenuOpen(false); }}
                    className="p-2 rounded-xl bg-[#1e2d01] text-slate-200 hover:bg-[#152000] border border-[#3e5606] text-xs font-medium flex items-center gap-2"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-white" />
                    <span>Luis (Dirección)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { quickLogin('it'); setMobileMenuOpen(false); }}
                    className="p-2 rounded-xl bg-[#1e2d01] text-slate-200 hover:bg-[#152000] border border-[#3e5606] text-xs font-medium flex items-center gap-2"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#dfb75c]" />
                    <span>Julio (Admin IT)</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Usuario Actual y Cerrar Sesión */}
            <div className="pt-2 border-t border-[#3e5606]/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-[#d4e6b5]">
                <User className="w-3.5 h-3.5 text-[#a1c62e]" />
                <span>Sesión: <strong>{user?.nombre || user?.username}</strong></span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 rounded-xl bg-rose-950/90 text-rose-200 border border-rose-800/80 hover:bg-rose-900 transition text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
