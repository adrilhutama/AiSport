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
          bg = 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60';
        } else if (res === 'D') {
          bg = 'bg-amber-950/80 text-amber-400 border-amber-700/60';
        } else if (res === 'L') {
          bg = 'bg-rose-950/80 text-rose-400 border-rose-700/60';
        }
        return (
          <span
            key={idx}
            className={`w-4 h-4 rounded text-[10px] font-mono font-bold flex items-center justify-center border ${bg}`}
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
