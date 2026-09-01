import React from 'react';

export default function StatCard({ title, value, unit = '', subtitle, icon: Icon, color = 'emerald', alert = false, badge = null }) {
  const colorStyles = {
    emerald: 'border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-slate-900/80 text-emerald-700 dark:text-emerald-400 shadow-sm dark:shadow-none',
    blue: 'border-blue-200 dark:border-blue-500/20 bg-white dark:bg-slate-900/80 text-blue-700 dark:text-blue-400 shadow-sm dark:shadow-none',
    amber: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400 shadow-sm dark:shadow-none',
    rose: 'border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/20 text-rose-800 dark:text-rose-400 shadow-sm dark:shadow-none',
    purple: 'border-purple-200 dark:border-purple-500/20 bg-white dark:bg-slate-900/80 text-purple-700 dark:text-purple-400 shadow-sm dark:shadow-none'
  };

  return (
    <div className={`p-4 rounded-2xl border backdrop-blur-sm transition-all relative overflow-hidden ${colorStyles[color] || colorStyles.emerald} ${alert ? 'ring-2 ring-rose-500/80 shadow-lg shadow-rose-500/10' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
            {unit && <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 ${alert ? 'text-rose-600 dark:text-rose-400 animate-bounce' : 'text-slate-700 dark:text-slate-300'}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}
