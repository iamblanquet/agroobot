import React, { useState, useEffect } from 'react';
import api from '../api/client';
import {
  Shield,
  UserPlus,
  Users,
  KeyRound,
  MapPin,
  Building,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Activity,
  Clock,
  Play,
  Check
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebd3] dark:border-[#253905] pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#a87d13]" /> Administración IT & Control de Accesos
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Gestión centralizada de identidades con PIN de 4 dígitos, salud del servidor y disparador de alertas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3.5 py-2 rounded-xl bg-[#a87d13] hover:bg-[#8f690f] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-600/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* DIAGNÓSTICO DE SERVIDOR & AUTOMATIZACIÓN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Estado del Backend</p>
            <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">
              {health?.status === 'OK' ? '✅ Standalone API Activo' : 'Conectando...'}
            </p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">SQLite Relacional (15 tablas)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-700/40">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Acceso & Offline Storage</p>
            <p className="text-sm font-black text-purple-700 dark:text-purple-400">PIN 4 Dígitos + IndexedDB</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Sesión persistente y sync idempotente</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] flex items-center gap-3.5 shadow-sm">
          <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/80 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-700/40">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Alertas Automáticas Cron</p>
            <p className="text-sm font-black text-sky-700 dark:text-sky-400">21:00 · 21:30 · 08:00</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Zona Horaria: America/Merida</p>
          </div>
        </div>
      </div>

      {/* DISPARADORES MANUALES DE ALERTAS CRON */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" /> Disparador de Alertas y Cortes Automáticos
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Simula el envío de mensajes a los temas de Telegram sin esperar la hora programada:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => triggerCronTest('general')}
            className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 border border-emerald-300 dark:border-slate-700 text-emerald-900 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Probar 07:30 (General Proyectos)
          </button>
          <button
            type="button"
            onClick={() => triggerCronTest('morning')}
            className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-slate-800 hover:bg-purple-100 dark:hover:bg-slate-700 border border-purple-300 dark:border-slate-700 text-purple-900 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Probar 08:00 (Incidencias/300h)
          </button>
          <button
            type="button"
            onClick={() => triggerCronTest('evening')}
            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 border border-amber-300 dark:border-slate-700 text-amber-900 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-[#a87d13]" /> Probar 21:00 (Obras Sin Reporte)
          </button>
          <button
            type="button"
            onClick={() => triggerCronTest('tablero')}
            className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-slate-700 text-sky-900 dark:text-sky-300 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Probar 21:30 (Corte Tablero)
          </button>
        </div>

        {cronTriggerStatus && (
          <span className="text-xs font-mono text-sky-900 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 px-3 py-1 rounded-lg border border-sky-300 dark:border-sky-700">
            {cronTriggerStatus}
          </span>
        )}
      </div>

      {/* TABLA DE GESTIÓN DE USUARIOS Y PIN */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm dark:shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#a87d13]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Catálogo de Usuarios & PINs de Campo</h3>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-medium">{users.length} usuarios registrados</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#e2ebd3] dark:border-[#253905]">
          <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
            <thead className="bg-[#f4f8ed] dark:bg-[#0e1700] text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase tracking-wider border-b border-[#e2ebd3] dark:border-[#253905]">
              <tr>
                <th className="py-3.5 px-4">Usuario</th>
                <th className="py-3.5 px-4">Nombre Completo</th>
                <th className="py-3.5 px-4">Rol Asignado</th>
                <th className="py-3.5 px-4 text-center">PIN de Acceso (4 Dígitos)</th>
                <th className="py-3.5 px-4 text-center">Estado</th>
                <th className="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#152202]/50">
              {users.map((u) => {
                const roleColors = {
                  campo: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700',
                  supervisor: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700',
                  direccion: 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700',
                  it: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700'
                };

                return (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">{u.username}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">{u.nombre}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border uppercase ${roleColors[u.rol] || 'bg-slate-100 text-slate-700'}`}>
                        {u.rol}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.pin ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-600/40 text-amber-900 dark:text-amber-300 font-mono font-black text-xs shadow-sm">
                          <KeyRound className="w-3.5 h-3.5 text-[#a87d13]" /> {u.pin}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Sin PIN</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.activo ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[11px] border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3.5 h-3.5" /> Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
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
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition shadow-sm"
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
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm dark:shadow-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
            <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Catálogo de Predios (GeoJSON)</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
            {predios.map((pr) => (
              <div key={pr.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-200">{pr.nombre}</p>
                  <p className="text-[11px] text-slate-500">{pr.regimen} • Útil: {pr.superficie_util_ha} ha / Legal: {pr.superficie_legal_ha} ha</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border border-[#e2ebd3] dark:border-[#253905]">
                  GeoJSON OK
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Obras */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm dark:shadow-xl space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
            <Building className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Catálogo de Frentes / Obras</h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto">
            {obras.map((o) => (
              <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900 dark:text-slate-200">{o.nombre}</p>
                  <p className="text-[11px] text-slate-500">{o.proyecto_nombre} • Fase: {o.fase_actual}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-md text-[10px] uppercase font-black bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {o.estado}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* MODAL: Crear Usuario */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#a87d13]" /> Crear Usuario
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={newUserForm.nombre}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Abner Díaz"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUserForm.username}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="ej. abner_campo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select
                    value={newUserForm.rol}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, rol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="campo">Campo</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="direccion">Dirección</option>
                    <option value="it">IT / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PIN de 4 Dígitos <span className="text-[#a87d13]">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newUserForm.pin}
                    onChange={(e) => setNewUserForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="ej. 1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-400 dark:border-amber-600/40 text-amber-900 dark:text-amber-300 font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#a87d13] hover:bg-[#8f690f] text-white text-xs font-bold shadow-md shadow-amber-600/30"
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
        <div className="fixed inset-0 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#a87d13]" /> Editar: {editingUser.username}
              </h3>
              <button type="button" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-lg">✕</button>
            </div>

            <form onSubmit={handleEditUserSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.nombre}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nombre: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select
                    value={editForm.rol}
                    onChange={(e) => setEditForm(prev => ({ ...prev, rol: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                  >
                    <option value="campo">Campo</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="direccion">Dirección</option>
                    <option value="it">IT / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PIN de 4 Dígitos
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editForm.pin}
                    onChange={(e) => setEditForm(prev => ({ ...prev, pin: e.target.value.replace(/\D/g, '') }))}
                    placeholder="ej. 1234"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-amber-400 dark:border-amber-600/40 text-amber-900 dark:text-amber-300 font-mono font-bold text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nueva Contraseña <span className="text-slate-400 font-normal">(Opcional)</span>
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Dejar en blanco para conservar actual"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activoCheck"
                  checked={editForm.activo}
                  onChange={(e) => setEditForm(prev => ({ ...prev, activo: e.target.checked }))}
                  className="rounded bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-amber-600"
                />
                <label htmlFor="activoCheck" className="text-xs font-bold text-slate-800 dark:text-slate-200">Usuario Activo con Permisos</label>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#a87d13] hover:bg-[#8f690f] text-white text-xs font-bold shadow-md shadow-amber-600/30"
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
