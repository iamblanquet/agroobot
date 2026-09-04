import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import OfflineBadge from './components/OfflineBadge';
import LoginView from './views/LoginView';
import CampoView from './views/CampoView';
import SupervisorView from './views/SupervisorView';
import DireccionView from './views/DireccionView';
import AdminView from './views/AdminView';
import GanttView from './views/GanttView';
import {
  Menu,
  X,
  Home,
  HardHat,
  TrendingUp,
  Layers,
  MapPin,
  Camera,
  BarChart3,
  Shield,
  Calendar,
  LogOut,
  Sun,
  Moon,
  ChevronRight,
  User,
  Activity,
  FileText
} from 'lucide-react';

export default function App() {
  const { user, isAuthenticated, isLoading, logout, quickLogin } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [currentView, setCurrentView] = useState('campo');
  const [activeSupervisorTab, setActiveSupervisorTab] = useState('tablero');
  const [supervisorMetadata, setSupervisorMetadata] = useState(null);

  // Estado del Sidebar (colapsado / expandido / móvil)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Ajustar vista predeterminada según el rol del usuario autenticado o hash URL
  useEffect(() => {
    const hash = window.location.hash || '';
    if (hash.startsWith('#gantt')) {
      setCurrentView('gantt');
      return;
    }

    if (user?.rol) {
      if (user.rol === 'campo') {
        setCurrentView('campo');
      } else if (user.rol === 'supervisor') {
        setCurrentView('supervisor');
        setActiveSupervisorTab('tablero'); // Inicio directo en 4 Widgets Canónicos
      } else if (user.rol === 'direccion') {
        setCurrentView('direccion');
      } else if (user.rol === 'it') {
        setCurrentView('it');
      }
    }
  }, [user]);

  // Listener para cambios dinámicos en hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#gantt')) {
        setCurrentView('gantt');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8faf2] dark:bg-[#0c1400] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-24 h-24 rounded-3xl bg-[#2c4001] border-2 border-[#a1c62e] shadow-2xl shadow-[#2c4001]/40 mx-auto p-2.5 animate-pulse flex items-center justify-center">
            <img src="/logo.png" alt="AGROKOOL" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs font-bold text-[#2c4001] dark:text-[#a1c62e] tracking-wide uppercase">AGROKOOL · Iniciando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  // Definición de ítems del Sidebar
  const navItems = [
    {
      id: 'inicio_widgets',
      label: 'Inicio (4 Widgets)',
      icon: TrendingUp,
      view: 'supervisor',
      subTab: 'tablero',
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      id: 'campo',
      label: 'Jornada de Campo',
      icon: HardHat,
      view: 'campo',
      roles: ['campo', 'supervisor', 'direccion', 'it']
    },
    {
      id: 'proyectos',
      label: 'Proyectos & Hitos',
      icon: Layers,
      view: 'supervisor',
      subTab: 'proyectos',
      badge: supervisorMetadata?.proyectos,
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      id: 'gantt',
      label: 'Diagrama de Gantt',
      icon: Calendar,
      view: 'gantt',
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      id: 'catalogos',
      label: 'Predios, Frentes & Maq.',
      icon: MapPin,
      view: 'supervisor',
      subTab: 'catalogos',
      badge: supervisorMetadata ? `${supervisorMetadata.predios}P / ${supervisorMetadata.maquinas || 0}M` : null,
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      id: 'reportes',
      label: 'Bitácora & Fotos',
      icon: Camera,
      view: 'supervisor',
      subTab: 'reportes',
      badge: supervisorMetadata?.reportes,
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      id: 'direccion',
      label: 'Dirección Ejecutiva',
      icon: BarChart3,
      view: 'direccion',
      roles: ['direccion', 'it']
    },
    {
      id: 'it',
      label: 'Administración IT',
      icon: Shield,
      view: 'it',
      roles: ['it']
    }
  ];

  const allowedItems = navItems.filter(item => item.roles.includes(user?.rol));

  const handleNavClick = (item) => {
    setCurrentView(item.view);
    if (item.subTab) {
      setActiveSupervisorTab(item.subTab);
    }
    setMobileDrawerOpen(false);
  };

  // Módulos para la pantalla Hub de Bienvenida (Estilo THESSA)
  const hubCards = [
    {
      title: 'Reporte de Campo',
      desc: 'Captura digital de jornada operativa con soporte offline, horas máquina y evidencias fotográficas.',
      icon: HardHat,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      action: () => setCurrentView('campo'),
      roles: ['campo', 'supervisor', 'direccion', 'it']
    },
    {
      title: '4 Widgets Canónicos',
      desc: 'Monitoreo en tiempo real de frentes sin reporte, avance vs meta, incidencias y déficit de insumos.',
      icon: TrendingUp,
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
      action: () => { setCurrentView('supervisor'); setActiveSupervisorTab('tablero'); },
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      title: 'Proyectos & Hitos (WBS)',
      desc: 'Gestor jerárquico de proyectos agrícolas, frentes de obra, hitos calendarizados y tareas asignadas.',
      icon: Layers,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      action: () => { setCurrentView('supervisor'); setActiveSupervisorTab('proyectos'); },
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      title: 'Diagrama de Gantt Agrícola',
      desc: 'Línea de tiempo interactiva con barras de avance, hitos críticos, fechas límite y vistas Días/Semanas/Meses.',
      icon: Calendar,
      color: 'bg-[#2c4001]/20 text-[#2c4001] dark:text-[#a1c62e] border-[#a1c62e]/40',
      action: () => setCurrentView('gantt'),
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      title: 'Catálogo Predios & Frentes',
      desc: 'Control de ranchos y polígonos con superficie legal vs útil, régimen y cuadrillas operativas asignadas.',
      icon: MapPin,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      action: () => { setCurrentView('supervisor'); setActiveSupervisorTab('catalogos'); },
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      title: 'Bitácora & Evidencias',
      desc: 'Historial completo de reportes sincronizados, evidencias fotográficas en alta resolución y horas offline.',
      icon: Camera,
      color: 'bg-[#a87d13]/15 text-[#a87d13] dark:text-[#dfb75c] border-[#a87d13]/30',
      action: () => { setCurrentView('supervisor'); setActiveSupervisorTab('reportes'); },
      roles: ['supervisor', 'direccion', 'it']
    },
    {
      title: 'Dirección Ejecutiva',
      desc: 'Tablero consolidado de metas del ciclo, comparativa Dron vs Campo y auditoría de discrepancias.',
      icon: BarChart3,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      action: () => setCurrentView('direccion'),
      roles: ['direccion', 'it']
    },
    {
      title: 'Administración & Seguridad IT',
      desc: 'Gestor de usuarios, PINs de acceso, logs del sistema, estado del bot de Telegram y pruebas de cron.',
      icon: Shield,
      color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      action: () => setCurrentView('it'),
      roles: ['it']
    }
  ].filter(c => c.roles.includes(user?.rol));

  return (
    <div className="min-h-screen bg-[#f8faf2] dark:bg-[#0c1400] text-[#1c2d01] dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR SUPERIOR (ESTILO THESSA: HEADER OSCURO / VERDE AGROKOOL)     */}
      {/* ========================================================================= */}
      <header className="no-print print:hidden bg-[#2c4001] text-white border-b border-[#3e5606] sticky top-0 z-40 shadow-md h-14 sm:h-16 flex items-center px-3 sm:px-6 justify-between gap-3">
        <div className="flex items-center min-w-0">
          {/* Logo Oficial AGROKOOL Simple */}
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileDrawerOpen(!mobileDrawerOpen);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }}
            className="flex items-center p-0 bg-transparent border-0 outline-none focus:outline-none cursor-pointer"
            title="AGROKOOL"
          >
            <img
              src="/logo.png"
              alt="AGROKOOL"
              className="h-10 sm:h-12 w-auto object-contain block"
            />
          </button>
        </div>

        {/* Acciones Rápidas Superior */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <OfflineBadge onSyncComplete={() => {
            if (supervisorMetadata?.reloadFn) supervisorMetadata.reloadFn();
          }} />

          {/* Selector Modo Claro / Oscuro */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[#1e2d01] text-[#a1c62e] hover:text-white hover:bg-[#152000] border border-[#3e5606] transition text-xs flex items-center shadow-sm"
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {isDark ? <Sun className="w-4 h-4 text-[#dfb75c]" /> : <Moon className="w-4 h-4 text-[#a1c62e]" />}
          </button>

          {/* Usuario Activo Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[#d4e6b5] font-semibold truncate max-w-[140px]">{user?.nombre || user?.username}</span>
          </div>

          {/* Cerrar Sesión */}
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-xl bg-rose-950/80 text-rose-200 hover:bg-rose-900 border border-rose-800/60 transition shadow-sm"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BODY CON SIDEBAR LATERAL IZQUIERDO Y CONTENIDO PRINCIPAL               */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative print:overflow-visible">
        {/* SIDEBAR LATERAL (DESKTOP) */}
        <aside
          className={`no-print print:hidden hidden md:flex flex-col bg-[#243302] border-r border-[#3e5606] text-slate-200 transition-all duration-300 z-30 flex-shrink-0 select-none ${
            sidebarOpen ? 'w-60' : 'w-16'
          }`}
        >
          <div className="flex-1 py-4 space-y-1 overflow-y-auto no-scrollbar px-2">
            {allowedItems.map((item) => {
              const ItemIcon = item.icon;
              const isSelected =
                (item.view === 'home' && currentView === 'home') ||
                (item.view === currentView && (!item.subTab || item.subTab === activeSupervisorTab));

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition group relative ${
                    isSelected
                      ? 'bg-[#a1c62e] text-[#2c4001] shadow-md shadow-[#a1c62e]/30'
                      : 'text-[#d4e6b5] hover:bg-[#1e2d01] hover:text-white'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <ItemIcon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && (
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  )}
                  {sidebarOpen && item.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? 'bg-[#2c4001] text-[#a1c62e]' : 'bg-[#152000] text-[#a1c62e] border border-[#3e5606]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Pie de Sidebar: Probar Roles Canónicos */}
          {sidebarOpen ? (
            <div className="p-3 border-t border-[#3e5606]/80 bg-[#1e2d01]/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#a1c62e] block">
                  Sesión: {user?.nombre?.split(' ')[0] || user?.username}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3e5606] text-white font-mono uppercase">
                  {user?.rol}
                </span>
              </div>
              {(user?.rol === 'it' || user?.rol === 'direccion') && (
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => quickLogin('campo')}
                    className="px-2 py-1.5 rounded-lg bg-[#243302] hover:bg-[#152000] text-[11px] text-[#d4e6b5] border border-[#3e5606] truncate text-left"
                  >
                    🌾 Abner
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLogin('supervisor')}
                    className="px-2 py-1.5 rounded-lg bg-[#243302] hover:bg-[#152000] text-[11px] text-[#d4e6b5] border border-[#3e5606] truncate text-left"
                  >
                    📋 Karen
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLogin('direccion')}
                    className="px-2 py-1.5 rounded-lg bg-[#243302] hover:bg-[#152000] text-[11px] text-[#d4e6b5] border border-[#3e5606] truncate text-left"
                  >
                    📊 Luis
                  </button>
                  <button
                    type="button"
                    onClick={() => quickLogin('it')}
                    className="px-2 py-1.5 rounded-lg bg-[#243302] hover:bg-[#152000] text-[11px] text-[#d4e6b5] border border-[#3e5606] truncate text-left"
                  >
                    🛡️ Julio
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={logout}
                className="w-full mt-1 py-1.5 px-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-[11px] font-bold border border-rose-800/40 flex items-center justify-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" /> Cerrar Sesión
              </button>
            </div>
          ) : (
            <div className="p-2 border-t border-[#3e5606]/80 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={logout}
                className="p-2 rounded-xl text-rose-400 hover:bg-rose-950 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </aside>

        {/* DRAWER LATERAL (MÓVILES) */}
        {mobileDrawerOpen && (
          <div className="no-print print:hidden fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileDrawerOpen(false)} />
            <div className="relative w-72 max-w-[80vw] bg-[#243302] border-r border-[#3e5606] text-slate-200 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200">
              <div className="p-4 border-b border-[#3e5606] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="AGROKOOL" className="h-9 w-auto object-contain" />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-xl bg-[#1e2d01] text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 py-4 space-y-1 overflow-y-auto px-3">
                {allowedItems.map((item) => {
                  const ItemIcon = item.icon;
                  const isSelected =
                    (item.view === 'home' && currentView === 'home') ||
                    (item.view === currentView && (!item.subTab || item.subTab === activeSupervisorTab));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                        isSelected
                          ? 'bg-[#a1c62e] text-[#2c4001] shadow-md'
                          : 'text-[#d4e6b5] hover:bg-[#1e2d01]'
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#152000] text-[#a1c62e]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Usuario y Sesión en Móvil */}
              <div className="p-4 border-t border-[#3e5606] bg-[#1e2d01] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#a1c62e] block">
                    Sesión: {user?.nombre?.split(' ')[0] || user?.username}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#3e5606] text-white font-mono uppercase">
                    {user?.rol}
                  </span>
                </div>
                {(user?.rol === 'it' || user?.rol === 'direccion') && (
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => { quickLogin('campo'); setMobileDrawerOpen(false); }}
                      className="px-2.5 py-2 rounded-xl bg-[#243302] text-xs font-semibold text-slate-200 border border-[#3e5606]"
                    >
                      Abner (Campo)
                    </button>
                    <button
                      type="button"
                      onClick={() => { quickLogin('supervisor'); setMobileDrawerOpen(false); }}
                      className="px-2.5 py-2 rounded-xl bg-[#243302] text-xs font-semibold text-slate-200 border border-[#3e5606]"
                    >
                      Karen (Superv)
                    </button>
                    <button
                      type="button"
                      onClick={() => { quickLogin('direccion'); setMobileDrawerOpen(false); }}
                      className="px-2.5 py-2 rounded-xl bg-[#243302] text-xs font-semibold text-slate-200 border border-[#3e5606]"
                    >
                      Luis (Dirección)
                    </button>
                    <button
                      type="button"
                      onClick={() => { quickLogin('it'); setMobileDrawerOpen(false); }}
                      className="px-2.5 py-2 rounded-xl bg-[#243302] text-xs font-semibold text-slate-200 border border-[#3e5606]"
                    >
                      Julio (Admin IT)
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => { logout(); setMobileDrawerOpen(false); }}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-rose-950/40 text-rose-300 text-xs font-bold border border-rose-800/40 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* 3. ÁREA DE CONTENIDO PRINCIPAL                                          */}
        {/* ======================================================================= */}
        <main className="flex-1 overflow-y-auto">
          {/* VISTA HUB: BIENVENIDA CON TARJETAS GRID (ESTILO THESSA) */}
          {currentView === 'home' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
              {/* Saludo de Bienvenida */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>¡Hola, {user?.nombre || user?.username}!</span>
                  <span className="animate-bounce">👋</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
                  Selecciona la herramienta o módulo operativo que desees utilizar
                </p>
              </div>

              {/* Grid de Herramientas Canónicas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
                {hubCards.map((card, idx) => {
                  const CardIcon = card.icon;
                  return (
                    <div
                      key={idx}
                      onClick={card.action}
                      className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm hover:shadow-xl hover:border-[#a1c62e]/80 transition-all duration-200 cursor-pointer flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl border ${card.color} group-hover:scale-110 transition-transform`}>
                            <CardIcon className="w-5 h-5" />
                          </div>
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-[#a1c62e] transition-colors">
                            {card.title}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {card.desc}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-[#e2ebd3] dark:border-[#253905]/60 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#a1c62e]" />
                          Activo
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VISTAS OPERATIVAS MODULARES */}
          {currentView === 'campo' && <CampoView />}
          {currentView === 'supervisor' && (
            <SupervisorView
              activeTab={activeSupervisorTab}
              onTabChange={setActiveSupervisorTab}
              onRegisterMetadata={setSupervisorMetadata}
            />
          )}
          {currentView === 'gantt' && (
            <GanttView
              onNavigateBack={() => setCurrentView(user?.rol === 'direccion' ? 'direccion' : 'supervisor')}
            />
          )}
          {currentView === 'direccion' && <DireccionView />}
          {currentView === 'it' && <AdminView />}
        </main>
      </div>
    </div>
  );
}
