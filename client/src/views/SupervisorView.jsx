import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  PackageX,
  Tractor,
  TrendingUp,
  Plus,
  Wrench,
  Layers,
  Calendar,
  RefreshCw,
  FolderPlus,
  Flag,
  CheckSquare,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  User,
  Building,
  MapPin,
  Sparkles,
  Camera,
  Image as ImageIcon
} from 'lucide-react';

export default function SupervisorView() {
  const [activeTab, setActiveTab] = useState('tablero'); // 'tablero' | 'proyectos' | 'reportes'
  const [stats, setStats] = useState(null);
  const [proyectosList, setProyectosList] = useState([]);
  const [prediosList, setPrediosList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [reportesList, setReportesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Visor de Foto Ampliada
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  // Estados de expansión de proyectos e hitos
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedHitos, setExpandedHitos] = useState({});

  // Modal Cierre de Incidencia
  const [selectedIssueToClose, setSelectedIssueToClose] = useState(null);
  const [causaRaizInput, setCausaRaizInput] = useState('');
  const [isClosingIssue, setIsClosingIssue] = useState(false);
  const [closeError, setCloseError] = useState(null);

  // Modal Nuevo/Editar Proyecto
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [projectForm, setProjectForm] = useState({
    nombre: '',
    tipo: 'Granos',
    ciclo: 'PV 2026',
    superficie_meta_ha: 100,
    fase_catalogo: 'Habilitación y Siembra',
    gerente_id: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: ''
  });

  // Modal Nuevo/Editar Hito
  const [showHitoModal, setShowHitoModal] = useState(false);
  const [selectedProjectForHito, setSelectedProjectForHito] = useState(null);
  const [editingHito, setEditingHito] = useState(null);
  const [hitoForm, setHitoForm] = useState({
    nombre: '',
    descripcion: '',
    orden: 1,
    fecha_meta: '',
    superficie_meta_ha: 50,
    estado: 'pendiente'
  });

  // Modal Nueva/Editar Tarea
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedHitoForTask, setSelectedHitoForTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    proyecto_id: '',
    hito_id: '',
    predio_id: '',
    nombre: '',
    actividad_id: 'subsoleo',
    unidad: 'ha',
    cantidad_meta: 50,
    cantidad_acumulada: 0,
    estado: 'en_progreso',
    responsable: ''
  });

  // Modal Nueva Obra/Frente
  const [showObraModal, setShowObraModal] = useState(false);
  const [selectedProjectForObra, setSelectedProjectForObra] = useState(null);
  const [obraForm, setObraForm] = useState({
    nombre: '',
    fase_actual: 'Operación',
    estado: 'operacion',
    predio_id: ''
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, projData, predData, repData] = await Promise.all([
        api.get('/stats/supervisor'),
        api.get('/projects'),
        api.get('/projects/predios'),
        api.get('/reports?limit=50')
      ]);

      setStats(statsData);
      setProyectosList(projData.projects || []);
      setPrediosList(predData.predios || []);
      setReportesList(repData.reports || []);

      // Auto-expandir el primer proyecto
      if (projData.projects?.length > 0) {
        const firstProjId = projData.projects[0].id;
        setExpandedProjects(prev => ({ ...prev, [firstProjId]: true }));
        if (projData.projects[0].hitos?.length > 0) {
          const firstHitoId = projData.projects[0].hitos[0].id;
          setExpandedHitos(prev => ({ ...prev, [firstHitoId]: true }));
        }
      }
    } catch (err) {
      console.error('Error al cargar datos del supervisor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers para colapsar/expandir
  const toggleProjectExpand = (projId) => {
    setExpandedProjects(prev => ({ ...prev, [projId]: !prev[projId] }));
  };

  const toggleHitoExpand = (hitoId) => {
    setExpandedHitos(prev => ({ ...prev, [hitoId]: !prev[hitoId] }));
  };

  // --- CRUD PROYECTOS ---
  const handleOpenProjectModal = (proj = null) => {
    if (proj) {
      setEditingProject(proj);
      setProjectForm({
        nombre: proj.nombre,
        tipo: proj.tipo,
        ciclo: proj.ciclo,
        superficie_meta_ha: proj.superficie_meta_ha,
        fase_catalogo: proj.fase_catalogo || 'Operación',
        gerente_id: proj.gerente_id || '',
        fecha_inicio: proj.fecha_inicio || '',
        fecha_fin: proj.fecha_fin || ''
      });
    } else {
      setEditingProject(null);
      setProjectForm({
        nombre: '',
        tipo: 'Granos',
        ciclo: 'PV 2026',
        superficie_meta_ha: 100,
        fase_catalogo: 'Habilitación y Siembra',
        gerente_id: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: ''
      });
    }
    setShowProjectModal(true);
  };

  const handleSaveProject = async (e) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await api.patch(`/projects/${editingProject.id}`, projectForm);
      } else {
        await api.post('/projects', projectForm);
      }
      setShowProjectModal(false);
      await loadData();
    } catch (err) {
      alert('Error al guardar proyecto: ' + err.message);
    }
  };

  const handleDeleteProject = async (projId, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el proyecto "${nombre}" con todos sus hitos y tareas?`)) return;
    try {
      await api.delete(`/projects/${projId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar proyecto: ' + err.message);
    }
  };

  // --- CRUD HITOS ---
  const handleOpenHitoModal = (proj, hito = null) => {
    setSelectedProjectForHito(proj);
    if (hito) {
      setEditingHito(hito);
      setHitoForm({
        nombre: hito.nombre,
        descripcion: hito.descripcion || '',
        orden: hito.orden,
        fecha_meta: hito.fecha_meta || '',
        superficie_meta_ha: hito.superficie_meta_ha,
        estado: hito.estado
      });
    } else {
      setEditingHito(null);
      const nextOrder = (proj.hitos?.length || 0) + 1;
      setHitoForm({
        nombre: '',
        descripcion: '',
        orden: nextOrder,
        fecha_meta: '',
        superficie_meta_ha: 50,
        estado: 'pendiente'
      });
    }
    setShowHitoModal(true);
  };

  const handleSaveHito = async (e) => {
    e.preventDefault();
    try {
      if (editingHito) {
        await api.patch(`/projects/hitos/${editingHito.id}`, hitoForm);
      } else {
        await api.post(`/projects/${selectedProjectForHito.id}/hitos`, hitoForm);
      }
      setShowHitoModal(false);
      await loadData();
    } catch (err) {
      alert('Error al guardar hito: ' + err.message);
    }
  };

  const handleDeleteHito = async (hitoId, nombre) => {
    if (!window.confirm(`¿Eliminar el hito "${nombre}" y sus tareas?`)) return;
    try {
      await api.delete(`/projects/hitos/${hitoId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar hito: ' + err.message);
    }
  };

  // --- CRUD TAREAS ---
  const handleOpenTaskModal = (proj, hito, tarea = null) => {
    setSelectedHitoForTask(hito);
    if (tarea) {
      setEditingTask(tarea);
      setTaskForm({
        proyecto_id: proj.id,
        hito_id: hito.id,
        predio_id: tarea.predio_id || '',
        nombre: tarea.nombre,
        actividad_id: tarea.actividad_id,
        unidad: tarea.unidad,
        cantidad_meta: tarea.cantidad_meta,
        cantidad_acumulada: tarea.cantidad_acumulada,
        estado: tarea.estado,
        responsable: tarea.responsable || ''
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        proyecto_id: proj.id,
        hito_id: hito.id,
        predio_id: prediosList[0]?.id ? String(prediosList[0].id) : '',
        nombre: '',
        actividad_id: 'subsoleo',
        unidad: 'ha',
        cantidad_meta: 40,
        cantidad_acumulada: 0,
        estado: 'en_progreso',
        responsable: 'Juan Pérez'
      });
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await api.patch(`/projects/tareas/${editingTask.id}`, taskForm);
      } else {
        await api.post('/projects/tareas', taskForm);
      }
      setShowTaskModal(false);
      await loadData();
    } catch (err) {
      alert('Error al guardar tarea: ' + err.message);
    }
  };

  const handleDeleteTask = async (taskId, nombre) => {
    if (!window.confirm(`¿Eliminar la tarea "${nombre}"?`)) return;
    try {
      await api.delete(`/projects/tareas/${taskId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar tarea: ' + err.message);
    }
  };

  const handleToggleTaskStatus = async (task) => {
    const statusCycle = {
      pendiente: 'en_progreso',
      en_progreso: 'completada',
      completada: 'detenida',
      detenida: 'pendiente'
    };
    const nextStatus = statusCycle[task.estado] || 'en_progreso';
    try {
      await api.patch(`/projects/tareas/${task.id}`, { estado: nextStatus });
      await loadData();
    } catch (err) {
      alert('Error al cambiar estatus: ' + err.message);
    }
  };

  // --- CRUD OBRAS/FRENTES ---
  const handleOpenObraModal = (proj) => {
    setSelectedProjectForObra(proj);
    setObraForm({
      nombre: `Frente ${proj.nombre} - Lote ${proj.obras?.length + 1 || 1}`,
      fase_actual: 'Habilitación',
      estado: 'operacion',
      predio_id: prediosList[0]?.id ? String(prediosList[0].id) : ''
    });
    setShowObraModal(true);
  };

  const handleSaveObra = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/projects/${selectedProjectForObra.id}/obras`, obraForm);
      setShowObraModal(false);
      await loadData();
    } catch (err) {
      alert('Error al crear frente de obra: ' + err.message);
    }
  };

  // --- CIERRE DE INCIDENCIA ---
  const handleCloseIssueSubmit = async (e) => {
    e.preventDefault();
    setCloseError(null);

    if (!causaRaizInput || causaRaizInput.trim().length < 10) {
      setCloseError('La causa raíz debe contener al menos 10 caracteres explicativos.');
      return;
    }

    setIsClosingIssue(true);
    try {
      await api.post(`/issues/${selectedIssueToClose.id}/close`, {
        causa_raiz: causaRaizInput.trim()
      });
      setSelectedIssueToClose(null);
      setCausaRaizInput('');
      await loadData();
    } catch (err) {
      setCloseError(err.message || 'Error al cerrar la incidencia.');
    } finally {
      setIsClosingIssue(false);
    }
  };

  // --- SERVICIO MAQUINARIA ---
  const handleMachineService = async (machineId, codigo) => {
    if (!window.confirm(`¿Confirmar servicio preventivo de 300 hrs para ${codigo}? Resetea el horómetro de referencia.`)) {
      return;
    }
    try {
      await api.post(`/machines/${machineId}/service`);
      await loadData();
    } catch (err) {
      alert('Error al registrar servicio: ' + err.message);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
          <p className="text-xs text-slate-600 dark:text-slate-400">Cargando Centro de Control del Supervisor...</p>
        </div>
      </div>
    );
  }

  const { widgets, maquinaria = [] } = stats || {};
  const {
    obras_sin_reporte_hoy = [],
    avance_contra_meta = [],
    incidencias_abiertas = [],
    bloqueado_por_material = []
  } = widgets || {};

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      {/* Header y Selector de Sub-Pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2ebd3] dark:border-[#253905] pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-400" /> Panel de Supervisión Operativa & Gestión
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-600 dark:text-slate-400 mt-1 font-medium">
            Monitoreo en tiempo real, administración de proyectos, hitos, tareas y parque de maquinaria
          </p>
        </div>

        {/* Switcher de Sub-Pestaña */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#152202] p-1 rounded-xl border border-[#e2ebd3] dark:border-[#253905]">
          <button
            type="button"
            onClick={() => setActiveTab('tablero')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'tablero'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>4 Widgets Canónicos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('proyectos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'proyectos'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Gestor de Proyectos & Hitos</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/50">
              {proyectosList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reportes')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'reportes'
                ? 'bg-[#a87d13] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Bitácora & Evidencias</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#362409] text-[#dfb75c] border border-[#a87d13]/50">
              {reportesList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-white transition"
            title="Refrescar datos"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: GESTOR DE PROYECTOS, HITOS Y TAREAS (WBS / EDT)                  */}
      {/* ========================================================================= */}
      {activeTab === 'proyectos' && (
        <div className="space-y-6">
          {/* Barra de Acción Superior */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-md">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Estructura de Proyectos Agrícolas
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Define proyectos, crea frentes de obra, calendariza hitos y asigna metas y responsables
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenProjectModal()}
              className="px-4 py-2 rounded-lg bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-950/60 self-start sm:self-auto"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Nuevo Proyecto</span>
            </button>
          </div>

          {/* Lista de Proyectos Expandibles */}
          <div className="space-y-4">
            {proyectosList.map((p) => {
              const isExpanded = !!expandedProjects[p.id];
              const totalHitos = p.hitos?.length || 0;
              const totalTareas = p.hitos?.reduce((acc, h) => acc + (h.tareas?.length || 0), 0) || 0;
              const totalAcumuladoHa = p.hitos?.reduce((acc, h) =>
                acc + (h.tareas?.reduce((tAcc, t) => tAcc + (t.cantidad_acumulada || 0), 0) || 0), 0) || 0;
              const progresoPct = p.superficie_meta_ha > 0
                ? Math.min(100, Math.round((totalAcumuladoHa / p.superficie_meta_ha) * 100))
                : 0;

              return (
                <div key={p.id} className="rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl overflow-hidden">
                  {/* Tarjeta de Encabezado de Proyecto */}
                  <div className="p-4 sm:p-5 bg-white dark:bg-[#152202] hover:bg-slate-850 transition">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Título & Meta */}
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => toggleProjectExpand(p.id)}
                          className="mt-1 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900 dark:text-white">{p.nombre}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700">
                              {p.tipo} • {p.ciclo}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                              {p.fase_catalogo}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                            <span>Gerente: <strong className="text-slate-900 dark:text-slate-100">{p.gerente_nombre || 'No asignado'}</strong></span>
                            <span>•</span>
                            <span>Inicio: {p.fecha_inicio || 'Sin fecha'}</span>
                            {p.fecha_fin && <span>Fin: {p.fecha_fin}</span>}
                          </p>
                        </div>
                      </div>

                      {/* Progreso y Botones de Acción */}
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="w-40 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400 font-medium">Avance Total:</span>
                            <span className="text-emerald-400 font-bold">{totalAcumuladoHa}/{p.superficie_meta_ha} ha ({progresoPct}%)</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${progresoPct}%` }} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenHitoModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-600/40 text-xs font-semibold flex items-center gap-1"
                            title="Agregar Hito"
                          >
                            <Flag className="w-3.5 h-3.5 text-blue-400" />
                            <span>+ Hito</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenObraModal(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-600/40 text-xs font-semibold flex items-center gap-1"
                            title="Agregar Frente/Obra"
                          >
                            <Building className="w-3.5 h-3.5 text-purple-400" />
                            <span>+ Frente</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenProjectModal(p)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                            title="Editar Proyecto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProject(p.id, p.nombre)}
                            className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 transition"
                            title="Eliminar Proyecto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Frentes / Obras Asociadas */}
                    {p.obras?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#e2ebd3] dark:border-[#253905]/60 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Frentes de Obra:</span>
                        {p.obras.map(o => (
                          <span key={o.id} className="px-2 py-0.5 rounded text-[11px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                            {o.nombre} ({o.fase_actual})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* HITOS DEL PROYECTO (Desplegable) */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-t border-[#e2ebd3] dark:border-[#253905] space-y-4">
                      {p.hitos?.length > 0 ? (
                        p.hitos.map((h) => {
                          const isHitoExp = !!expandedHitos[h.id];
                          const hitoTareas = h.tareas || [];
                          const hitoAcumHa = hitoTareas.reduce((acc, t) => acc + (t.cantidad_acumulada || 0), 0);
                          const hitoPct = h.superficie_meta_ha > 0 ? Math.min(100, Math.round((hitoAcumHa / h.superficie_meta_ha) * 100)) : 0;

                          const statusColors = {
                            pendiente: 'bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
                            en_proceso: 'bg-blue-950 text-blue-300 border-blue-700',
                            completado: 'bg-emerald-950 text-emerald-300 border-emerald-700',
                            bloqueado: 'bg-rose-950 text-rose-300 border-rose-700'
                          };

                          return (
                            <div key={h.id} className="rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905]/90 overflow-hidden">
                              {/* Fila del Hito */}
                              <div className="p-3.5 bg-white dark:bg-[#152202] flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleHitoExpand(h.id)}
                                    className="p-1 rounded bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white"
                                  >
                                    {isHitoExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  </button>
                                  <div className="w-6 h-6 rounded-full bg-blue-950 text-blue-400 border border-blue-600/40 flex items-center justify-center font-bold text-xs">
                                    {h.orden}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="text-sm font-bold text-white">{h.nombre}</h5>
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusColors[h.estado] || statusColors.pendiente}`}>
                                        {h.estado.replace('_', ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                                      {h.descripcion || 'Sin descripción'} • Meta: <strong>{h.superficie_meta_ha} ha</strong> {h.fecha_meta && `• Fecha Meta: ${h.fecha_meta}`}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 self-end md:self-auto">
                                  <div className="w-32 hidden sm:block">
                                    <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 mb-0.5">
                                      <span>Progreso:</span>
                                      <span className="font-bold text-emerald-400">{hitoPct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-800 rounded-full h-1.5">
                                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${hitoPct}%` }} />
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenTaskModal(p, h)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/40 text-xs font-semibold flex items-center gap-1"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>+ Tarea</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenHitoModal(p, h)}
                                    className="p-1 rounded bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white"
                                    title="Editar Hito"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteHito(h.id, h.nombre)}
                                    className="p-1 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40"
                                    title="Eliminar Hito"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              {/* TAREAS DENTRO DEL HITO */}
                              {isHitoExp && (
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-[#e2ebd3] dark:border-[#253905]/80">
                                  {hitoTareas.length > 0 ? (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                                        <thead className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-[#e2ebd3] dark:border-[#253905]">
                                          <tr>
                                            <th className="py-2 px-3">Tarea / Actividad</th>
                                            <th className="py-2 px-3">Predio</th>
                                            <th className="py-2 px-3">Responsable</th>
                                            <th className="py-2 px-3 text-right">Meta vs Acumulado</th>
                                            <th className="py-2 px-3 text-center">Estado (Clic para alternar)</th>
                                            <th className="py-2 px-3 text-right">Acciones</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/60">
                                          {hitoTareas.map((t) => {
                                            const tPct = t.cantidad_meta > 0 ? Math.min(100, Math.round((t.cantidad_acumulada / t.cantidad_meta) * 100)) : 0;
                                            const taskStatusColors = {
                                              pendiente: 'bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
                                              en_progreso: 'bg-blue-950 text-blue-300 border-blue-700',
                                              completada: 'bg-emerald-950 text-emerald-300 border-emerald-700 font-bold',
                                              detenida: 'bg-amber-950 text-amber-300 border-amber-700'
                                            };

                                            return (
                                              <tr key={t.id} className="hover:bg-slate-900/60">
                                                <td className="py-2.5 px-3">
                                                  <span className="font-semibold text-white">{t.nombre}</span>
                                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 font-mono">[{t.actividad_id}]</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                                                  {t.predio_nombre || 'General'}
                                                </td>
                                                <td className="py-2.5 px-3">
                                                  <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                                                    <User className="w-3 h-3 text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400" /> {t.responsable || 'Sin asignar'}
                                                  </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-mono">
                                                  <span className="text-emerald-400 font-bold">{t.cantidad_acumulada}</span>
                                                  <span className="text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400"> / {t.cantidad_meta} {t.unidad} ({tPct}%)</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                  <button
                                                    type="button"
                                                    onClick={() => handleToggleTaskStatus(t)}
                                                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border transition ${taskStatusColors[t.estado] || taskStatusColors.pendiente}`}
                                                    title="Haz clic para cambiar el estado de la tarea"
                                                  >
                                                    {t.estado.replace('_', ' ')}
                                                  </button>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="flex items-center justify-end gap-1">
                                                    <button
                                                      type="button"
                                                      onClick={() => handleOpenTaskModal(p, h, t)}
                                                      className="p-1 rounded bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white"
                                                      title="Editar Tarea"
                                                    >
                                                      <Edit2 className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleDeleteTask(t.id, t.nombre)}
                                                      className="p-1 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40"
                                                      title="Eliminar Tarea"
                                                    >
                                                      <Trash2 className="w-3 h-3" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">
                                      No hay tareas configuradas en este hito.{' '}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenTaskModal(p, h)}
                                        className="text-emerald-400 font-semibold underline ml-1"
                                      >
                                        Crear la primera tarea
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">
                          Este proyecto aún no tiene hitos definidos.{' '}
                          <button
                            type="button"
                            onClick={() => handleOpenHitoModal(p)}
                            className="text-blue-400 font-semibold underline ml-1"
                          >
                            Agregar Hito 1
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: 4 WIDGETS CANÓNICOS & MONITOR DE HORÓMETROS (TABLERO)             */}
      {/* ========================================================================= */}
      {activeTab === 'tablero' && (
        <div className="space-y-6">
          {/* KPI CARDS RESUMEN */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Obras Sin Reporte Hoy"
              value={obras_sin_reporte_hoy.length}
              subtitle="Frentes activos pendientes"
              icon={Clock}
              color={obras_sin_reporte_hoy.length > 0 ? 'amber' : 'emerald'}
              alert={obras_sin_reporte_hoy.length > 0}
            />
            <StatCard
              title="Incidencias Abiertas"
              value={incidencias_abiertas.length}
              subtitle="Folios activos en campo"
              icon={AlertTriangle}
              color={incidencias_abiertas.length > 0 ? 'rose' : 'emerald'}
              alert={incidencias_abiertas.length > 0}
            />
            <StatCard
              title="Materiales Bloqueados"
              value={bloqueado_por_material.length}
              subtitle="Insumos con déficit"
              icon={PackageX}
              color={bloqueado_por_material.length > 0 ? 'amber' : 'blue'}
            />
            <StatCard
              title="Parque de Maquinaria"
              value={maquinaria.length}
              subtitle={`${maquinaria.filter(m => m.alerta_activa).length} en alerta preventiva`}
              icon={Tractor}
              color={maquinaria.some(m => m.alerta_activa) ? 'rose' : 'emerald'}
              alert={maquinaria.some(m => m.alerta_activa)}
            />
          </div>

          {/* 4 WIDGETS CANÓNICOS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* WIDGET 1: Obras Sin Reporte Hoy */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">1. Obras Sin Reporte Hoy</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Frentes en operación sin registro en la fecha actual</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200">
                  {obras_sin_reporte_hoy.length} pendientes
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
                {obras_sin_reporte_hoy.length > 0 ? (
                  obras_sin_reporte_hoy.map((o) => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{o.nombre}</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-600 dark:text-slate-400">{o.proyecto_nombre} • Fase: {o.fase_actual}</p>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200">
                          {o.dias_atraso} {o.dias_atraso === 1 ? 'día' : 'días'} de retraso
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 mt-0.5">Último: {o.ultimo_reporte_fecha}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Todos los frentes en operación han reportado el día de hoy.</span>
                  </div>
                )}
              </div>
            </div>

            {/* WIDGET 2: Avance Contra Meta (Campo vs Dron vs Meta) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-blue-950 text-emerald-700 dark:text-blue-400 border border-emerald-200">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">2. Avance Contra Meta & Validación Dron</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Comparativa Hectáreas Campo vs Medición Dron vs Meta</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {avance_contra_meta.map((p) => (
                  <div key={p.proyecto_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-[#e2ebd3] dark:border-[#253905]/80 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{p.proyecto_nombre}</span>
                      <span className="text-slate-600 dark:text-slate-600 dark:text-slate-400 font-bold">Meta: {p.meta_ha} ha</span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-700 dark:text-slate-700 dark:text-slate-300 font-medium">
                        <span>🚜 Reportado Campo:</span>
                        <span className="font-bold text-emerald-400">{p.campo_ha} ha ({p.porcentaje_campo}%)</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${p.porcentaje_campo}%` }} />
                      </div>

                      {p.dron_ha !== null ? (
                        <>
                          <div className="flex items-center justify-between text-slate-700 dark:text-slate-700 dark:text-slate-300 font-medium pt-1">
                            <span>🛰️ Medición Dron:</span>
                            <span className="font-bold text-sky-400">{p.dron_ha} ha ({p.porcentaje_dron}%)</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div className="bg-sky-400 h-1.5 rounded-full" style={{ width: `${p.porcentaje_dron}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-600 dark:text-slate-400 pt-0.5">
                            <span>Discrepancia: {Math.abs(p.discrepancia_ha)} ha</span>
                            <span className={p.discrepancia_ha > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                              {p.discrepancia_ha > 0 ? `+${p.discrepancia_ha} ha sobredeclarada` : 'Alineado con ortofoto'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 italic pt-1">Sin vuelo de validación dron reciente</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* WIDGET 3: Incidencias Abiertas */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">3. Incidencias Abiertas</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Folios activos con resolución y validación de causa raíz</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200">
                  {incidencias_abiertas.length} activas
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
                {incidencias_abiertas.length > 0 ? (
                  incidencias_abiertas.map((inc) => (
                    <div key={inc.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-400">{inc.folio}</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] uppercase font-semibold bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inc.estado}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 line-clamp-1">{inc.tipo}</p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-600 dark:text-slate-400">{inc.obra_nombre}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIssueToClose(inc);
                          setCausaRaizInput('');
                          setCloseError(null);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold transition shadow-sm flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cerrar</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span>No hay incidencias abiertas en los frentes de obra.</span>
                  </div>
                )}
              </div>
            </div>

            {/* WIDGET 4: Bloqueado por Material */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200">
                    <PackageX className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">4. Bloqueado por Material</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">Insumos donde requerido - en_sitio &gt; 0 con ETA</p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200">
                  {bloqueado_por_material.length} con déficit
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto pr-1">
                {bloqueado_por_material.length > 0 ? (
                  bloqueado_por_material.map((mat) => (
                    <div key={mat.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{mat.nombre}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400">
                          {mat.obra_nombre} • En Sitio: {mat.en_sitio}/{mat.requerido} {mat.unidad}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-amber-400">
                          Faltan {mat.deficit} {mat.unidad}
                        </span>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-500 dark:text-slate-400 dark:text-slate-600 dark:text-slate-400" />
                          <span className={`text-[10px] font-semibold ${mat.eta_vencido ? 'text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-400'}`}>
                            ETA: {mat.eta || 'Sin fecha'} {mat.eta_vencido ? '⚠️ ATRASADO' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-emerald-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Todos los materiales requeridos se encuentran al 100% en sitio.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MONITOR DE MAQUINARIA & HORÓMETROS */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-[#2c4001] dark:text-[#a1c62e] border border-emerald-200">
                  <Tractor className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">Monitor de Maquinaria y Alertas Preventivas</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Regla preventiva: Alerta activa cuando horas desde último servicio ≥ 280 hrs (≤ 20 hrs para las 300 hrs)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {maquinaria.map((maq) => {
                const isAlert = maq.alerta_activa || maq.alerta_mantenimiento === 1;
                return (
                  <div
                    key={maq.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isAlert
                        ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-600/50 shadow-sm'
                        : 'bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{maq.codigo}</span>
                          {isAlert ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-900 text-rose-200 border border-rose-600 animate-pulse">
                              🚨 SERVICIO REQUERIDO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700">
                              ÓPTIMO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{maq.modelo}</p>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span>Horómetro Actual:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{maq.horometro_actual} hrs</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Último Servicio:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-700 dark:text-slate-300">{maq.ultimo_servicio_hr} hrs</span>
                      </div>
                      <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                        <span>Uso Desde Servicio:</span>
                        <span className={isAlert ? 'text-rose-400 font-bold' : 'text-slate-900 dark:text-slate-100'}>
                          {maq.horas_desde_servicio} hrs / 300 hrs
                        </span>
                      </div>
                    </div>

                    {isAlert && (
                      <div className="mt-3 p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700/60 text-xs font-bold text-rose-900 dark:text-rose-200">
                        ⚠️ Faltan solo <strong>{maq.horas_restantes} hrs</strong> para alcanzar el límite de 300 hrs. Programar mantenimiento.
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-[#e2ebd3] dark:border-[#253905] flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleMachineService(maq.id, maq.codigo)}
                        className="px-3.5 py-2 rounded-xl bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                      >
                        <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Registrar Servicio 300h</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: BITÁCORA DE REPORTES & EVIDENCIAS FOTOGRÁFICAS                   */}
      {/* ========================================================================= */}
      {activeTab === 'reportes' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-md">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#a87d13]" /> Bitácora Oficial de Campo con Evidencias Fotográficas
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Historial cronológico de reportes con fotos de avance, maquinaria y labores agrícolas
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="px-3.5 py-2 rounded-xl bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar Bitácora</span>
            </button>
          </div>

          {reportesList.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] text-slate-500 dark:text-slate-400 space-y-2">
              <Camera className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-sm font-bold">No hay reportes registrados en la bitácora.</p>
              <p className="text-xs">Los reportes enviados desde la vista de Campo aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {reportesList.map((rep) => {
                const repFotos = rep.fotos || [];
                const repLineas = rep.lineas || [];
                const repMaq = rep.maquinaria || [];

                return (
                  <div
                    key={rep.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm space-y-4 transition hover:border-[#a1c62e]/60"
                  >
                    {/* Header del reporte */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#2c4001] dark:text-[#a1c62e] bg-[#f4f8ed] dark:bg-[#1f3004] px-2 py-0.5 rounded border border-[#d3e2be] dark:border-[#3e5606]">
                            Folio: {rep.client_uuid ? rep.client_uuid.substring(0, 13) + '...' : `REP-${rep.id}`}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {rep.obra_nombre || 'Frente General'}
                          </span>
                          {rep.proyecto_nombre && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              ({rep.proyecto_nombre})
                            </span>
                          )}
                          {rep.es_sin_actividad ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              🌧️ PARO OPERATIVO
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              ✅ EFECTUADO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                          <span>Fecha: <strong className="text-slate-800 dark:text-slate-200">{rep.fecha_operativa}</strong></span>
                          {rep.hora_offline && (
                            <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-300 dark:border-amber-700/60 flex items-center gap-1">
                              ⏰ Captura Offline: <strong>{rep.hora_offline} hrs</strong>
                            </span>
                          )}
                          <span>· Por: <strong className="text-slate-800 dark:text-slate-200">{rep.autor_nombre}</strong></span>
                        </p>
                      </div>

                      {repFotos.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#a87d13] bg-[#fdfaf3] dark:bg-[#362409] px-2.5 py-1 rounded-xl border border-[#f3e3ba] dark:border-[#704f15] self-start sm:self-auto">
                          <Camera className="w-3.5 h-3.5" />
                          <span>{repFotos.length} foto(s)</span>
                        </div>
                      )}
                    </div>

                    {/* Resumen de labor, avance y notas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-[#e2ebd3] dark:border-[#253905] space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                          Avance & Actividad
                        </p>
                        {rep.es_sin_actividad ? (
                          <p className="text-amber-700 dark:text-amber-400 font-medium">
                            Motivo de paro: {rep.motivo_sin_actividad || 'Lluvia / Condiciones climáticas'}
                          </p>
                        ) : repLineas.length > 0 ? (
                          repLineas.map((l, idx) => (
                            <p key={idx} className="text-slate-900 dark:text-white font-medium">
                              • <strong className="text-emerald-600 dark:text-emerald-400">{l.cantidad_ha || l.cantidad} {l.unidad || 'ha'}</strong> ({l.actividad_id})
                            </p>
                          ))
                        ) : (
                          <p className="text-slate-500 italic">Sin líneas cuantitativas registradas</p>
                        )}
                        {rep.nota && (
                          <p className="text-slate-600 dark:text-slate-400 pt-1 text-[11px] border-t border-slate-200 dark:border-slate-800">
                            <strong>Nota:</strong> {rep.nota}
                          </p>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-[#e2ebd3] dark:border-[#253905] space-y-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                          Maquinaria & Recursos
                        </p>
                        {repMaq.length > 0 ? (
                          repMaq.map((m, idx) => (
                            <p key={idx} className="text-slate-900 dark:text-white font-medium">
                              🚜 <strong>{m.maquina_codigo || 'Equipo'}:</strong> {m.horas_trabajadas} hrs ({m.litros_diesel} L diésel)
                            </p>
                          ))
                        ) : (
                          <p className="text-slate-500 italic">No se utilizó maquinaria en este turno</p>
                        )}
                      </div>
                    </div>

                    {/* Galería de Fotos */}
                    {repFotos.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-[#e2ebd3] dark:border-[#253905]/60">
                        <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" /> Evidencias Fotográficas Adjuntas
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                          {repFotos.map((foto, fIdx) => (
                            <button
                              key={foto.id || fIdx}
                              type="button"
                              onClick={() => setActivePhotoModal(foto)}
                              className="group relative rounded-xl overflow-hidden aspect-video border border-[#e2ebd3] dark:border-[#253905] bg-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-[#a1c62e]"
                            >
                              <img
                                src={foto.url}
                                alt={foto.descripcion || `Evidencia ${fIdx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded">
                                  Ver ampliada
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISOR DE FOTO LIGHTBOX                                             */}
      {/* ========================================================================= */}
      {activePhotoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4">
          <div className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setActivePhotoModal(null)}
              className="absolute -top-10 right-0 text-white hover:text-rose-400 font-bold text-xl px-2 py-1 bg-black/40 rounded-lg transition"
            >
              ✕ Cerrar
            </button>
            <img
              src={activePhotoModal.url}
              alt="Evidencia fotográfica ampliada"
              className="max-h-[75vh] w-auto object-contain rounded-2xl border border-white/20 shadow-2xl"
            />
            {activePhotoModal.descripcion && (
              <p className="mt-3 text-white text-xs text-center bg-black/60 px-4 py-1.5 rounded-xl border border-white/10">
                {activePhotoModal.descripcion}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALES: CREACIÓN Y EDICIÓN                                               */}
      {/* ========================================================================= */}

      {/* MODAL 1: PROYECTO */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-400" />
                {editingProject ? 'Editar Proyecto Agrícola' : 'Nuevo Proyecto Agrícola'}
              </h3>
              <button type="button" onClick={() => setShowProjectModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Proyecto</label>
                <input
                  type="text"
                  required
                  value={projectForm.nombre}
                  onChange={(e) => setProjectForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Proyecto Maíz de Temporal 2026"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Tipo de Cultivo</label>
                  <input
                    type="text"
                    required
                    value={projectForm.tipo}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, tipo: e.target.value }))}
                    placeholder="ej. Granos, Frutales, Hortalizas"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ciclo Agrícola</label>
                  <input
                    type="text"
                    required
                    value={projectForm.ciclo}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, ciclo: e.target.value }))}
                    placeholder="ej. PV 2026, OI 2026-2027"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Superficie Meta (Hectáreas)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={projectForm.superficie_meta_ha}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, superficie_meta_ha: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fase Catálogo</label>
                  <input
                    type="text"
                    value={projectForm.fase_catalogo}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, fase_catalogo: e.target.value }))}
                    placeholder="ej. Habilitación y Siembra"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha Inicio</label>
                  <input
                    type="date"
                    value={projectForm.fecha_inicio}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha Fin Meta</label>
                  <input
                    type="date"
                    value={projectForm.fecha_fin}
                    onChange={(e) => setProjectForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold shadow-md shadow-emerald-950/50"
                >
                  {editingProject ? 'Actualizar Proyecto' : 'Crear Proyecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: HITO */}
      {showHitoModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-blue-400" />
                {editingHito ? 'Editar Hito' : `Nuevo Hito: ${selectedProjectForHito?.nombre}`}
              </h3>
              <button type="button" onClick={() => setShowHitoModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveHito} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Hito</label>
                <input
                  type="text"
                  required
                  value={hitoForm.nombre}
                  onChange={(e) => setHitoForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Hito 1: Desmonte y Subsoleo Profundo"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción / Alcance</label>
                <textarea
                  rows="2"
                  value={hitoForm.descripcion}
                  onChange={(e) => setHitoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalles de la fase técnica..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nº Orden</label>
                  <input
                    type="number"
                    min="1"
                    value={hitoForm.orden}
                    onChange={(e) => setHitoForm(prev => ({ ...prev, orden: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Superficie Meta (ha)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={hitoForm.superficie_meta_ha}
                    onChange={(e) => setHitoForm(prev => ({ ...prev, superficie_meta_ha: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <select
                    value={hitoForm.estado}
                    onChange={(e) => setHitoForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_proceso">En Proceso</option>
                    <option value="completado">Completado</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fecha Meta</label>
                <input
                  type="date"
                  value={hitoForm.fecha_meta}
                  onChange={(e) => setHitoForm(prev => ({ ...prev, fecha_meta: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowHitoModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-950/50"
                >
                  {editingHito ? 'Guardar Cambios' : 'Crear Hito'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TAREA */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-400" />
                {editingTask ? 'Editar Tarea' : `Nueva Tarea en Hito: ${selectedHitoForTask?.nombre}`}
              </h3>
              <button type="button" onClick={() => setShowTaskModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre de la Tarea</label>
                <input
                  type="text"
                  required
                  value={taskForm.nombre}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Rastreo Cruzado Doble Paso"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Actividad ID</label>
                  <input
                    type="text"
                    value={taskForm.actividad_id}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, actividad_id: e.target.value }))}
                    placeholder="ej. rastreo, subsoleo, riego"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Predio / Lote Asignado</label>
                  <select
                    value={taskForm.predio_id}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, predio_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Sin predio asignado</option>
                    {prediosList.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.nombre} ({pr.superficie_util_ha} ha)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Cantidad Meta</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={taskForm.cantidad_meta}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, cantidad_meta: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Unidad</label>
                  <input
                    type="text"
                    value={taskForm.unidad}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, unidad: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <select
                    value={taskForm.estado}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en_progreso">En Progreso</option>
                    <option value="completada">Completada</option>
                    <option value="detenida">Detenida</option>
                  </select>
                </div>
              </div>

              {editingTask && (
                <div>
                  <label className="block text-xs font-semibold text-emerald-400 mb-1">Cantidad Acumulada Real</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={taskForm.cantidad_acumulada}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, cantidad_acumulada: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-emerald-600/50 text-emerald-300 text-xs font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Responsable en Campo</label>
                <input
                  type="text"
                  value={taskForm.responsable}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, responsable: e.target.value }))}
                  placeholder="ej. Juan Pérez / Operador"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold shadow-md shadow-emerald-950/50"
                >
                  {editingTask ? 'Actualizar Tarea' : 'Crear Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: FRENTE / OBRA */}
      {showObraModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-400" />
                Nuevo Frente de Obra: {selectedProjectForObra?.nombre}
              </h3>
              <button type="button" onClick={() => setShowObraModal(false)} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveObra} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Frente / Obra</label>
                <input
                  type="text"
                  required
                  value={obraForm.nombre}
                  onChange={(e) => setObraForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Frente Norte - Desmonte y Nivelación"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fase Actual</label>
                <input
                  type="text"
                  value={obraForm.fase_actual}
                  onChange={(e) => setObraForm(prev => ({ ...prev, fase_actual: e.target.value }))}
                  placeholder="ej. Subsoleo, Camellonado, Riego"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <select
                    value={obraForm.estado}
                    onChange={(e) => setObraForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="operacion">Operación</option>
                    <option value="prospeccion">Prospección</option>
                    <option value="habilitacion">Habilitación</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="standby">Standby</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Predio Vinculado</label>
                  <select
                    value={obraForm.predio_id}
                    onChange={(e) => setObraForm(prev => ({ ...prev, predio_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Sin predio</option>
                    {prediosList.map(pr => (
                      <option key={pr.id} value={pr.id}>{pr.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowObraModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  Crear Frente de Obra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CIERRE DE INCIDENCIA */}
      {selectedIssueToClose && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-start border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Cierre Técnico de Incidencia
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Folio: <strong className="text-rose-400 font-mono">{selectedIssueToClose.folio}</strong> — {selectedIssueToClose.obra_nombre}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssueToClose(null)}
                className="text-slate-600 dark:text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-[#e2ebd3] dark:border-[#253905] text-xs text-slate-700 dark:text-slate-300">
              <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">Descripción reportada:</p>
              <p>{selectedIssueToClose.tipo}</p>
            </div>

            {closeError && (
              <div className="p-3 rounded-lg bg-rose-950 border border-rose-600 text-rose-200 text-xs">
                {closeError}
              </div>
            )}

            <form onSubmit={handleCloseIssueSubmit} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Causa Raíz & Acción Correctiva (Obligatorio)
                  </label>
                  <span className={`text-[11px] font-mono ${causaRaizInput.trim().length >= 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {causaRaizInput.trim().length} / min 10 caracteres
                  </span>
                </div>
                <textarea
                  rows="4"
                  required
                  value={causaRaizInput}
                  onChange={(e) => setCausaRaizInput(e.target.value)}
                  placeholder="Explique detalladamente la causa raíz técnica y la reparación implementada (mínimo 10 caracteres)..."
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-white text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedIssueToClose(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isClosingIssue || causaRaizInput.trim().length < 10}
                  className="px-4 py-2 rounded-lg bg-[#2c4001] hover:bg-[#203001] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/50"
                >
                  {isClosingIssue ? 'Cerrando...' : 'Confirmar Cierre Formal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
