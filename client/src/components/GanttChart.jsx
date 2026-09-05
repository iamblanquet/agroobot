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
  Printer,
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

/**
 * Componente Principal GanttChart con Soporte Completo de Impresión & Exportación PDF
 */
export default function GanttChart({
  projects = [],
  selectedProjectId = null,
  onProjectChange = null,
  onRefresh = null,
  isModal = false,
  onCloseModal = null
}) {
  const [activeProjectFilter, setActiveProjectFilter] = useState(selectedProjectId || 'all');
  const [timeScale, setTimeScale] = useState('semanas'); // 'dias' | 'semanas' | 'meses'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'en_progreso' | 'completado' | 'pendiente' | 'bloqueado'
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedHitos, setExpandedHitos] = useState({});
  const [tooltipData, setTooltipData] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const timelineScrollRef = useRef(null);

  // Sincronizar filtro externo si cambia
  useEffect(() => {
    if (selectedProjectId) {
      setActiveProjectFilter(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Expandir proyectos por defecto al cargar
  useEffect(() => {
    if (projects.length > 0) {
      const expProj = {};
      const expHit = {};
      projects.forEach((p) => {
        expProj[p.id] = true;
        p.hitos?.forEach((h) => {
          expHit[h.id] = true;
        });
      });
      setExpandedProjects(expProj);
      setExpandedHitos(expHit);
    }
  }, [projects]);

  // Filtrar proyectos según selección y búsqueda
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (activeProjectFilter !== 'all') {
      result = result.filter((p) => String(p.id) === String(activeProjectFilter));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.map((p) => {
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
      }).filter(Boolean);
    }

    if (statusFilter !== 'all') {
      result = result.map((p) => {
        const filteredHitos = (p.hitos || []).filter((h) => {
          if (statusFilter === 'completado') return h.estado === 'completado';
          if (statusFilter === 'en_progreso') return h.estado === 'en_proceso' || h.tareas?.some((t) => t.estado === 'en_progreso');
          if (statusFilter === 'pendiente') return h.estado === 'pendiente';
          if (statusFilter === 'bloqueado') return h.estado === 'bloqueado' || h.tareas?.some((t) => t.estado === 'detenida');
          return true;
        });
        return { ...p, hitos: filteredHitos };
      }).filter((p) => p.hitos && p.hitos.length > 0);
    }

    return result;
  }, [projects, activeProjectFilter, searchQuery, statusFilter]);

  // Calcular rango global de fechas para la cuadrícula del Gantt
  const { minDate, maxDate, totalDays, todayOffsetDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let earliest = new Date(today);
    let latest = new Date(today);

    // Si no hay proyectos, mostrar ventana de 90 días
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

    // Añadir margen al inicio y al final
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

  // Ancho de columna por escala en píxeles (modo pantalla)
  const dayWidth = useMemo(() => {
    if (timeScale === 'dias') return 34;
    if (timeScale === 'semanas') return 12;
    return 4.5; // 'meses'
  }, [timeScale]);

  const timelineTotalWidth = Math.max(900, totalDays * dayWidth);

  // Generar columnas del encabezado de la línea de tiempo con porcentajes de ancho
  const timelineHeaders = useMemo(() => {
    const months = [];
    const subUnits = []; // Días o Semanas

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

      // Sub-unidades
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
        if (date.getDay() === 1 || dayIdx === 0) { // Lunes o inicio
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
      const scrollPos = Math.max(0, (todayOffsetDays / totalDays) * timelineTotalWidth - 250);
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

  // Abrir en ventana emergente nativa
  const handleOpenPopoutWindow = () => {
    const url = `/index.html#gantt${activeProjectFilter !== 'all' ? `?project=${activeProjectFilter}` : ''}`;
    const windowFeatures = 'toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=1380,height=850';
    const popout = window.open(url, 'AgrokoolGanttWindow', windowFeatures);
    if (popout) {
      popout.focus();
    } else {
      alert('Por favor permite las ventanas emergentes en tu navegador para abrir el Diagrama de Gantt independiente.');
    }
  };

  // Imprimir / PDF
  const handlePrint = () => {
    // Mantiene abierta la vista para quien vuelve de imprimir; el reporte impreso
    // siempre genera todas las filas, aun si en pantalla estaban contraídas.
    handleToggleExpandAll(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.print());
    });
  };

  // Calcular métricas del proyecto o consolidado
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

  // El panel de pantalla usa dos columnas con scroll independiente. Para papel se
  // construyen filas únicas (WBS + barra) para que nunca se descuadre el diagrama.
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
      const pAcum = p.hitos?.reduce((sum, h) => sum + (h.tareas?.reduce((taskSum, t) => taskSum + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0), 0) || 0;
      rows.push({
        id: `print-p-${p.id}`,
        type: 'project',
        label: p.nombre,
        detail: `${p.ciclo || 'Sin ciclo'} · ${pAcum}/${pMeta} ha`,
        left: Math.max(0, getDaysBetween(minDate, pStart)) / totalDays * 100,
        width: Math.max(3, pDuration / totalDays * 100),
        progress: pMeta > 0 ? Math.min(100, Math.round(pAcum / pMeta * 100)) : 0,
        barLabel: `${p.nombre} · ${pMeta > 0 ? Math.min(100, Math.round(pAcum / pMeta * 100)) : 0}%`
      });

      (p.hitos || []).forEach((h, hIndex) => {
        const previous = hIndex > 0 ? p.hitos[hIndex - 1] : null;
        const hStart = previous?.fecha_meta ? parseDate(previous.fecha_meta) : pStart;
        const hEnd = parseDate(h.fecha_meta) || addDays(hStart, 20);
        const hDuration = Math.max(4, getDaysBetween(hStart, hEnd));
        const hMeta = parseFloat(h.superficie_meta_ha) || 0;
        const hAcum = h.tareas?.reduce((sum, t) => sum + (parseFloat(t.cantidad_acumulada) || 0), 0) || 0;
        const hProgress = hMeta > 0 ? Math.min(100, Math.round(hAcum / hMeta * 100)) : 0;
        rows.push({
          id: `print-h-${h.id}`,
          type: 'milestone',
          label: `Hito ${h.orden}: ${h.nombre}`,
          detail: `Meta ${formatDisplayDate(h.fecha_meta)} · ${h.estado || 'pendiente'}`,
          left: Math.max(0, getDaysBetween(minDate, hStart)) / totalDays * 100,
          width: Math.max(2.5, hDuration / totalDays * 100),
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
            left: Math.max(0, getDaysBetween(minDate, tStart)) / totalDays * 100,
            width: Math.max(2, getDaysBetween(tStart, tEnd) / totalDays * 100),
            progress: Math.min(100, Math.round(tAcum / tMeta * 100)),
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
      className={`gantt-root flex flex-col bg-[#f8faf2] dark:bg-[#0c1400] text-slate-900 dark:text-slate-100 ${
        isFullscreen ? 'fixed inset-0 z-50 overflow-hidden' : 'w-full rounded-2xl border border-[#e2ebd3] dark:border-[#253905] shadow-lg'
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
            <div><strong>Fecha de Emisión:</strong> {new Date().toLocaleDateString('es-MX', { dateStyle: 'full' })}</div>
            <div><strong>Proyecto:</strong> {activeProjectFilter === 'all' ? 'Consolidado General Multi-Proyecto' : `${activeProjectObj?.nombre || ''} (${activeProjectObj?.ciclo || ''})`}</div>
            <div><strong>Gerente Asignado:</strong> {activeProjectObj?.gerente_nombre || 'Dirección de Operaciones'}</div>
          </div>
        </div>

        {/* Resumen de Métricas Oficiales en Impresión */}
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
            <span className="text-xs font-black text-emerald-800">{metrics.totalAcumHa} ha ({metrics.pctGlobal}%)</span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Hitos</span>
            <span className="text-xs font-black text-blue-800">{metrics.hitosCompletados} / {metrics.totalHitos} completados</span>
          </div>
          <div className="p-1.5 rounded bg-slate-50 border border-slate-300">
            <span className="text-[9px] font-bold text-slate-600 uppercase block">Tareas</span>
            <span className="text-xs font-black text-purple-800">{metrics.tareasCompletadas} / {metrics.totalTareas} listas</span>
          </div>
        </div>
      </div>

      <section className="gantt-print-report hidden print:block px-4 pb-3 text-slate-900">
        <div className="gantt-print-grid gantt-print-header-row">
          <div className="gantt-print-wbs-head">Estructura / tarea</div>
          <div className="gantt-print-time-head">
            {timelineHeaders.months.map((month) => (
              <span key={month.key} style={{ width: `${month.widthPct}%` }}>{month.label}</span>
            ))}
          </div>
        </div>
        <div className="gantt-print-grid gantt-print-subhead">
          <div className="gantt-print-wbs-subhead">Avance y responsable</div>
          <div className="gantt-print-time-subhead">
            {timelineHeaders.subUnits.map((unit) => (
              <span key={unit.key} style={{ width: `${unit.widthPct}%` }}>{unit.label}</span>
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
                  className={`gantt-print-bar ${row.type === 'project' ? 'gantt-print-project-bar' : row.type === 'milestone' ? `gantt-print-milestone-bar gantt-print-${row.state}` : row.color}`}
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
          <span>Escala: {formatDisplayDate(formatDate(minDate))} a {formatDisplayDate(formatDate(maxDate))}</span>
          <span>AGROKOOL · Reporte operativo</span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 1. ENCABEZADO SUPERIOR & BARRA DE HERRAMIENTAS EJECUTIVA (SOLO PANTALLA)  */}
      {/* ========================================================================= */}
      <div className="gantt-screen-header no-print print:hidden relative overflow-hidden bg-[#2c4001] text-white p-4 sm:p-5 border-b border-[#3e5606] space-y-4">
        <div className="absolute -right-24 -top-32 h-64 w-64 rounded-full border border-[#a1c62e]/20" />
        <div className="absolute right-24 -bottom-36 h-56 w-56 rounded-full border-[18px] border-[#a1c62e]/10" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[#1e2d01] border border-[#a1c62e]/40 shadow-inner">
                <Calendar className="w-5 h-5 text-[#a1c62e]" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  Diagrama de Gantt · Planeación & Ejecución Agrícola
                </h1>
                <p className="text-xs text-[#d4e6b5] font-medium">
                  Supervisión temporal en cascada: Ciclos, Frentes de Obra, Hitos y Tareas Operativas
                </p>
              </div>
            </div>
          </div>

          {/* Botonera de Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Centrar en Hoy */}
            <button
              type="button"
              onClick={handleScrollToToday}
              className="px-3 py-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#a1c62e] border border-[#3e5606] text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Centrar línea de tiempo en el día actual"
            >
              <Clock className="w-3.5 h-3.5 text-[#a1c62e]" />
              <span>Hoy</span>
            </button>

            {/* Escala Temporal */}
            <div className="flex items-center bg-[#1e2d01] rounded-xl p-0.5 border border-[#3e5606]">
              {['dias', 'semanas', 'meses'].map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => setTimeScale(scale)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition ${
                    timeScale === scale
                      ? 'bg-[#a1c62e] text-[#2c4001] shadow-sm'
                      : 'text-[#d4e6b5] hover:text-white'
                  }`}
                >
                  {scale}
                </button>
              ))}
            </div>

            {/* Abrir en Ventana Emergente */}
            <button
              type="button"
              onClick={handleOpenPopoutWindow}
              className="px-3 py-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#d4e6b5] hover:text-white border border-[#3e5606] text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Abrir en ventana independiente del navegador"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#a1c62e]" />
              <span className="hidden sm:inline">Nueva Ventana</span>
            </button>

            {/* Imprimir / PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-[#a1c62e] hover:bg-[#8eb025] text-[#2c4001] font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-[#a1c62e]/30"
              title="Imprimir o Guardar como PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>

            {/* Pantalla Completa */}
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-[#1e2d01] hover:bg-[#152000] text-[#d4e6b5] hover:text-white border border-[#3e5606] transition"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="px-3 py-1.5 rounded-xl bg-rose-900/80 hover:bg-rose-900 text-rose-100 text-xs font-bold transition"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>

        {/* ======================================================================= */}
        {/* 2. FILTROS & SELECTOR DE PROYECTO (SOLO PANTALLA)                       */}
        {/* ======================================================================= */}
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#3e5606]">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Selector de Proyecto */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#d4e6b5]">Proyecto:</span>
              <select
                value={activeProjectFilter}
                onChange={(e) => {
                  setActiveProjectFilter(e.target.value);
                  if (onProjectChange) onProjectChange(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs font-bold text-white focus:outline-none focus:border-[#a1c62e]"
              >
                <option value="all">📁 Todos los Proyectos ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.ciclo}) · {p.superficie_meta_ha} ha
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Estado */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs font-bold text-white focus:outline-none focus:border-[#a1c62e]"
            >
              <option value="all">Todos los Estados</option>
              <option value="en_progreso">🔵 En Proceso</option>
              <option value="completado">🟢 Completados</option>
              <option value="pendiente">⚪ Pendientes</option>
              <option value="bloqueado">🔴 Con Bloqueo</option>
            </select>

            {/* Botones Expandir/Colapsar Todo */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleToggleExpandAll(true)}
                className="px-2 py-1 rounded-lg bg-[#1e2d01] hover:bg-[#152000] text-[11px] font-semibold text-[#d4e6b5] border border-[#3e5606]"
              >
                Expandir Todo
              </button>
              <button
                type="button"
                onClick={() => handleToggleExpandAll(false)}
                className="px-2 py-1 rounded-lg bg-[#1e2d01] hover:bg-[#152000] text-[11px] font-semibold text-[#d4e6b5] border border-[#3e5606]"
              >
                Colapsar Todo
              </button>
            </div>
          </div>

          {/* Barra de Búsqueda Rápida */}
          <div className="relative min-w-[200px] sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar hito, tarea o frente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#1e2d01] border border-[#3e5606] text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#a1c62e]"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. KPIS RESUMEN SUPERIOR (SOLO PANTALLA)                                  */}
      {/* ========================================================================= */}
      <div className="no-print print:hidden grid grid-cols-2 lg:grid-cols-5 gap-3 p-3 sm:p-4 bg-[#f4f8ed] dark:bg-[#121c02] border-b border-[#e2ebd3] dark:border-[#253905]">
        <div className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905]">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Proyectos Activos</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-black text-slate-900 dark:text-white">{metrics.totalProyectos}</span>
            <span className="text-xs text-slate-500 font-normal">en monitoreo</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905]">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Superficie Meta</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-black text-[#2c4001] dark:text-[#a1c62e]">{metrics.totalMetaHa} ha</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905]">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Avance Acumulado</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{metrics.totalAcumHa} ha</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              {metrics.pctGlobal}%
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905]">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Hitos Clave</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-black text-blue-600 dark:text-blue-400">
              {metrics.hitosCompletados} / {metrics.totalHitos}
            </span>
            <span className="text-xs text-slate-500 font-normal">completados</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] col-span-2 lg:col-span-1">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 block">Tareas Operativas</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-lg font-black text-purple-600 dark:text-purple-400">
              {metrics.tareasCompletadas} / {metrics.totalTareas}
            </span>
            <span className="text-xs text-slate-500 font-normal">terminadas</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. CUADRÍCULA INTERACTIVA & IMPRIMIBLE DEL GANTT (WBS + LÍNEA DE TIEMPO)  */}
      {/* ========================================================================= */}
      <div className="screen-gantt gantt-flex-wrapper flex-1 flex overflow-hidden min-h-[500px]">
        {/* PANEL IZQUIERDO: ESTRUCTURA DESGLOSADA DE TRABAJO (WBS) */}
        <div className="gantt-wbs-panel w-80 sm:w-96 flex-shrink-0 border-r border-[#e2ebd3] dark:border-[#253905] bg-white dark:bg-[#152202] flex flex-col select-none">
          {/* Encabezado WBS */}
          <div className="h-16 border-b border-[#e2ebd3] dark:border-[#253905] px-3 sm:px-4 flex items-center justify-between bg-[#f4f8ed] dark:bg-[#0e1700]">
            <span className="text-xs font-black uppercase text-[#2c4001] dark:text-[#a1c62e] tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 no-print" />
              Estructura (WBS) / Tarea
            </span>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Meta / Avance</span>
          </div>

          {/* Filas WBS */}
          <div className="gantt-wbs-list flex-1 overflow-y-auto divide-y divide-[#f0f4ea] dark:divide-[#253905]/40 no-scrollbar">
            {filteredProjects.map((p) => {
              const isProjExp = !!expandedProjects[p.id];
              const pTotalHa = parseFloat(p.superficie_meta_ha) || 0;
              const pAcumHa = p.hitos?.reduce((acc, h) =>
                acc + (h.tareas?.reduce((tAcc, t) => tAcc + (t.cantidad_acumulada || 0), 0) || 0), 0) || 0;
              const pPct = pTotalHa > 0 ? Math.min(100, Math.round((pAcumHa / pTotalHa) * 100)) : 0;

              return (
                <div key={`wbs-p-${p.id}`} className="gantt-row group">
                  {/* Fila del Proyecto */}
                  <div className="h-12 px-3 flex items-center justify-between bg-[#f8faf2] dark:bg-[#1a2803] hover:bg-[#eef5e4] dark:hover:bg-[#203004] transition">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedProjects((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                        }
                        className="no-print p-0.5 rounded-md bg-[#2c4001] text-white hover:bg-[#1e2d01]"
                      >
                        {isProjExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate" title={p.nombre}>
                          {p.nombre}
                        </h4>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                          {p.tipo} · {p.ciclo}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="text-xs font-black text-[#2c4001] dark:text-[#a1c62e] block">
                        {pAcumHa}/{pTotalHa} ha
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">{pPct}%</span>
                    </div>
                  </div>

                  {/* Frentes de Obra Chips */}
                  {isProjExp && p.obras && p.obras.length > 0 && (
                    <div className="px-6 py-1 bg-[#fbfdf8] dark:bg-[#121c02] border-t border-[#f0f4ea] dark:border-[#253905]/40 flex flex-wrap gap-1">
                      {p.obras.map((o) => (
                        <span
                          key={o.id}
                          className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8px] font-bold bg-[#dfb75c]/20 text-[#5c4015] dark:text-[#dfb75c] border border-[#dfb75c]/40"
                        >
                          <Building className="w-2.5 h-2.5 no-print" />
                          {o.nombre}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Filas de Hitos */}
                  {isProjExp &&
                    p.hitos?.map((h) => {
                      const isHitoExp = !!expandedHitos[h.id];
                      const hMetaHa = parseFloat(h.superficie_meta_ha) || 0;
                      const hAcumHa = h.tareas?.reduce((acc, t) => acc + (t.cantidad_acumulada || 0), 0) || 0;
                      const hPct = hMetaHa > 0 ? Math.min(100, Math.round((hAcumHa / hMetaHa) * 100)) : 0;

                      return (
                        <div key={`wbs-h-${h.id}`} className="gantt-row">
                          {/* Fila del Hito */}
                          <div className="h-10 pl-5 pr-3 flex items-center justify-between bg-white dark:bg-[#152202] hover:bg-[#f4f8ed] dark:hover:bg-[#1d2b05] border-t border-[#f0f4ea] dark:border-[#253905]/30 transition">
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedHitos((prev) => ({ ...prev, [h.id]: !prev[h.id] }))
                                }
                                className="no-print p-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              >
                                {isHitoExp ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                              </button>
                              <div className="w-4 h-4 rounded-full bg-[#2c4001] text-[#a1c62e] text-[8px] font-black flex items-center justify-center flex-shrink-0">
                                {h.orden}
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate block" title={h.nombre}>
                                  {h.nombre}
                                </span>
                                <span className="text-[8px] text-slate-500 dark:text-slate-400">
                                  Meta: {formatDisplayDate(h.fecha_meta)}
                                </span>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 block">
                                {hMetaHa} ha
                              </span>
                              <span className={`text-[8px] font-semibold ${h.estado === 'completado' ? 'text-emerald-600' : 'text-slate-500'}`}>
                                {h.estado}
                              </span>
                            </div>
                          </div>

                          {/* Filas de Tareas */}
                          {isHitoExp &&
                            h.tareas?.map((t) => {
                              const tMeta = parseFloat(t.cantidad_meta) || 1;
                              const tAcum = parseFloat(t.cantidad_acumulada) || 0;
                              const tPct = Math.min(100, Math.round((tAcum / tMeta) * 100));

                              return (
                                <div
                                  key={`wbs-t-${t.id}`}
                                  className="gantt-row h-9 pl-9 pr-3 flex items-center justify-between bg-[#fbfdf8] dark:bg-[#101901] hover:bg-[#f0f6e8] dark:hover:bg-[#182403] border-t border-[#f0f4ea] dark:border-[#253905]/20 text-xs"
                                >
                                  <div className="min-w-0 pr-2">
                                    <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate block" title={t.nombre}>
                                      • {t.nombre}
                                    </span>
                                    <div className="flex items-center gap-1.5 text-[8px] text-slate-500 dark:text-slate-400">
                                      {t.responsable && <span>👤 {t.responsable}</span>}
                                      {t.predio_nombre && <span>📍 {t.predio_nombre}</span>}
                                    </div>
                                  </div>

                                  <div className="text-right flex-shrink-0 font-mono text-[9px]">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {tAcum}/{tMeta} {t.unidad || 'ha'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: LÍNEA DE TIEMPO DEL GANTT (CANVAS HORIZONTAL CON PORCENTAJES) */}
        <div
          ref={timelineScrollRef}
          className="gantt-timeline-panel flex-1 overflow-x-auto overflow-y-auto relative bg-white dark:bg-[#0d1501] select-none"
        >
          <div style={{ width: `${timelineTotalWidth}px` }} className="gantt-timeline-canvas relative min-h-full">
            {/* 1. ENCABEZADO DE LA LÍNEA DE TIEMPO (MESES Y SUB-UNIDADES) */}
            <div className="sticky top-0 z-20 bg-[#f4f8ed] dark:bg-[#0e1700] border-b border-[#e2ebd3] dark:border-[#253905] shadow-xs">
              {/* Fila de Meses */}
              <div className="h-8 flex border-b border-[#e2ebd3] dark:border-[#253905]">
                {timelineHeaders.months.map((m) => (
                  <div
                    key={m.key}
                    style={{ width: `${m.widthPct}%` }}
                    className="h-full px-1 border-r border-[#e2ebd3] dark:border-[#253905] flex items-center justify-center font-bold text-[10px] uppercase text-[#2c4001] dark:text-[#a1c62e] tracking-wide truncate bg-[#edf5e3] dark:bg-[#121c02]"
                  >
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Fila de Días / Semanas */}
              <div className="h-8 flex">
                {timelineHeaders.subUnits.map((sub) => (
                  <div
                    key={sub.key}
                    style={{ width: `${sub.widthPct}%` }}
                    className={`h-full border-r border-[#e2ebd3] dark:border-[#253905]/50 flex flex-col items-center justify-center text-[9px] ${
                      sub.isToday
                        ? 'bg-red-500/20 text-red-600 dark:text-red-400 font-black'
                        : sub.isWeekend
                        ? 'bg-slate-100 dark:bg-[#152000] text-slate-400'
                        : 'text-slate-600 dark:text-slate-400 font-medium'
                    }`}
                  >
                    <span className="truncate px-0.5">{sub.label}</span>
                    {sub.subLabel && <span className="text-[7px] font-bold opacity-75">{sub.subLabel}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* 2. LÍNEA VERTICAL DE "HOY" */}
            {todayOffsetDays >= 0 && todayOffsetDays <= totalDays && (
              <div
                style={{ left: `${(todayOffsetDays / totalDays) * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-sm flex flex-col items-center no-print"
              >
                <div className="sticky top-16 bg-red-600 text-white text-[8px] font-black px-1 py-0.2 rounded shadow-md uppercase tracking-wider">
                  Hoy
                </div>
              </div>
            )}

            {/* 3. BARRAS GANTT CORRESPONDIENTES A CADA FILA */}
            <div className="pt-0 divide-y divide-[#f0f4ea] dark:divide-[#253905]/40">
              {filteredProjects.map((p) => {
                const isProjExp = !!expandedProjects[p.id];
                const pStart = parseDate(p.fecha_inicio) || minDate;
                const pEnd = parseDate(p.fecha_fin) || addDays(pStart, 60);

                const projStartDay = Math.max(0, getDaysBetween(minDate, pStart));
                const projDurationDays = Math.max(7, getDaysBetween(pStart, pEnd));
                const projLeftPct = (projStartDay / totalDays) * 100;
                const projWidthPct = Math.max(3, (projDurationDays / totalDays) * 100);

                const pTotalHa = parseFloat(p.superficie_meta_ha) || 0;
                const pAcumHa = p.hitos?.reduce((acc, h) =>
                  acc + (h.tareas?.reduce((tAcc, t) => tAcc + (t.cantidad_acumulada || 0), 0) || 0), 0) || 0;
                const pPct = pTotalHa > 0 ? Math.min(100, Math.round((pAcumHa / pTotalHa) * 100)) : 0;

                return (
                  <div key={`bars-p-${p.id}`} className="gantt-row">
                    {/* Barra del Proyecto */}
                    <div className="h-12 relative flex items-center bg-[#f8faf2]/50 dark:bg-[#1a2803]/30">
                      <div
                        style={{ left: `${projLeftPct}%`, width: `${projWidthPct}%` }}
                        className="absolute h-7 rounded-lg bg-gradient-to-r from-[#2c4001] to-[#456306] border border-[#a1c62e]/50 shadow-md flex items-center px-2 text-white overflow-hidden group cursor-pointer hover:ring-2 hover:ring-[#a1c62e] transition"
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
                          className="absolute left-0 top-0 bottom-0 bg-[#a1c62e]/40"
                        />
                        <span className="relative z-10 text-[10px] font-black truncate drop-shadow-sm flex items-center gap-1">
                          <Layers className="w-3 h-3 text-[#a1c62e] no-print" />
                          {p.nombre} ({pPct}%)
                        </span>
                      </div>
                    </div>

                    {/* Espacio para Obras Chips */}
                    {isProjExp && p.obras && p.obras.length > 0 && (
                      <div className="h-[25px] bg-[#fbfdf8]/40 dark:bg-[#121c02]/20" />
                    )}

                    {/* Barras de Hitos */}
                    {isProjExp &&
                      p.hitos?.map((h, hIdx) => {
                        const isHitoExp = !!expandedHitos[h.id];

                        // Fechas del hito
                        const prevHito = hIdx > 0 ? p.hitos[hIdx - 1] : null;
                        const hStart = prevHito?.fecha_meta ? parseDate(prevHito.fecha_meta) : pStart;
                        const hMeta = parseDate(h.fecha_meta) || addDays(hStart, 20);

                        const hStartDay = Math.max(0, getDaysBetween(minDate, hStart));
                        const hDurationDays = Math.max(4, getDaysBetween(hStart, hMeta));
                        const hLeftPct = (hStartDay / totalDays) * 100;
                        const hWidthPct = Math.max(2.5, (hDurationDays / totalDays) * 100);
                        const milestonePosPct = (Math.max(0, getDaysBetween(minDate, hMeta)) / totalDays) * 100;

                        const hMetaHa = parseFloat(h.superficie_meta_ha) || 0;
                        const hAcumHa = h.tareas?.reduce((acc, t) => acc + (t.cantidad_acumulada || 0), 0) || 0;
                        const hPct = hMetaHa > 0 ? Math.min(100, Math.round((hAcumHa / hMetaHa) * 100)) : 0;

                        const barColors = {
                          completado: 'from-emerald-600 to-emerald-700 border-emerald-400',
                          en_proceso: 'from-blue-600 to-blue-700 border-blue-400',
                          pendiente: 'from-amber-600 to-amber-700 border-amber-400',
                          bloqueado: 'from-rose-600 to-rose-700 border-rose-400'
                        };

                        return (
                          <div key={`bars-h-${h.id}`} className="gantt-row">
                            {/* Barra del Hito */}
                            <div className="h-10 relative flex items-center bg-white/40 dark:bg-[#152202]/20">
                              {/* Barra de duración del hito */}
                              <div
                                style={{ left: `${hLeftPct}%`, width: `${hWidthPct}%` }}
                                className={`absolute h-5 rounded-md bg-gradient-to-r ${
                                  barColors[h.estado] || barColors.pendiente
                                } border shadow-xs flex items-center px-1.5 text-white overflow-hidden cursor-pointer hover:scale-[1.02] transition`}
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
                                  className="absolute left-0 top-0 bottom-0 bg-white/30"
                                />
                                <span className="relative z-10 text-[9px] font-bold truncate">
                                  #{h.orden} {h.nombre}
                                </span>
                              </div>

                              {/* Diamante de Hito (Fecha Meta) */}
                              <div
                                style={{ left: `calc(${milestonePosPct}% - 6px)` }}
                                className="absolute w-3.5 h-3.5 rotate-45 bg-[#dfb75c] border-2 border-white dark:border-[#152202] shadow-sm z-10 cursor-pointer"
                                title={`Hito Meta: ${formatDisplayDate(h.fecha_meta)}`}
                              />
                            </div>

                            {/* Barras de Tareas Operativas */}
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
                                    ? 'bg-emerald-500'
                                    : t.estado === 'en_progreso'
                                    ? 'bg-sky-500'
                                    : t.estado === 'detenida'
                                    ? 'bg-rose-500'
                                    : 'bg-amber-500';

                                return (
                                  <div
                                    key={`bars-t-${t.id}`}
                                    className="gantt-row h-9 relative flex items-center bg-[#fbfdf8]/20 dark:bg-[#101901]/20"
                                  >
                                    <div
                                      style={{ left: `${tLeftPct}%`, width: `${tWidthPct}%` }}
                                      className={`absolute h-3.5 rounded-sm ${taskColor} text-white shadow-xs flex items-center px-1 overflow-hidden cursor-pointer hover:h-4.5 transition-all`}
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
                                      <span className="relative z-10 text-[8px] font-bold truncate">
                                        {t.nombre}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. TOOLTIP FLOTANTE INTERACTIVO (SOLO PANTALLA)                           */}
      {/* ========================================================================= */}
      {tooltipData && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 300, tooltipData.x + 15)}px`,
            top: `${Math.min(window.innerHeight - 200, tooltipData.y + 15)}px`
          }}
          className="no-print z-50 p-3 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-2xl backdrop-blur-md w-72 pointer-events-none space-y-1.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
            <span className="text-[10px] font-black text-[#a1c62e] uppercase tracking-wider">
              {tooltipData.type}
            </span>
            {tooltipData.estado && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {tooltipData.estado}
              </span>
            )}
          </div>
          <h4 className="text-xs font-bold text-white">{tooltipData.title}</h4>
          {tooltipData.subtitle && (
            <p className="text-[11px] text-slate-300">{tooltipData.subtitle}</p>
          )}
          <div className="pt-1 text-[10px] space-y-1 text-slate-400 border-t border-slate-800">
            {tooltipData.dates && <div>📅 <strong>Fechas:</strong> {tooltipData.dates}</div>}
            {tooltipData.progress && <div>📊 <strong>Avance:</strong> <span className="text-emerald-400 font-bold">{tooltipData.progress}</span></div>}
            {tooltipData.responsable && <div>👤 <strong>Responsable:</strong> {tooltipData.responsable}</div>}
            {tooltipData.predio && <div>📍 <strong>Predio:</strong> {tooltipData.predio}</div>}
            {tooltipData.fase && <div>🏢 <strong>Fase:</strong> {tooltipData.fase}</div>}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PIE DE PÁGINA CON LEYENDA CANÓNICA                                     */}
      {/* ========================================================================= */}
      <div className="p-3 sm:p-4 bg-[#f4f8ed] dark:bg-[#121c02] border-t border-[#e2ebd3] dark:border-[#253905] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">Leyenda:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#2c4001] border border-[#a1c62e]" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Proyecto Agrícola</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 bg-[#dfb75c]" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Hito Meta (Clave)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Completado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sky-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">En Proceso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Pendiente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-500" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Bloqueado / Detenido</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          AGROKOOL Standalone · Gantt Engine v5.0
        </div>
      </div>
    </div>
  );
}
