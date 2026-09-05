import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import GanttChart from '../components/GanttChart';
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
  Image as ImageIcon,
  LayoutGrid,
  Search,
  Filter,
  Send,
  ExternalLink,
  MoreVertical,
  X,
  Check,
  ChevronsUpDown
} from 'lucide-react';

export default function SupervisorView({ activeTab: externalActiveTab, onTabChange: externalOnTabChange, onRegisterMetadata }) {
  const [internalActiveTab, setInternalActiveTab] = useState('tablero'); // 'tablero' | 'proyectos' | 'reportes'
  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = externalOnTabChange || setInternalActiveTab;

  const [stats, setStats] = useState(null);
  const [proyectosList, setProyectosList] = useState([]);
  const [prediosList, setPrediosList] = useState([]);
  const [obrasList, setObrasList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [entidadesList, setEntidadesList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [reportesList, setReportesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal Diagrama de Gantt
  const [showGanttModal, setShowGanttModal] = useState(false);
  const [selectedGanttProject, setSelectedGanttProject] = useState('all');

  // Filtro y búsqueda en Catálogos
  const [catalogoSubTab, setCatalogoSubTab] = useState('todos'); // 'todos' | 'predios' | 'frentes' | 'maquinaria'
  const [catalogoSearch, setCatalogoSearch] = useState('');

  // Modal Maquinaria (Crear / Editar)
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState(null);
  const [machineForm, setMachineForm] = useState({
    codigo: '',
    nombre: '',
    tipo: 'tractor',
    modelo: '',
    propietaria_id: '',
    operadora_id: '',
    umbral_servicio_hrs: 300,
    horometro_actual: 0,
    ultimo_servicio_hr: 0
  });

  // Modal Visor de Foto Ampliada
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  // Estados de expansión de proyectos e hitos
  const [expandedProjects, setExpandedProjects] = useState({});
  const [expandedHitos, setExpandedHitos] = useState({});
  const [projectSearch, setProjectSearch] = useState('');
  const [projectCicloFilter, setProjectCicloFilter] = useState('todos');
  const [projectSubTabs, setProjectSubTabs] = useState({});
  const [activeProjectMenuId, setActiveProjectMenuId] = useState(null);

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

  // Modal Nueva/Editar Obra/Frente
  const [showObraModal, setShowObraModal] = useState(false);
  const [selectedProjectForObra, setSelectedProjectForObra] = useState(null);
  const [editingObra, setEditingObra] = useState(null);
  const [obraForm, setObraForm] = useState({
    nombre: '',
    proyecto_id: '',
    fase_actual: 'Operación',
    estado: 'operacion',
    tg_thread_id: '',
    predio_ids: []
  });

  // Modal Nuevo/Editar Predio
  const [showPredioModal, setShowPredioModal] = useState(false);
  const [editingPredio, setEditingPredio] = useState(null);
  const [predioForm, setPredioForm] = useState({
    nombre: '',
    superficie_legal_ha: 15,
    superficie_util_ha: 15,
    regimen: 'Propiedad Privada',
    proyecto_id: '',
    crear_frente_telegram: true
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, projData, predData, repData, machData, entData, obrasData] = await Promise.all([
        api.get('/stats/supervisor'),
        api.get('/projects'),
        api.get('/projects/predios'),
        api.get('/reports?limit=50'),
        api.get('/machines'),
        api.get('/machines/entidades'),
        api.get('/projects/obras')
      ]);

      setStats(statsData);
      const prList = projData.projects || [];
      const pdList = predData.predios || [];
      const rpList = repData.reports || [];
      const mcList = machData.machines || [];
      const etList = entData.entidades || [];
      const obList = obrasData.obras || [];
      setProyectosList(prList);
      setPrediosList(pdList);
      setReportesList(rpList);
      setMachinesList(mcList);
      setEntidadesList(etList);
      setObrasList(obList);

      if (onRegisterMetadata) {
        onRegisterMetadata({
          proyectos: prList.length,
          predios: pdList.length,
          obras: obList.length || prList.reduce((acc, p) => acc + (p.obras?.length || 0), 0),
          reportes: rpList.length,
          maquinas: mcList.length,
          reloadFn: loadData
        });
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

  const handleToggleAllProjects = () => {
    const areAllExpanded = proyectosList.length > 0 && proyectosList.every(p => expandedProjects[p.id]);
    if (areAllExpanded) {
      setExpandedProjects({});
    } else {
      const all = {};
      proyectosList.forEach(p => { all[p.id] = true; });
      setExpandedProjects(all);
    }
  };

  const setProjectSubTab = (projId, tab) => {
    setProjectSubTabs(prev => ({ ...prev, [projId]: tab }));
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
  const handleOpenObraModal = (proj = null, obra = null) => {
    setSelectedProjectForObra(proj || (obra?.proyecto_id ? proyectosList.find(p => p.id === obra.proyecto_id) : proyectosList[0]));
    setEditingObra(obra);
    if (obra) {
      setObraForm({
        nombre: obra.nombre,
        proyecto_id: String(obra.proyecto_id || proj?.id || ''),
        fase_actual: obra.fase_actual || 'Operación',
        estado: obra.estado || 'operacion',
        tg_thread_id: obra.tg_thread_id || '',
        predio_ids: obra.predios ? obra.predios.map(pr => String(pr.id)) : []
      });
    } else {
      const parentProj = proj || proyectosList[0];
      setObraForm({
        nombre: parentProj ? `Frente ${parentProj.nombre} - Lote ${parentProj.obras?.length + 1 || 1}` : 'Nuevo Frente de Obra',
        proyecto_id: parentProj ? String(parentProj.id) : (proyectosList[0]?.id ? String(proyectosList[0].id) : ''),
        fase_actual: 'Habilitación',
        estado: 'operacion',
        tg_thread_id: '',
        predio_ids: prediosList[0]?.id ? [String(prediosList[0].id)] : []
      });
    }
    setShowObraModal(true);
  };

  const handleSaveObra = async (e) => {
    e.preventDefault();
    try {
      if (editingObra) {
        await api.patch(`/projects/obras/${editingObra.id}`, obraForm);
        alert(`✅ Frente "${obraForm.nombre}" actualizado correctamente.`);
      } else {
        const res = await api.post('/projects/obras', obraForm);
        const threadId = res.obra?.tg_thread_id || res.tg_thread_id;
        if (threadId) {
          alert(`✅ ¡Frente de obra creado con éxito!\n\n🏢 Frente: "${obraForm.nombre}"\n📡 Tema de Telegram generado: #${threadId}\n\nSe ha fijado el mensaje de bienvenida operativo en Telegram.`);
        } else {
          alert(`✅ Frente de obra "${obraForm.nombre}" creado exitosamente.`);
        }
      }
      setShowObraModal(false);
      setEditingObra(null);
      await loadData();
    } catch (err) {
      alert('❌ Error al guardar frente de obra: ' + err.message);
    }
  };

  const handleDeleteObra = async (obraId, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el frente de obra "${nombre}"?`)) return;
    try {
      await api.delete(`/projects/obras/${obraId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar obra: ' + err.message);
    }
  };

  // --- SINCRONIZACIÓN Y CREACIÓN DINÁMICA DE TEMAS EN TELEGRAM ---
  const [syncingTelegram, setSyncingTelegram] = useState(false);

  const handleCreateTelegramTopic = async (obraId, obraNombre) => {
    try {
      const res = await api.post(`/projects/obras/${obraId}/create-telegram-topic`);
      alert(`✅ ${res.message || 'Tema creado en Telegram exitosamente'}`);
      await loadData();
    } catch (err) {
      alert(`❌ Error al crear tema en Telegram para "${obraNombre}": ${err.message}`);
    }
  };

  const handleSyncAllTelegramTopics = async () => {
    if (!window.confirm('¿Deseas crear y sincronizar automáticamente los temas en el Supergrupo de Telegram para todos los frentes y predios activos?')) return;
    setSyncingTelegram(true);
    try {
      const res = await api.post('/projects/sync-telegram-topics');
      const created = res.results?.filter(r => r.status === 'creado').length || 0;
      const skipped = res.results?.filter(r => r.status === 'omitido_existente').length || 0;
      const failed = res.results?.filter(r => r.status === 'fallido').length || 0;
      alert(`✅ Sincronización de Temas Telegram completada:\n• ${created} tema(s) creado(s) con éxito en Telegram\n• ${skipped} ya contaban con tema asociado\n• ${failed} fallido(s)`);
      await loadData();
    } catch (err) {
      alert(`❌ Error al sincronizar temas con Telegram: ${err.message}`);
    } finally {
      setSyncingTelegram(false);
    }
  };

  // --- CRUD PREDIOS ---
  const handleOpenPredioModal = (predio = null) => {
    setEditingPredio(predio);
    if (predio) {
      setPredioForm({
        nombre: predio.nombre,
        superficie_legal_ha: predio.superficie_legal_ha || 0,
        superficie_util_ha: predio.superficie_util_ha || 0,
        regimen: predio.regimen || 'Propiedad Privada',
        proyecto_id: '',
        crear_frente_telegram: false
      });
    } else {
      setPredioForm({
        nombre: '',
        superficie_legal_ha: 15,
        superficie_util_ha: 15,
        regimen: 'Propiedad Privada',
        proyecto_id: proyectosList[0]?.id ? String(proyectosList[0].id) : '',
        crear_frente_telegram: true
      });
    }
    setShowPredioModal(true);
  };

  const handleSavePredio = async (e) => {
    e.preventDefault();
    try {
      if (editingPredio) {
        await api.patch(`/projects/predios/${editingPredio.id}`, predioForm);
        alert('✅ Predio actualizado correctamente');
      } else {
        const res = await api.post('/projects/predios', predioForm);
        if (res.tg_thread_id) {
          alert(`✅ ¡Predio registrado con éxito!\n\n🏢 Frente operativo creado: "${predioForm.nombre}"\n📡 Tema de Telegram generado en el Supergrupo: #${res.tg_thread_id}\n\nLas cuadrillas ya pueden enviar reportes en este tema.`);
        } else {
          alert(`✅ ${res.message || 'Predio registrado correctamente'}`);
        }
      }
      setShowPredioModal(false);
      setEditingPredio(null);
      await loadData();
    } catch (err) {
      alert('❌ Error al guardar predio: ' + err.message);
    }
  };

  const handleDeletePredio = async (predioId, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el predio "${nombre}"? Se desvinculará de sus obras y tareas asociadas.`)) return;
    try {
      await api.delete(`/projects/predios/${predioId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar predio: ' + err.message);
    }
  };

  // --- CRUD MAQUINARIA (FLOTA MÓVIL) ---
  const handleOpenMachineModal = (machine = null) => {
    setEditingMachine(machine);
    if (machine) {
      setMachineForm({
        codigo: machine.codigo,
        nombre: machine.nombre || machine.modelo,
        tipo: machine.tipo || 'tractor',
        modelo: machine.modelo,
        propietaria_id: machine.propietaria_id ? String(machine.propietaria_id) : '',
        operadora_id: machine.operadora_id ? String(machine.operadora_id) : '',
        umbral_servicio_hrs: machine.umbral_servicio_hrs || 300,
        horometro_actual: machine.horometro_actual || 0,
        ultimo_servicio_hr: machine.ultimo_servicio_hr || 0
      });
    } else {
      setMachineForm({
        codigo: '',
        nombre: '',
        tipo: 'tractor',
        modelo: '',
        propietaria_id: entidadesList.find(e => e.nombre.toLowerCase().includes('aspromex'))?.id ? String(entidadesList.find(e => e.nombre.toLowerCase().includes('aspromex')).id) : (entidadesList[0]?.id ? String(entidadesList[0].id) : ''),
        operadora_id: entidadesList.find(e => e.nombre.toLowerCase().includes('agrokool'))?.id ? String(entidadesList.find(e => e.nombre.toLowerCase().includes('agrokool')).id) : (entidadesList[0]?.id ? String(entidadesList[0].id) : ''),
        umbral_servicio_hrs: 300,
        horometro_actual: 0,
        ultimo_servicio_hr: 0
      });
    }
    setShowMachineModal(true);
  };

  const handleSaveMachine = async (e) => {
    e.preventDefault();
    try {
      if (editingMachine) {
        await api.patch(`/machines/${editingMachine.id}`, machineForm);
      } else {
        await api.post('/machines', machineForm);
      }
      setShowMachineModal(false);
      setEditingMachine(null);
      await loadData();
    } catch (err) {
      alert('Error al guardar maquinaria: ' + err.message);
    }
  };

  const handleDeleteMachine = async (machineId, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar la máquina "${nombre}" del catálogo?`)) return;
    try {
      await api.delete(`/machines/${machineId}`);
      await loadData();
    } catch (err) {
      alert('Error al eliminar máquina: ' + err.message);
    }
  };

  const handleServiceMachine = async (machine) => {
    if (!window.confirm(`¿Registrar servicio preventivo de mantenimiento para "${machine.nombre || machine.codigo}"? Esto reiniciará el contador de horas.`)) return;
    try {
      const res = await api.post(`/machines/${machine.id}/service`);
      alert(res.message || 'Servicio registrado correctamente.');
      await loadData();
    } catch (err) {
      alert('Error al registrar servicio: ' + err.message);
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

        {/* Switcher de Sub-Pestañas Responsivo (Solo visible en pantallas pequeñas si no se usa la barra de navegación) */}
        <div className="hidden items-center gap-2 bg-white dark:bg-[#152202] p-1.5 rounded-2xl border border-[#e2ebd3] dark:border-[#253905] overflow-x-auto no-scrollbar w-full sm:w-auto shadow-sm">
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
            <span>Proyectos & Hitos</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/50">
              {proyectosList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('catalogos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'catalogos'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Catálogo Predios & Frentes</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-500/50">
              {prediosList.length}P / {proyectosList.reduce((acc, p) => acc + (p.obras?.length || 0), 0)}F
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
      {activeTab === 'proyectos' && (() => {
        const availableCiclos = Array.from(new Set(proyectosList.map(p => p.ciclo).filter(Boolean)));
        const areAllExpanded = proyectosList.length > 0 && proyectosList.every(p => !!expandedProjects[p.id]);

        const filteredProyectos = proyectosList.filter(p => {
          const matchesCiclo = projectCicloFilter === 'todos' || p.ciclo === projectCicloFilter;
          if (!matchesCiclo) return false;
          if (!projectSearch.trim()) return true;
          const query = projectSearch.toLowerCase();
          return (
            (p.nombre && p.nombre.toLowerCase().includes(query)) ||
            (p.tipo && p.tipo.toLowerCase().includes(query)) ||
            (p.gerente_nombre && p.gerente_nombre.toLowerCase().includes(query)) ||
            (p.fase_catalogo && p.fase_catalogo.toLowerCase().includes(query)) ||
            (p.obras && p.obras.some(o => o.nombre && o.nombre.toLowerCase().includes(query))) ||
            (p.hitos && p.hitos.some(h => h.nombre && h.nombre.toLowerCase().includes(query)))
          );
        });

        return (
          <div className="space-y-4">
            {/* Backdrop para cerrar menús desplegables */}
            {activeProjectMenuId && (
              <div
                className="fixed inset-0 z-20"
                onClick={() => setActiveProjectMenuId(null)}
              />
            )}

            {/* Barra de Cabecera y Herramientas */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#d9e6c3] dark:border-[#253905] shadow-xs space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-500" /> Estructura de Proyectos Agrícolas
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Administración de frentes de obra, hitos calendarizados y tareas operativas
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleAllProjects}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1e2d01] hover:bg-slate-200 dark:hover:bg-[#283d03] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#3e5606] text-xs font-semibold flex items-center gap-1.5 transition"
                    title={areAllExpanded ? 'Colapsar todos los proyectos' : 'Expandir todos los proyectos'}
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500 dark:text-[#a1c62e]" />
                    <span>{areAllExpanded ? 'Colapsar Todo' : 'Expandir Todo'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGanttProject('all');
                      setShowGanttModal(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#1e2d01] hover:bg-slate-200 dark:hover:bg-[#283d03] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#3e5606] text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" />
                    <span>Gantt</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.open('/index.html#gantt', 'AgrokoolGantt', 'width=1380,height=850,resizable=yes,scrollbars=yes');
                    }}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-[#1e2d01] hover:bg-slate-200 dark:hover:bg-[#283d03] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#3e5606] transition"
                    title="Abrir Gantt en Ventana Independiente"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenProjectModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2c4001] hover:bg-[#1e2d01] text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <FolderPlus className="w-4 h-4 text-[#a1c62e]" />
                    <span>+ Nuevo Proyecto</span>
                  </button>
                </div>
              </div>

              {/* Barra de Búsqueda y Filtros Rápidos */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100 dark:border-[#253905]/40">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Buscar por proyecto, cultivo, frente o responsable..."
                    className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-slate-50 dark:bg-[#121c02] border border-slate-200 dark:border-[#253905] text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {projectSearch && (
                    <button
                      type="button"
                      onClick={() => setProjectSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {availableCiclos.length > 0 && (
                  <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto max-w-full pb-1 sm:pb-0">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Filter className="w-3 h-3" /> Ciclo:
                    </span>
                    <button
                      type="button"
                      onClick={() => setProjectCicloFilter('todos')}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                        projectCicloFilter === 'todos'
                          ? 'bg-[#2c4001] text-white font-bold'
                          : 'bg-slate-100 dark:bg-[#1a2902] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    {availableCiclos.map((ciclo) => (
                      <button
                        key={ciclo}
                        type="button"
                        onClick={() => setProjectCicloFilter(ciclo)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                          projectCicloFilter === ciclo
                            ? 'bg-[#2c4001] text-white font-bold'
                            : 'bg-slate-100 dark:bg-[#1a2902] text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {ciclo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Proyectos */}
            {filteredProyectos.length === 0 ? (
              <div className="p-10 text-center rounded-2xl bg-white dark:bg-[#152202] border border-[#d9e6c3] dark:border-[#253905] space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {proyectosList.length === 0
                    ? 'No hay proyectos agrícolas registrados'
                    : 'No se encontraron proyectos con los filtros actuales'}
                </p>
                {projectSearch || projectCicloFilter !== 'todos' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setProjectSearch('');
                      setProjectCicloFilter('todos');
                    }}
                    className="text-xs font-bold text-emerald-600 dark:text-[#a1c62e] underline"
                  >
                    Restablecer filtros de búsqueda
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenProjectModal()}
                    className="px-3.5 py-1.5 rounded-xl bg-[#2c4001] hover:bg-[#1e2d01] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-[#a1c62e]" />
                    Crear el primer proyecto
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProyectos.map((p) => {
                  const isExpanded = !!expandedProjects[p.id];
                  const totalHitos = p.hitos?.length || 0;
                  const allTareas = p.hitos?.flatMap(h => h.tareas || []) || [];
                  const totalTareas = allTareas.length;
                  const tareasCompletadas = allTareas.filter(t => t.estado === 'completada').length;
                  const totalAcumuladoHa = allTareas.reduce((acc, t) => acc + (t.cantidad_acumulada || 0), 0);
                  const progresoPct = p.superficie_meta_ha > 0
                    ? Math.min(100, Math.round((totalAcumuladoHa / p.superficie_meta_ha) * 100))
                    : 0;
                  const currentSubTab = projectSubTabs[p.id] || 'hitos';
                  const isMenuOpen = activeProjectMenuId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl bg-white dark:bg-[#152202] border border-[#d9e6c3] dark:border-[#253905] shadow-xs hover:shadow-md transition-all overflow-hidden"
                    >
                      {/* Cabecera Principal del Proyecto */}
                      <div className="p-3.5 sm:p-4 bg-white dark:bg-[#152202] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Lado Izquierdo: Toggle, Nombre, Badges y Meta */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleProjectExpand(p.id)}
                            className="mt-0.5 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] dark:hover:bg-[#283d03] text-slate-700 dark:text-[#a1c62e] transition"
                            title={isExpanded ? 'Contraer proyecto' : 'Expandir proyecto'}
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4
                                onClick={() => toggleProjectExpand(p.id)}
                                className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight cursor-pointer hover:text-emerald-700 dark:hover:text-[#a1c62e] transition"
                              >
                                {p.nombre}
                              </h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#eef5e2] text-[#2c4001] dark:bg-[#203001] dark:text-[#d4e6b5] border border-[#d3e2be] dark:border-[#3e5606]">
                                {p.tipo}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                Ciclo {p.ciclo}
                              </span>
                              {p.fase_catalogo && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-[#192404] dark:text-slate-300 border border-slate-200 dark:border-[#2f4308]">
                                  {p.fase_catalogo}
                                </span>
                              )}
                            </div>

                            {/* Metadatos en una sola línea limpia */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  {p.gerente_nombre || 'Sin gerente'}
                                </span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{p.fecha_inicio || 'S/F'} {p.fecha_fin ? `al ${p.fecha_fin}` : ''}</span>
                              </span>
                              <span>•</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {totalHitos} {totalHitos === 1 ? 'hito' : 'hitos'}
                              </span>
                              <span>•</span>
                              <span>
                                {p.obras?.length || 0} {p.obras?.length === 1 ? 'frente' : 'frentes'}
                              </span>
                              {totalTareas > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{tareasCompletadas}/{totalTareas} tareas</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Lado Derecho: Barra de Progreso y Acciones */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-[#253905]/40">
                          {/* Progreso */}
                          <div className="w-36 sm:w-44 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500 dark:text-slate-400 font-medium">Avance:</span>
                              <span className="font-bold text-[#2c4001] dark:text-[#a1c62e]">
                                {totalAcumuladoHa}/{p.superficie_meta_ha} ha ({progresoPct}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-[#1a2802] rounded-full h-2 overflow-hidden border border-slate-200/50 dark:border-[#253905]">
                              <div
                                className="bg-[#2c4001] dark:bg-[#a1c62e] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progresoPct}%` }}
                              />
                            </div>
                          </div>

                          {/* Botones de Acción Consolidados */}
                          <div className="flex items-center gap-1.5 relative">
                            {/* Botón Primario: + Hito */}
                            <button
                              type="button"
                              onClick={() => handleOpenHitoModal(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-[#2c4001] hover:bg-[#1e2d01] text-white text-xs font-bold flex items-center gap-1 shadow-xs transition"
                              title="Agregar Hito"
                            >
                              <Flag className="w-3 h-3 text-[#a1c62e]" />
                              <span>+ Hito</span>
                            </button>

                            {/* Botón Gantt Individual */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGanttProject(p.id);
                                setShowGanttModal(true);
                              }}
                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] dark:hover:bg-[#283d03] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#3e5606] transition"
                              title="Ver Gantt de este proyecto"
                            >
                              <Calendar className="w-3.5 h-3.5 text-[#2c4001] dark:text-[#a1c62e]" />
                            </button>

                            {/* Menú Desplegable de Más Opciones */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveProjectMenuId(isMenuOpen ? null : p.id)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] dark:hover:bg-[#283d03] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#3e5606] transition"
                                title="Más opciones"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>

                              {isMenuOpen && (
                                <div className="absolute right-0 top-9 w-48 rounded-xl bg-white dark:bg-[#172502] border border-slate-200 dark:border-[#3e5606] shadow-xl py-1 z-30 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveProjectMenuId(null);
                                      handleOpenObraModal(p);
                                    }}
                                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#203202] flex items-center gap-2 transition"
                                  >
                                    <Building className="w-3.5 h-3.5 text-[#a87d13]" />
                                    <span>+ Agregar Frente de Obra</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveProjectMenuId(null);
                                      handleOpenProjectModal(p);
                                    }}
                                    className="w-full text-left px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#203202] flex items-center gap-2 transition"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Editar Proyecto</span>
                                  </button>

                                  <div className="my-1 border-t border-slate-100 dark:border-[#253905]" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveProjectMenuId(null);
                                      handleDeleteProject(p.id, p.nombre);
                                    }}
                                    className="w-full text-left px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Eliminar Proyecto</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CONTENIDO INTERNO DESPLEGABLE (Estructurado por Pestañas) */}
                      {isExpanded && (
                        <div className="border-t border-[#d9e6c3] dark:border-[#253905] bg-[#fbfdf8] dark:bg-[#0f1701]">
                          {/* Barra de Sub-Navegación Interna */}
                          <div className="px-4 py-2 bg-slate-50/70 dark:bg-[#121c02] border-b border-[#e6eed9] dark:border-[#253905] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setProjectSubTab(p.id, 'hitos')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                  currentSubTab === 'hitos'
                                    ? 'bg-[#2c4001] text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1a2802]'
                                }`}
                              >
                                <Flag className="w-3 h-3 text-[#a1c62e]" />
                                <span>Hitos & Cronograma</span>
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white">
                                  {totalHitos}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setProjectSubTab(p.id, 'frentes')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                  currentSubTab === 'frentes'
                                    ? 'bg-[#2c4001] text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1a2802]'
                                }`}
                              >
                                <Building className="w-3 h-3 text-[#dfb75c]" />
                                <span>Frentes de Obra</span>
                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/20 text-white">
                                  {p.obras?.length || 0}
                                </span>
                              </button>
                            </div>

                            {/* Botón rápido de acción según pestaña activa */}
                            <div>
                              {currentSubTab === 'hitos' ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenHitoModal(p)}
                                  className="text-xs font-semibold text-[#2c4001] dark:text-[#a1c62e] hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Nuevo Hito</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenObraModal(p)}
                                  className="text-xs font-semibold text-[#a87d13] dark:text-[#dfb75c] hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Nuevo Frente</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* PESTAÑA: FRENTES DE OBRA */}
                          {currentSubTab === 'frentes' && (
                            <div className="p-4">
                              {p.obras?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                  {p.obras.map(o => (
                                    <div
                                      key={o.id}
                                      className="p-3 rounded-xl bg-white dark:bg-[#152202] border border-[#d9e6c3] dark:border-[#253905] shadow-xs flex items-center justify-between gap-2"
                                    >
                                      <div className="min-w-0">
                                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                          {o.nombre}
                                        </h5>
                                        <p className="text-[11px] text-purple-600 dark:text-purple-300 font-medium">
                                          Fase: {o.fase_actual}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenObraModal(p, o)}
                                          className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] text-slate-600 dark:text-slate-300 transition"
                                          title="Editar frente"
                                        >
                                          <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteObra(o.id, o.nombre)}
                                          className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 transition"
                                          title="Eliminar frente"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                                  Este proyecto aún no tiene frentes de obra asignados.{' '}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenObraModal(p)}
                                    className="text-[#a87d13] font-bold underline ml-1"
                                  >
                                    Crear Frente de Obra
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* PESTAÑA: HITOS Y TAREAS */}
                          {currentSubTab === 'hitos' && (
                            <div className="p-3 sm:p-4 space-y-3">
                              {p.hitos?.length > 0 ? (
                                p.hitos.map((h) => {
                                  const isHitoExp = !!expandedHitos[h.id];
                                  const hitoTareas = h.tareas || [];
                                  const hitoAcumHa = hitoTareas.reduce((acc, t) => acc + (t.cantidad_acumulada || 0), 0);
                                  const hitoPct = h.superficie_meta_ha > 0 ? Math.min(100, Math.round((hitoAcumHa / h.superficie_meta_ha) * 100)) : 0;

                                  const statusStyles = {
                                    pendiente: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
                                    en_proceso: 'bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800',
                                    completado: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                                    bloqueado: 'bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                  };

                                  return (
                                    <div
                                      key={h.id}
                                      className="rounded-xl bg-white dark:bg-[#152202] border border-[#d9e6c3] dark:border-[#253905] overflow-hidden shadow-2xs"
                                    >
                                      {/* Fila Encabezado del Hito */}
                                      <div className="p-3 bg-white dark:bg-[#152202] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                          <button
                                            type="button"
                                            onClick={() => toggleHitoExpand(h.id)}
                                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] dark:hover:bg-[#283d03] text-slate-700 dark:text-[#a1c62e] transition"
                                          >
                                            {isHitoExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          </button>
                                          <div className="w-6 h-6 rounded-full bg-[#2c4001] text-[#a1c62e] flex items-center justify-center font-black text-xs shrink-0">
                                            {h.orden}
                                          </div>
                                          <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <h5
                                                onClick={() => toggleHitoExpand(h.id)}
                                                className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white cursor-pointer hover:text-emerald-700 dark:hover:text-[#a1c62e] transition truncate"
                                              >
                                                {h.nombre}
                                              </h5>
                                              <span className={`px-2 py-0.2 rounded-md text-[10px] uppercase font-bold border ${statusStyles[h.estado] || statusStyles.pendiente}`}>
                                                {h.estado.replace('_', ' ')}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium truncate">
                                              {h.descripcion || 'Sin descripción'} • Meta: <strong className="text-slate-800 dark:text-slate-200">{h.superficie_meta_ha} ha</strong> {h.fecha_meta && `• Límite: ${h.fecha_meta}`}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2.5 self-end md:self-auto shrink-0">
                                          <div className="w-28 hidden sm:block">
                                            <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-0.5">
                                              <span>Progreso</span>
                                              <span className="font-bold text-[#2c4001] dark:text-[#a1c62e]">{hitoPct}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-[#1e2d01] rounded-full h-1.5 overflow-hidden">
                                              <div className="bg-[#2c4001] dark:bg-[#a1c62e] h-1.5 rounded-full" style={{ width: `${hitoPct}%` }} />
                                            </div>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() => handleOpenTaskModal(p, h)}
                                            className="px-2.5 py-1 rounded-lg bg-[#2c4001] hover:bg-[#1e2d01] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs transition"
                                          >
                                            <CheckSquare className="w-3 h-3 text-[#a1c62e]" />
                                            <span>+ Tarea</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleOpenHitoModal(p, h)}
                                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#1e2d01] text-slate-600 dark:text-slate-300 transition"
                                            title="Editar Hito"
                                          >
                                            <Edit2 className="w-3 h-3" />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleDeleteHito(h.id, h.nombre)}
                                            className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 transition"
                                            title="Eliminar Hito"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* TAREAS DENTRO DEL HITO */}
                                      {isHitoExp && (
                                        <div className="p-3 bg-slate-50/50 dark:bg-[#121c02] border-t border-[#f0f4ea] dark:border-[#253905]/50">
                                          {hitoTareas.length > 0 ? (
                                            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#253905] bg-white dark:bg-[#152202]">
                                              <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                                                <thead className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-[#121c02] border-b border-slate-200 dark:border-[#253905]">
                                                  <tr>
                                                    <th className="py-2 px-3">Tarea / Actividad</th>
                                                    <th className="py-2 px-3">Predio</th>
                                                    <th className="py-2 px-3">Responsable</th>
                                                    <th className="py-2 px-3 text-right">Meta vs Acumulado</th>
                                                    <th className="py-2 px-3 text-center">Estado</th>
                                                    <th className="py-2 px-3 text-right">Acciones</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-[#253905]/50">
                                                  {hitoTareas.map((t) => {
                                                    const tPct = t.cantidad_meta > 0 ? Math.min(100, Math.round((t.cantidad_acumulada / t.cantidad_meta) * 100)) : 0;
                                                    const taskStatusStyles = {
                                                      pendiente: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
                                                      en_progreso: 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200 font-bold',
                                                      completada: 'bg-emerald-50 text-emerald-800 dark:bg-[#203001] dark:text-[#a1c62e] border-emerald-200 dark:border-[#3e5606] font-bold',
                                                      detenida: 'bg-amber-50 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200 font-bold'
                                                    };

                                                    return (
                                                      <tr key={t.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1a2b03] transition-colors">
                                                        <td className="py-2.5 px-3">
                                                          <span className="font-bold text-slate-900 dark:text-white block">{t.nombre}</span>
                                                          <span className="text-[10px] text-slate-400 font-mono">[{t.actividad_id}]</span>
                                                        </td>
                                                        <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-300">
                                                          {t.predio_nombre || 'General'}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                                                            <User className="w-3 h-3 text-slate-400" /> {t.responsable || 'Sin asignar'}
                                                          </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono">
                                                          <span className="text-[#2c4001] dark:text-[#a1c62e] font-black">{t.cantidad_acumulada}</span>
                                                          <span className="text-slate-500 dark:text-slate-400"> / {t.cantidad_meta} {t.unidad}</span>
                                                          <span className="text-[10px] text-slate-400 ml-1">({tPct}%)</span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                          <button
                                                            type="button"
                                                            onClick={() => handleToggleTaskStatus(t)}
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wide border transition transform active:scale-95 ${taskStatusStyles[t.estado] || taskStatusStyles.pendiente}`}
                                                            title="Clic para alternar estado"
                                                          >
                                                            {t.estado.replace('_', ' ')}
                                                          </button>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right">
                                                          <div className="flex items-center justify-end gap-1">
                                                            <button
                                                              type="button"
                                                              onClick={() => handleOpenTaskModal(p, h, t)}
                                                              className="p-1 rounded-lg bg-slate-100 dark:bg-[#1e2d01] text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
                                                              title="Editar Tarea"
                                                            >
                                                              <Edit2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => handleDeleteTask(t.id, t.nombre)}
                                                              className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 hover:bg-rose-100 transition"
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
                                            <div className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">
                                              No hay tareas en este hito.{' '}
                                              <button
                                                type="button"
                                                onClick={() => handleOpenTaskModal(p, h)}
                                                className="text-[#2c4001] dark:text-[#a1c62e] font-bold underline ml-1"
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
                                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                                  Este proyecto aún no tiene hitos definidos.{' '}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenHitoModal(p)}
                                    className="text-emerald-600 dark:text-[#a1c62e] font-bold underline ml-1"
                                  >
                                    Agregar Hito 1
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
      {/* VISTA 4: CATÁLOGO DE PREDIOS, FRENTES Y MAQUINARIA (EDITABLE Y RESPONSIVO) */}
      {/* ========================================================================= */}
      {activeTab === 'catalogos' && (() => {
        const allObras = obrasList.length > 0 ? obrasList : proyectosList.flatMap(p => (p.obras || []).map(o => ({ ...o, proyecto_nombre: p.nombre, proyecto_id: p.id })));
        
        const filteredPredios = prediosList.filter(pr => 
          !catalogoSearch || 
          pr.nombre?.toLowerCase().includes(catalogoSearch.toLowerCase()) || 
          pr.regimen?.toLowerCase().includes(catalogoSearch.toLowerCase())
        );

        const filteredObras = allObras.filter(ob => 
          !catalogoSearch || 
          ob.nombre?.toLowerCase().includes(catalogoSearch.toLowerCase()) || 
          ob.proyecto_nombre?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          ob.fase_actual?.toLowerCase().includes(catalogoSearch.toLowerCase())
        );

        const filteredMachines = machinesList.filter(m =>
          !catalogoSearch ||
          m.nombre?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          m.codigo?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          m.modelo?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          m.tipo?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          m.propietaria_nombre?.toLowerCase().includes(catalogoSearch.toLowerCase()) ||
          m.operadora_nombre?.toLowerCase().includes(catalogoSearch.toLowerCase())
        );

        const statusColors = {
          operacion: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-400',
          habilitacion: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-400',
          prospeccion: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-400',
          mantenimiento: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-400',
          standby: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-400',
          cerrada: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-400'
        };

        const totalHaLegal = prediosList.reduce((acc, p) => acc + (p.superficie_legal_ha || 0), 0);
        const totalHaUtil = prediosList.reduce((acc, p) => acc + (p.superficie_util_ha || 0), 0);

        return (
          <div className="space-y-6">
            {/* Header & Quick Action Bar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-500" /> Catálogos Operativos: Predios, Frentes & Maquinaria
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Administración integral de polígonos, frentes de obra y parque de maquinaria (Flota Móvil)
                </p>
              </div>

              {/* Botones de Alta Rápida */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSyncAllTelegramTopics}
                  disabled={syncingTelegram}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                  title="Crear y sincronizar temas en el Supergrupo de Telegram para todas las obras"
                >
                  <Send className={`w-3.5 h-3.5 ${syncingTelegram ? 'animate-spin' : ''}`} />
                  <span>{syncingTelegram ? 'Sincronizando...' : 'Sincronizar Temas Telegram'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPredioModal()}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+ Nuevo Predio</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenObraModal()}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Nuevo Frente</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenMachineModal()}
                  className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-[#a87d13] hover:bg-[#8f690f] text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Tractor className="w-3.5 h-3.5 text-amber-200" />
                  <span>+ Nueva Máquina</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Predios</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">{prediosList.length}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-0.5">Polígonos registrados</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sup. Mecanizable</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{totalHaUtil.toFixed(1)} ha</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Legal: {totalHaLegal.toFixed(1)} ha</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Frentes Activos</span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">{allObras.length}</span>
                <span className="text-[10px] text-purple-500 font-medium block mt-0.5">En operación o habilitación</span>
              </div>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Flota Maquinaria</span>
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">{machinesList.length}</span>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Equipos móviles activos</span>
              </div>
            </div>

            {/* Sub-Tabs & Buscador Responsivo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#152202] p-2.5 rounded-2xl border border-[#e2ebd3] dark:border-[#253905] shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setCatalogoSubTab('todos')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
                    catalogoSubTab === 'todos'
                      ? 'bg-[#2c4001] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Todos ({prediosList.length + allObras.length + machinesList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogoSubTab('predios')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
                    catalogoSubTab === 'predios'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Predios ({prediosList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogoSubTab('frentes')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
                    catalogoSubTab === 'frentes'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Frentes ({allObras.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogoSubTab('maquinaria')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0 ${
                    catalogoSubTab === 'maquinaria'
                      ? 'bg-[#a87d13] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Tractor className="w-3.5 h-3.5" />
                  <span>Maquinaria ({machinesList.length})</span>
                </button>
              </div>

              {/* Input Buscador */}
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={catalogoSearch}
                  onChange={(e) => setCatalogoSearch(e.target.value)}
                  placeholder="Buscar predio o frente..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                {catalogoSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogoSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-200"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* SECCIÓN PREDIOS AGRÍCOLAS */}
            {(catalogoSubTab === 'todos' || catalogoSubTab === 'predios') && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Predios Registrados ({filteredPredios.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Superficies legales y útiles</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPredios.map((pr) => {
                    const prObras = pr.obras || [];
                    return (
                      <div
                        key={pr.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#a1c62e]/80 transition group"
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 border-b border-[#e2ebd3] dark:border-[#253905]/60 pb-2.5">
                            <div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606] uppercase tracking-wider">
                                {pr.regimen || 'Propiedad Privada'}
                              </span>
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-1.5">
                                <MapPin className="w-4 h-4 text-emerald-500" /> {pr.nombre}
                              </h5>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenPredioModal(pr)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Editar predio"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePredio(pr.id, pr.nombre)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                title="Eliminar predio"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Hectáreas Grid */}
                          <div className="grid grid-cols-2 gap-2 my-3">
                            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850">
                              <span className="text-[10px] text-slate-500 block font-medium">Sup. Legal</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{pr.superficie_legal_ha} ha</span>
                            </div>
                            <div className="p-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40">
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-medium">Mecanizable</span>
                              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">{pr.superficie_util_ha} ha</span>
                            </div>
                          </div>
                        </div>

                        {/* Frentes Asociados */}
                        <div className="pt-2 border-t border-[#e2ebd3] dark:border-[#253905]/60 text-xs">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Frentes en este predio ({prObras.length}):
                          </span>
                          {prObras.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {prObras.map(ob => (
                                <span key={ob.id} className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium">
                                  {ob.nombre}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Sin frentes asignados</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN FRENTES DE OBRA */}
            {(catalogoSubTab === 'todos' || catalogoSubTab === 'frentes') && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-purple-400" />
                    <span>Frentes de Obra Activos ({filteredObras.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Asignados a proyectos agrícolas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredObras.map((ob) => {
                    const isMockThread = ['101', '102', '103', '104', '105', '106', '107'].includes(String(ob.tg_thread_id));
                    const hasRealThread = ob.tg_thread_id && !isMockThread;

                    return (
                    <div
                      key={ob.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm flex flex-col justify-between hover:shadow-md hover:border-purple-400/80 transition group"
                    >
                      <div>
                        {/* Header Frente */}
                        <div className="flex items-start justify-between gap-2 border-b border-[#e2ebd3] dark:border-[#253905]/60 pb-2.5">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${statusColors[ob.estado] || statusColors.operacion}`}>
                                {ob.estado}
                              </span>
                              {ob.tg_thread_id ? (
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1 font-bold ${hasRealThread ? 'bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800' : 'bg-slate-100 dark:bg-slate-900 text-slate-500'}`}>
                                  <Send className="w-2.5 h-2.5 text-sky-500" /> #{ob.tg_thread_id}
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800 font-semibold">
                                  Sin Tema TG
                                </span>
                              )}
                            </div>
                            <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
                              <Building className="w-4 h-4 text-purple-400" /> {ob.nombre}
                            </h5>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleCreateTelegramTopic(ob.id, ob.nombre)}
                              className="p-1.5 rounded-lg text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/60 transition"
                              title={hasRealThread ? 'Recrear o actualizar tema en Telegram' : 'Crear tema en Telegram para este frente'}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenObraModal(null, ob)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                              title="Editar frente"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteObra(ob.id, ob.nombre)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                              title="Eliminar frente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Proyecto & Fase */}
                        <div className="py-2.5 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>Proyecto:</span>
                            <strong className="text-slate-800 dark:text-slate-200 text-right truncate max-w-[180px]">
                              {ob.proyecto_nombre}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                            <span>Fase Actual:</span>
                            <span className="font-semibold text-purple-600 dark:text-purple-400">{ob.fase_actual}</span>
                          </div>
                        </div>
                      </div>

                      {/* Predios Vinculados & Botón Tema */}
                      <div className="pt-2 border-t border-[#e2ebd3] dark:border-[#253905]/60 text-xs space-y-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Predio(s) Vinculado(s):
                          </span>
                          {ob.predios && ob.predios.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {ob.predios.map(pr => (
                                <span key={pr.id} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                                  📍 {pr.nombre} ({pr.superficie_util_ha} ha)
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Sin predio vinculado</span>
                          )}
                        </div>

                        {(!hasRealThread) && (
                          <button
                            type="button"
                            onClick={() => handleCreateTelegramTopic(ob.id, ob.nombre)}
                            className="w-full py-1 px-2 rounded-lg bg-sky-50 dark:bg-sky-950/80 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition"
                          >
                            <Send className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                            <span>Crear Tema en Telegram</span>
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN PARQUE DE MAQUINARIA (FLOTA MÓVIL) */}
            {(catalogoSubTab === 'todos' || catalogoSubTab === 'maquinaria') && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tractor className="w-3.5 h-3.5 text-amber-500" />
                    <span>Catálogo de Maquinaria (Flota Móvil) ({filteredMachines.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">Mantenimiento preventivo por umbral de horas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredMachines.map((mq) => {
                    const umbral = mq.umbral_servicio_hrs || 300;
                    const hrsDesdeServicio = mq.horometro_actual - (mq.ultimo_servicio_hr || 0);
                    const pct = Math.min(100, Math.round((hrsDesdeServicio / umbral) * 100));
                    const isAlerta = mq.alerta_mantenimiento === 1 || hrsDesdeServicio >= (umbral - 20);

                    return (
                      <div
                        key={mq.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#152202] border border-[#e2ebd3] dark:border-[#253905] shadow-sm flex flex-col justify-between hover:shadow-md hover:border-amber-400/80 transition group"
                      >
                        <div>
                          {/* Header Máquina */}
                          <div className="flex items-start justify-between gap-2 border-b border-[#e2ebd3] dark:border-[#253905]/60 pb-2.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                  {mq.codigo}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606] uppercase">
                                  {mq.tipo}
                                </span>
                                {isAlerta && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500 text-white animate-pulse">
                                    ALERTA {umbral}h
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-1.5">
                                <Tractor className="w-4 h-4 text-amber-500 flex-shrink-0" /> {mq.nombre || mq.modelo}
                              </h5>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenMachineModal(mq)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Editar máquina"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMachine(mq.id, mq.nombre || mq.codigo)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition"
                                title="Eliminar máquina"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Entidades Propietaria y Operadora */}
                          <div className="py-2.5 space-y-1.5 text-xs border-b border-[#e2ebd3] dark:border-[#253905]/60">
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Propietaria:</span>
                              <strong className="text-slate-800 dark:text-slate-200">
                                {mq.propietaria_nombre || 'Aspromex'}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                              <span>Operadora:</span>
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                {mq.operadora_nombre || 'Agrokool'}
                              </span>
                            </div>
                            {mq.propietaria_nombre !== mq.operadora_nombre && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic">
                                ℹ️ Maquinaria en préstamo / convenio inter-empresas
                              </p>
                            )}
                          </div>

                          {/* Horómetro y Mantenimiento */}
                          <div className="py-2.5 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-500 font-medium">Horómetro Actual:</span>
                              <span className="font-black text-slate-900 dark:text-white font-mono">
                                {mq.horometro_actual} hrs
                              </span>
                            </div>

                            {/* Barra de Horómetro hacia el Umbral */}
                            <div>
                              <div className="flex justify-between text-[11px] mb-1">
                                <span className="text-slate-500">
                                  Ciclo: <strong>{hrsDesdeServicio.toFixed(1)} / {umbral} hrs</strong>
                                </span>
                                <span className={`font-bold ${isAlerta ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                  {pct}%
                                </span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-200 dark:border-slate-700">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isAlerta ? 'bg-amber-500' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Botón de Servicio Preventivo */}
                        <div className="pt-2.5 border-t border-[#e2ebd3] dark:border-[#253905]/60 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500">
                            Último serv: <strong>{mq.ultimo_servicio_hr || 0} hrs</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleServiceMachine(mq)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-sm"
                            title="Resetear contador tras servicio preventivo"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>Servicio {umbral}h</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
                {editingObra ? `Editar Frente: ${editingObra.nombre}` : `Nuevo Frente de Obra: ${selectedProjectForObra?.nombre || ''}`}
              </h3>
              <button type="button" onClick={() => { setShowObraModal(false); setEditingObra(null); }} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveObra} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Proyecto Asignado</label>
                <select
                  required
                  value={obraForm.proyecto_id}
                  onChange={(e) => setObraForm(prev => ({ ...prev, proyecto_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-purple-500 focus:outline-none"
                >
                  <option value="">Selecciona un proyecto...</option>
                  {proyectosList.map(p => (
                    <option key={p.id} value={p.id}>{p.nombre} ({p.ciclo})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Frente / Obra</label>
                <input
                  type="text"
                  required
                  value={obraForm.nombre}
                  onChange={(e) => setObraForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Frente Norte - Desmonte y Nivelación"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fase Actual</label>
                  <input
                    type="text"
                    value={obraForm.fase_actual}
                    onChange={(e) => setObraForm(prev => ({ ...prev, fase_actual: e.target.value }))}
                    placeholder="ej. Subsoleo, Siembra"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                  <select
                    value={obraForm.estado}
                    onChange={(e) => setObraForm(prev => ({ ...prev, estado: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-purple-500 focus:outline-none"
                  >
                    <option value="operacion">Operación</option>
                    <option value="prospeccion">Prospección</option>
                    <option value="habilitacion">Habilitación</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="standby">Standby</option>
                    <option value="cerrada">Cerrada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Predios Vinculados ({obraForm.predio_ids?.length || 0})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Selecciona 1 o varios predios</span>
                </label>
                <div className="max-h-36 overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 p-2 space-y-1">
                  {prediosList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic p-1">No hay predios registrados aún.</p>
                  ) : (
                    prediosList.map(pr => {
                      const isSelected = obraForm.predio_ids?.map(String).includes(String(pr.id));
                      return (
                        <label
                          key={pr.id}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-bold'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setObraForm(prev => {
                                  const current = (prev.predio_ids || []).map(String);
                                  const prIdStr = String(pr.id);
                                  const next = current.includes(prIdStr)
                                    ? current.filter(id => id !== prIdStr)
                                    : [...current, prIdStr];
                                  return { ...prev, predio_ids: next };
                                });
                              }}
                              className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500"
                            />
                            <span>📍 {pr.nombre}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono font-normal">{pr.superficie_util_ha} ha</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Thread / Tema de Telegram (Opcional)</label>
                <input
                  type="text"
                  value={obraForm.tg_thread_id}
                  onChange={(e) => setObraForm(prev => ({ ...prev, tg_thread_id: e.target.value }))}
                  placeholder="ej. Dejar vacío para creación automática"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-purple-500 focus:outline-none"
                />
                <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">
                  💡 Si se deja vacío, el bot creará automáticamente el tema en el Supergrupo de Telegram con los predios seleccionados.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowObraModal(false); setEditingObra(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                >
                  {editingObra ? 'Guardar Cambios' : 'Crear Frente de Obra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: PREDIO AGRÍCOLA */}
      {showPredioModal && (
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-500" />
                {editingPredio ? `Editar Predio: ${editingPredio.nombre}` : 'Nuevo Predio Agrícola'}
              </h3>
              <button type="button" onClick={() => { setShowPredioModal(false); setEditingPredio(null); }} className="text-slate-600 dark:text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSavePredio} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Predio / Rancho</label>
                <input
                  type="text"
                  required
                  value={predioForm.nombre}
                  onChange={(e) => setPredioForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Santa Teresita, San Alberto, Guayeme"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Superficie Legal (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={predioForm.superficie_legal_ha}
                    onChange={(e) => setPredioForm(prev => ({ ...prev, superficie_legal_ha: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Superficie Útil/Mecanizable (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={predioForm.superficie_util_ha}
                    onChange={(e) => setPredioForm(prev => ({ ...prev, superficie_util_ha: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Régimen Jurídico</label>
                <input
                  type="text"
                  value={predioForm.regimen}
                  onChange={(e) => setPredioForm(prev => ({ ...prev, regimen: e.target.value }))}
                  placeholder="ej. Propiedad Privada, Ejidal, En trámite RPP"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {!editingPredio && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={predioForm.crear_frente_telegram}
                      onChange={(e) => setPredioForm(prev => ({ ...prev, crear_frente_telegram: e.target.checked }))}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Crear Frente y Tema en Telegram automáticamente
                    </span>
                  </label>
                  {predioForm.crear_frente_telegram && (
                    <div>
                      <label className="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                        Asignar al Proyecto:
                      </label>
                      <select
                        value={predioForm.proyecto_id}
                        onChange={(e) => setPredioForm(prev => ({ ...prev, proyecto_id: e.target.value }))}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                      >
                        {proyectosList.map(p => (
                          <option key={p.id} value={p.id}>{p.nombre} ({p.ciclo})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                        📡 El bot creará el tema en el Supergrupo de Telegram para captura de reportes.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowPredioModal(false); setEditingPredio(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#2c4001] hover:bg-[#203001] text-white text-xs font-bold shadow-md shadow-emerald-950/50"
                >
                  {editingPredio ? 'Guardar Cambios' : 'Crear Predio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CREAR / EDITAR MAQUINARIA (FLOTA MÓVIL) */}
      {showMachineModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#152202] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[#e2ebd3] dark:border-[#253905] pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Tractor className="w-5 h-5 text-amber-500" />
                {editingMachine ? `Editar Máquina: ${editingMachine.nombre || editingMachine.codigo}` : 'Registrar Nueva Máquina en Catálogo'}
              </h3>
              <button
                type="button"
                onClick={() => { setShowMachineModal(false); setEditingMachine(null); }}
                className="text-slate-600 dark:text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Código Identificador *
                  </label>
                  <input
                    type="text"
                    required
                    value={machineForm.codigo}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="ej. TRACTOR-PUMA-01, BULL-CAT-01"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tipo de Maquinaria *
                  </label>
                  <select
                    required
                    value={machineForm.tipo}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, tipo: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none capitalize"
                  >
                    {['tractor', 'bulldozer', 'retroexcavadora', 'dron', 'sembradora', 'rastra'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Descriptivo *
                </label>
                <input
                  type="text"
                  required
                  value={machineForm.nombre}
                  onChange={(e) => setMachineForm(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej. Puma CASE IH 155, Bulldozer Caterpillar D6"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Modelo o Especificación
                </label>
                <input
                  type="text"
                  value={machineForm.modelo}
                  onChange={(e) => setMachineForm(prev => ({ ...prev, modelo: e.target.value }))}
                  placeholder="ej. CASE IH Puma 155 CVX, DJI Agras T70P"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Entidad Propietaria *
                  </label>
                  <select
                    value={machineForm.propietaria_id}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, propietaria_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Seleccionar Propietaria...</option>
                    {entidadesList.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Entidad Operadora *
                  </label>
                  <select
                    value={machineForm.operadora_id}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, operadora_id: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">Seleccionar Operadora...</option>
                    {entidadesList.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              {machineForm.propietaria_id && machineForm.operadora_id && machineForm.propietaria_id !== machineForm.operadora_id && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
                  ⚠️ Convenio detectado: La maquinaria pertenece a <strong>{entidadesList.find(e => String(e.id) === String(machineForm.propietaria_id))?.nombre}</strong> y es operada en préstamo por <strong>{entidadesList.find(e => String(e.id) === String(machineForm.operadora_id))?.nombre}</strong>.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Umbral Servicio (hrs) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="10"
                    required
                    value={machineForm.umbral_servicio_hrs}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, umbral_servicio_hrs: parseFloat(e.target.value) || 300 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">ej. 300 hrs</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horómetro Actual (hrs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={machineForm.horometro_actual}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, horometro_actual: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Último Servicio (hrs)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={machineForm.ultimo_servicio_hr}
                    onChange={(e) => setMachineForm(prev => ({ ...prev, ultimo_servicio_hr: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#e2ebd3] dark:border-[#253905]">
                <button
                  type="button"
                  onClick={() => { setShowMachineModal(false); setEditingMachine(null); }}
                  className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#a87d13] hover:bg-[#8f690f] text-white text-xs font-bold shadow-md shadow-amber-950/40"
                >
                  {editingMachine ? 'Guardar Cambios' : 'Registrar Máquina'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: CIERRE DE INCIDENCIA */}
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

      {/* MODAL FULLSCREEN / VENTANA DE GANTT */}
      {showGanttModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-[1550px] max-h-[96vh] flex flex-col bg-[#f8faf2] dark:bg-[#0c1400] rounded-2xl overflow-hidden border border-[#e2ebd3] dark:border-[#253905] shadow-2xl">
            <GanttChart
              projects={proyectosList}
              selectedProjectId={selectedGanttProject}
              onProjectChange={setSelectedGanttProject}
              onRefresh={loadData}
              isModal={true}
              onCloseModal={() => setShowGanttModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
