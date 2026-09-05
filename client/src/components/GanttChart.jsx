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
  Building
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

const WBS_WIDTH = 360;

/**
 * Componente Principal GanttChart con Diseño Moderno Unificado
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
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

  const timelineScrollRef = useRef(null);

  // Sincronizar filtro externo si cambia
  useEffect(() => {
    if (selectedProjectId) {
      setActiveProjectFilter(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Expandir proyectos e hitos al cargar
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

  // Escala en píxeles
  const dayWidth = useMemo(() => {
    if (timeScale === 'dias') return 34;
    if (timeScale === 'semanas') return 12;
    return 4.5;
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
            label: `Sem ${Math.ceil((date.getDate() + 6 - date.getDay()) / 7)} (${date.getDate()} ${date.toLocaleDateString('es-MX', { month: 'short' })})`,
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
      const scrollPos = Math.max(0, (todayOffsetDays / totalDays) * timelineTotalWidth - 150);
      timelineScrollRef.current.scrollTo({ left: scrollPos, behavior: 'smooth' });
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

  // Filas para impresión
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

  return (
    <div
      className={`gantt-root flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${
        isFullscreen
          ? 'fixed inset-0 z-50 overflow-hidden'
          : isModal
          ? 'w-full h-full flex-1 overflow-hidden'
          : 'w-full h-full flex-1 overflow-hidden'
      }`}
    >
      {/* ========================================================================= */}
      {/* ENCABEZADO EXCLUSIVO PARA IMPRESIÓN OFICIAL (PDF & PAPEL LANDSCAPE)       */}
      {/* ========================================================================= */}
      <div className="hidden print:block p-4 mb-2 border-b-2 border-slate-900 bg-white text-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AGROKOOL" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-base font-black uppercase tracking-tight text-slate-950">
                AGROKOOL · DIAGRAMA DE GANTT DE PLANEACIÓN & EJECUCIÓN
              </h1>
              <p className="text-[11px] text-slate-700 font-semibold">
                Control Operativo Temporal: Ciclos Agrícolas, Frentes de Obra, Hitos y Tareas
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
              <strong>Gerente Asignado:</strong> {activeProjectObj?.gerente_nombre || 'Dirección de Operaciones'}
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
            <span className="text-xs font-black text-emerald-800">{metrics.totalMetaHa} ha</span>
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
        <div className="mt-2 text-[8px] text-slate-600 flex items-center justify-between border-t border-slate-300 pt-1.5">
          <span>
            Escala: {formatDisplayDate(formatDate(minDate))} a {formatDisplayDate(formatDate(maxDate))}
          </span>
          <span>AGROKOOL · Reporte operativo</span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 1. TOOLBAR MODERNA Y ELEGANTE (CLICKUP / LINEAR STYLE)                     */}
      {/* ========================================================================= */}
      <header className="no-print print:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0 z-30">
        {/* Grupo Izquierdo: Volver + Título + Selector Proyecto */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {onNavigateBack && (
            <button
              type="button"
              onClick={onNavigateBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Volver"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Volver</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Diagrama de Gantt
              </h2>
              <span className="text-[10px] text-slate-400 hidden md:inline">Planeación & Ejecución</span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          {/* Selector de Proyecto */}
          <select
            value={activeProjectFilter}
            onChange={(e) => {
              setActiveProjectFilter(e.target.value);
              if (onProjectChange) onProjectChange(e.target.value);
            }}
            className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[190px] sm:max-w-[260px] truncate"
          >
            <option value="all">📁 Todos los Proyectos ({projects.length})</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.ciclo})
              </option>
            ))}
          </select>

          {/* Selector de Estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 hidden xl:block"
          >
            <option value="all">Todos los estados</option>
            <option value="en_progreso">🔵 En Proceso</option>
            <option value="completado">🟢 Completados</option>
            <option value="pendiente">⚪ Pendientes</option>
            <option value="bloqueado">🔴 Con Bloqueo</option>
          </select>
        </div>

        {/* Grupo Derecho: Buscador + Escala + Acciones */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap ml-auto">
          {/* Buscador */}
          <div className="relative w-32 sm:w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-6 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Escala Temporal */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
            {['dias', 'semanas', 'meses'].map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => setTimeScale(scale)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold capitalize transition ${
                  timeScale === scale
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
            className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 transition"
            title="Centrar en el día de hoy"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline">Hoy</span>
          </button>

          {/* Botón Alternar Métricas */}
          <button
            type="button"
            onClick={() => setShowMetrics(!showMetrics)}
            className={`px-2 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 transition ${
              showMetrics
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
            title="Mostrar / Ocultar KPIs"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Métricas</span>
          </button>

          {/* Expandir / Colapsar */}
          <button
            type="button"
            onClick={() => {
              const anyCollapsed = Object.values(expandedProjects).some((v) => !v);
              handleToggleExpandAll(anyCollapsed);
            }}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            title="Expandir / Colapsar Todo"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>

          {/* Nueva Ventana */}
          <button
            type="button"
            onClick={handleOpenPopoutWindow}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            title="Abrir en ventana emergente"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Pantalla Completa */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition ml-1"
            >
              Cerrar
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. BARRA DE MÉTRICAS COMPACTA (UNA SOLA LÍNEA, SIN QUITAR ESPACIO)       */}
      {/* ========================================================================= */}
      {showMetrics && (
        <div className="no-print print:hidden bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 flex items-center justify-between gap-4 text-xs overflow-x-auto no-scrollbar flex-shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-5 divide-x divide-slate-200 dark:divide-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Proyectos:</span>
              <span className="font-bold text-slate-900 dark:text-white">{metrics.totalProyectos} activos</span>
            </div>
            <div className="pl-5 flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Meta:</span>
              <span className="font-bold text-slate-900 dark:text-white">{metrics.totalMetaHa.toLocaleString('es-MX')} ha</span>
            </div>
            <div className="pl-5 flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Avance:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{metrics.totalAcumHa.toLocaleString('es-MX')} ha</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                {metrics.pctGlobal}%
              </span>
            </div>
            <div className="pl-5 flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Hitos Clave:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {metrics.hitosCompletados} / {metrics.totalHitos}
              </span>
            </div>
            <div className="pl-5 flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium text-[11px]">Tareas Operativas:</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                {metrics.tareasCompletadas} / {metrics.totalTareas}
              </span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-slate-400 text-[11px]">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>
              {formatDisplayDate(formatDate(minDate))} al {formatDisplayDate(formatDate(maxDate))}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. GRILLA UNIFICADA CON SCROLL SINCRONIZADO NATIVO (STICKY WBS COLUMN)   */}
      {/* ========================================================================= */}
      <div
        ref={timelineScrollRef}
        className="flex-1 overflow-auto bg-white dark:bg-slate-950 relative no-print select-none"
      >
        <div style={{ width: `${WBS_WIDTH + timelineTotalWidth}px`, minWidth: '100%' }} className="relative">
          {/* ================= ENCABEZADO DE TABLA (STICKY TOP) ================= */}
          <div className="sticky top-0 z-30 flex bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xs">
            {/* Esquina Superior Izquierda (Sticky Left + Top) */}
            <div
              style={{ width: `${WBS_WIDTH}px` }}
              className="sticky left-0 z-40 bg-slate-100 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between flex-shrink-0 shadow-xs"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Estructura (WBS) / Tarea
              </span>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                Meta / Avance
              </span>
            </div>

            {/* Pista del Encabezado Temporal (Meses y Sub-unidades) */}
            <div style={{ width: `${timelineTotalWidth}px` }} className="flex-1 flex flex-col flex-shrink-0">
              {/* Fila 1: Meses */}
              <div className="h-6 flex border-b border-slate-200 dark:border-slate-800 bg-slate-200/50 dark:bg-slate-850">
                {timelineHeaders.months.map((m) => (
                  <div
                    key={m.key}
                    style={{ width: `${m.widthPct}%` }}
                    className="h-full px-2 border-r border-slate-200 dark:border-slate-700/60 flex items-center justify-center font-bold text-[10px] uppercase text-slate-700 dark:text-slate-200 tracking-wider truncate"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Fila 2: Sub-unidades (Semanas o Días) */}
              <div className="h-6 flex bg-slate-100 dark:bg-slate-900">
                {timelineHeaders.subUnits.map((sub) => (
                  <div
                    key={sub.key}
                    style={{ width: `${sub.widthPct}%` }}
                    className={`h-full border-r border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-[9px] ${
                      sub.isToday
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold'
                        : sub.isWeekend
                        ? 'bg-slate-200/40 dark:bg-slate-800/40 text-slate-400'
                        : 'text-slate-600 dark:text-slate-400 font-medium'
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
            style={{ left: `${WBS_WIDTH}px`, width: `${timelineTotalWidth}px` }}
            className="absolute top-12 bottom-0 pointer-events-none flex"
          >
            {timelineHeaders.subUnits.map((sub) => (
              <div
                key={`grid-${sub.key}`}
                style={{ width: `${sub.widthPct}%` }}
                className={`h-full border-r ${
                  sub.isWeekend
                    ? 'border-slate-100 dark:border-slate-900/60 bg-slate-50/40 dark:bg-slate-900/20'
                    : 'border-slate-100 dark:border-slate-900/40'
                }`}
              />
            ))}

            {/* Línea vertical de Hoy */}
            {todayOffsetDays >= 0 && todayOffsetDays <= totalDays && (
              <div
                style={{ left: `${(todayOffsetDays / totalDays) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none shadow-xs"
              >
                <div className="sticky top-14 -translate-x-1/2 bg-red-600 text-white text-[8px] font-bold px-1.5 py-0.2 rounded shadow-xs uppercase tracking-wider whitespace-nowrap">
                  Hoy
                </div>
              </div>
            )}
          </div>

          {/* ================= FILAS DE CONTENIDO UNIFICADAS ================= */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
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
                    <div className="h-11 flex items-stretch hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors group">
                      {/* Celda Izquierda (Sticky Left) */}
                      <div
                        style={{ width: `${WBS_WIDTH}px` }}
                        className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 group-hover:bg-slate-100/80 dark:group-hover:bg-slate-850 border-r border-slate-200 dark:border-slate-800 px-3 flex items-center justify-between flex-shrink-0 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProjects((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                            }
                            className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                          >
                            {isProjExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                          <div className="min-w-0">
                            <h4
                              className="text-xs font-bold text-slate-900 dark:text-white truncate"
                              title={p.nombre}
                            >
                              {p.nombre}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>{p.tipo}</span>
                              <span>•</span>
                              <span>{p.ciclo}</span>
                              {p.obras && p.obras.length > 0 && (
                                <span className="text-[9px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/70 px-1 rounded">
                                  {p.obras.length} frentes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 font-mono text-[10px]">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {pAcumHa}/{pTotalHa} ha
                          </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{pPct}%</span>
                        </div>
                      </div>

                      {/* Pista Derecha de la Fila (Timeline Track) */}
                      <div
                        style={{ width: `${timelineTotalWidth}px` }}
                        className="relative flex items-center flex-shrink-0"
                      >
                        <div
                          style={{ left: `${projLeftPct}%`, width: `${projWidthPct}%` }}
                          className="absolute h-7 rounded-md bg-gradient-to-r from-emerald-700 to-emerald-800 dark:from-emerald-600 dark:to-emerald-700 border border-emerald-600 dark:border-emerald-500 text-white shadow-xs flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 transition group/bar"
                          onMouseEnter={(e) => {
                            setTooltipData({
                              title: p.nombre,
                              type: 'Proyecto Agrícola',
                              subtitle: `${p.tipo} · ${p.ciclo}`,
                              dates: `${formatDisplayDate(p.fecha_inicio)} al ${formatDisplayDate(p.fecha_fin)}`,
                              progress: `${pPct}% (${pAcumHa} / ${pTotalHa} ha)`,
                              fase: p.fase_catalogo,
                              x: e.clientX,
                              y: e.clientY
                            });
                          }}
                          onMouseLeave={() => setTooltipData(null)}
                        >
                          <div
                            style={{ width: `${pPct}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-l-md"
                          />
                          <span className="relative z-10 text-[10px] font-bold truncate flex items-center gap-1.5 drop-shadow-xs">
                            <Layers className="w-3 h-3 text-emerald-200" />
                            {p.nombre} ({pPct}%)
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
                          completado: 'from-emerald-600 to-emerald-700 border-emerald-500',
                          en_proceso: 'from-blue-600 to-blue-700 border-blue-500',
                          pendiente: 'from-slate-500 to-slate-600 border-slate-400',
                          bloqueado: 'from-rose-600 to-rose-700 border-rose-500'
                        };

                        return (
                          <React.Fragment key={`hito-group-${h.id}`}>
                            {/* Fila del Hito */}
                            <div className="h-10 flex items-stretch hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group">
                              {/* Celda Izquierda (Sticky Left) */}
                              <div
                                style={{ width: `${WBS_WIDTH}px` }}
                                className="sticky left-0 z-20 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-r border-slate-200 dark:border-slate-800 pl-6 pr-3 flex items-center justify-between flex-shrink-0 transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedHitos((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                                    }
                                    className="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                                  >
                                    {isHitoExp ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    )}
                                  </button>
                                  <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                                    {h.orden}
                                  </div>
                                  <div className="min-w-0">
                                    <span
                                      className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block"
                                      title={h.nombre}
                                    >
                                      {h.nombre}
                                    </span>
                                    <span className="text-[9px] text-slate-400 block font-normal">
                                      Meta: {formatDisplayDate(h.fecha_meta)}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right flex-shrink-0 font-mono text-[9px] space-y-0.5">
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                                      {hMetaHa} ha
                                    </span>
                                    <span
                                      className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                        statusBadgeStyles[h.estado] || statusBadgeStyles.pendiente
                                      }`}
                                    >
                                      {h.estado?.replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Pista Derecha del Hito */}
                              <div
                                style={{ width: `${timelineTotalWidth}px` }}
                                className="relative flex items-center flex-shrink-0"
                              >
                                {/* Barra del Hito */}
                                <div
                                  style={{ left: `${hLeftPct}%`, width: `${hWidthPct}%` }}
                                  className={`absolute h-5 rounded bg-gradient-to-r ${
                                    hitoBarStyles[h.estado] || hitoBarStyles.pendiente
                                  } border text-white shadow-2xs flex items-center px-2 overflow-hidden cursor-pointer hover:brightness-110 transition`}
                                  onMouseEnter={(e) => {
                                    setTooltipData({
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
                                  onMouseLeave={() => setTooltipData(null)}
                                >
                                  <div
                                    style={{ width: `${hPct}%` }}
                                    className="absolute left-0 top-0 bottom-0 bg-white/25 rounded"
                                  />
                                  <span className="relative z-10 text-[9px] font-bold truncate">
                                    #{h.orden} {h.nombre}
                                  </span>
                                </div>

                                {/* Diamante del Hito (Meta) */}
                                <div
                                  style={{ left: `calc(${milestonePosPct}% - 7px)` }}
                                  className="absolute w-3.5 h-3.5 rotate-45 bg-amber-400 border-2 border-white dark:border-slate-900 shadow-sm z-10 cursor-pointer hover:scale-125 transition"
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
                                    className="h-8 flex items-stretch hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors group"
                                  >
                                    {/* Celda Izquierda de la Tarea (Sticky Left) */}
                                    <div
                                      style={{ width: `${WBS_WIDTH}px` }}
                                      className="sticky left-0 z-20 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-r border-slate-200 dark:border-slate-800 pl-11 pr-3 flex items-center justify-between flex-shrink-0 transition-colors"
                                    >
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
                                    </div>

                                    {/* Pista Derecha de la Tarea */}
                                    <div
                                      style={{ width: `${timelineTotalWidth}px` }}
                                      className="relative flex items-center flex-shrink-0"
                                    >
                                      <div
                                        style={{ left: `${tLeftPct}%`, width: `${tWidthPct}%` }}
                                        className={`absolute h-4 rounded ${taskColor} text-white shadow-2xs border flex items-center px-1.5 overflow-hidden cursor-pointer hover:brightness-110 transition`}
                                        onMouseEnter={(e) => {
                                          setTooltipData({
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
                                        onMouseLeave={() => setTooltipData(null)}
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
      {/* 4. TOOLTIP FLOTANTE INTERACTIVO                                           */}
      {/* ========================================================================= */}
      {tooltipData && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 280, tooltipData.x + 15)}px`,
            top: `${Math.min(window.innerHeight - 180, tooltipData.y + 15)}px`
          }}
          className="no-print z-50 p-2.5 rounded-xl bg-slate-900/95 text-white border border-slate-700 shadow-xl backdrop-blur-sm w-64 pointer-events-none space-y-1 animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
              {tooltipData.type}
            </span>
            {tooltipData.estado && (
              <span className="text-[8px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                {tooltipData.estado}
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-white leading-snug">{tooltipData.title}</h4>
          {tooltipData.subtitle && (
            <p className="text-[10px] text-slate-300">{tooltipData.subtitle}</p>
          )}
          <div className="pt-1 text-[9px] space-y-0.5 text-slate-400 border-t border-slate-800">
            {tooltipData.dates && (
              <div>
                📅 <strong>Fechas:</strong> {tooltipData.dates}
              </div>
            )}
            {tooltipData.progress && (
              <div>
                📊 <strong>Avance:</strong>{' '}
                <span className="text-emerald-400 font-bold">{tooltipData.progress}</span>
              </div>
            )}
            {tooltipData.responsable && (
              <div>
                👤 <strong>Responsable:</strong> {tooltipData.responsable}
              </div>
            )}
            {tooltipData.predio && (
              <div>
                📍 <strong>Predio:</strong> {tooltipData.predio}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. PIE DE PÁGINA CON LEYENDA SUTIL                                        */}
      {/* ========================================================================= */}
      <footer className="no-print print:hidden h-8 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-3 sm:px-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0 z-30">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[10px] uppercase">
            Leyenda:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-700" />
            <span className="text-[10px]">Proyecto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rotate-45 bg-amber-400" />
            <span className="text-[10px]">Hito Meta</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span className="text-[10px]">Completada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-sky-500" />
            <span className="text-[10px]">En Proceso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-slate-400" />
            <span className="text-[10px]">Pendiente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-rose-500" />
            <span className="text-[10px]">Detenida</span>
          </div>
        </div>

        <span className="hidden sm:inline text-[10px] text-slate-400">
          Agrookool Gantt Engine
        </span>
      </footer>
    </div>
  );
}
