'use client';

import React from 'react';
import { LeagueCode } from '@/types';
import { LEAGUES_DATA } from '@/lib/mock-data';
import {
  Trophy,
  Flame,
  Globe2,
  Dribbble,
  Gamepad2,
  Zap,
  Target,
  Medal,
  ChevronRight,
} from 'lucide-react';

interface SportsbookSidebarProps {
  selectedLeague: LeagueCode | 'ALL';
  onSelectLeague: (league: LeagueCode | 'ALL') => void;
  leagueCounts: Record<LeagueCode | 'ALL', number>;
}

export const SportsbookSidebar: React.FC<SportsbookSidebarProps> = ({
  selectedLeague,
  onSelectLeague,
  leagueCounts,
}) => {
  const topLeagues: { code: LeagueCode; name: string; country: string; flag: string; emblem?: string }[] = [
    { code: 'PL', name: 'Premier League', country: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', emblem: LEAGUES_DATA.PL.emblem_url },
    { code: 'PD', name: 'La Liga', country: 'Spain', flag: '🇪🇸', emblem: LEAGUES_DATA.PD.emblem_url },
    { code: 'SA', name: 'Serie A', country: 'Italy', flag: '🇮🇹', emblem: LEAGUES_DATA.SA.emblem_url },
    { code: 'BL1', name: 'Bundesliga', country: 'Germany', flag: '🇩🇪', emblem: LEAGUES_DATA.BL1.emblem_url },
    { code: 'FL1', name: 'Ligue 1', country: 'France', flag: '🇫🇷', emblem: LEAGUES_DATA.FL1.emblem_url },
    { code: 'CL', name: 'Champions League', country: 'Europe', flag: '⭐', emblem: LEAGUES_DATA.CL.emblem_url },
    { code: 'EL', name: 'Europa League', country: 'Europe', flag: '🏆', emblem: LEAGUES_DATA.EL.emblem_url },
  ];

  const sportsCategories = [
    { id: 'soccer', name: 'Soccer / Football', count: leagueCounts.ALL, icon: Trophy, active: true },
    { id: 'basketball', name: 'Basketball (NBA / Euro)', count: 8, icon: Dribbble, active: false },
    { id: 'tennis', name: 'Tennis (ATP / WTA)', count: 14, icon: Target, active: false },
    { id: 'esports', name: 'Esports (CS2 / Dota 2)', count: 6, icon: Gamepad2, active: false },
    { id: 'american-football', name: 'American Football', count: 4, icon: Zap, active: false },
    { id: 'ice-hockey', name: 'Ice Hockey (NHL)', count: 5, icon: Medal, active: false },
  ];

  return (
    <aside className="w-full lg:w-[240px] xl:w-[260px] shrink-0 bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 space-y-5 lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-92px)] lg:overflow-y-auto no-scrollbar shadow-lg">
      {/* Top Section: Top Leagues / Popular Competitions */}
      <div>
        <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-800/60">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
            <Flame className="w-3.5 h-3.5 text-emerald-400" />
            Top Leagues
          </div>
          <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            Tier 1
          </span>
        </div>

        <nav className="space-y-0.5 mt-1.5" aria-label="Top Leagues Navigation">
          {/* All Leagues Option */}
          <button
            type="button"
            onClick={() => onSelectLeague('ALL')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all ${
              selectedLeague === 'ALL'
                ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500 font-semibold shadow-xs'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-l-2 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">All Top 5 Leagues</span>
            </div>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.2 rounded ${
                selectedLeague === 'ALL'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {leagueCounts.ALL}
            </span>
          </button>

          {/* Individual League Rows */}
          {topLeagues.map((lg) => {
            const count = leagueCounts[lg.code] || 0;
            const isSelected = selectedLeague === lg.code;

            return (
              <button
                key={lg.code}
                type="button"
                onClick={() => onSelectLeague(lg.code)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all ${
                  isSelected
                    ? 'bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500 font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border-l-2 border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {lg.emblem ? (
                    <div className="w-5 h-5 rounded flex items-center justify-center bg-slate-950 border border-slate-800 shrink-0 p-0.5 overflow-hidden" title={`${lg.name} Official Badge`}>
                      <img
                        src={lg.emblem}
                        alt={`${lg.name} badge`}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-base leading-none shrink-0" title={lg.country}>
                      {lg.flag}
                    </span>
                  )}
                  <div className="text-left truncate">
                    <span className="block truncate font-medium">{lg.name}</span>
                    <span className="block text-[10px] text-slate-500 font-mono -mt-0.5 truncate">
                      {lg.country}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.2 rounded shrink-0 ml-1.5 ${
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Sports Categories */}
      <div className="pt-2 border-t border-slate-800/60">
        <div className="flex items-center justify-between px-2 pb-2 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 text-slate-400" />
            Sports Hub
          </div>
        </div>

        <nav className="space-y-0.5" aria-label="Sports Categories">
          {sportsCategories.map((sport) => {
            const Icon = sport.icon;
            return (
              <div
                key={sport.id}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs select-none ${
                  sport.active
                    ? 'text-slate-200 font-semibold bg-slate-800/40'
                    : 'text-slate-400 hover:text-slate-300 cursor-not-allowed opacity-75'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Icon className={`w-3.5 h-3.5 ${sport.active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="truncate">{sport.name}</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-500">
                  {sport.count}
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
