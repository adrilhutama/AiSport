'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, MarketType, BetSelection, LeagueCode } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { MatchRow } from '@/components/MatchRow';
import { LEAGUES_DATA } from '@/lib/mock-data';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SportsbookTableProps {
  fixtures: Fixture[];
  selectedLegs: LegSelection[];
  onToggleLeg: (leg: LegSelection) => void;
  onOpenMatrix: (fixture: Fixture) => void;
  selectedLeague?: LeagueCode | 'ALL';
  recentlyUpdatedIds?: Set<string>;
}

export const SportsbookTable: React.FC<SportsbookTableProps> = ({
  fixtures,
  selectedLegs,
  onToggleLeg,
  onOpenMatrix,
  selectedLeague = 'ALL',
  recentlyUpdatedIds = new Set(),
}) => {
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(new Set());
  const [activeMarketTab, setActiveMarketTab] = useState<
    'All Markets' | '1X2' | 'Asian Handicap' | 'Goal Totals' | 'BTTS'
  >('All Markets');

  const toggleCollapseLeague = (leagueCode: string) => {
    setCollapsedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(leagueCode)) {
        next.delete(leagueCode);
      } else {
        next.add(leagueCode);
      }
      return next;
    });
  };

  // Check for correlation conflict on the same match
  const hasConflict = selectedLegs.some((l1, idx1) =>
    selectedLegs.some((l2, idx2) => idx1 !== idx2 && l1.fixtureId === l2.fixtureId)
  );

  // Filter fixtures by selectedLeague
  const filteredFixtures =
    selectedLeague && selectedLeague !== 'ALL'
      ? fixtures.filter((f) => f.league === selectedLeague)
      : fixtures;

  // Group fixtures by league
  const groupedFixtures = filteredFixtures.reduce((acc, f) => {
    if (!acc[f.league]) acc[f.league] = [];
    acc[f.league].push(f);
    return acc;
  }, {} as Record<string, Fixture[]>);

  const leagueOrder: string[] = ['PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL'].filter(
    (code) => selectedLeague === 'ALL' || selectedLeague === code
  );

  const isLegSelected = (fixtureId: string, market: MarketType, selection: BetSelection) => {
    return selectedLegs.some(
      (l) => l.fixtureId === fixtureId && l.market === market && l.selection === selection
    );
  };

  return (
    <div className="space-y-3">
      {/* Correlation Conflict Alert Banner */}
      {hasConflict && (
        <div className="flex items-center gap-2.5 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono shadow-xs animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <strong className="text-amber-200">Correlation Alert</strong>: Multiple bets on the same match detected in your slip. Odds will be adjusted by quantitative joint covariance.
          </div>
        </div>
      )}

      {/* Top Market Navigation Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-900/90 border border-slate-800/90 rounded-xl shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(
            ['All Markets', '1X2', 'Asian Handicap', 'Goal Totals', 'BTTS'] as const
          ).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMarketTab(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 cursor-pointer ${
                activeMarketTab === m
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>Round: <strong className="text-white font-semibold">Upcoming Matchday Round</strong></span>
        </div>
      </div>

      {/* Dedicated Market Tab Grid (when a specific market is highlighted) */}
      {activeMarketTab !== 'All Markets' && activeMarketTab !== '1X2' && (
        <div className="bg-slate-900/95 border border-slate-800/90 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300">
            <span className="font-bold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Quick {activeMarketTab} Odds Board
            </span>
            <span className="text-[11px] text-slate-500">
              Showing active lines across European fixtures
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filteredFixtures.slice(0, 6).map((f) => {
              const qa = f.quantAnalysis || analyzeFixtureQuant(f);
              const odds = f.marketOdds;
              const homeName = f.homeTeam?.name || 'Home';
              const awayName = f.awayTeam?.name || 'Away';

              return (
                <div
                  key={`quick-${f.id}`}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="truncate max-w-[150px]">
                    <div className="font-bold text-white truncate">{homeName}</div>
                    <div className="text-slate-400 truncate">{awayName}</div>
                  </div>

                  {activeMarketTab === 'Goal Totals' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleLeg({
                            fixtureId: f.id,
                            league: f.league,
                            homeTeam: homeName,
                            awayTeam: awayName,
                            homeCrest: f.homeTeam?.crest_url,
                            awayCrest: f.awayTeam?.crest_url,
                            homeForm: f.homeTeam?.form,
                            awayForm: f.awayTeam?.form,
                            market: 'Totals',
                            selection: 'Over 2.5',
                            odds: odds?.over_25_odds || 1.85,
                            trueProb: qa.trueProbabilities.over25,
                            ev: qa.expectedValues.over25EV,
                            matchTime: f.match_time,
                          })
                        }
                        className={`px-2 py-1 rounded border text-[11px] font-bold ${
                          isLegSelected(f.id, 'Totals', 'Over 2.5')
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Over 2.5 @ {(odds?.over_25_odds || 1.85).toFixed(2)}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onToggleLeg({
                            fixtureId: f.id,
                            league: f.league,
                            homeTeam: homeName,
                            awayTeam: awayName,
                            homeCrest: f.homeTeam?.crest_url,
                            awayCrest: f.awayTeam?.crest_url,
                            homeForm: f.homeTeam?.form,
                            awayForm: f.awayTeam?.form,
                            market: 'Totals',
                            selection: 'Under 2.5',
                            odds: odds?.under_25_odds || 1.95,
                            trueProb: qa.trueProbabilities.under25,
                            ev: qa.expectedValues.under25EV,
                            matchTime: f.match_time,
                          })
                        }
                        className={`px-2 py-1 rounded border text-[11px] font-bold ${
                          isLegSelected(f.id, 'Totals', 'Under 2.5')
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Under 2.5 @ {(odds?.under_25_odds || 1.95).toFixed(2)}
                      </button>
                    </div>
                  )}

                  {activeMarketTab === 'Asian Handicap' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleLeg({
                            fixtureId: f.id,
                            league: f.league,
                            homeTeam: homeName,
                            awayTeam: awayName,
                            homeCrest: f.homeTeam?.crest_url,
                            awayCrest: f.awayTeam?.crest_url,
                            homeForm: f.homeTeam?.form,
                            awayForm: f.awayTeam?.form,
                            market: 'Asian Handicap',
                            selection: 'Home -0.5',
                            odds: odds?.home_odds || 1.85,
                            trueProb: qa.trueProbabilities.home,
                            ev: qa.expectedValues.homeEV,
                            matchTime: f.match_time,
                          })
                        }
                        className={`px-2 py-1 rounded border text-[11px] font-bold ${
                          isLegSelected(f.id, 'Asian Handicap', 'Home -0.5')
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Home -0.5 @ {(odds?.home_odds || 1.85).toFixed(2)}
                      </button>
                    </div>
                  )}

                  {activeMarketTab === 'BTTS' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onToggleLeg({
                            fixtureId: f.id,
                            league: f.league,
                            homeTeam: homeName,
                            awayTeam: awayName,
                            homeCrest: f.homeTeam?.crest_url,
                            awayCrest: f.awayTeam?.crest_url,
                            homeForm: f.homeTeam?.form,
                            awayForm: f.awayTeam?.form,
                            market: 'BTTS',
                            selection: 'Yes',
                            odds: odds?.btts_odds?.['btts_yes'] || 1.75,
                            trueProb: qa.trueProbabilities.bttsYes,
                            ev: qa.expectedValues.bttsYesEV,
                            matchTime: f.match_time,
                          })
                        }
                        className={`px-2 py-1 rounded border text-[11px] font-bold ${
                          isLegSelected(f.id, 'BTTS', 'Yes')
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                            : 'bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Yes @ {(odds?.btts_odds?.['btts_yes'] || 1.75).toFixed(2)}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Unified Horizontal Odds Board by League */}
      {leagueOrder.map((code) => {
        const leagueFixtures = groupedFixtures[code] || [];
        if (leagueFixtures.length === 0) return null;

        const leagueInfo = LEAGUES_DATA[code as keyof typeof LEAGUES_DATA];
        const isCollapsed = collapsedLeagues.has(code);

        return (
          <div
            key={code}
            className="bg-slate-900/90 border border-slate-800/90 rounded-xl overflow-hidden shadow-md"
          >
            {/* League Section Header Accordion */}
            <div
              onClick={() => toggleCollapseLeague(code)}
              className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-950/80 hover:bg-slate-900 border-b border-slate-800/80 transition-colors text-left select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg leading-none shrink-0" title={leagueInfo.country}>
                  {leagueInfo.flag}
                </span>
                <div className="flex items-center gap-2 truncate">
                  <h3 className="font-bold text-white text-xs sm:text-sm tracking-tight truncate">
                    {leagueInfo.country} • {leagueInfo.name}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {leagueFixtures.length} Matches
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-slate-400">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (leagueFixtures[0]) onOpenMatrix(leagueFixtures[0]);
                  }}
                  className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded"
                >
                  <BarChart2 className="w-3 h-3" />
                  <span>Quant Matrix</span>
                </button>
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Odds Table Rows */}
            {!isCollapsed && (
              <div className="overflow-x-auto no-scrollbar">
                {/* High-Density Header Column Labels */}
                <div className="min-h-[28px] py-1 px-3 grid grid-cols-12 gap-2 items-center text-[10px] font-mono font-bold text-slate-400 bg-slate-950/60 border-b border-slate-800/80 uppercase tracking-wider select-none min-w-[760px]">
                  <div className="col-span-5 lg:col-span-4">Event / Teams & Form</div>
                  <div className="col-span-3 text-center">1X2 Consensus</div>
                  <div className="col-span-2 hidden md:block text-center">Asian Handicap (-0.5 / +0.5)</div>
                  <div className="col-span-3 md:col-span-2 text-center">Totals (O/U)</div>
                  <div className="col-span-1 text-right">More</div>
                </div>

                {/* Match Rows */}
                <div className="divide-y divide-slate-800/60">
                  {leagueFixtures.map((f) => (
                    <MatchRow
                      key={f.id}
                      fixture={f}
                      selectedLegs={selectedLegs}
                      onToggleLeg={onToggleLeg}
                      onOpenMatrix={onOpenMatrix}
                      isRecentlyUpdated={recentlyUpdatedIds.has(f.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
