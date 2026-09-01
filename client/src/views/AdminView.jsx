import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Shield,
  UserPlus,
  Users,
  KeyRound,
  MapPin,
  Building,
  CheckCircle,
  XCircle,
  RefreshCw,
  Server,
  Activity,
  Clock,
  Play
} from 'lucide-react';

export default function AdminView() {
  const [users, setUsers] = useState([]);
  const [predios, setPredios] = useState([]);
  const [obras, setObras] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cronTriggerStatus, setCronTriggerStatus] = useState(null);

  // Formulario Nuevo Usuario
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    pin: '',
    nombre: '',
    rol: 'campo'
  });

  // Modal Edición de Usuario
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    rol: 'campo',
    pin: '',
    activo: true,
    password: ''
  });

  const loadAll = async () => {
    setIsLoading(true);
    try {
      const [uData, pData, oData, hData] = await Promise.all([
        api.get('/users'),
        api.get('/projects/predios'),
        api.get('/projects/obras'),
        api.get('/health')
      ]);

      setUsers(uData.users || []);
      setPredios(pData.predios || []);
      setObras(oData.obras || []);
      setHealth(hData);
    } catch (err) {
      console.error('Error cargando datos de admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', newUserForm);
      setShowCreateModal(false);
      setNewUserForm({
        username: '',
        password: '',
        pin: '',
        nombre: '',
        rol: 'campo'
      });
      await loadAll();
    } catch (err) {
      alert('Error al crear usuario: ' + err.message);
    }
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/users/${editingUser.id}`, editForm);
      setEditingUser(null);
      await loadAll();
    } catch (err) {
      alert('Error al actualizar usuario: ' + err.message);
    }
  };

  const triggerCronTest = async (type) => {
    setCronTriggerStatus('Ejecutando...');
    try {
      const res = await api.post('/stats/cron-trigger', { type });
      setCronTriggerStatus(`✅ ${res.type || 'Ejecutado con éxito'}`);
      setTimeout(() => setCronTriggerStatus(null), 5000);
    } catch (err) {
      setCronTriggerStatus(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      {/* Header Admin */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" /> Administración IT & Control de Accesos
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gestión de identidades con PIN de 4 dígitos, monitoreo de servidor y automatización de alertas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refrescar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-950/50"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* DIAGNÓSTICO DE SERVIDOR & AUTOMATIZACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700/40">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Estado del Backend</p>
            <p className="text-sm font-bold text-emerald-400">
              {health?.status === 'OK' ? '✅ Standalone API Activo' : 'Conectando...'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">SQLite Relacional (15 tablas)</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-lg bg-purple-950 text-purple-400 border border-purple-700/40">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Acceso & Offline Storage</p>
            <p className="text-sm font-bold text-purple-400">PIN 4 Dígitos + IndexedDB</p>
            <p className="text-[10px] text-slate-500">Sesión persistente y sync idempotente</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3">
          <div className="p-3 rounded-lg bg-sky-950 text-sky-400 border border-sky-700/40">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Alertas Automáticas Cron</p>
            <p className="text-sm font-bold text-sky-400">21:00 · 21:30 · 08:00</p>
            <p className="text-[10px] text-slate-500">Zona Horaria: America/Merida</p>
          </div>
        </div>
      </div>

      {/* DISPARADORES MANUALES DE ALERTAS CRON */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-sky-400" /> Disparador de Alertas y Cortes Automáticos
          </p>
          <p className="text-[11px] text-slate-400">
            Simula las alertas programadas sin esperar la hora fija:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => triggerCronTest('evening')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition"
          >
            <Play className="w-3 h-3 text-amber-400" /> Probar 21:00 (Obras Sin Reporte)
          </button>
          <button
            type="button"
            onClick={() => triggerCronTest('tablero')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition"
          >
            <Play className="w-3 h-3 text-sky-400" /> Probar 21:30 (Corte Tablero)
          </button>
          <button
            type="button"
            onClick={() => triggerCronTest('morning')}
            className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition"
          >
            <Play className="w-3 h-3 text-emerald-400" /> Probar 08:00 (Incidencias/300h)
          </button>
        </div>

        {cronTriggerStatus && (
          <span className="text-xs font-mono text-sky-300 bg-sky-950/80 px-2 py-1 rounded border border-sky-700/50">
            {cronTriggerStatus}
          </span>
        )}
      </div>

      {/* TABLA DE GESTIÓN DE USUARIOS Y PIN */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Catálogo de Usuarios & PINs de Campo</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{users.length} usuarios registrados</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Usuario</th>
                <th className="py-3 px-4">Nombre Completo</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4 text-center">PIN de Acceso (4 Dígitos)</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => {
                const roleColors = {
                  campo: 'bg-emerald-950 text-emerald-300 border-emerald-700',
                  supervisor: 'bg-blue-950 text-blue-300 border-blue-700',
                  direccion: 'bg-purple-950 text-purple-300 border-purple-700',
                  it: 'bg-amber-950 text-amber-300 border-amber-700'
                };

                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-semibold text-white">{u.username}</td>
                    <td className="py-3 px-4">{u.nombre}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${roleColors[u.rol] || 'bg-slate-800'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.pin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-600/40 text-amber-300 font-mono font-bold text-xs shadow-sm">
                          <KeyRound className="w-3 h-3 text-amber-400" /> {u.pin}
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Sin PIN</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px]">
                          <XCircle className="w-3.5 h-3.5" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUser(u);
                          setEditForm({
                            nombre: u.nombre,
                            rol: u.rol,
                            pin: u.pin || '',
                            activo: !!u.activo,
                            password: ''
                          });
                        }}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                      >
                        Editar / PIN
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CATÁLOGO DE PREDIOS Y OBRAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Predios */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Catálogo de Predios (GeoJSON)</h3>
          </div>
          <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto">
            {predios.map((pr) => (
              <div key={pr.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">{pr.nombre}</p>
                  <p className="text-[10px] text-slate-500">{pr.regimen} • Útil: {pr.superficie_util_ha} ha / Legal: {pr.superficie_legal_ha} ha</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
                  GeoJSON OK
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Obras */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Catálogo de Frentes / Obras</h3>
          </div>
          <div className="divide-y divide-slate-800 max-h-56 overflow-y-auto">
            {obras.map((o) => (
              <div key={o.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">{o.nombre}</p>
                  <p className="text-[10px] text-slate-500">{o.proyecto_nombre} • Fase: {o.fase_actual}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-blue-950 text-blue-300 border border-blue-800">
                  {o.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" /> Crear Usuario
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newUserForm.nombre}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Abner Díaz"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="ej. abner_campo"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rol</label>
                  <select
                    value={newUserForm.rol}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, rol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    <option value="campo">Campo</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="direccion">Dirección</option>
                    <option value="it">IT / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    PIN de 4 Dígitos <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newUserForm.pin}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="ej. 1234"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-600/40 text-amber-300 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Editar Usuario & Asignar PIN */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" /> Editar: {editingUser.username}
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Rol</label>
                  <select
                    value={editForm.rol}
                    onChange={(e) => setEditForm(prev => ({ ...prev, rol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    <option value="campo">Campo</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="direccion">Dirección</option>
                    <option value="it">IT / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    PIN de 4 Dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editForm.pin}
                    onChange={(e) => setEditForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="ej. 1234"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-600/40 text-amber-300 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nueva Contraseña <span className="text-slate-500 font-normal">(Opcional)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Dejar en blanco para conservar actual"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activoCheck"
                  checked={editForm.activo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded bg-slate-800 border-slate-700 text-amber-500"
                />
                <label htmlFor="activoCheck" className="text-xs text-slate-200">Usuario Activo con Permisos</label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
