import React from 'react';

export default function StatCard({ title, value, unit = '', subtitle, icon: Icon, color = 'emerald', alert = false, badge = null }) {
  const colorStyles = {
    emerald: 'border-[#e2ebd3] dark:border-[#253905] bg-white dark:bg-[#152202] text-[#2c4001] dark:text-[#a1c62e] shadow-sm',
    blue: 'border-[#e2ebd3] dark:border-[#253905] bg-white dark:bg-[#152202] text-[#2c4001] dark:text-[#a1c62e] shadow-sm',
    amber: 'border-[#f3e3ba] dark:border-[#5e4216] bg-white dark:bg-[#152202] text-[#a87d13] dark:text-[#dfb75c] shadow-sm',
    rose: 'border-rose-200 dark:border-rose-900/50 bg-white dark:bg-[#152202] text-rose-800 dark:text-rose-400 shadow-sm',
    purple: 'border-[#e2ebd3] dark:border-[#253905] bg-white dark:bg-[#152202] text-[#2c4001] dark:text-[#a1c62e] shadow-sm'
  };

  const iconStyles = {
    emerald: 'bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606]',
    blue: 'bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606]',
    amber: 'bg-[#fdfaf3] dark:bg-[#362409] text-[#a87d13] dark:text-[#dfb75c] border border-[#f3e3ba] dark:border-[#704f15]',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60',
    purple: 'bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606]'
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all relative overflow-hidden ${colorStyles[color] || colorStyles.emerald} ${alert ? 'ring-2 ring-rose-500 shadow-md' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold text-[#5c6b4b] dark:text-[#a1c62e] uppercase tracking-wider">{title}</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <span className="text-3xl font-black text-[#1c2d01] dark:text-white tracking-tight">{value}</span>
            {unit && <span className="text-xs text-[#5c6b4b] dark:text-slate-300 font-bold">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-[#7a8a65] dark:text-slate-400 mt-1 font-medium">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${iconStyles[color] || iconStyles.emerald} ${alert ? 'animate-bounce' : ''}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {badge && (
        <div className="mt-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#f4f8ed] dark:bg-[#1f3004] text-[#2c4001] dark:text-[#a1c62e] border border-[#d3e2be] dark:border-[#3e5606]">
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}
