'use client';

import React, { useState } from 'react';
import { LeagueCode } from '@/types';
import { LEAGUES_DATA } from '@/lib/mock-data';

interface LeagueFilterProps {
  selectedLeague: LeagueCode | 'ALL';
  onSelectLeague: (league: LeagueCode | 'ALL') => void;
  fixtureCounts: Record<LeagueCode | 'ALL', number>;
}

export const LeagueFilter: React.FC<LeagueFilterProps> = ({
  selectedLeague,
  onSelectLeague,
  fixtureCounts,
}) => {
  const [emblemErrors, setEmblemErrors] = useState<Record<string, boolean>>({});

  const leagues: Array<{ code: LeagueCode | 'ALL'; name: string; flag: string; emblem?: string }> = [
    { code: 'ALL', name: 'All Leagues', flag: '🇪🇺' },
    { code: 'PL', name: 'Premier League', flag: LEAGUES_DATA.PL.flag, emblem: LEAGUES_DATA.PL.emblem_url },
    { code: 'PD', name: 'La Liga', flag: LEAGUES_DATA.PD.flag, emblem: LEAGUES_DATA.PD.emblem_url },
    { code: 'SA', name: 'Serie A', flag: LEAGUES_DATA.SA.flag, emblem: LEAGUES_DATA.SA.emblem_url },
    { code: 'BL1', name: 'Bundesliga', flag: LEAGUES_DATA.BL1.flag, emblem: LEAGUES_DATA.BL1.emblem_url },
    { code: 'FL1', name: 'Ligue 1', flag: LEAGUES_DATA.FL1.flag, emblem: LEAGUES_DATA.FL1.emblem_url },
    { code: 'CL', name: 'Champions League', flag: LEAGUES_DATA.CL.flag, emblem: LEAGUES_DATA.CL.emblem_url },
    { code: 'EL', name: 'Europa League', flag: LEAGUES_DATA.EL.flag, emblem: LEAGUES_DATA.EL.emblem_url },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none no-scrollbar">
      {leagues.map((lg) => {
        const isSelected = selectedLeague === lg.code;
        const count = fixtureCounts[lg.code] || 0;
        const hasError = emblemErrors[lg.code];

        return (
          <button
            key={lg.code}
            onClick={() => onSelectLeague(lg.code)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium whitespace-nowrap transition-all border ${
              isSelected
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm ring-1 ring-emerald-500/30'
                : 'bg-terminal-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            {lg.emblem && !hasError ? (
              <img
                src={lg.emblem}
                alt={lg.name}
                onError={() => setEmblemErrors((prev) => ({ ...prev, [lg.code]: true }))}
                className="w-4 h-4 object-contain filter brightness-110"
              />
            ) : (
              <span className="text-sm" role="img" aria-label={lg.name}>
                {lg.flag}
              </span>
            )}
            <span>{lg.name}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isSelected
                  ? 'bg-emerald-400/20 text-emerald-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
