import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronDown, ChevronRight, RefreshCw, X, Maximize2, ExternalLink } from 'lucide-react';
import api from '../api/client';
import { buildSchedule, filterSchedule, flattenSchedule, timelineUnits, todayDay, displayDay } from '../utils/gantt';
import GanttTaskEditor from './GanttTaskEditor';

const ROW = 48;
const field = 'rounded-lg border border-[#dce5cb] dark:border-[#3e5606] bg-white dark:bg-[#142002] px-3 py-2 text-sm';
const button = 'px-3 py-2 rounded-lg border border-[#dce5cb] dark:border-[#3e5606] text-xs font-semibold hover:bg-[#a1c62e]/20 disabled:opacity-50';
const states = { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', detenida: 'Detenida', atrasada: 'Atrasada' };
const color = row => row.type === 'project' ? '#2c4001' : row.type === 'milestone' ? '#a87d13' : row.overdue || row.estado === 'detenida' ? '#be3455' : row.progress >= 100 ? '#16835e' : '#407c9c';

export default function GanttChart({ projects = [], selectedProjectId = null, onProjectChange, isModal = false, onCloseModal, onNavigateBack }) {
  const [source, setSource] = useState(projects);
  const [projectId, setProjectId] = useState(String(selectedProjectId || 'all'));
  const [scale, setScale] = useState('semanas');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [collapsed, setCollapsed] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState('gantt');
  const [fit, setFit] = useState(false);
  const [viewport, setViewport] = useState({ width: 1000, height: 600 });
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const scroller = useRef(null), container = useRef(null);
  const [today, setToday] = useState(todayDay);
  useEffect(() => { const timer = setInterval(() => setToday(todayDay()), 60000); return () => clearInterval(timer); }, []);
  useEffect(() => setSource(projects), [projects]);
  useEffect(() => setProjectId(String(selectedProjectId || 'all')), [selectedProjectId]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setViewport({ width: entry.contentRect.width, height: Math.max(240, entry.contentRect.height) }));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const schedule = useMemo(() => buildSchedule(source, today), [source, today]);
  const chosen = useMemo(() => schedule.filter(project => projectId === 'all' || String(project.id) === projectId), [schedule, projectId]);
  const filtered = useMemo(() => filterSchedule(chosen, query, status), [chosen, query, status]);
  const forceOpen = !!query.trim() || status !== 'all';
  const rows = useMemo(() => flattenSchedule(filtered, collapsed, forceOpen), [filtered, collapsed, forceOpen]);
  const printRows = useMemo(() => flattenSchedule(filtered, {}, true), [filtered]);
  const tasks = useMemo(() => chosen.flatMap(project => project.tasks), [chosen]);
  const minDay = chosen.length ? Math.min(...chosen.map(project => project.start)) - 3 : today - 7;
  const maxDay = chosen.length ? Math.max(...chosen.map(project => project.end)) + 3 : today + 30;
  const totalDays = maxDay - minDay + 1;
  const labelWidth = viewport.width < 640 ? 180 : 320;
  const dayWidth = fit ? Math.max(0.1, (viewport.width - labelWidth - 18) / totalDays) : { dias: 36, semanas: 14, meses: 5 }[scale];
  const timelineWidth = totalDays * dayWidth;
  const units = useMemo(() => timelineUnits(minDay, maxDay, scale), [minDay, maxDay, scale]);
  const visibleUnits = units.filter(unit => (unit.start - minDay + unit.days) * dayWidth >= scroll.left - labelWidth && (unit.start - minDay) * dayWidth <= scroll.left + viewport.width);
  const startIndex = Math.max(0, Math.min(rows.length - 1, Math.floor(scroll.top / ROW) - 5));
  const visibleRows = rows.slice(startIndex, startIndex + Math.ceil(viewport.height / ROW) + 12);
  const progress = tasks.length ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0;
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0; setScroll(previous => ({ ...previous, top: 0 })); }, [projectId, query, status]);
  async function refresh() {
    setRefreshing(true); setError('');
    try { setSource((await api.get('/gantt')).projects); }
    catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }
  function goToday() {
    if (today < minDay || today > maxDay) { setNotice('Hoy está fuera del periodo de los proyectos seleccionados.'); return; }
    scroller.current?.scrollTo({ left: Math.max(0, (today - minDay) * dayWidth - (viewport.width - labelWidth) / 2), behavior: 'smooth' });
  }
  function saved(updated) {
    setSource(previous => previous.map(project => ({ ...project, hitos: (project.hitos || []).map(hito => ({ ...hito, tareas: (hito.tareas || []).map(task => Number(task.id) === Number(updated.id) ? { ...task, ...updated } : task) })) })));
    setSelected(null); setNotice('Planificación guardada.');
  }

  return <div className={`gantt-root bg-white dark:bg-[#0e1700] text-slate-900 dark:text-slate-100 flex flex-col min-h-0 ${fullscreen ? 'fixed inset-0 z-50' : 'w-full h-full flex-1'}`}>
    <div className="no-print p-3 sm:p-4 space-y-3 border-b border-[#dce5cb] dark:border-[#3e5606]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold text-lg flex items-center gap-2"><Calendar className="w-5 h-5 text-[#a87d13]" /> Cronograma de trabajo</h2><p className="text-xs text-slate-500 dark:text-slate-400">{displayDay(minDay)} — {displayDay(maxDay)}</p></div>
        <div className="flex gap-2 flex-wrap">
          {onNavigateBack && <button className={button} onClick={onNavigateBack}>Volver</button>}
          <button className={button} onClick={refresh} disabled={refreshing}><RefreshCw className={`inline w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar</button>
          <button className={button} onClick={() => setFullscreen(value => !value)} aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}><Maximize2 className="w-4 h-4" /></button>
          <button className={button} aria-label="Abrir cronograma en otra ventana" onClick={() => { if (!window.open(`/index.html#gantt${projectId === 'all' ? '' : `?project=${encodeURIComponent(projectId)}`}`, '_blank', 'width=1380,height=850')) setNotice('Permite las ventanas emergentes para abrir el cronograma.'); }}><ExternalLink className="w-4 h-4" /></button>
          {isModal && <button className={button} onClick={onCloseModal} aria-label="Cerrar cronograma"><X className="w-4 h-4" /></button>}
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select aria-label="Proyecto del cronograma" value={projectId} onChange={event => { setProjectId(event.target.value); onProjectChange?.(event.target.value); }} className={`${field} max-w-full`}><option value="all">Todos los proyectos</option>{source.map(project => <option key={project.id} value={project.id}>{project.nombre}</option>)}</select>
        <input className={`${field} flex-1 min-w-40`} aria-label="Buscar tareas" placeholder="Tarea, responsable o predio" value={query} onChange={event => setQuery(event.target.value)} />
        <select aria-label="Estado de las tareas" className={field} value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos los estados</option>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </div>
      <div className="flex flex-wrap justify-between gap-3 items-center text-xs">
        <div className="flex gap-2 flex-wrap"><span className="rounded-lg bg-[#a1c62e]/15 px-3 py-2"><strong>{progress}%</strong> cumplimiento de tareas</span><span className="px-2 py-2">{tasks.length} tareas</span><span className="px-2 py-2 text-rose-700 dark:text-rose-300">{tasks.filter(task => task.overdue).length} atrasadas</span><span className="px-2 py-2 text-amber-700 dark:text-amber-300">{tasks.filter(task => task.estimated).length} por planificar</span></div>
        <div className="flex gap-1 flex-wrap">
          {['dias', 'semanas', 'meses'].map(value => <button key={value} aria-pressed={scale === value && !fit} className={`${button} ${scale === value && !fit ? 'bg-[#a1c62e]/25' : ''}`} onClick={() => { setScale(value); setFit(false); }}>{value === 'dias' ? 'Días' : value === 'semanas' ? 'Semanas' : 'Meses'}</button>)}
          <button className={button} aria-pressed={fit} onClick={() => { setFit(true); scroller.current?.scrollTo({ left: 0 }); }}>Ajustar</button><button className={button} onClick={goToday}>Hoy</button>
          <button className={button} onClick={() => setMode(mode === 'gantt' ? 'lista' : 'gantt')}>{mode === 'gantt' ? 'Ver lista' : 'Ver Gantt'}</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 justify-between text-xs text-slate-500 dark:text-slate-400"><span>Avance: promedio por tarea, con el mismo peso. Barras discontinuas: fechas estimadas.</span><div className="flex gap-3"><button className="underline" onClick={() => setCollapsed({})}>Expandir todo</button><button className="underline" onClick={() => setCollapsed(Object.fromEntries(chosen.map(project => [project.key, true])))}>Contraer todo</button></div></div>
      {notice && <p role="status" className="text-xs text-[#2c4001] dark:text-[#a1c62e]">{notice}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error} Los datos visibles pueden estar desactualizados.</p>}
    </div>

    <div ref={container} className="no-print flex-1 min-h-[280px] relative">
      {!rows.length ? <p role="status" className="p-8 text-center text-sm text-slate-500">No hay tareas o proyectos que coincidan con los filtros.</p> : <div ref={scroller} className="absolute inset-0 overflow-auto" onScroll={event => setScroll({ top: event.currentTarget.scrollTop, left: event.currentTarget.scrollLeft })}>
        <div style={{ width: mode === 'lista' ? '100%' : Math.max(viewport.width, labelWidth + timelineWidth), minWidth: mode === 'lista' ? 320 : undefined }}>
          <div className="sticky top-0 z-30 h-12 flex border-b border-[#dce5cb] dark:border-[#3e5606] bg-[#f4f8ed] dark:bg-[#142002]">
            <div className="sticky left-0 z-40 shrink-0 flex items-center px-3 font-semibold text-xs bg-[#f4f8ed] dark:bg-[#142002] border-r border-[#dce5cb] dark:border-[#3e5606]" style={{ width: mode === 'lista' ? '100%' : labelWidth }}>{mode === 'lista' ? 'Tareas y planificación' : 'Estructura de trabajo'}</div>
            {mode === 'gantt' && <div className="relative" style={{ width: timelineWidth }}>{visibleUnits.map(unit => <div key={unit.start} className="absolute top-0 bottom-0 flex items-center justify-center border-r border-[#dce5cb] dark:border-[#3e5606] text-[11px] overflow-hidden whitespace-nowrap" style={{ left: (unit.start - minDay) * dayWidth, width: unit.days * dayWidth }}>{unit.label}</div>)}</div>}
          </div>
          <div style={{ height: rows.length * ROW, position: 'relative' }}>
            {visibleRows.map((row, offset) => <div key={row.key} className="absolute left-0 right-0 flex border-b border-[#e2ebd3] dark:border-[#253905]" style={{ top: (startIndex + offset) * ROW, height: ROW }}>
              <div className="sticky left-0 z-20 shrink-0 bg-white dark:bg-[#0e1700] border-r border-[#dce5cb] dark:border-[#3e5606] flex items-center gap-2 pr-3" style={{ width: mode === 'lista' ? '100%' : labelWidth, paddingLeft: row.type === 'task' ? 32 : row.type === 'milestone' ? 20 : 8 }}>
                {row.type !== 'task' && <button aria-label={`${collapsed[row.key] && !forceOpen ? 'Expandir' : 'Contraer'} ${row.nombre}`} aria-expanded={forceOpen || !collapsed[row.key]} onClick={() => setCollapsed(previous => ({ ...previous, [row.key]: !previous[row.key] }))} className="p-1">{collapsed[row.key] && !forceOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>}
                <button onClick={() => setSelected(row)} className="text-left min-w-0 flex-1" title={row.nombre}><span className={`block truncate text-xs ${row.type === 'task' ? 'font-medium' : 'font-bold'}`}>{row.nombre}</span><span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{row.type === 'task' ? `${row.responsable || 'Sin responsable'}${row.overdue ? ' · Atrasada' : ''}${row.warnings.length ? ' · Revisar fechas/dependencias' : ''}${row.estimated ? ' · Estimada' : ''}` : row.type === 'project' ? 'Proyecto' : 'Hito'}</span></button>
                {mode === 'lista' ? <span className="text-[10px] text-right shrink-0">{displayDay(row.start)}<br />{displayDay(row.end)} · {Math.round(row.progress)}%</span> : <span className="text-[10px] text-slate-500">{Math.round(row.progress)}%</span>}
              </div>
              {mode === 'gantt' && <div className="relative shrink-0" style={{ width: timelineWidth, backgroundImage: 'linear-gradient(to right, rgba(120,140,100,.15) 1px, transparent 1px)', backgroundSize: `${Math.max(1, dayWidth * (scale === 'dias' ? 1 : 7))}px 100%` }}>
                {today >= minDay && today <= maxDay && <div aria-hidden="true" className="absolute top-0 bottom-0 border-l-2 border-red-500 pointer-events-none z-10" style={{ left: (today - minDay) * dayWidth }} />}
                <button aria-label={`${row.nombre}: ${displayDay(row.start)} a ${displayDay(row.end)}, ${Math.round(row.progress)}%${row.estimated ? ', estimado' : ''}`} onClick={() => setSelected(row)} title={`${row.nombre}\n${displayDay(row.start)} — ${displayDay(row.end)}${row.estimated ? '\nFechas estimadas' : ''}`} className="absolute top-3 h-6 rounded-md text-white text-[10px] text-left overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#a1c62e]" style={{ left: (row.start - minDay) * dayWidth, width: Math.max(2, (row.end - row.start + 1) * dayWidth), backgroundColor: color(row), border: row.estimated ? '2px dashed #cbd5a7' : '1px solid transparent' }}><span className="absolute inset-y-0 left-0 bg-black/20" style={{ width: `${row.progress}%` }} /><span className="relative px-2 whitespace-nowrap">{row.nombre}</span></button>
                {row.type === 'milestone' && row.target != null && <span title={`Meta: ${displayDay(row.target)}`} className="absolute top-4 w-3 h-3 rotate-45 border border-white bg-amber-500" style={{ left: (row.target - minDay) * dayWidth }} />}
              </div>}
            </div>)}
          </div>
        </div>
      </div>}
    </div>
    <div className="hidden gantt-print-report"><h2 className="font-bold p-3">AGROKOOL · Cronograma de trabajo</h2><p className="p-3">{displayDay(minDay)} — {displayDay(maxDay)} · Fechas estimadas identificadas por fila.</p>{printRows.map(row => <div key={row.key} className={`gantt-print-grid gantt-print-row gantt-print-${row.type}`}><div className="gantt-print-label"><strong>{row.nombre}</strong><span>{displayDay(row.start)} — {displayDay(row.end)} · {Math.round(row.progress)}%{row.estimated ? ' · Estimado' : ''}</span></div><div className="gantt-print-track"><div className="gantt-print-bar" style={{ left: `${(row.start - minDay) / totalDays * 100}%`, width: `${(row.end - row.start + 1) / totalDays * 100}%`, background: color(row) }}>{row.nombre}</div></div></div>)}</div>
    {selected && <GanttTaskEditor item={selected} tasks={schedule.flatMap(project => project.tasks)} onClose={() => setSelected(null)} onSaved={saved} />}
  </div>;
}
