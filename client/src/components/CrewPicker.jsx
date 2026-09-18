import React, { useState } from 'react';
import { Search, Plus, X } from 'lucide-react';

const roles = { operadores: 'Operadores', tecnicos: 'Técnicos', auxiliares: 'Auxiliares' };
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function CrewPicker({ employees, selection, onChange, loading, disabled }) {
  const [queries, setQueries] = useState({ operadores: '', tecnicos: '', auxiliares: '' });
  const selectedIds = new Set(Object.values(selection).flat().map(employee => employee.id));

  function add(role, employee) {
    onChange(previous => {
      if (Object.values(previous).flat().some(item => item.id === employee.id)) return previous;
      return { ...previous, [role]: [...previous[role], employee] };
    });
    setQueries(previous => ({ ...previous, [role]: '' }));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 dark:text-slate-400">Busca por nombre y añade a cada persona en el rol que desempeñará hoy. Cada persona cuenta una sola vez.</p>
      {!loading && employees.length === 0 && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">No hay empleados en el catálogo disponible. Regístralos y asígnales roles en el panel Empleados; luego actualiza el catálogo con conexión.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(roles).map(([role, label]) => {
          const query = normalize(queries[role].trim());
          const available = employees.filter(employee => employee.roles?.includes(role) && !selectedIds.has(employee.id));
          const matches = available.filter(employee => normalize(employee.nombre).includes(query));
          return <section key={role} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-[#e2ebd3] dark:border-[#253905] space-y-3 min-w-0">
            <div className="flex justify-between items-center"><h4 className="text-xs font-bold">{label}</h4><span className="text-xs font-bold" aria-label={`${label} seleccionados`}>{selection[role].length}</span></div>
            <div className="relative">
              <Search aria-hidden="true" className="absolute left-2.5 top-3 w-3.5 h-3.5 text-slate-400" />
              <input aria-label={`Buscar ${label.toLowerCase()}`} disabled={loading || disabled} value={queries[role]} onChange={event => setQueries(previous => ({ ...previous, [role]: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} placeholder="Nombre del empleado…" className="w-full pl-8 pr-2 py-2.5 text-xs rounded-xl bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#a1c62e]" />
            </div>
            {loading ? <p role="status" className="text-xs text-slate-500">Cargando empleados…</p> : <ul aria-label={`${label} disponibles`} className="max-h-40 overflow-y-auto space-y-1">
              {matches.slice(0, 20).map(employee => <li key={employee.id}><button type="button" disabled={disabled} onClick={() => add(role, employee)} aria-label={`Añadir a ${employee.nombre} como ${label.toLowerCase()}`} className="w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-[#a1c62e]/20 disabled:opacity-50">
                <span className="min-w-0"><span className="block text-xs font-semibold break-words">{employee.nombre}</span></span><Plus className="w-4 h-4 shrink-0" />
              </button></li>)}
              {!matches.length && <li className="text-xs text-slate-500 dark:text-slate-400 py-1">{query ? 'Sin coincidencias.' : 'No hay más empleados disponibles para este rol.'}</li>}
              {matches.length > 20 && <li className="text-xs text-slate-500">Escribe para acotar los resultados.</li>}
            </ul>}
            <ul aria-label={`${label} en la cuadrilla`} className="space-y-2">
              {selection[role].map(employee => <li key={employee.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#a1c62e]/20 border border-[#a1c62e]/40">
                <span className="text-xs font-semibold break-words">{employee.nombre}</span>
                <button type="button" disabled={disabled} aria-label={`Quitar a ${employee.nombre} de la cuadrilla`} onClick={() => onChange(previous => ({ ...previous, [role]: previous[role].filter(item => item.id !== employee.id) }))} className="p-1 rounded-lg hover:bg-black/10"><X className="w-4 h-4" /></button>
              </li>)}
            </ul>
          </section>;
        })}
      </div>
    </div>
  );
}
