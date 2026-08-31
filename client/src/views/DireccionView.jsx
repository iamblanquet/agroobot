import React, { useState, useEffect } from 'react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import {
  BarChart3,
  TrendingUp,
  Fuel,
  Tractor,
  Layers,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  PieChart,
  MapPin
} from 'lucide-react';

export default function DireccionView() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await api.get('/stats/direction');
      setData(resp);
    } catch (err) {
      setError(err.message || 'Error al obtener métricas ejecutivas de dirección.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-xs text-slate-400">Cargando KPIs Consolidados del Ciclo Agrícola...</p>
        </div>
      </div>
    );
  }

  const { kpis, proyectos = [] } = data || {};

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-24 space-y-6">
      {/* Header Ejecutivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" /> Tablero de Control Ejecutivo & Dirección
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Consolidado estratégico: Hectáreas habilitadas vs sembradas, discrepancias dron y eficiencia operativa
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar KPIs</span>
        </button>
      </div>

      {/* TARJETAS EJECUTIVAS (KPIS DE DIRECCIÓN) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Superficie Meta Consolidada"
          value={kpis?.total_meta_ha || 0}
          unit="ha"
          subtitle={`${kpis?.total_proyectos || 0} proyectos activos`}
          icon={Layers}
          color="purple"
        />

        <StatCard
          title="Avance Total Habilitado"
          value={kpis?.total_campo_ha || 0}
          unit="ha"
          subtitle={`${kpis?.porcentaje_avance_global || 0}% de la meta global`}
          icon={TrendingUp}
          color="emerald"
          badge={`${kpis?.porcentaje_avance_global || 0}% completado`}
        />

        <StatCard
          title="Discrepancia Dron vs Campo"
          value={Math.abs(kpis?.discrepancia_ha || 0)}
          unit="ha"
          subtitle={kpis?.discrepancia_ha > 0 ? 'Campo sobredeclara vs ortofoto' : 'Medición dron en línea'}
          icon={AlertTriangle}
          color={Math.abs(kpis?.discrepancia_ha || 0) > 2 ? 'amber' : 'blue'}
          badge={`${kpis?.porcentaje_discrepancia || 0}% diff`}
        />

        <StatCard
          title="Consumo Total Diésel"
          value={kpis?.total_diesel_litros || 0}
          unit="L"
          subtitle={`${kpis?.total_horas_maquina || 0} hrs totales máquina`}
          icon={Fuel}
          color="blue"
        />
      </div>

      {/* SECCIÓN ANALÍTICA: COMPARATIVA DE PROYECTOS */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-950 text-purple-400 border border-purple-600/40">
              <PieChart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Desglose por Proyecto & Auditoría Dron</h3>
              <p className="text-[11px] text-slate-400">
                Auditoría cruzada de hectáreas declaradas por residentes vs verificación aérea
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Proyecto</th>
                <th className="py-3 px-4">Ciclo</th>
                <th className="py-3 px-4 text-right">Meta (ha)</th>
                <th className="py-3 px-4 text-right">Campo (ha)</th>
                <th className="py-3 px-4 text-right">Dron (ha)</th>
                <th className="py-3 px-4 text-right">Discrepancia</th>
                <th className="py-3 px-4 text-center">Avance</th>
                <th className="py-3 px-4 text-center">Frentes</th>
                <th className="py-3 px-4 text-center">Incidencias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {proyectos.map((p) => {
                const haCampo = parseFloat(p.ha_campo) || 0;
                const haDron = p.ha_dron !== null ? parseFloat(p.ha_dron) : null;
                const meta = parseFloat(p.superficie_meta_ha) || 1;
                const pct = Math.min(100, Math.round((haCampo / meta) * 100));
                const diff = haDron !== null ? parseFloat((haCampo - haDron).toFixed(2)) : null;

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div>{p.nombre}</div>
                      <span className="text-[10px] text-slate-500 font-normal">{p.fase_catalogo}</span>
                    </td>
                    <td className="py-3 px-4 font-mono">{p.ciclo}</td>
                    <td className="py-3 px-4 text-right font-bold text-white">{meta} ha</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">{haCampo} ha</td>
                    <td className="py-3 px-4 text-right text-sky-400 font-bold">
                      {haDron !== null ? `${haDron} ha` : <span className="text-slate-500 font-normal italic">Sin vuelo</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {diff !== null ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${diff > 0 ? 'bg-amber-950 text-amber-300 border border-amber-700' : 'bg-emerald-950 text-emerald-300 border border-emerald-700'}`}>
                          {diff > 0 ? `+${diff} ha` : `${diff} ha`}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="w-24 mx-auto space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span>{pct}%</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5">
                          <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300">
                        {p.num_obras} frentes
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {p.incidencias_activas > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                          {p.incidencias_activas} activas
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                          0 activas
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
