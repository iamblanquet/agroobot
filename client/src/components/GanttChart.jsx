import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Calendar,
  Layers,
  Flag,
  CheckSquare,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  User,
  MapPin,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  Sliders,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Building,
  List,
  BarChart2,
  X,
  ChevronLeft
} from 'lucide-react';

/**
 * Utilidades de fecha para el cálculo de posiciones y escalas en el Diagrama de Gantt
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return 'Sin fecha';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getDaysBetween(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((d2.getTime() - d1.getTime()) / oneDay);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Componente Principal GanttChart con Diseño Senior Responsive y Colores de Marca AGROKOOL
 */
export default function GanttChart({
  projects = [],
  selectedProjectId = null,
  onProjectChange = null,
  onRefresh = null,
  isModal = false,
  onCloseModal = null,
  onNavigateBack = null
}) {
  const [activeProjectFilter, setActiveProjectFilter] = useState(selectedProjectId || 'all');
  const [timeScale, setTimeScale] = useState('semanas'); // 'dias' | 'semanas' | 'meses'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'en_progreso' | 'completado' | 'pendiente' | 'bloqueado'
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedHitos, setExpandedHitos] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  // Estados responsivos móviles (Senior UX)
  const [mobileTab, setMobileTab] = useState('gantt'); // 'gantt' | 'lista'
  const [wbsCollapsedMobile, setWbsCollapsedMobile] = useState(false);
  const [selectedItemDetail, setSelectedItemDetail] = useState(null); // Para Bottom Sheet Modal táctil
  const [hoverTooltip, setHoverTooltip] = useState(null); // Para desktop tooltip

  const timelineScrollRef = useRef(null);

  // Sincronizar filtro externo si cambia
  useEffect(() => {
    if (selectedProjectId) {
      setActiveProjectFilter(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Expandir proyectos al cargar
  useEffect(() => {
    if (projects.length > 0) {
      const expProj = {};
      const expHit = {};
      if (selectedProjectId && selectedProjectId !== 'all') {
        expProj[selectedProjectId] = true;
        const targetProj = projects.find((p) => String(p.id) === String(selectedProjectId));
        targetProj?.hitos?.forEach((h) => {
          expHit[h.id] = true;
        });
      } else {
        projects.forEach((p) => {
          expProj[p.id] = true;
        });
      }
      setExpandedProjects(expProj);
      setExpandedHitos(expHit);
    }
  }, [projects, selectedProjectId]);

  // Filtrar proyectos según selección y búsqueda
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (activeProjectFilter !== 'all') {
      result = result.filter((p) => String(p.id) === String(activeProjectFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result
        .map((p) => {
          const matchesProj = p.nombre?.toLowerCase().includes(q) || p.tipo?.toLowerCase().includes(q);
          const matchedHitos = (p.hitos || []).filter((h) => {
            const matchesHito = h.nombre?.toLowerCase().includes(q) || h.descripcion?.toLowerCase().includes(q);
            const matchedTareas = (h.tareas || []).filter(
              (t) =>
                t.nombre?.toLowerCase().includes(q) ||
                t.responsable?.toLowerCase().includes(q) ||
                t.predio_nombre?.toLowerCase().includes(q)
            );
            return matchesHito || matchedTareas.length > 0;
          });

          if (matchesProj || matchedHitos.length > 0) {
            return {
              ...p,
              hitos: matchedHitos.length > 0 ? matchedHitos : p.hitos
            };
          }
          return null;
        })
        .filter(Boolean);
    }

    if (statusFilter !== 'all') {
      result = result
        .map((p) => {
          const filteredHitos = (p.hitos || []).filter((h) => {
            if (statusFilter === 'completado') return h.estado === 'completado';
            if (statusFilter === 'en_progreso') return h.estado === 'en_proceso' || h.tareas?.some((t) => t.estado === 'en_progreso');
            if (statusFilter === 'pendiente') return h.estado === 'pendiente';
            if (statusFilter === 'bloqueado') return h.estado === 'bloqueado' || h.tareas?.some((t) => t.estado === 'detenida');
            return true;
          });
          return { ...p, hitos: filteredHitos };
        })
        .filter((p) => p.hitos && p.hitos.length > 0);
    }

    return result;
  }, [projects, activeProjectFilter, searchQuery, statusFilter]);

  // Rango global de fechas para la cuadrícula
  const { minDate, maxDate, totalDays, todayOffsetDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let earliest = new Date(today);
    let latest = new Date(today);

    earliest.setDate(earliest.getDate() - 15);
    latest.setDate(latest.getDate() + 75);

    projects.forEach((p) => {
      const pStart = parseDate(p.fecha_inicio);
      const pEnd = parseDate(p.fecha_fin);
      if (pStart && pStart < earliest) earliest = new Date(pStart);
      if (pEnd && pEnd > latest) latest = new Date(pEnd);

      p.hitos?.forEach((h) => {
        const hMeta = parseDate(h.fecha_meta);
        if (hMeta) {
          if (hMeta < earliest) earliest = new Date(hMeta);
          if (hMeta > latest) latest = new Date(hMeta);
        }
      });
    });

    earliest.setDate(earliest.getDate() - 5);
    latest.setDate(latest.getDate() + 10);

    const days = Math.max(30, getDaysBetween(earliest, latest));
    const todayOffset = getDaysBetween(earliest, today);

    return {
      minDate: earliest,
      maxDate: latest,
      totalDays: days,
      todayOffsetDays: todayOffset
    };
  }, [projects]);

  // Escala en píxeles por día
  const dayWidth = useMemo(() => {
    if (timeScale === 'dias') return 36;
    if (timeScale === 'semanas') return 14;
    return 5;
  }, [timeScale]);

  const timelineTotalWidth = Math.max(900, totalDays * dayWidth);

  // Columnas del encabezado de la línea de tiempo
  const timelineHeaders = useMemo(() => {
    const months = [];
    const subUnits = [];

    let currentMonth = null;
    let monthStartDay = 0;

    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const date = addDays(minDate, dayIdx);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      if (!currentMonth || currentMonth.key !== monthKey) {
        if (currentMonth) {
          currentMonth.widthDays = dayIdx - monthStartDay;
          currentMonth.widthPct = (currentMonth.widthDays / totalDays) * 100;
          months.push(currentMonth);
        }
        currentMonth = {
          key: monthKey,
          label: date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }),
          startDay: dayIdx,
          widthDays: 0,
          widthPct: 0
        };
        monthStartDay = dayIdx;
      }

      if (timeScale === 'dias') {
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isToday = dayIdx === todayOffsetDays;
        subUnits.push({
          key: `d-${dayIdx}`,
          label: date.getDate(),
          subLabel: ['D', 'L', 'M', 'M', 'J', 'V', 'S'][date.getDay()],
          isWeekend,
          isToday,
          startDay: dayIdx,
          widthDays: 1,
          leftPct: (dayIdx / totalDays) * 100,
          widthPct: (1 / totalDays) * 100
        });
      } else if (timeScale === 'semanas') {
        if (date.getDay() === 1 || dayIdx === 0) {
          const remaining = totalDays - dayIdx;
          const wDays = Math.min(7, remaining);
          subUnits.push({
            key: `w-${dayIdx}`,
            label: `S${Math.ceil((date.getDate() + 6 - date.getDay()) / 7)} (${date.getDate()} ${date.toLocaleDateString('es-MX', { month: 'short' })})`,
            startDay: dayIdx,
            widthDays: wDays,
            leftPct: (dayIdx / totalDays) * 100,
            widthPct: (wDays / totalDays) * 100
          });
        }
      }
    }

    if (currentMonth) {
      currentMonth.widthDays = totalDays - monthStartDay;
      currentMonth.widthPct = (currentMonth.widthDays / totalDays) * 100;
      months.push(currentMonth);
    }

    return { months, subUnits };
  }, [minDate, totalDays, timeScale, todayOffsetDays]);

  // Centrar en el día de hoy
  const handleScrollToToday = () => {
    if (timelineScrollRef.current && todayOffsetDays >= 0) {
      const scrollPos = Math.max(0, (todayOffsetDays / totalDays) * timelineTotalWidth - 120);
      timelineScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
    }
  };

  // Scroll a un rango de fecha específico (usado desde la vista lista móvil)
  const handleScrollToDate = (targetDateStr) => {
    const d = parseDate(targetDateStr);
    if (d && timelineScrollRef.current) {
      const offsetDays = getDaysBetween(minDate, d);
      const scrollPos = Math.max(0, (offsetDays / totalDays) * timelineTotalWidth - 100);
      setMobileTab('gantt');
      setTimeout(() => {
        timelineScrollRef.current?.scrollTo({ left: scrollPos, behavior: 'smooth' });
      }, 100);
    }
  };

  // Expandir / Colapsar Todo
  const handleToggleExpandAll = (expand) => {
    const expProj = {};
    const expHit = {};
    projects.forEach((p) => {
      expProj[p.id] = expand;
      p.hitos?.forEach((h) => {
        expHit[h.id] = expand;
      });
    });
    setExpandedProjects(expProj);
    setExpandedHitos(expHit);
  };

  // Abrir en ventana emergente
  const handleOpenPopoutWindow = () => {
    const url = `/index.html#gantt${activeProjectFilter !== 'all' ? `?project=${activeProjectFilter}` : ''}`;
    const windowFeatures = 'toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=1380,height=850';
    const popout = window.open(url, 'AgrokoolGanttWindow', windowFeatures);
    if (popout) {
      popout.focus();
    } else {
      alert('Por favor permite las ventanas emergentes en tu navegador.');
    }
  };

  // Calcular métricas
  const metrics = useMemo(() => {
    let totalMetaHa = 0;
    let totalAcumHa = 0;
    let totalHitos = 0;
    let hitosCompletados = 0;
    let totalTareas = 0;
    let tareasCompletadas = 0;

    filteredProjects.forEach((p) => {
      totalMetaHa += parseFloat(p.superficie_meta_ha) || 0;
      p.hitos?.forEach((h) => {
        totalHitos += 1;
        if (h.estado === 'completado') hitosCompletados += 1;
        h.tareas?.forEach((t) => {
          totalTareas += 1;
          totalAcumHa += parseFloat(t.cantidad_acumulada) || 0;
          if (t.estado === 'completada') tareasCompletadas += 1;
        });
      });
    });

    const pctGlobal = totalMetaHa > 0 ? Math.min(100, Math.round((totalAcumHa / totalMetaHa) * 100)) : 0;

    return {
      totalMetaHa,
      totalAcumHa: parseFloat(totalAcumHa.toFixed(1)),
      pctGlobal,
      totalHitos,
      hitosCompletados,
      totalTareas,
      tareasCompletadas,
      totalProyectos: filteredProjects.length
    };
  }, [filteredProjects]);

  const activeProjectObj = projects.find((p) => String(p.id) === String(activeProjectFilter));

  // Filas para impresión oficial
  const printRows = useMemo(() => {
    const rows = [];
    const taskColors = {
      completada: 'bg-emerald-600',
      en_progreso: 'bg-sky-600',
      detenida: 'bg-rose-600',
      pendiente: 'bg-amber-500'
    };

    filteredProjects.forEach((p) => {
      const pStart = parseDate(p.fecha_inicio) || minDate;
      const pEnd = parseDate(p.fecha_fin) || addDays(pStart, 60);
      const pDuration = Math.max(7, getDaysBetween(pStart, pEnd));
      const pMeta = parseFloat(p.superficie_meta_ha) || 0;
      const pAcum =
        p.hitos?.reduce(
          (sum, h) => sum + (h.tareas?.reduce((taskSum, t) => taskSum + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0),
          0
        ) || 0;
      rows.push({
        id: `print-p-${p.id}`,
        type: 'project',
        label: p.nombre,
        detail: `${p.ciclo || 'Sin ciclo'} · ${pAcum}/${pMeta} ha`,
        left: (Math.max(0, getDaysBetween(minDate, pStart)) / totalDays) * 100,
        width: Math.max(3, (pDuration / totalDays) * 100),
        progress: pMeta > 0 ? Math.min(100, Math.round((pAcum / pMeta) * 100)) : 0,
        barLabel: `${p.nombre} · ${pMeta > 0 ? Math.min(100, Math.round((pAcum / pMeta) * 100)) : 0}%`
      });

      (p.hitos || []).forEach((h, hIndex) => {
        const previous = hIndex > 0 ? p.hitos[hIndex - 1] : null;
        const hStart = previous?.fecha_meta ? parseDate(previous.fecha_meta) : pStart;
        const hEnd = parseDate(h.fecha_meta) || addDays(hStart, 20);
        const hDuration = Math.max(4, getDaysBetween(hStart, hEnd));
        const hMeta = parseFloat(h.superficie_meta_ha) || 0;
        const hAcum = h.tareas?.reduce((sum, t) => sum + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0;
        const hProgress = hMeta > 0 ? Math.min(100, Math.round((hAcum / hMeta) * 100)) : 0;
        rows.push({
          id: `print-h-${h.id}`,
          type: 'milestone',
          label: `Hito ${h.orden}: ${h.nombre}`,
          detail: `Meta ${formatDisplayDate(h.fecha_meta)} · ${h.estado || 'pendiente'}`,
          left: (Math.max(0, getDaysBetween(minDate, hStart)) / totalDays) * 100,
          width: Math.max(2.5, (hDuration / totalDays) * 100),
          progress: hProgress,
          state: h.estado || 'pendiente',
          barLabel: `Hito ${h.orden} · ${hProgress}%`
        });

        (h.tareas || []).forEach((t, taskIndex) => {
          const taskStep = Math.max(2, Math.floor(hDuration / Math.max(1, h.tareas.length)));
          const tStart = addDays(hStart, taskIndex * taskStep);
          const tEnd = addDays(tStart, taskStep);
          const tMeta = parseFloat(t.cantidad_meta) || 1;
          const tAcum = parseFloat(t.cantidad_acumulada) || 0;
          rows.push({
            id: `print-t-${t.id}`,
            type: 'task',
            label: t.nombre,
            detail: `${t.responsable || 'Sin asignar'} · ${tAcum}/${tMeta} ${t.unidad || 'ha'}`,
            left: (Math.max(0, getDaysBetween(minDate, tStart)) / totalDays) * 100,
            width: Math.max(2, (getDaysBetween(tStart, tEnd) / totalDays) * 100),
            progress: Math.min(100, Math.round((tAcum / tMeta) * 100)),
            color: taskColors[t.estado] || taskColors.pendiente,
            barLabel: t.nombre
          });
        });
      });
    });
    return rows;
  }, [filteredProjects, minDate, totalDays]);

  // Manejo de clic en elementos del Gantt (Abre Bottom Sheet en móvil / modal en desktop)
  const handleItemClick = (itemData) => {
    setSelectedItemDetail(itemData);
  };

  return (
    <div
      className={`gantt-root flex flex-col bg-[#fdfdfc] dark:bg-[#0e1700] text-slate-900 dark:text-slate-100 ${
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-hidden'
          : isModal
          ? 'w-full h-full flex-1 overflow-hidden'
          : 'w-full h-full flex-1 overflow-hidden'
      }`}
    >
      {/* ========================================================================= */}
      {/* ENCABEZADO EXCLUSIVO PARA IMPRESIÓN OFICIAL                                */}
      {/* ========================================================================= */}
      <div className="hidden print:block p-4 mb-2 border-b-2 border-slate-900 bg-white text-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AGROKOOL" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-base font-black uppercase tracking-tight text-[#2c4001]">
                AGROKOOL · CRONOGRAMA MAESTRO DE GANTT
              </h1>
              <p className="text-[11px] text-slate-700 font-semibold">
                Supervisión de Ciclos Agrícolas, Frentes de Obra, Hitos y Tareas de Campo
              </p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-700 leading-tight">
            <div>
              <strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })}
            </div>
            <div>
              <strong>Proyecto:</strong>{' '}
              {activeProjectFilter === 'all'
                ? 'Consolidado General Multi-Proyecto'
                : `${activeProjectObj?.nombre || ''} (${activeProjectObj?.ciclo || ''})`}
            </div>
            <div>
              <strong>Responsable:</strong> {activeProjectObj?.gerente_nombre || 'Dirección de Operaciones'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mt-3 pt-2 border-t border-slate-300 text-center text-xs">
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Proyectos</span>
            <span className="text-xs font-black text-slate-900">{metrics.totalProyectos} activos</span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Superficie Meta</span>
            <span className="text-xs font-black text-[#2c4001]">{metrics.totalMetaHa} ha</span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Avance Acumulado</span>
            <span className="text-xs font-black text-emerald-800">
              {metrics.totalAcumHa} ha ({metrics.pctGlobal}%)
            </span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Hitos Clave</span>
            <span className="text-xs font-black text-blue-800">
              {metrics.hitosCompletados} / {metrics.totalHitos}
            </span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Tareas</span>
            <span className="text-xs font-black text-purple-800">
              {metrics.tareasCompletadas} / {metrics.totalTareas}
            </span>
          </div>
        </div>
      </div>

      <section className="gantt-print-report hidden print:block px-4 pb-3 text-slate-900">
        <div className="gantt-print-grid gantt-print-header-row">
          <div className="gantt-print-wbs-head">Estructura / tarea</div>
          <div className="gantt-print-time-head">
            {timelineHeaders.months.map((month) => (
              <span key={month.key} style={{ width: `${month.widthPct}%` }}>
                {month.label}
              </span>
            ))}
          </div>
        </div>
        <div className="gantt-print-grid gantt-print-subhead">
          <div className="gantt-print-wbs-subhead">Avance y responsable</div>
          <div className="gantt-print-time-subhead">
            {timelineHeaders.subUnits.map((unit) => (
              <span key={unit.key} style={{ width: `${unit.widthPct}%` }}>
                {unit.label}
              </span>
            ))}
          </div>
        </div>
        <div className="gantt-print-rows">
          {printRows.map((row) => (
            <div className={`gantt-print-grid gantt-print-row gantt-print-${row.type}`} key={row.id}>
              <div className="gantt-print-label">
                <strong>{row.label}</strong>
                <span>{row.detail}</span>
              </div>
              <div className="gantt-print-track">
                <div
                  className={`gantt-print-bar ${
                    row.type === 'project'
                      ? 'gantt-print-project-bar'
                      : row.type === 'milestone'
                      ? `gantt-print-milestone-bar gantt-print-${row.state}`
                      : row.color
                  }`}
                  style={{ left: `${row.left}%`, width: `${row.width}%` }}
                >
                  <i style={{ width: `${row.progress}%` }} />
                  <b>{row.barLabel}</b>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 1. TOOLBAR PRINCIPAL RESPONSIVA CON LOGO Y COLORES OFICIALES AGROKOOL      */}
      {/* ========================================================================= */}
      <header className="no-print print:hidden bg-[#243302] text-white border-b border-[#3e5606] px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-2 flex-shrink-0 z-30 shadow-md">
        {/* Fila 1: Logo + Botón Volver + Título + Selector Modo Móvil + Controles */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Lado Izquierdo: Volver + Logo Oficial + Título */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#a1c62e] border border-[#3e5606] text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                title="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Volver</span>
              </button>
            )}

            {/* Logo Oficial AGROKOOL */}
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="AGROKOOL" className="h-7 sm:h-8 w-auto object-contain shrink-0" />
              <div className="hidden sm:block">
                <h1 className="text-xs sm:text-sm font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                  <span>Diagrama de Gantt</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1e2d01] text-[#a1c62e] border border-[#3e5606] font-mono">
                    v7
                  </span>
                </h1>
                <p className="text-[10px] text-[#d4e6b5] font-medium mt-0.5">Planeación & Ejecución Agrícola</p>
              </div>
            </div>
          </div>

          {/* Selector de Modo en Móvil (Gantt vs Lista) */}
          <div className="flex md:hidden items-center bg-[#1e2d01] rounded-xl p-0.5 border border-[#3e5606]">
            <button
              type="button"
              onClick={() => setMobileTab('gantt')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                mobileTab === 'gantt'
                  ? 'bg-[#a1c62e] text-[#2c4001] shadow-xs'
                  : 'text-[#d4e6b5] hover:text-white'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Gantt</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('lista')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                mobileTab === 'lista'
                  ? 'bg-[#a1c62e] text-[#2c4001] shadow-xs'
                  : 'text-[#d4e6b5] hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
          </div>

          {/* Lado Derecho: Controles Rápidos */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Escala Temporal (Días / Semanas / Meses) */}
            <div className="hidden sm:flex items-center bg-[#1e2d01] rounded-xl p-0.5 border border-[#3e5606]">
              {['dias', 'semanas', 'meses'].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setTimeScale(scale)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    timeScale === scale
                      ? 'bg-[#a1c62e] text-[#2c4001] shadow-xs'
                      : 'text-[#d4e6b5] hover:text-white'
                  }`}
                >
                  {scale}
                </button>
              ))}
            </div>

            {/* Botón Hoy */}
            <button
              type="button"
              onClick={handleScrollToToday}
              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#a1c62e] border border-[#3e5606] text-xs font-bold flex items-center gap-1 transition shadow-xs"
              title="Centrar línea de tiempo en el día actual"
            >
              <Clock className="w-3.5 h-3.5 text-[#a1c62e]" />
              <span className="hidden xs:inline">Hoy</span>
            </button>

            {/* Alternar Métricas */}
            <button
              type="button"
              onClick={() => setShowMetrics(!showMetrics)}
              className={`p-1.5 sm:px-2 sm:py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition shadow-xs ${
                showMetrics
                  ? 'bg-[#a1c62e] text-[#2c4001] border-[#a1c62e]'
                  : 'bg-[#1e2d01] text-[#d4e6b5] border-[#3e5606] hover:text-white'
              }`}
              title="Mostrar / Ocultar cinta de métricas"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Métricas</span>
            </button>

            {/* Expandir / Colapsar Todo */}
            <button
              type="button"
              onClick={() => {
                const anyCollapsed = Object.values(expandedProjects).some((v) => !v);
                handleToggleExpandAll(anyCollapsed);
              }}
              className="p-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#d4e6b5] hover:text-white border border-[#3e5606] transition"
              title="Expandir / Colapsar todos los proyectos"
            >
              <Sliders className="w-3.5 h-3.5 text-[#a1c62e]" />
            </button>

            {/* Pantalla Completa */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#d4e6b5] hover:text-white border border-[#3e5606] transition"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {isModal && onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition ml-1"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>

        {/* Fila 2: Selectores de Proyecto, Estado y Buscador (Adaptativo a Móvil) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-1 border-t border-[#3e5606]/80 text-xs">
          {/* Selector de Proyecto */}
          <select
            value={activeProjectFilter}
            onChange={(e) => {
              setActiveProjectFilter(e.target.value);
              if (onProjectChange) onProjectChange(e.target.value);
            }}
            className="flex-1 sm:flex-initial sm:min-w-[200px] max-w-full sm:max-w-xs px-2.5 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs font-bold text-white focus:outline-none focus:border-[#a1c62e] truncate"
          >
            <option value="all">📁 Todos los Proyectos ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.ciclo}) · {p.superficie_meta_ha} ha
              </option>
            ))}
          </select>

          {/* Selector de Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="hidden sm:block px-2.5 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs font-semibold text-[#d4e6b5] focus:outline-none focus:border-[#a1c62e]"
          >
            <option value="all">Todos los Estados</option>
            <option value="en_progreso">🔵 En Proceso</option>
            <option value="completado">🟢 Completados</option>
            <option value="pendiente">⚪ Pendientes</option>
            <option value="bloqueado">🔴 Con Bloqueo</option>
          </select>

          {/* Escala en móvil si la barra superior se ocultó */}
          <div className="flex sm:hidden items-center bg-[#1e2d01] rounded-xl p-0.5 border border-[#3e5606]">
            {['dias', 'semanas', 'meses'].map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => setTimeScale(scale)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition ${
                  timeScale === scale
                    ? 'bg-[#a1c62e] text-[#2c4001]'
                    : 'text-[#d4e6b5]'
                }`}
              >
                {scale}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className="relative flex-1 sm:w-56 sm:ml-auto">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar hito, tarea..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#a1c62e]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. CINTA DE MÉTRICAS COMPACTA CON COLORES CORPORATIVOS                    */}
      {/* ========================================================================= */}
      {showMetrics && (
        <div className="no-print print:hidden bg-[#f4f8ed] dark:bg-[#152202] border-b border-[#e2ebd3] dark:border-[#253905] px-3 sm:px-4 py-1.5 flex items-center justify-between gap-4 text-xs overflow-x-auto no-scrollbar flex-shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-4 sm:gap-6 divide-x divide-[#d4e6b5] dark:divide-[#3e5606]/60">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase">Proyectos:</span>
              <span className="font-black text-[#2c4001] dark:text-[#a1c62e]">{metrics.totalProyectos}</span>
            </div>
            <div className="pl-4 sm:pl-6 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase">Meta:</span>
              <span className="font-black text-[#2c4001] dark:text-white">{metrics.totalMetaHa.toLocaleString('es-MX')} ha</span>
            </div>
            <div className="pl-4 sm:pl-6 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase">Avance:</span>
              <span className="font-black text-emerald-700 dark:text-emerald-400">{metrics.totalAcumHa.toLocaleString('es-MX')} ha</span>
              <span className="px-1.5 py-0.2 rounded-full bg-[#a1c62e] text-[#2c4001] font-black text-[10px] shadow-xs">
                {metrics.pctGlobal}%
              </span>
            </div>
            <div className="pl-4 sm:pl-6 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase">Hitos:</span>
              <span className="font-black text-blue-700 dark:text-blue-400">
                {metrics.hitosCompletados}/{metrics.totalHitos}
              </span>
            </div>
            <div className="pl-4 sm:pl-6 flex items-center gap-1.5 whitespace-nowrap">
              <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase">Tareas:</span>
              <span className="font-black text-purple-700 dark:text-purple-300">
                {metrics.tareasCompletadas}/{metrics.totalTareas}
              </span>
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-[#a1c62e] animate-pulse" />
            <span>
              {formatDisplayDate(formatDate(minDate))} al {formatDisplayDate(formatDate(maxDate))}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. VISTA MÓVIL: MODO LISTA TÁCTIL (TARJETAS WBS)                          */}
      {/* ========================================================================= */}
      {mobileTab === 'lista' && (
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 md:hidden no-scrollbar bg-[#f8faf4] dark:bg-[#0c1400]">
          {filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-bold text-xs">No se encontraron proyectos.</p>
            </div>
          ) : (
            filteredProjects.map((p) => {
              const isProjExp = !!expandedProjects[p.id];
              const pTotalHa = parseFloat(p.superficie_meta_ha) || 0;
              const pAcumHa =
                p.hitos?.reduce(
                  (acc, h) =>
                    acc + (h.tareas?.reduce((tAcc, t) => tAcc + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0),
                  0
                ) || 0;
              const pPct = pTotalHa > 0 ? Math.min(100, Math.round((pAcumHa / pTotalHa) * 100)) : 0;

              return (
                <div
                  key={`mobile-p-${p.id}`}
                  className="rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xs overflow-hidden"
                >
                  {/* Cabecera de Proyecto */}
                  <div
                    onClick={() =>
                      setExpandedProjects((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                    }
                    className="p-3.5 flex items-center justify-between cursor-pointer bg-[#f4f8ed] dark:bg-[#1a2b03] border-b border-[#e2ebd3] dark:border-[#253905]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="p-1.5 rounded-lg bg-[#2c4001] text-[#a1c62e]">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">{p.nombre}</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {p.tipo} · Ciclo {p.ciclo}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right font-mono text-[10px]">
                        <span className="font-bold text-[#2c4001] dark:text-[#a1c62e] block">
                          {pAcumHa}/{pTotalHa} ha
                        </span>
                        <span className="text-slate-500 font-bold">{pPct}%</span>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform ${
                          isProjExp ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Acciones Rápidas del Proyecto */}
                  <div className="px-3.5 py-2 bg-white dark:bg-[#152202] flex items-center justify-between border-b border-[#f0f4ea] dark:border-[#253905]/40 text-[11px]">
                    <span className="text-slate-400 text-[10px]">
                      📅 {formatDisplayDate(p.fecha_inicio)} al {formatDisplayDate(p.fecha_fin)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScrollToDate(p.fecha_inicio);
                      }}
                      className="text-[#2c4001] dark:text-[#a1c62e] font-bold flex items-center gap-1 hover:underline"
                    >
                      <span>Ver en Cronograma</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Lista de Hitos del Proyecto */}
                  {isProjExp && (
                    <div className="divide-y divide-[#f0f4ea] dark:divide-[#253905]/40">
                      {p.hitos?.map((h) => {
                        const isHitoExp = !!expandedHitos[h.id];
                        const hMetaHa = parseFloat(h.superficie_meta_ha) || 0;
                        const hAcumHa =
                          h.tareas?.reduce((acc, t) => acc + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0;
                        const hPct = hMetaHa > 0 ? Math.min(100, Math.round((hAcumHa / hMetaHa) * 100)) : 0;

                        return (
                          <div key={`mobile-h-${h.id}`} className="p-3 bg-white dark:bg-[#121c02]">
                            <div
                              onClick={() =>
                                setExpandedHitos((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                              }
                              className="flex items-center justify-between cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-5 h-5 rounded-full bg-[#dfb75c] text-[#2c4001] text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs">
                                  {h.orden}
                                </span>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                    {h.nombre}
                                  </h4>
                                  <p className="text-[10px] text-slate-400">
                                    Meta: {formatDisplayDate(h.fecha_meta)} · {h.estado?.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {hMetaHa} ha ({hPct}%)
                                </span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                                    isHitoExp ? 'rotate-180' : ''
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Tareas del Hito */}
                            {isHitoExp && (
                              <div className="mt-2.5 pl-7 space-y-1.5 border-l-2 border-[#e2ebd3] dark:border-[#253905]">
                                {h.tareas?.map((t) => {
                                  const tMeta = parseFloat(t.cantidad_meta) || 1;
                                  const tAcum = parseFloat(t.cantidad_acumulada) || 0;
                                  const tPct = Math.min(100, Math.round((tAcum / tMeta) * 100));

                                  return (
                                    <div
                                      key={`mobile-t-${t.id}`}
                                      onClick={() =>
                                        handleItemClick({
                                          title: t.nombre,
                                          type: 'Tarea Operativa',
                                          subtitle: `Hito: ${h.nombre}`,
                                          responsable: t.responsable,
                                          predio: t.predio_nombre,
                                          progress: `${tAcum} / ${tMeta} ${t.unidad || 'ha'} (${tPct}%)`,
                                          estado: t.estado,
                                          dates: `Meta Hito: ${formatDisplayDate(h.fecha_meta)}`
                                        })
                                      }
                                      className="p-2 rounded-xl bg-slate-50 dark:bg-[#1a2903]/40 border border-slate-200/70 dark:border-[#253905] flex items-center justify-between text-xs"
                                    >
                                      <div className="min-w-0 pr-2">
                                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                                          {t.nombre}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                          {t.responsable || 'Sin asignar'} · {t.predio_nombre || 'General'}
                                        </span>
                                      </div>
                                      <div className="text-right font-mono text-[10px] shrink-0">
                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                          {tAcum}/{tMeta} {t.unidad || 'ha'}
                                        </span>
                                        <span className="text-[#2c4001] dark:text-[#a1c62e] font-bold block">{tPct}%</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GRILLA PRINCIPAL GANTT CON STICKY WBS & SCROLL SINCRONIZADO NATIVO     */}
      {/* ========================================================================= */}
      <div
        ref={timelineScrollRef}
        className={`flex-1 overflow-auto bg-white dark:bg-[#0c1400] relative no-print select-none touch-pan-x touch-pan-y ${
          mobileTab === 'lista' ? 'hidden md:block' : 'block'
        }`}
      >
        <div
          style={{
            width: `${(wbsCollapsedMobile ? 60 : 340) + timelineTotalWidth}px`,
            minWidth: '100%'
          }}
          className="relative"
        >
          {/* ================= ENCABEZADO DE TABLA (STICKY TOP) ================= */}
          <div className="sticky top-0 z-30 flex bg-[#edf5e3] dark:bg-[#142002] border-b border-[#d3e2be] dark:border-[#253905] shadow-xs">
            {/* Esquina Superior Izquierda (Sticky Left + Top) */}
            <div
              style={{ width: `${wbsCollapsedMobile ? 60 : 340}px` }}
              className="sticky left-0 z-40 bg-[#edf5e3] dark:bg-[#142002] border-r border-[#d3e2be] dark:border-[#253905] px-2 sm:px-3 py-2 flex items-center justify-between flex-shrink-0 shadow-xs transition-all"
            >
              {!wbsCollapsedMobile ? (
                <>
                  <span className="text-[11px] font-black uppercase tracking-wider text-[#2c4001] dark:text-[#a1c62e] flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" />
                    <span>Estructura / Tareas</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                      Meta / Avance
                    </span>
                    <button
                      type="button"
                      onClick={() => setWbsCollapsedMobile(!wbsCollapsedMobile)}
                      className="p-1 rounded text-slate-500 hover:text-[#2c4001] dark:hover:text-[#a1c62e] md:hidden"
                      title="Ocultar columna para ampliar cronograma"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setWbsCollapsedMobile(false)}
                  className="w-full py-1 text-center font-bold text-[10px] text-[#2c4001] dark:text-[#a1c62e] flex items-center justify-center gap-1"
                  title="Expandir columna"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="text-[9px]">WBS</span>
                </button>
              )}
            </div>

            {/* Pista del Encabezado Temporal (Meses y Sub-unidades) */}
            <div style={{ width: `${timelineTotalWidth}px` }} className="flex-1 flex flex-col flex-shrink-0">
              {/* Fila 1: Meses */}
              <div className="h-6 flex border-b border-[#d3e2be] dark:border-[#253905] bg-[#e6f0d7] dark:bg-[#101901]">
                {timelineHeaders.months.map((m) => (
                  <div
                    key={m.key}
                    style={{ width: `${m.widthPct}%` }}
                    className="h-full px-2 border-r border-[#d3e2be] dark:border-[#253905] flex items-center justify-center font-black text-[10px] uppercase text-[#2c4001] dark:text-[#a1c62e] tracking-wider truncate"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Fila 2: Sub-unidades (Semanas o Días) */}
              <div className="h-6 flex bg-[#edf5e3] dark:bg-[#142002]">
                {timelineHeaders.subUnits.map((sub) => (
                  <div
                    key={sub.key}
                    style={{ width: `${sub.widthPct}%` }}
                    className={`h-full border-r border-[#e2ebd3] dark:border-[#253905]/70 flex items-center justify-center text-[9px] ${
                      sub.isToday
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-black'
                        : sub.isWeekend
                        ? 'bg-[#e2ebd3]/40 dark:bg-[#101901] text-slate-400'
                        : 'text-[#2c4001] dark:text-[#d4e6b5] font-semibold'
                    }`}
                  >
                    <span className="truncate px-0.5">{sub.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================= LÍNEAS DE GUÍA VERTICALES & LÍNEA DE HOY ================= */}
          <div
            style={{
              left: `${wbsCollapsedMobile ? 60 : 340}px`,
              width: `${timelineTotalWidth}px`
            }}
            className="absolute top-12 bottom-0 pointer-events-none flex transition-all"
          >
            {timelineHeaders.subUnits.map((sub) => (
              <div
                key={`grid-${sub.key}`}
                style={{ width: `${sub.widthPct}%` }}
                className={`h-full border-r ${
                  sub.isWeekend
                    ? 'border-[#eef3e6] dark:border-[#1c2903]/40 bg-[#f8faf4]/30 dark:bg-[#0c1400]/20'
                    : 'border-[#f0f4ea] dark:border-[#1a2903]/30'
                }`}
              />
            ))}

            {/* Línea vertical de Hoy */}
            {todayOffsetDays >= 0 && todayOffsetDays <= totalDays && (
              <div
                style={{ left: `${(todayOffsetDays / totalDays) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-xs"
              >
                <div className="sticky top-14 -translate-x-1/2 bg-red-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded shadow-xs uppercase tracking-wider whitespace-nowrap">
                  Hoy
                </div>
              </div>
            )}
          </div>

          {/* ================= FILAS DE CONTENIDO UNIFICADAS ================= */}
          <div className="divide-y divide-[#edf3e4] dark:divide-[#1c2903]/50">
            {filteredProjects.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-bold text-xs text-slate-600 dark:text-slate-300">
                  No se encontraron proyectos o tareas que coincidan con los filtros.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Prueba cambiando el término de búsqueda o el estado seleccionado.
                </p>
              </div>
            ) : (
              filteredProjects.map((p) => {
                const isProjExp = !!expandedProjects[p.id];
                const pTotalHa = parseFloat(p.superficie_meta_ha) || 0;
                const pAcumHa =
                  p.hitos?.reduce(
                    (acc, h) =>
                      acc + (h.tareas?.reduce((tAcc, t) => tAcc + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0),
                    0
                  ) || 0;
                const pPct = pTotalHa > 0 ? Math.min(100, Math.round((pAcumHa / pTotalHa) * 100)) : 0;

                const pStart = parseDate(p.fecha_inicio) || minDate;
                const pEnd = parseDate(p.fecha_fin) || addDays(pStart, 60);
                const projStartDay = Math.max(0, getDaysBetween(minDate, pStart));
                const projDurationDays = Math.max(7, getDaysBetween(pStart, pEnd));
                const projLeftPct = (projStartDay / totalDays) * 100;
                const projWidthPct = Math.max(3, (projDurationDays / totalDays) * 100);

                return (
                  <React.Fragment key={`proj-group-${p.id}`}>
                    {/* FILA DE PROYECTO */}
                    <div className="h-11 flex items-stretch hover:bg-[#f4f8ed] dark:hover:bg-[#1a2b03] transition-colors group">
                      {/* Celda Izquierda WBS (Sticky Left) */}
                      <div
                        style={{ width: `${wbsCollapsedMobile ? 60 : 340}px` }}
                        className="sticky left-0 z-20 bg-[#f8faf4] dark:bg-[#142002] group-hover:bg-[#eef5e4] dark:group-hover:bg-[#1a2903] border-r border-[#d3e2be] dark:border-[#253905] px-2 sm:px-3 flex items-center justify-between flex-shrink-0 transition-all shadow-2xs"
                      >
                        {!wbsCollapsedMobile ? (
                          <>
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedProjects((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                                }
                                className="p-1 rounded bg-[#2c4001] text-[#a1c62e] hover:bg-[#1e2d01] transition shrink-0"
                              >
                                {isProjExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                              <div className="min-w-0">
                                <h4
                                  className="text-xs font-black text-[#2c4001] dark:text-white truncate"
                                  title={p.nombre}
                                >
                                  {p.nombre}
                                </h4>
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold">{p.tipo}</span>
                                  <span>•</span>
                                  <span>{p.ciclo}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0 font-mono text-[10px]">
                              <span className="font-black text-[#2c4001] dark:text-[#a1c62e] block">
                                {pAcumHa}/{pTotalHa} ha
                              </span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">{pPct}%</span>
                            </div>
                          </>
                        ) : (
                          <div className="w-full text-center">
                            <span className="text-[10px] font-black text-[#2c4001] dark:text-[#a1c62e] block">
                              {pPct}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pista Derecha de la Fila (Timeline Track) */}
                      <div
                        style={{ width: `${timelineTotalWidth}px` }}
                        className="relative flex items-center flex-shrink-0"
                      >
                        <div
                          style={{ left: `${projLeftPct}%`, width: `${projWidthPct}%` }}
                          onClick={() =>
                            handleItemClick({
                              title: p.nombre,
                              type: 'Proyecto Agrícola',
                              subtitle: `${p.tipo} · Ciclo ${p.ciclo}`,
                              dates: `${formatDisplayDate(p.fecha_inicio)} al ${formatDisplayDate(p.fecha_fin)}`,
                              progress: `${pPct}% (${pAcumHa} / ${pTotalHa} ha)`,
                              fase: p.fase_catalogo
                            })
                          }
                          onMouseEnter={(e) => {
                            setHoverTooltip({
                              title: p.nombre,
                              type: 'Proyecto Agrícola',
                              subtitle: `${p.tipo} · Ciclo ${p.ciclo}`,
                              dates: `${formatDisplayDate(p.fecha_inicio)} al ${formatDisplayDate(p.fecha_fin)}`,
                              progress: `${pPct}% (${pAcumHa} / ${pTotalHa} ha)`,
                              fase: p.fase_catalogo,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          onMouseLeave={() => setHoverTooltip(null)}
                          className="absolute h-7 rounded-lg bg-gradient-to-r from-[#2c4001] to-[#456306] border border-[#a1c62e]/60 text-white shadow-sm flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 active:scale-98 transition group/bar"
                        >
                          <div
                            style={{ width: `${pPct}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-[#a1c62e]/35 rounded-l-lg"
                          />
                          <span className="relative z-10 text-[10px] font-black truncate flex items-center gap-1.5 drop-shadow-xs">
                            <Layers className="w-3 h-3 text-[#a1c62e] shrink-0" />
                            <span>{p.nombre}</span>
                            <span className="text-[#a1c62e]">({pPct}%)</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* FILAS DE HITOS (SI EL PROYECTO ESTÁ EXPANDIDO) */}
                    {isProjExp &&
                      p.hitos?.map((h, hIdx) => {
                        const isHitoExp = !!expandedHitos[h.id];
                        const hMetaHa = parseFloat(h.superficie_meta_ha) || 0;
                        const hAcumHa =
                          h.tareas?.reduce((acc, t) => acc + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0;
                        const hPct = hMetaHa > 0 ? Math.min(100, Math.round((hAcumHa / hMetaHa) * 100)) : 0;

                        const prevHito = hIdx > 0 ? p.hitos[hIdx - 1] : null;
                        const hStart = prevHito?.fecha_meta ? parseDate(prevHito.fecha_meta) : pStart;
                        const hMeta = parseDate(h.fecha_meta) || addDays(hStart, 20);

                        const hStartDay = Math.max(0, getDaysBetween(minDate, hStart));
                        const hDurationDays = Math.max(4, getDaysBetween(hStart, hMeta));
                        const hLeftPct = (hStartDay / totalDays) * 100;
                        const hWidthPct = Math.max(2.5, (hDurationDays / totalDays) * 100);
                        const milestonePosPct = (Math.max(0, getDaysBetween(minDate, hMeta)) / totalDays) * 100;

                        const statusBadgeStyles = {
                          completado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300',
                          en_proceso: 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
                          pendiente: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                          bloqueado: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                        };

                        const hitoBarStyles = {
                          completado: 'from-emerald-600 to-emerald-700 border-emerald-400',
                          en_proceso: 'from-blue-600 to-blue-700 border-blue-400',
                          pendiente: 'from-slate-500 to-slate-600 border-slate-400',
                          bloqueado: 'from-rose-600 to-rose-700 border-rose-400'
                        };

                        return (
                          <React.Fragment key={`hito-group-${h.id}`}>
                            {/* Fila del Hito */}
                            <div className="h-10 flex items-stretch hover:bg-[#f8faf4] dark:hover:bg-[#142002]/60 transition-colors group">
                              {/* Celda Izquierda WBS (Sticky Left) */}
                              <div
                                style={{ width: `${wbsCollapsedMobile ? 60 : 340}px` }}
                                className="sticky left-0 z-20 bg-white dark:bg-[#0e1601] group-hover:bg-[#f8faf4] dark:group-hover:bg-[#142002] border-r border-[#d3e2be] dark:border-[#253905] pl-3 sm:pl-6 pr-2 sm:pr-3 flex items-center justify-between flex-shrink-0 transition-all"
                              >
                                {!wbsCollapsedMobile ? (
                                  <>
                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 pr-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setExpandedHitos((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                                        }
                                        className="p-0.5 rounded text-slate-400 hover:text-[#2c4001] dark:hover:text-[#a1c62e] transition shrink-0"
                                      >
                                        {isHitoExp ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                      </button>
                                      <div className="w-4 h-4 rounded-full bg-[#dfb75c] text-[#2c4001] text-[9px] font-black flex items-center justify-center flex-shrink-0 shadow-xs">
                                        {h.orden}
                                      </div>
                                      <div className="min-w-0">
                                        <span
                                          className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block"
                                          title={h.nombre}
                                        >
                                          {h.nombre}
                                        </span>
                                        <span className="text-[9px] text-slate-400 block font-medium">
                                          Meta: {formatDisplayDate(h.fecha_meta)}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-right flex-shrink-0 font-mono text-[9px]">
                                      <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {hMetaHa} ha
                                      </span>
                                      <span
                                        className={`ml-1 text-[8px] font-bold px-1 py-0.2 rounded uppercase ${
                                          statusBadgeStyles[h.estado] || statusBadgeStyles.pendiente
                                        }`}
                                      >
                                        {h.estado?.replace('_', ' ')}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="w-full text-center">
                                    <span className="w-4 h-4 mx-auto rounded-full bg-[#dfb75c] text-[#2c4001] text-[9px] font-black flex items-center justify-center">
                                      {h.orden}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Pista Derecha del Hito */}
                              <div
                                style={{ width: `${timelineTotalWidth}px` }}
                                className="relative flex items-center flex-shrink-0"
                              >
                                {/* Barra del Hito */}
                                <div
                                  style={{ left: `${hLeftPct}%`, width: `${hWidthPct}%` }}
                                  onClick={() =>
                                    handleItemClick({
                                      title: `Hito #${h.orden}: ${h.nombre}`,
                                      type: 'Hito en Cascada',
                                      subtitle: h.descripcion || 'Sin descripción',
                                      dates: `Meta: ${formatDisplayDate(h.fecha_meta)}`,
                                      progress: `${hPct}% (${hAcumHa} / ${hMetaHa} ha)`,
                                      estado: h.estado
                                    })
                                  }
                                  onMouseEnter={(e) => {
                                    setHoverTooltip({
                                      title: `Hito #${h.orden}: ${h.nombre}`,
                                      type: 'Hito en Cascada',
                                      subtitle: h.descripcion || 'Sin descripción',
                                      dates: `Meta: ${formatDisplayDate(h.fecha_meta)}`,
                                      progress: `${hPct}% (${hAcumHa} / ${hMetaHa} ha)`,
                                      estado: h.estado,
                                      x: e.clientX,
                                      y: e.clientY
                                    });
                                  }}
                                  onMouseLeave={() => setHoverTooltip(null)}
                                  className={`absolute h-5 rounded-md bg-gradient-to-r ${
                                    hitoBarStyles[h.estado] || hitoBarStyles.pendiente
                                  } border text-white shadow-2xs flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 active:scale-98 transition`}
                                >
                                  <div
                                    style={{ width: `${hPct}%` }}
                                    className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-l-md"
                                  />
                                  <span className="relative z-10 text-[9px] font-bold truncate">
                                    #{h.orden} {h.nombre}
                                  </span>
                                </div>

                                {/* Diamante del Hito (Meta) - Marca Oficial AGROKOOL */}
                                <div
                                  style={{ left: `calc(${milestonePosPct}% - 7px)` }}
                                  onClick={() =>
                                    handleItemClick({
                                      title: `Hito Clave #${h.orden}: ${h.nombre}`,
                                      type: 'Fecha Meta Clave',
                                      dates: `Meta: ${formatDisplayDate(h.fecha_meta)}`,
                                      progress: `${hPct}% de la superficie`,
                                      estado: h.estado
                                    })
                                  }
                                  className="absolute w-3.5 h-3.5 rotate-45 bg-[#dfb75c] border-2 border-white dark:border-[#0e1700] shadow-sm z-10 cursor-pointer hover:scale-125 active:scale-110 transition"
                                  title={`Hito Meta: ${formatDisplayDate(h.fecha_meta)}`}
                                />
                              </div>
                            </div>

                            {/* FILAS DE TAREAS (SI EL HITO ESTÁ EXPANDIDO) */}
                            {isHitoExp &&
                              h.tareas?.map((t, tIdx) => {
                                const totalT = h.tareas.length || 1;
                                const taskStepDays = Math.max(2, Math.floor(hDurationDays / totalT));
                                const tStart = addDays(hStart, tIdx * taskStepDays);
                                const tEnd = addDays(tStart, taskStepDays);

                                const tStartDay = Math.max(0, getDaysBetween(minDate, tStart));
                                const tDurationDays = Math.max(2, getDaysBetween(tStart, tEnd));
                                const tLeftPct = (tStartDay / totalDays) * 100;
                                const tWidthPct = Math.max(2, (tDurationDays / totalDays) * 100);

                                const tMeta = parseFloat(t.cantidad_meta) || 1;
                                const tAcum = parseFloat(t.cantidad_acumulada) || 0;
                                const tPct = Math.min(100, Math.round((tAcum / tMeta) * 100));

                                const taskColor =
                                  t.estado === 'completada'
                                    ? 'bg-emerald-500 border-emerald-400'
                                    : t.estado === 'en_progreso'
                                    ? 'bg-sky-500 border-sky-400'
                                    : t.estado === 'detenida'
                                    ? 'bg-rose-500 border-rose-400'
                                    : 'bg-slate-400 border-slate-300';

                                return (
                                  <div
                                    key={`task-row-${t.id}`}
                                    className="h-8 flex items-stretch hover:bg-[#f8faf4] dark:hover:bg-[#142002]/30 transition-colors group"
                                  >
                                    {/* Celda Izquierda de la Tarea (Sticky Left) */}
                                    <div
                                      style={{ width: `${wbsCollapsedMobile ? 60 : 340}px` }}
                                      className="sticky left-0 z-20 bg-white dark:bg-[#0c1400] group-hover:bg-[#f8faf4] dark:group-hover:bg-[#142002] border-r border-[#d3e2be] dark:border-[#253905] pl-6 sm:pl-10 pr-2 sm:pr-3 flex items-center justify-between flex-shrink-0 transition-all"
                                    >
                                      {!wbsCollapsedMobile ? (
                                        <>
                                          <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                            <CheckSquare className="w-3 h-3 text-slate-400 shrink-0" />
                                            <div className="min-w-0">
                                              <span
                                                className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate block"
                                                title={t.nombre}
                                              >
                                                {t.nombre}
                                              </span>
                                              {t.responsable && (
                                                <span className="text-[9px] text-slate-400 block font-normal">
                                                  {t.responsable}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="text-right flex-shrink-0 font-mono text-[9px]">
                                            <span className="text-slate-600 dark:text-slate-400">
                                              {tAcum}/{tMeta} {t.unidad || 'ha'}
                                            </span>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="w-full text-center">
                                          <span className="text-[8px] font-mono text-slate-400">
                                            {tPct}%
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Pista Derecha de la Tarea */}
                                    <div
                                      style={{ width: `${timelineTotalWidth}px` }}
                                      className="relative flex items-center flex-shrink-0"
                                    >
                                      <div
                                        style={{ left: `${tLeftPct}%`, width: `${tWidthPct}%` }}
                                        onClick={() =>
                                          handleItemClick({
                                            title: `Tarea: ${t.nombre}`,
                                            type: 'Tarea Operativa de Campo',
                                            subtitle: `Actividad: ${t.actividad_id}`,
                                            responsable: t.responsable || 'Sin asignar',
                                            predio: t.predio_nombre || 'General',
                                            progress: `${tAcum} / ${tMeta} ${t.unidad || 'ha'} (${tPct}%)`,
                                            estado: t.estado
                                          })
                                        }
                                        onMouseEnter={(e) => {
                                          setHoverTooltip({
                                            title: `Tarea: ${t.nombre}`,
                                            type: 'Tarea Operativa de Campo',
                                            subtitle: `Actividad: ${t.actividad_id}`,
                                            responsable: t.responsable || 'Sin asignar',
                                            predio: t.predio_nombre || 'General',
                                            progress: `${tAcum} / ${tMeta} ${t.unidad || 'ha'} (${tPct}%)`,
                                            estado: t.estado,
                                            x: e.clientX,
                                            y: e.clientY
                                          });
                                        }}
                                        onMouseLeave={() => setHoverTooltip(null)}
                                        className={`absolute h-4 rounded-md ${taskColor} text-white shadow-2xs border flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-110 active:scale-98 transition`}
                                      >
                                        <div
                                          style={{ width: `${tPct}%` }}
                                          className="absolute left-0 top-0 bottom-0 bg-black/20"
                                        />
                                        <span className="relative z-10 text-[8px] font-bold truncate leading-none">
                                          {t.nombre}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BOTÓN FLOTANTE RÁPIDO EN MÓVIL (FAB PARA CENTRAR EN "HOY")              */}
      {/* ========================================================================= */}
      {mobileTab === 'gantt' && (
        <button
          type="button"
          onClick={handleScrollToToday}
          className="md:hidden fixed bottom-12 right-4 z-40 px-3 py-2 rounded-full bg-[#2c4001] text-[#a1c62e] border-2 border-[#a1c62e] shadow-xl flex items-center gap-1.5 text-xs font-black active:scale-95 transition"
          title="Centrar cronograma en hoy"
        >
          <Clock className="w-4 h-4 text-[#a1c62e]" />
          <span>Hoy</span>
        </button>
      )}

      {/* ========================================================================= */}
      {/* 6. BOTTOM SHEET MODAL TÁCTIL (SENIOR MOBILE UX PARA INSPECCIÓN DE TAREAS)  */}
      {/* ========================================================================= */}
      {selectedItemDetail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg bg-white dark:bg-[#142002] rounded-t-3xl border-t border-[#3e5606] shadow-2xl p-5 space-y-3 animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del Bottom Sheet con Barra de Arrastre */}
            <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-[#3e5606] mx-auto mb-1" />

            <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#1e2d01] text-[#a1c62e] border border-[#3e5606]">
                  {selectedItemDetail.type}
                </span>
                {selectedItemDetail.estado && (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedItemDetail.estado}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="p-1.5 rounded-full bg-slate-100 dark:bg-[#1e2d01] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              {selectedItemDetail.title}
            </h3>

            {selectedItemDetail.subtitle && (
              <p className="text-xs text-slate-600 dark:text-[#d4e6b5]">{selectedItemDetail.subtitle}</p>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
              {selectedItemDetail.dates && (
                <div className="p-2.5 rounded-xl bg-[#f4f8ed] dark:bg-[#1a2903] border border-[#e2ebd3] dark:border-[#253905]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    📅 Fechas
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white block mt-0.5">
                    {selectedItemDetail.dates}
                  </span>
                </div>
              )}

              {selectedItemDetail.progress && (
                <div className="p-2.5 rounded-xl bg-[#f4f8ed] dark:bg-[#1a2903] border border-[#e2ebd3] dark:border-[#253905]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    📊 Avance
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-[#a1c62e] block mt-0.5">
                    {selectedItemDetail.progress}
                  </span>
                </div>
              )}

              {selectedItemDetail.responsable && (
                <div className="p-2.5 rounded-xl bg-[#f4f8ed] dark:bg-[#1a2903] border border-[#e2ebd3] dark:border-[#253905]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    👤 Responsable
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white block mt-0.5">
                    {selectedItemDetail.responsable}
                  </span>
                </div>
              )}

              {selectedItemDetail.predio && (
                <div className="p-2.5 rounded-xl bg-[#f4f8ed] dark:bg-[#1a2903] border border-[#e2ebd3] dark:border-[#253905]">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">
                    📍 Predio
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-white block mt-0.5">
                    {selectedItemDetail.predio}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedItemDetail(null)}
              className="w-full py-2.5 rounded-xl bg-[#2c4001] hover:bg-[#1e2d01] text-[#a1c62e] font-black text-xs border border-[#a1c62e]/40 shadow-sm transition"
            >
              Cerrar Detalle
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. TOOLTIP FLOTANTE (SOLO DESKTOP CON MOUSE)                              */}
      {/* ========================================================================= */}
      {hoverTooltip && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 280, hoverTooltip.x + 15)}px`,
            top: `${Math.min(window.innerHeight - 180, hoverTooltip.y + 15)}px`
          }}
          className="hidden md:block z-50 p-2.5 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-2xl backdrop-blur-sm w-64 pointer-events-none space-y-1 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span className="text-[9px] font-black text-[#a1c62e] uppercase tracking-wider">
              {hoverTooltip.type}
            </span>
            {hoverTooltip.estado && (
              <span className="text-[8px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                {hoverTooltip.estado}
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-white leading-snug">{hoverTooltip.title}</h4>
          {hoverTooltip.subtitle && (
            <p className="text-[10px] text-slate-300">{hoverTooltip.subtitle}</p>
          )}
          <div className="pt-1 text-[9px] space-y-0.5 text-slate-400 border-t border-slate-800">
            {hoverTooltip.dates && (
              <div>
                📅 <strong>Fechas:</strong> {hoverTooltip.dates}
              </div>
            )}
            {hoverTooltip.progress && (
              <div>
                📊 <strong>Avance:</strong>{' '}
                <span className="text-emerald-400 font-bold">{hoverTooltip.progress}</span>
              </div>
            )}
            {hoverTooltip.responsable && (
              <div>
                👤 <strong>Responsable:</strong> {hoverTooltip.responsable}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. PIE DE PÁGINA CON LEYENDA CANÓNICA                                     */}
      {/* ========================================================================= */}
      <footer className="no-print print:hidden h-8 bg-[#f4f8ed] dark:bg-[#121c02] border-t border-[#e2ebd3] dark:border-[#253905] px-3 sm:px-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 flex-wrap overflow-x-auto no-scrollbar">
          <span className="font-bold text-[#2c4001] dark:text-[#a1c62e] text-[10px] uppercase">
            Leyenda:
          </span>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#2c4001] border border-[#a1c62e]" />
            <span className="text-[10px]">Proyecto</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rotate-45 bg-[#dfb75c]" />
            <span className="text-[10px]">Hito Meta</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span className="text-[10px]">Completada</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-sky-500" />
            <span className="text-[10px]">En Proceso</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-400" />
            <span className="text-[10px]">Pendiente</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-500" />
            <span className="text-[10px]">Detenida</span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
          <img src="/logo.png" alt="AGROKOOL" className="h-3.5 w-auto object-contain opacity-70" />
          <span>Gantt Engine v7.0</span>
        </div>
      </footer>
    </div>
  );
}
