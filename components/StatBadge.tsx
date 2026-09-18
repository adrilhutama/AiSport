import React from 'react';

interface FormBadgesProps {
  form: string;
}

export const FormBadges: React.FC<FormBadgesProps> = ({ form }) => {
  if (!form || form.toUpperCase() === 'N/A' || form.trim() === '') {
    return (
      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
        N/A
      </span>
    );
  }

  const validChars = form.toUpperCase().replace(/[^WDL]/g, '');
  if (!validChars) {
    return (
      <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
        N/A
      </span>
    );
  }

  const letters = validChars.slice(-5).split('');

  return (
    <div className="flex items-center gap-1">
      {letters.map((res, idx) => {
        let bg = 'bg-slate-800 text-slate-400 border-slate-700';
        if (res === 'W') {
          bg = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-xs shadow-emerald-950/50';
        } else if (res === 'D') {
          bg = 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-xs shadow-amber-950/50';
        } else if (res === 'L') {
          bg = 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-xs shadow-rose-950/50';
        }
        return (
          <span
            key={idx}
            className={`w-5 h-5 rounded-full text-[10px] font-mono font-extrabold flex items-center justify-center border ${bg}`}
          >
            {res}
          </span>
        );
      })}
    </div>
  );
};

interface EVBadgeProps {
  ev: number;
}

export const EVBadge: React.FC<EVBadgeProps> = ({ ev }) => {
  if (ev <= 0) return null;

  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      +{ev.toFixed(1)}% EV
    </span>
  );
};
