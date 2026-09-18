import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/client';
import { dayString, displayDay } from '../utils/gantt';
const field = 'w-full rounded-xl border border-slate-300 dark:border-[#3e5606] p-2.5 text-sm bg-white dark:bg-[#0e1700]';
export default function GanttTaskEditor({ item, tasks, onClose, onSaved }) {
  const dialog = useRef(null);
  const [start, setStart] = useState(item.fecha_inicio || '');
  const [end, setEnd] = useState(item.fecha_fin || '');
  const [owner, setOwner] = useState(item.responsable || '');
  const [deps, setDeps] = useState(item.dependencias || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const candidates = tasks.filter(task => Number(task.projectId) === Number(item.projectId) && Number(task.id) !== Number(item.id));
  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if ((!start || !end) && (start || end)) { setError('Completa ambas fechas o deja ambas vacías para usar una estimación.'); return; }
    if (start && end < start) { setError('El fin no puede ser anterior al inicio.'); return; }
    setSaving(true); setError('');
    try { onSaved((await api.patch(`/gantt/tasks/${item.id}`, { fecha_inicio: start || null, fecha_fin: end || null, responsable: owner, dependencias: deps })).task); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} aria-labelledby="gantt-task-title" className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[90vh] overflow-auto rounded-2xl p-5 bg-white dark:bg-[#142002] text-slate-900 dark:text-slate-100 shadow-2xl backdrop:bg-black/60">
    <div className="flex justify-between items-start gap-4"><h3 id="gantt-task-title" className="text-lg font-bold">{item.nombre}</h3><button aria-label="Cerrar detalle" disabled={saving} onClick={onClose} className="p-2"><X className="w-5 h-5" /></button></div>
    <p className="text-sm my-3">{displayDay(item.start)} — {displayDay(item.end)} · {Math.round(item.progress)}%{item.estimated ? ' · Fechas estimadas' : ''}</p>
    {item.type !== 'task' ? <p className="text-sm text-slate-500">El avance se calcula con el cumplimiento de sus tareas. Selecciona una tarea para editar su planificación.</p> : <form onSubmit={save} className="space-y-4">
      {item.overdue && <p className="text-sm text-rose-700 dark:text-rose-300">Esta tarea está atrasada.</p>}
      {!!item.warnings.length && <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-300">{item.warnings.map(message => <li key={message}>{message}</li>)}</ul>}
      <p className="text-xs text-slate-500">Las dependencias son de fin a inicio: esta tarea debe comenzar después de que terminen sus predecesoras. Las fechas no se desplazan automáticamente.</p>
      <fieldset disabled={saving} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><label className="text-sm">Inicio<input type="date" className={field} value={start} onChange={event => setStart(event.target.value)} /></label><label className="text-sm">Fin<input type="date" className={field} value={end} min={start || undefined} onChange={event => setEnd(event.target.value)} /></label></div>
        <div className="flex flex-wrap gap-3 text-xs"><button type="button" className="underline" onClick={() => { setStart(dayString(item.start)); setEnd(dayString(item.end)); }}>Usar fechas mostradas</button><button type="button" className="underline" onClick={() => { setStart(''); setEnd(''); }}>Quitar fechas confirmadas</button></div>
        <label className="block text-sm">Responsable<input className={field} maxLength={150} value={owner} onChange={event => setOwner(event.target.value)} placeholder="Nombre del responsable" /></label>
        <fieldset className="space-y-2"><legend className="text-sm font-semibold">Tareas predecesoras ({deps.length})</legend><input aria-label="Buscar predecesoras" className={field} placeholder="Buscar tarea del proyecto" value={search} onChange={event => setSearch(event.target.value)} />
          {deps.filter(id => !candidates.some(task => Number(task.id) === id)).map(id => <label key={id} className="flex gap-2 text-xs text-amber-700"><input type="checkbox" checked onChange={() => setDeps(previous => previous.filter(value => value !== id))} />Tarea eliminada (#{id}): desmarca para quitar esta dependencia.</label>)}
          <div className="max-h-36 overflow-auto space-y-2">{candidates.filter(task => task.nombre.toLowerCase().includes(search.toLowerCase())).map(task => <label key={task.id} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={deps.includes(Number(task.id))} onChange={event => setDeps(previous => event.target.checked ? [...previous, Number(task.id)] : previous.filter(id => id !== Number(task.id)))} />{task.nombre}</label>)}</div>
          {!candidates.length && <p className="text-xs text-slate-500">No hay otras tareas en este proyecto.</p>}
        </fieldset>
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2">Cancelar</button><button type="submit" className="px-4 py-2 rounded-xl bg-[#2c4001] text-white font-semibold">{saving ? 'Guardando…' : 'Guardar planificación'}</button></div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>}
  </dialog>;
}
