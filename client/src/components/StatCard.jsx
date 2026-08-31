import React from 'react';

export default function StatCard({ title, value, unit = '', subtitle, icon: Icon, color = 'emerald', alert = false, badge = null }) {
  const colorStyles = {
    emerald: 'border-emerald-500/20 bg-slate-900/80 text-emerald-400',
    blue: 'border-blue-500/20 bg-slate-900/80 text-blue-400',
    amber: 'border-amber-500/30 bg-amber-950/20 text-amber-400',
    rose: 'border-rose-500/30 bg-rose-950/20 text-rose-400',
    purple: 'border-purple-500/20 bg-slate-900/80 text-purple-400'
  };

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-sm transition-all relative overflow-hidden ${colorStyles[color] || colorStyles.emerald} ${alert ? 'ring-2 ring-rose-500/60 shadow-lg shadow-rose-950/50' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
            {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 ${alert ? 'text-rose-400 animate-bounce' : 'text-slate-300'}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}
