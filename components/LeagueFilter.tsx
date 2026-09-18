'use client';

import React from 'react';
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
  const leagues: Array<{ code: LeagueCode | 'ALL'; name: string; flag: string }> = [
    { code: 'ALL', name: 'All Leagues', flag: '🇪🇺' },
    { code: 'PL', name: 'Premier League', flag: LEAGUES_DATA.PL.flag },
    { code: 'PD', name: 'La Liga', flag: LEAGUES_DATA.PD.flag },
    { code: 'SA', name: 'Serie A', flag: LEAGUES_DATA.SA.flag },
    { code: 'BL1', name: 'Bundesliga', flag: LEAGUES_DATA.BL1.flag },
    { code: 'FL1', name: 'Ligue 1', flag: LEAGUES_DATA.FL1.flag },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-2 scrollbar-none no-scrollbar">
      {leagues.map((lg) => {
        const isSelected = selectedLeague === lg.code;
        const count = fixtureCounts[lg.code] || 0;

        return (
          <button
            key={lg.code}
            onClick={() => onSelectLeague(lg.code)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium whitespace-nowrap transition-all border ${
              isSelected
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-terminal-900/80 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span className="text-sm" role="img" aria-label={lg.name}>
              {lg.flag}
            </span>
            <span>{lg.name}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                isSelected
                  ? 'bg-cyan-400/20 text-cyan-200'
                  : 'bg-slate-800 text-slate-500'
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
