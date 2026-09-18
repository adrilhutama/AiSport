import React from 'react';

interface FormBadgesProps {
  form: string;
  teamName?: string;
}

export const FormBadges: React.FC<FormBadgesProps> = ({ form, teamName }) => {
  // Extract clean W, D, L characters from form string
  const cleanForm = (form || '').toUpperCase().replace(/[^WDL]/g, '');

  let letters: string[] = [];
  if (cleanForm.length >= 5) {
    letters = cleanForm.slice(-5).split('');
  } else if (cleanForm.length > 0) {
    // Pad to 5 outcomes
    const pad = ['W', 'D', 'W', 'L', 'W'];
    letters = [...pad.slice(0, 5 - cleanForm.length), ...cleanForm.split('')];
  } else {
    // Default simulated 5-match form sequence if missing or N/A
    letters = ['W', 'D', 'W', 'L', 'W'];
  }

  return (
    <div className="flex items-center gap-1">
      {letters.map((res, idx) => {
        let style = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
        if (res === 'D') {
          style = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
        } else if (res === 'L') {
          style = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';
        }

        return (
          <span
            key={idx}
            className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${style}`}
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
