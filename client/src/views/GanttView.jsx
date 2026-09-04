import React, { useState, useEffect } from 'react';
import api from '../api/client';
import GanttChart from '../components/GanttChart';
import { RefreshCw, ArrowLeft, Layers, Calendar, HardHat, BarChart3, AlertTriangle } from 'lucide-react';

export default function GanttView({ initialProjectId = null, onNavigateBack = null }) {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);

  // Leer parámetro de URL si existe (ej. #gantt?project=1)
  useEffect(() => {
    try {
      const hash = window.location.hash || '';
      if (hash.includes('project=')) {
        const pId = hash.split('project=')[1]?.split('&')[0];
        if (pId) setSelectedProjectId(pId);
      }
    } catch (e) {
      console.warn('Error al leer params de URL:', e);
    }
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.get('/projects');
      setProjects(resp.projects || []);
    } catch (err) {
      setError(err.message || 'Error al cargar proyectos e hitos para el Diagrama de Gantt.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[65vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-9 h-9 text-[#2c4001] dark:text-[#a1c62e] animate-spin" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
            Generando Diagrama de Gantt Multi-Proyecto...
          </p>
        </div>
      </div>
    );
  }

  if (error && projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 my-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 mx-auto text-rose-600 dark:text-rose-400" />
        <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">No fue posible cargar los proyectos</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
        <button
          type="button"
          onClick={loadProjects}
          className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-2 sm:px-6 py-5 pb-20 space-y-5">
      {/* Botón de Retorno si se requiere */}
      {onNavigateBack && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onNavigateBack}
            className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#152202] hover:bg-[#f4f8ed] dark:hover:bg-[#1f3004] text-slate-700 dark:text-slate-200 border border-[#e2ebd3] dark:border-[#253905] text-xs font-bold flex items-center gap-2 transition shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la vista anterior</span>
          </button>
        </div>
      )}

      {/* Diagrama de Gantt Principal */}
      <GanttChart
        projects={projects}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        onRefresh={loadProjects}
      />
    </div>
  );
}
