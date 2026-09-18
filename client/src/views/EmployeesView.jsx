import React, { useEffect, useRef, useState } from 'react';
import { Users, Pencil, Search, Plus, Trash2, X } from 'lucide-react';
import api from '../api/client';

const emptyForm = { nombre: '', roles: [] };
const roleLabels = { operadores: 'Operadores', tecnicos: 'Técnicos', auxiliares: 'Auxiliares' };
const inputClass = 'w-full rounded-xl border border-[#e2ebd3] dark:border-[#3e5606] bg-white dark:bg-[#0c1400] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a1c62e]';

export default function EmployeesView() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const editor = useRef(null);
  const deleteDialog = useRef(null);

  function openEditor(employee) {
    setEditingId(employee?.id ?? null);
    setForm(employee ? { nombre: employee.nombre, roles: employee.roles || [] } : emptyForm);
    setError('');
    setNotice('');
    editor.current.showModal();
  }

  async function deleteEmployee() {
    if (saving || !deletingEmployee) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/employees/${deletingEmployee.id}`);
      setEmployees(previous => previous.filter(employee => employee.id !== deletingEmployee.id));
      setNotice('Empleado eliminado.');
      deleteDialog.current.close();
      setDeletingEmployee(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadEmployees() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/employees');
      setEmployees(data.employees);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEmployees(); }, []);

  async function saveEmployee(event) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setNotice('');
    if (!form.nombre.trim() || !form.roles.length) {
      setError('Completa el nombre del empleado y selecciona al menos un rol.');
      return;
    }
    setSaving(true);
    try {
      const data = editingId
        ? await api.patch(`/employees/${editingId}`, form)
        : await api.post('/employees', form);
      setEmployees(previous => editingId
        ? previous.map(employee => employee.id === editingId ? data.employee : employee)
        : [...previous, data.employee]);
      setNotice(editingId ? 'Empleado actualizado.' : 'Empleado registrado.');
      setForm(emptyForm);
      setEditingId(null);
      editor.current.close();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const query = search.trim().toLocaleLowerCase('es');
  const filtered = employees.filter(employee => `${employee.nombre} ${(employee.roles || []).map(role => roleLabels[role]).join(' ')}`.toLocaleLowerCase('es').includes(query))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      <header className="border-b border-[#e2ebd3] dark:border-[#253905] pb-4">
        <h2 className="text-xl font-black flex items-center gap-2"><Users className="w-6 h-6 text-[#a87d13]" /> Empleados</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Administra los empleados y sus roles.</p>
        <button type="button" disabled={loading || !!loadError} onClick={() => openEditor(null)} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2c4001] text-white font-bold text-sm disabled:opacity-50"><Plus className="w-4 h-4" /> Añadir empleado</button>
      </header>
      {notice && <p role="status" className="text-sm text-green-700 dark:text-green-400">{notice}</p>}

      <div>
        <dialog ref={editor} aria-labelledby="employee-dialog-title" onCancel={event => { if (saving) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#152202] text-[#1c2d01] dark:text-slate-100 border border-[#e2ebd3] dark:border-[#253905] shadow-xl backdrop:bg-black/50">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 id="employee-dialog-title" className="font-bold">{editingId ? 'Editar empleado' : 'Añadir empleado'}</h3>
            <button type="button" disabled={saving} onClick={() => editor.current.close()} aria-label="Cerrar ventana" className="p-2 rounded-lg hover:bg-black/10"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={saveEmployee} className="space-y-4">
            <fieldset disabled={saving || loading || !!loadError} className="space-y-4 disabled:opacity-60">
              <div>
                <label htmlFor="employee-name" className="block text-sm font-semibold mb-1">Empleado</label>
                <input id="employee-name" required maxLength={150} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} className={inputClass} placeholder="Nombre completo" />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold mb-1">Rol</legend>
                <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona uno o varios roles.</p>
                {Object.entries(roleLabels).map(([role, label]) => <label key={role} className="flex items-center gap-3 rounded-xl border border-[#e2ebd3] dark:border-[#3e5606] p-3 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.roles.includes(role)} onChange={event => setForm(previous => ({ ...previous, roles: event.target.checked ? [...previous.roles, role] : previous.roles.filter(value => value !== role) }))} className="w-4 h-4 accent-[#2c4001]" />{label}
                </label>)}
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#2c4001] text-white font-bold text-sm hover:bg-[#3e5606] disabled:opacity-50">{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Agregar empleado'}</button>
                <button type="button" onClick={() => editor.current.close()} className="px-4 py-2 text-sm font-semibold">Cancelar</button>
              </div>
            </fieldset>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </form>
        </dialog>

        <dialog ref={deleteDialog} aria-labelledby="delete-employee-title" onCancel={event => { if (saving) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-md p-6 rounded-2xl bg-white dark:bg-[#152202] text-[#1c2d01] dark:text-slate-100 shadow-xl backdrop:bg-black/50">
          <h3 id="delete-employee-title" className="text-lg font-bold">Eliminar empleado</h3>
          <p className="mt-3 text-sm break-words">¿Eliminar a <strong>{deletingEmployee?.nombre}</strong>? Esta acción no se puede deshacer.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 mt-6">
            <button type="button" autoFocus disabled={saving} onClick={() => deleteDialog.current.close()} className="px-4 py-2 text-sm font-semibold">Cancelar</button>
            <button type="button" disabled={saving} onClick={deleteEmployee} className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold disabled:opacity-50">{saving ? 'Eliminando…' : 'Eliminar empleado'}</button>
          </div>
        </dialog>

        <section className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm space-y-4 min-w-0">
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-bold">Directorio de empleados</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">{employees.length} registrados</span>
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input aria-label="Buscar por empleado o rol" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por empleado o rol" className={`${inputClass} pl-9`} />
          </div>
          {loading ? <p role="status" className="text-sm py-8 text-center">Cargando empleados…</p>
            : loadError ? <div role="alert" className="text-sm text-red-600 dark:text-red-400">{loadError} <button type="button" onClick={loadEmployees} className="underline font-bold">Reintentar</button></div>
            : !filtered.length ? <p className="text-sm py-8 text-center text-slate-500 dark:text-slate-400">{employees.length ? 'No hay empleados que coincidan con tu búsqueda.' : 'Aún no hay empleados. Usa «Añadir empleado» para registrar el primero.'}</p>
            : <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-[#f4f8ed] dark:bg-[#0c1400]"><tr><th scope="col" className="p-3">Empleado</th><th scope="col" className="p-3">Rol</th><th scope="col" className="p-3 text-right">Acciones</th></tr></thead>
                <tbody className="divide-y divide-[#e2ebd3] dark:divide-[#253905]">
                  {filtered.map(employee => <tr key={employee.id}>
                    <td className="p-3 font-semibold break-words">{employee.nombre}</td>
                    <td className="p-3"><div className="flex flex-wrap gap-1">{employee.roles?.length ? employee.roles.map(role => <span key={role} className="px-2 py-1 rounded-lg bg-[#a1c62e]/20 text-xs font-semibold">{roleLabels[role]}</span>) : <span className="text-xs text-slate-500">Sin asignar</span>}</div></td>
                    <td className="p-3 text-right"><div className="flex justify-end flex-wrap gap-3">
                      <button type="button" disabled={saving} aria-label={`Editar a ${employee.nombre}`} onClick={() => openEditor(employee)} className="inline-flex items-center gap-1 text-[#2c4001] dark:text-[#a1c62e] font-semibold disabled:opacity-50"><Pencil className="w-4 h-4" /> Editar</button>
                      <button type="button" disabled={saving} aria-label={`Eliminar a ${employee.nombre}`} onClick={() => { setDeletingEmployee(employee); setError(''); setNotice(''); deleteDialog.current.showModal(); }} className="inline-flex items-center gap-1 text-red-700 dark:text-red-400 font-semibold disabled:opacity-50"><Trash2 className="w-4 h-4" /> Eliminar</button>
                    </div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>}
        </section>
      </div>
    </div>
  );
}
