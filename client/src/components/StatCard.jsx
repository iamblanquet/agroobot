import React from 'react';

export default function StatCard({ title, value, unit = '', subtitle, icon: Icon, color = 'emerald', alert = false, badge = null }) {
  const colorStyles = {
    emerald: 'border-emerald-200 dark:border-emerald-500/20 bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-sm',
    blue: 'border-emerald-200 dark:border-blue-500/20 bg-white dark:bg-slate-900 text-slate-800 dark:text-blue-400 shadow-sm',
    amber: 'border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-400 shadow-sm',
    rose: 'border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-900 text-rose-900 dark:text-rose-400 shadow-sm',
    purple: 'border-emerald-200 dark:border-purple-500/20 bg-white dark:bg-slate-900 text-slate-800 dark:text-purple-400 shadow-sm'
  };

  const iconStyles = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200',
    blue: 'bg-emerald-50 dark:bg-blue-950/60 text-emerald-700 dark:text-blue-400 border-emerald-200',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200',
    purple: 'bg-emerald-50 dark:bg-purple-950/60 text-emerald-700 dark:text-purple-400 border-emerald-200'
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden ${colorStyles[color] || colorStyles.emerald} ${alert ? 'ring-2 ring-rose-500 shadow-md' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{value}</span>
            {unit && <span className="text-xs text-slate-600 dark:text-slate-400 font-bold">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl border ${iconStyles[color] || iconStyles.emerald} ${alert ? 'animate-bounce' : ''}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-slate-300 border border-emerald-200 dark:border-slate-700">
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}
