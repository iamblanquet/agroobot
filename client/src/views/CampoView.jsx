import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { saveReportOffline, cacheCatalogData, getCachedCatalogData } from '../db/indexedDb';
import {
  HardHat,
  Tractor,
  Users,
  CloudRain,
  CheckCircle,
  AlertTriangle,
  Plus,
  Minus,
  Save,
  Clock,
  Fuel,
  WifiOff,
  Layers
} from 'lucide-react';

export default function CampoView() {
  const { user, offlineSimulated, toggleOfflineSimulation } = useAuth();

  // Estados del catálogo
  const [catalog, setCatalog] = useState({
    proyectos: [],
    hitos: [],
    tareas: [],
    obras: [],
    predios: [],
    maquinas: []
  });
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Estados de los selectores en cascada
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [selectedHitoId, setSelectedHitoId] = useState('');
  const [selectedTareaId, setSelectedTareaId] = useState('');
  const [selectedObraId, setSelectedObraId] = useState('');
  const [selectedPredioId, setSelectedPredioId] = useState('');

  // Avance en Ha
  const [avanceHa, setAvanceHa] = useState('');

  // Cuadrilla dinámica
  const [cuadrilla, setCuadrilla] = useState({
    operadores: 2,
    tecnicos: 1,
    auxiliares: 1
  });

  // Toggle y motivos de "Sin Actividad"
  const [esSinActividad, setEsSinActividad] = useState(false);
  const [motivoSinActividad, setMotivoSinActividad] = useState('Lluvia');
  const [motivoPersonalizado, setMotivoPersonalizado] = useState('');

  // Maquinaria y Horómetro
  const [incluirMaquinaria, setIncluirMaquinaria] = useState(true);
  const [selectedMaquinaId, setSelectedMaquinaId] = useState('');
  const [horometroInicio, setHorometroInicio] = useState('');
  const [horometroFin, setHorometroFin] = useState('');
  const [litrosDiesel, setLitrosDiesel] = useState('');

  // Notas
  const [nota, setNota] = useState('');

  // Feedback y Envío
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState(null);

  // Cargar catálogo (con fallback a IndexedDB si offline)
  const loadCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      if (!offlineSimulated && navigator.onLine) {
        const data = await api.get('/projects/cascade-options');
        setCatalog(data);
        await cacheCatalogData(data);
      } else {
        const cached = await getCachedCatalogData();
        if (cached) {
          setCatalog(cached);
        }
      }
    } catch (err) {
      console.warn('Error cargando catálogo online, intentando caché:', err);
      const cached = await getCachedCatalogData();
      if (cached) setCatalog(cached);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [offlineSimulated]);

  // Selección automática de primeros elementos
  useEffect(() => {
    if (catalog.proyectos.length > 0 && !selectedProyectoId) {
      setSelectedProyectoId(String(catalog.proyectos[0].id));
    }
    if (catalog.obras.length > 0 && !selectedObraId) {
      setSelectedObraId(String(catalog.obras[0].id));
    }
    if (catalog.predios.length > 0 && !selectedPredioId) {
      setSelectedPredioId(String(catalog.predios[0].id));
    }
    if (catalog.maquinas.length > 0 && !selectedMaquinaId) {
      setSelectedMaquinaId(String(catalog.maquinas[0].id));
      setHorometroInicio(catalog.maquinas[0].horometro_actual || 0);
      setHorometroFin((catalog.maquinas[0].horometro_actual || 0) + 8);
    }
  }, [catalog]);

  // Filtrar hitos por proyecto seleccionado
  const filteredHitos = catalog.hitos.filter(
    (h) => String(h.proyecto_id) === String(selectedProyectoId)
  );

  useEffect(() => {
    if (filteredHitos.length > 0) {
      setSelectedHitoId(String(filteredHitos[0].id));
    } else {
      setSelectedHitoId('');
    }
  }, [selectedProyectoId]);

  // Filtrar tareas por hito seleccionado
  const filteredTareas = catalog.tareas.filter(
    (t) => String(t.hito_id) === String(selectedHitoId)
  );

  useEffect(() => {
    if (filteredTareas.length > 0) {
      setSelectedTareaId(String(filteredTareas[0].id));
    } else {
      setSelectedTareaId('');
    }
  }, [selectedHitoId]);

  // Manejar cambio de máquina y autocompletar horómetro
  const handleMaquinaChange = (maqId) => {
    setSelectedMaquinaId(maqId);
    const maq = catalog.maquinas.find((m) => String(m.id) === String(maqId));
    if (maq) {
      setHorometroInicio(maq.horometro_actual || 0);
      setHorometroFin((maq.horometro_actual || 0) + 8);
    }
  };

  // Cálculo automático de horas trabajadas
  const hIni = parseFloat(horometroInicio) || 0;
  const hFin = parseFloat(horometroFin) || 0;
  const horasTrabajadasCalculadas = Math.max(0, parseFloat((hFin - hIni).toFixed(2)));

  // Tarea activa seleccionada para la barra de progreso
  const activeTarea = catalog.tareas.find((t) => String(t.id) === String(selectedTareaId));
  const activeProgresoPorcentaje = activeTarea && activeTarea.cantidad_meta > 0
    ? Math.min(100, Math.round((activeTarea.cantidad_acumulada / activeTarea.cantidad_meta) * 100))
    : 0;

  // Ajustadores de cuadrilla (+ / -)
  const adjustCuadrilla = (tipo, delta) => {
    setCuadrilla((prev) => ({
      ...prev,
      [tipo]: Math.max(0, prev[tipo] + delta)
    }));
  };

  const totalHeadcount = cuadrilla.operadores + cuadrilla.tecnicos + cuadrilla.auxiliares;

  // Generador UUIDv4 para client_uuid
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // Envío del Reporte
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitFeedback(null);

    const client_uuid = `campo-${generateUUID()}`;
    const today = new Date().toISOString().split('T')[0];

    const motivoFinal = motivoSinActividad === 'Otro' ? motivoPersonalizado : motivoSinActividad;

    const reportPayload = {
      client_uuid,
      proyecto_id: parseInt(selectedProyectoId, 10) || null,
      hito_id: parseInt(selectedHitoId, 10) || null,
      tarea_id: parseInt(selectedTareaId, 10) || null,
      obra_id: parseInt(selectedObraId, 10) || null,
      fecha_operativa: today,
      autor_nombre: user?.nombre || 'Operador de Campo',
      nota: nota.trim() || null,
      es_sin_actividad: esSinActividad,
      motivo_sin_actividad: esSinActividad ? motivoFinal : null,
      lineas: !esSinActividad && avanceHa
        ? [
            {
              predio_id: parseInt(selectedPredioId, 10) || null,
              actividad_id: activeTarea?.actividad_id || 'labor_campo',
              cantidad: parseFloat(avanceHa) || 0,
              unidad: activeTarea?.unidad || 'ha',
              cantidad_ha: parseFloat(avanceHa) || 0,
              fuente: 'campo'
            }
          ]
        : [],
      cuadrilla: !esSinActividad
        ? [
            { rol_id: 'operador', headcount: cuadrilla.operadores },
            { rol_id: 'tecnico', headcount: cuadrilla.tecnicos },
            { rol_id: 'auxiliar', headcount: cuadrilla.auxiliares }
          ]
        : [],
      maquinaria: !esSinActividad && incluirMaquinaria && selectedMaquinaId
        ? [
            {
              maquina_id: parseInt(selectedMaquinaId, 10),
              horometro_inicio: hIni,
              horometro_fin: hFin,
              horas_trabajadas: horasTrabajadasCalculadas,
              litros_diesel: parseFloat(litrosDiesel) || 0
            }
          ]
        : []
    };

    const isOfflineMode = offlineSimulated || !navigator.onLine;

    try {
      if (isOfflineMode) {
        // Guardar en cola offline de IndexedDB
        await saveReportOffline(reportPayload);
        setSubmitFeedback({
          type: 'offline',
          text: `📡 Reporte guardado en almacenamiento local (Modo Sin Señal). Se sincronizará automáticamente al volver la red.`
        });
      } else {
        // Enviar a Standalone API
        await api.post('/reports/sync', { reports: [reportPayload] });
        setSubmitFeedback({
          type: 'online',
          text: `✅ Reporte sincronizado exitosamente con el servidor central.`
        });
        // Recargar catálogo para actualizar acumulados
        loadCatalog();
      }

      // Resetear campos variables
      setAvanceHa('');
      setNota('');
      if (selectedMaquinaId) {
        setHorometroInicio(hFin);
        setHorometroFin(hFin + 8);
      }
      setLitrosDiesel('');
    } catch (err) {
      console.error('Error al enviar reporte:', err);
      // Fallback: guardar en IndexedDB
      await saveReportOffline(reportPayload);
      setSubmitFeedback({
        type: 'offline',
        text: `⚠️ Error de red con el servidor. El reporte ha sido respaldado en IndexedDB localmente.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      {/* Banner de Modo Sin Señal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${offlineSimulated ? 'bg-amber-950 text-amber-400 border border-amber-600/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-600/30'}`}>
            {offlineSimulated ? <WifiOff className="w-5 h-5" /> : <HardHat className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Captura de Jornada Operativa</h2>
            <p className="text-xs text-slate-400">
              {offlineSimulated ? 'Simulador de campo remoto (Sin Cobertura Celular)' : 'Operación normal conectada al API'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleOfflineSimulation}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition border shadow-sm ${
            offlineSimulated
              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          {offlineSimulated ? '🟢 Desactivar Simulación Offline' : '📡 Simular Modo Sin Señal'}
        </button>
      </div>

      {/* Feedback Toast */}
      {submitFeedback && (
        <div className={`p-4 rounded-xl text-xs font-medium border flex items-center gap-2.5 shadow-lg ${
          submitFeedback.type === 'online'
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500'
            : 'bg-amber-950/90 text-amber-200 border-amber-500'
        }`}>
          {submitFeedback.type === 'online' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          )}
          <span>{submitFeedback.text}</span>
        </div>
      )}

      {/* Formulario Principal */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECCIÓN 1: SELECTORES EN CASCADA */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm border-b border-slate-800 pb-2">
            <Layers className="w-4 h-4" /> 1. Jerarquía de Trabajo (Cascada)
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Proyecto */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Proyecto
              </label>
              <select
                value={selectedProyectoId}
                onChange={(e) => setSelectedProyectoId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                {catalog.proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.ciclo})
                  </option>
                ))}
              </select>
            </div>

            {/* Hito */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Hito Activo
              </label>
              <select
                value={selectedHitoId}
                onChange={(e) => setSelectedHitoId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                {filteredHitos.length > 0 ? (
                  filteredHitos.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nombre} ({h.superficie_meta_ha} ha)
                    </option>
                  ))
                ) : (
                  <option value="">Sin hitos para este proyecto</option>
                )}
              </select>
            </div>

            {/* Tarea */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Tarea Operativa
              </label>
              <select
                value={selectedTareaId}
                onChange={(e) => setSelectedTareaId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                {filteredTareas.length > 0 ? (
                  filteredTareas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} — Meta: {t.cantidad_meta} {t.unidad} (Acumulado: {t.cantidad_acumulada} {t.unidad})
                    </option>
                  ))
                ) : (
                  <option value="">Sin tareas asignadas</option>
                )}
              </select>

              {/* Barra de progreso de la tarea seleccionada */}
              {activeTarea && (
                <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-400 font-medium">Progreso Tarea Meta:</span>
                    <span className="text-emerald-400 font-bold">
                      {activeTarea.cantidad_acumulada} / {activeTarea.cantidad_meta} {activeTarea.unidad} ({activeProgresoPorcentaje}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activeProgresoPorcentaje}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Obra (Frente) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Frente / Obra
              </label>
              <select
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                {catalog.obras.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.fase_actual})
                  </option>
                ))}
              </select>
            </div>

            {/* Predio */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Predio / Lote
              </label>
              <select
                value={selectedPredioId}
                onChange={(e) => setSelectedPredioId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
              >
                {catalog.predios.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nombre} ({pr.superficie_util_ha} ha útiles)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: TOGGLE DE DÍA SIN ACTIVIDAD */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <CloudRain className="w-4 h-4" /> 2. Estatus Operativo de la Jornada
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={esSinActividad}
                onChange={(e) => setEsSinActividad(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              <span className="ml-2 text-xs font-semibold text-slate-300">
                {esSinActividad ? '🌧️ Día Sin Actividad (Paro)' : '⚡ Jornada Activa'}
              </span>
            </label>
          </div>

          {esSinActividad && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/40 space-y-3 animate-fadeIn">
              <label className="block text-xs font-semibold text-amber-200 uppercase tracking-wider">
                Motivo del Paro Operativo
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Lluvia', 'Sin Material', 'Sin Cuadrilla', 'Sin Máquina', 'Descanso', 'Otro'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMotivoSinActividad(m)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition border ${
                      motivoSinActividad === m
                        ? 'bg-amber-600 text-slate-950 border-amber-400 font-bold shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {motivoSinActividad === 'Otro' && (
                <input
                  type="text"
                  value={motivoPersonalizado}
                  onChange={(e) => setMotivoPersonalizado(e.target.value)}
                  placeholder="Detalla el motivo específico del paro..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              )}
            </div>
          )}
        </div>

        {/* SECCIÓN 3: AVANCE Y CUADRILLA (Visible solo si hay actividad) */}
        {!esSinActividad && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm border-b border-slate-800 pb-2">
              <Users className="w-4 h-4" /> 3. Avance de Labor y Cuadrilla
            </div>

            {/* Input de Avance */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Superficie / Cantidad Realizada Hoy ({activeTarea?.unidad || 'ha'})
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={avanceHa}
                onChange={(e) => setAvanceHa(e.target.value)}
                placeholder="ej. 8.5"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Steppers de Cuadrilla */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Personal en Campo
                </label>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-600/40">
                  Headcount Total: {totalHeadcount}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Operadores */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Operadores</p>
                    <p className="text-[10px] text-slate-500">Maquinaria pesada</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('operadores', -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-white w-5 text-center">{cuadrilla.operadores}</span>
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('operadores', 1)}
                      className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Técnicos */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Técnicos</p>
                    <p className="text-[10px] text-slate-500">Riego / Suelos</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('tecnicos', -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-white w-5 text-center">{cuadrilla.tecnicos}</span>
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('tecnicos', 1)}
                      className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Auxiliares */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Auxiliares</p>
                    <p className="text-[10px] text-slate-500">Jornaleros</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('auxiliares', -1)}
                      className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center text-xs font-bold"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold text-white w-5 text-center">{cuadrilla.auxiliares}</span>
                    <button
                      type="button"
                      onClick={() => adjustCuadrilla('auxiliares', 1)}
                      className="w-7 h-7 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 4: HORÓMETROS Y DIÉSEL (Visible solo si hay actividad) */}
        {!esSinActividad && (
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <Tractor className="w-4 h-4" /> 4. Horómetro & Diésel de Maquinaria
              </div>
              <label className="text-xs text-slate-400 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirMaquinaria}
                  onChange={(e) => setIncluirMaquinaria(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-emerald-600 focus:ring-0"
                />
                Incluir lectura de máquina
              </label>
            </div>

            {incluirMaquinaria && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Máquina Asignada
                  </label>
                  <select
                    value={selectedMaquinaId}
                    onChange={(e) => handleMaquinaChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    {catalog.maquinas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.codigo} — {m.modelo} (Actual: {m.horometro_actual} hrs) {m.alerta_mantenimiento ? '⚠️ ALERTA PREVENTIVA' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {/* Horómetro Inicio */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Horómetro Inicial
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={horometroInicio}
                      onChange={(e) => setHorometroInicio(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Horómetro Fin */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                      Horómetro Final
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={horometroFin}
                      onChange={(e) => setHorometroFin(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Horas Calculadas (Readonly) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-400 uppercase mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horas Trabajadas
                    </label>
                    <div className="px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs font-bold text-center">
                      {horasTrabajadasCalculadas} hrs
                    </div>
                  </div>

                  {/* Litros Diesel */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1 flex items-center gap-1">
                      <Fuel className="w-3 h-3 text-amber-400" /> Diésel (Litros)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={litrosDiesel}
                      onChange={(e) => setLitrosDiesel(e.target.value)}
                      placeholder="ej. 140"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECCIÓN 5: NOTAS Y OBSERVACIONES */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-2">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Notas Adicionales / Observaciones de Campo
          </label>
          <textarea
            rows="2"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Detalles sobre el estado del terreno, condiciones climáticas, etc."
            className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none resize-none"
          />
        </div>

        {/* BOTÓN DE GUARDADO / SINCRONIZACIÓN */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 rounded-xl font-bold text-sm transition shadow-2xl flex items-center justify-center gap-2 ${
            esSinActividad
              ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-amber-950/60'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
          }`}
        >
          <Save className="w-5 h-5" />
          <span>
            {isSubmitting
              ? 'Guardando...'
              : esSinActividad
              ? 'Guardar Reporte de Paro (Sin Actividad)'
              : offlineSimulated
              ? 'Guardar en Cola Offline (IndexedDB)'
              : 'Guardar y Sincronizar Reporte'}
          </span>
        </button>
      </form>
    </div>
  );
}
