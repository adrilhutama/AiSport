'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, MarketType, BetSelection, LeagueCode } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { TeamCrest } from '@/components/TeamCrest';
import { FormBadges, EVBadge } from '@/components/StatBadge';
import { LEAGUES_DATA } from '@/lib/mock-data';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Layers,
  AlertTriangle,
  Info,
  Calendar,
} from 'lucide-react';

interface SportsbookTableProps {
  fixtures: Fixture[];
  selectedLegs: LegSelection[];
  onToggleLeg: (leg: LegSelection) => void;
  onOpenMatrix: (fixture: Fixture) => void;
  selectedLeague?: LeagueCode | 'ALL';
}

export const SportsbookTable: React.FC<SportsbookTableProps> = ({
  fixtures,
  selectedLegs,
  onToggleLeg,
  onOpenMatrix,
  selectedLeague = 'ALL',
}) => {
  // Expanded match IDs for the "More (+)" accordion
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  // Collapsed league sections
  const [collapsedLeagues, setCollapsedLeagues] = useState<Set<string>>(new Set());
  // Active market filter tab
  const [activeMarketTab, setActiveMarketTab] = useState<
    'All Markets' | '1X2' | 'Asian Handicap' | 'Goal Totals' | 'BTTS'
  >('All Markets');

  const toggleExpandMatch = (fixtureId: string) => {
    setExpandedMatches((prev) => {
      const next = new Set(prev);
      if (next.has(fixtureId)) {
        next.delete(fixtureId);
      } else {
        next.add(fixtureId);
      }
      return next;
    });
  };

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

  // Helper to check if a specific selection is active in the betting slip
  const isSelected = (fixtureId: string, market: MarketType, selection: BetSelection) => {
    return selectedLegs.some(
      (l) => l.fixtureId === fixtureId && l.market === market && l.selection === selection
    );
  };

  // Helper to check for conflict on same match
  const hasConflict = (fixtureId: string) => {
    const legsForFixture = selectedLegs.filter((l) => l.fixtureId === fixtureId);
    return legsForFixture.length > 1;
  };

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

  const leagueOrder: string[] = ['PL', 'PD', 'SA', 'BL1', 'FL1'].filter(
    (code) => selectedLeague === 'ALL' || selectedLeague === code
  );

  return (
    <div className="space-y-4">
      {/* Top Market Navigation Tabs Bar */}
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

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
          <span>Round: <strong className="text-white">Upcoming Matchday Round</strong></span>
        </div>
      </div>

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
            {/* League Group Header Accordion */}
            <div
              onClick={() => toggleCollapseLeague(code)}
              className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 bg-slate-950/80 hover:bg-slate-900 border-b border-slate-800/80 transition-colors text-left select-none cursor-pointer"
            >
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
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

              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-[11px] font-mono hidden sm:inline text-slate-500">
                  Poisson 6x6 Calibrated
                </span>
                {isCollapsed ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Odds Table for League */}
            {!isCollapsed && (
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  {/* Dynamic Table Header depending on market tab */}
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-slate-800/80 text-[11px] font-mono font-semibold text-slate-400 select-none">
                      <th className="py-2 px-3 w-[36%] font-medium text-slate-300">
                        Event / Teams
                      </th>

                      {(activeMarketTab === 'All Markets' || activeMarketTab === '1X2') && (
                        <>
                          <th className="py-2 px-1 text-center w-[8%]">1</th>
                          <th className="py-2 px-1 text-center w-[8%]">X</th>
                          <th className="py-2 px-1 text-center w-[8%]">2</th>
                          <th className="py-2 px-1 text-center w-[12%]">Handicap (AH)</th>
                          <th className="py-2 px-1 text-center w-[6%] text-slate-500">Total</th>
                          <th className="py-2 px-1 text-center w-[9%]">Over</th>
                          <th className="py-2 px-1 text-center w-[9%]">Under</th>
                        </>
                      )}

                      {activeMarketTab === 'Asian Handicap' && (
                        <>
                          <th className="py-2 px-1 text-center w-[13%]">Home -1.5</th>
                          <th className="py-2 px-1 text-center w-[13%]">Away +1.5</th>
                          <th className="py-2 px-1 text-center w-[14%]">Home -0.5</th>
                          <th className="py-2 px-1 text-center w-[14%]">Away +0.5</th>
                        </>
                      )}

                      {activeMarketTab === 'Goal Totals' && (
                        <>
                          <th className="py-2 px-1 text-center w-[9%]">Over 1.5</th>
                          <th className="py-2 px-1 text-center w-[9%]">Under 1.5</th>
                          <th className="py-2 px-1 text-center w-[11%]">Over 2.5</th>
                          <th className="py-2 px-1 text-center w-[11%]">Under 2.5</th>
                          <th className="py-2 px-1 text-center w-[9%]">Over 3.5</th>
                          <th className="py-2 px-1 text-center w-[9%]">Under 3.5</th>
                        </>
                      )}

                      {activeMarketTab === 'BTTS' && (
                        <>
                          <th className="py-2 px-1 text-center w-[27%]">BTTS Yes</th>
                          <th className="py-2 px-1 text-center w-[27%]">BTTS No</th>
                        </>
                      )}

                      <th className="py-2 px-2 text-center w-[6%] text-slate-500">More</th>
                    </tr>
                  </thead>

                  {/* Table Rows */}
                  <tbody className="divide-y divide-slate-800/50 text-xs">
                    {leagueFixtures.map((fixture) => {
                      const analysis = fixture.quantAnalysis || analyzeFixtureQuant(fixture);
                      const odds = fixture.marketOdds;
                      const isExpanded = expandedMatches.has(fixture.id);
                      const hasMatchConflict = hasConflict(fixture.id);

                      const homeName = fixture.homeTeam?.name || 'Home';
                      const awayName = fixture.awayTeam?.name || 'Away';
                      const homeForm = fixture.homeTeam?.form || 'WDLWW';
                      const awayForm = fixture.awayTeam?.form || 'DWDWL';

                      // Format kickoff date
                      const dateObj = new Date(fixture.match_time);
                      const kickoffTime = dateObj.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const kickoffDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(
                        dateObj.getMonth() + 1
                      ).padStart(2, '0')}`;

                      // Odds Values
                      const homeOdds = odds?.home_odds || 2.0;
                      const drawOdds = odds?.draw_odds || 3.2;
                      const awayOdds = odds?.away_odds || 3.5;

                      const over15Odds = odds?.totals_odds?.['over_1.5'] || 1.25;
                      const under15Odds = odds?.totals_odds?.['under_1.5'] || 3.8;
                      const over25Odds =
                        odds?.over_25_odds || odds?.totals_odds?.['over_2.5'] || 1.85;
                      const under25Odds =
                        odds?.under_25_odds || odds?.totals_odds?.['under_2.5'] || 1.95;
                      const over35Odds = odds?.totals_odds?.['over_3.5'] || 3.1;
                      const under35Odds = odds?.totals_odds?.['under_3.5'] || 1.38;

                      const ahHome15Odds = odds?.handicap_odds?.['home_-1.5'] || 3.4;
                      const ahAway15Odds = odds?.handicap_odds?.['away_+1.5'] || 1.32;
                      const ahHome05Odds = odds?.handicap_odds?.['home_-0.5'] || homeOdds;
                      const ahAway05Odds = odds?.handicap_odds?.['away_+0.5'] || 1.85;

                      const bttsYesOdds = odds?.btts_odds?.btts_yes || 1.75;
                      const bttsNoOdds = odds?.btts_odds?.btts_no || 2.05;

                      // EVs
                      const homeEV = analysis.expectedValues.homeEV;
                      const drawEV = analysis.expectedValues.drawEV;
                      const awayEV = analysis.expectedValues.awayEV;
                      const over25EV = analysis.expectedValues.over25EV;
                      const under25EV = analysis.expectedValues.under25EV;
                      const ah05EV =
                        analysis.expectedValues.asianHandicapEV?.['home_-0.5'] || homeEV;

                      return (
                        <React.Fragment key={fixture.id}>
                          {/* Main Match Row */}
                          <tr className="hover:bg-slate-800/40 transition-colors group">
                            {/* Left Cell: Event / Teams */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2 sm:gap-2.5">
                                {/* Kickoff Time & Quant Matrix Trigger */}
                                <div className="flex flex-col items-center justify-center shrink-0 w-12 text-center">
                                  <span className="text-[10px] font-mono text-slate-400 font-medium leading-tight">
                                    {kickoffDate}
                                  </span>
                                  <span className="text-[11px] font-mono text-cyan-400 font-semibold leading-tight">
                                    {kickoffTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onOpenMatrix(fixture)}
                                    className="mt-1 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/40 text-cyan-300 transition-colors cursor-pointer"
                                    title="Open 6x6 Bivariate Poisson Score Matrix"
                                  >
                                    <BarChart2 className="w-2.5 h-2.5" />
                                    <span>Quant Matrix</span>
                                  </button>
                                </div>

                                {/* Vertical Stacked Teams */}
                                <div className="space-y-1 min-w-0 flex-1">
                                  {/* Home Team */}
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <TeamCrest
                                        src={fixture.homeTeam?.crest_url}
                                        name={homeName}
                                        size="xs"
                                      />
                                      <span className="font-bold text-white text-xs truncate">
                                        {homeName}
                                      </span>
                                    </div>
                                    <div className="shrink-0 scale-90 origin-right">
                                      <FormBadges form={homeForm} />
                                    </div>
                                  </div>

                                  {/* Away Team */}
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                      <TeamCrest
                                        src={fixture.awayTeam?.crest_url}
                                        name={awayName}
                                        size="xs"
                                      />
                                      <span className="font-bold text-white text-xs truncate">
                                        {awayName}
                                      </span>
                                    </div>
                                    <div className="shrink-0 scale-90 origin-right">
                                      <FormBadges form={awayForm} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* STANDARD 1X2 & 1XBET ODDS COLUMNS */}
                            {(activeMarketTab === 'All Markets' || activeMarketTab === '1X2') && (
                              <>
                                {/* Column 1: Home Win */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: '1X2',
                                        selection: '1',
                                        odds: homeOdds,
                                        trueProb: analysis.trueProbabilities.home,
                                        ev: homeEV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, '1X2', '1')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="text-[9px] text-slate-500 block leading-none">1</span>
                                    {homeEV > 0 && (
                                      <span
                                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-xs"
                                        title={`+${homeEV}% EV`}
                                      />
                                    )}
                                    <span className="block font-bold text-xs">
                                      {homeOdds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                {/* Column X: Draw */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: '1X2',
                                        selection: 'X',
                                        odds: drawOdds,
                                        trueProb: analysis.trueProbabilities.draw,
                                        ev: drawEV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, '1X2', 'X')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="text-[9px] text-slate-500 block leading-none">X</span>
                                    {drawEV > 0 && (
                                      <span
                                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-xs"
                                        title={`+${drawEV}% EV`}
                                      />
                                    )}
                                    <span className="block font-bold text-xs">
                                      {drawOdds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                {/* Column 2: Away Win */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: '1X2',
                                        selection: '2',
                                        odds: awayOdds,
                                        trueProb: analysis.trueProbabilities.away,
                                        ev: awayEV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, '1X2', '2')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="text-[9px] text-slate-500 block leading-none">2</span>
                                    {awayEV > 0 && (
                                      <span
                                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 shadow-xs"
                                        title={`+${awayEV}% EV`}
                                      />
                                    )}
                                    <span className="block font-bold text-xs">
                                      {awayOdds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                {/* Column AH: Asian Handicap Home -0.5 */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: 'Asian Handicap',
                                        selection: 'Home -0.5',
                                        odds: ahHome05Odds,
                                        trueProb:
                                          analysis.trueProbabilities.asianHandicap?.[
                                            'home_-0.5'
                                          ] || analysis.trueProbabilities.home,
                                        ev: ah05EV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, 'Asian Handicap', 'Home -0.5')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="block text-[10px] text-slate-400 truncate leading-none">
                                      Home -0.5
                                    </span>
                                    <span className="block font-bold text-xs leading-tight">
                                      {ahHome05Odds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                {/* Column Total: Line indicator */}
                                <td className="py-2 px-1 text-center font-mono text-slate-400 font-semibold text-xs">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px]">
                                    2.5
                                  </span>
                                </td>

                                {/* Column Over 2.5 */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: 'Totals',
                                        selection: 'Over 2.5',
                                        odds: over25Odds,
                                        trueProb: analysis.trueProbabilities.over25,
                                        ev: over25EV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, 'Totals', 'Over 2.5')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="text-[10px] text-slate-400 block leading-none">
                                      Over 2.5
                                    </span>
                                    <span className="block font-bold text-xs">
                                      {over25Odds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                {/* Column Under 2.5 */}
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: 'Totals',
                                        selection: 'Under 2.5',
                                        odds: under25Odds,
                                        trueProb: analysis.trueProbabilities.under25,
                                        ev: under25EV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all relative cursor-pointer ${
                                      isSelected(fixture.id, 'Totals', 'Under 2.5')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="text-[10px] text-slate-400 block leading-none">
                                      Under 2.5
                                    </span>
                                    <span className="block font-bold text-xs">
                                      {under25Odds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>
                              </>
                            )}

                            {/* ASIAN HANDICAP TAB COLUMNS */}
                            {activeMarketTab === 'Asian Handicap' && (
                              <>
                                {[
                                  { sel: 'Home -1.5', line: 'home_-1.5', odd: ahHome15Odds },
                                  { sel: 'Away +1.5', line: 'away_+1.5', odd: ahAway15Odds },
                                  { sel: 'Home -0.5', line: 'home_-0.5', odd: ahHome05Odds },
                                  { sel: 'Away +0.5', line: 'away_+0.5', odd: ahAway05Odds },
                                ].map((h) => {
                                  const ev =
                                    analysis.expectedValues.asianHandicapEV?.[h.line] || 0;
                                  const prob =
                                    analysis.trueProbabilities.asianHandicap?.[h.line] || 0.5;

                                  return (
                                    <td key={h.sel} className="py-2 px-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggleLeg({
                                            fixtureId: fixture.id,
                                            league: fixture.league,
                                            homeTeam: homeName,
                                            awayTeam: awayName,
                                            homeCrest: fixture.homeTeam?.crest_url,
                                            awayCrest: fixture.awayTeam?.crest_url,
                                            homeForm,
                                            awayForm,
                                            market: 'Asian Handicap',
                                            selection: h.sel,
                                            odds: h.odd,
                                            trueProb: prob,
                                            ev,
                                            matchTime: fixture.match_time,
                                          })
                                        }
                                        className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all cursor-pointer ${
                                          isSelected(fixture.id, 'Asian Handicap', h.sel)
                                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                            : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                        }`}
                                      >
                                        <span className="block text-[10px] text-slate-400 truncate leading-none">
                                          {h.sel}
                                        </span>
                                        <span className="block font-bold text-xs leading-tight">
                                          {h.odd.toFixed(2)}
                                        </span>
                                      </button>
                                    </td>
                                  );
                                })}
                              </>
                            )}

                            {/* GOAL TOTALS TAB COLUMNS */}
                            {activeMarketTab === 'Goal Totals' && (
                              <>
                                {[
                                  { line: '1.5', sel: 'Over 1.5', odd: over15Odds, ev: analysis.expectedValues.over15EV, prob: analysis.trueProbabilities.over15 },
                                  { line: '1.5', sel: 'Under 1.5', odd: under15Odds, ev: analysis.expectedValues.under15EV, prob: analysis.trueProbabilities.under15 },
                                  { line: '2.5', sel: 'Over 2.5', odd: over25Odds, ev: over25EV, prob: analysis.trueProbabilities.over25 },
                                  { line: '2.5', sel: 'Under 2.5', odd: under25Odds, ev: under25EV, prob: analysis.trueProbabilities.under25 },
                                  { line: '3.5', sel: 'Over 3.5', odd: over35Odds, ev: analysis.expectedValues.over35EV, prob: analysis.trueProbabilities.over35 },
                                  { line: '3.5', sel: 'Under 3.5', odd: under35Odds, ev: analysis.expectedValues.under35EV, prob: analysis.trueProbabilities.under35 },
                                ].map((tot) => (
                                  <td key={tot.sel} className="py-2 px-1 text-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onToggleLeg({
                                          fixtureId: fixture.id,
                                          league: fixture.league,
                                          homeTeam: homeName,
                                          awayTeam: awayName,
                                          homeCrest: fixture.homeTeam?.crest_url,
                                          awayCrest: fixture.awayTeam?.crest_url,
                                          homeForm,
                                          awayForm,
                                          market: 'Totals',
                                          selection: tot.sel,
                                          odds: tot.odd,
                                          trueProb: tot.prob,
                                          ev: tot.ev,
                                          matchTime: fixture.match_time,
                                        })
                                      }
                                      className={`w-full py-1.5 px-1 rounded-md text-center font-mono transition-all cursor-pointer ${
                                        isSelected(fixture.id, 'Totals', tot.sel)
                                          ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                          : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                      }`}
                                    >
                                      <span className="block text-[10px] text-slate-400 truncate leading-none">
                                        {tot.sel}
                                      </span>
                                      <span className="block font-bold text-xs leading-tight">
                                        {tot.odd.toFixed(2)}
                                      </span>
                                    </button>
                                  </td>
                                ))}
                              </>
                            )}

                            {/* BTTS TAB COLUMNS */}
                            {activeMarketTab === 'BTTS' && (
                              <>
                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: 'BTTS',
                                        selection: 'Yes',
                                        odds: bttsYesOdds,
                                        trueProb: analysis.trueProbabilities.bttsYes,
                                        ev: analysis.expectedValues.bttsYesEV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-2 px-2 rounded-md text-center font-mono transition-all cursor-pointer ${
                                      isSelected(fixture.id, 'BTTS', 'Yes')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="block text-[10px] text-slate-400 truncate leading-none">
                                      Yes
                                    </span>
                                    <span className="block font-bold text-xs leading-tight">
                                      {bttsYesOdds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>

                                <td className="py-2 px-1 text-center">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleLeg({
                                        fixtureId: fixture.id,
                                        league: fixture.league,
                                        homeTeam: homeName,
                                        awayTeam: awayName,
                                        homeCrest: fixture.homeTeam?.crest_url,
                                        awayCrest: fixture.awayTeam?.crest_url,
                                        homeForm,
                                        awayForm,
                                        market: 'BTTS',
                                        selection: 'No',
                                        odds: bttsNoOdds,
                                        trueProb: analysis.trueProbabilities.bttsNo,
                                        ev: analysis.expectedValues.bttsNoEV,
                                        matchTime: fixture.match_time,
                                      })
                                    }
                                    className={`w-full py-2 px-2 rounded-md text-center font-mono transition-all cursor-pointer ${
                                      isSelected(fixture.id, 'BTTS', 'No')
                                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border border-slate-800/80 hover:border-emerald-500/50'
                                    }`}
                                  >
                                    <span className="block text-[10px] text-slate-400 truncate leading-none">
                                      No
                                    </span>
                                    <span className="block font-bold text-xs leading-tight">
                                      {bttsNoOdds.toFixed(2)}
                                    </span>
                                  </button>
                                </td>
                              </>
                            )}

                            {/* Column More (+) */}
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleExpandMatch(fixture.id)}
                                className={`inline-flex items-center justify-center p-1.5 rounded-md border text-[11px] font-mono transition-all cursor-pointer ${
                                  isExpanded
                                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                                    : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 border-slate-800'
                                }`}
                                title="Expand all Asian Handicap, Goal Totals, and BTTS lines"
                              >
                                <span>+18</span>
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Secondary Betting Markets Sub-Row */}
                          {isExpanded && (
                            <tr className="bg-slate-950/95 border-b border-slate-800">
                              <td colSpan={9} className="p-3.5 sm:p-4">
                                <div className="space-y-3.5">
                                  {/* Sub-Header with Quant Info & Round */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/60">
                                    <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>All Quantitative Betting Markets</span>
                                      <span className="text-[10px] text-slate-500">•</span>
                                      <span className="text-slate-400">Upcoming Matchday Round</span>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => onOpenMatrix(fixture)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/50 text-cyan-300 font-mono text-xs font-medium transition-colors cursor-pointer"
                                      >
                                        <BarChart2 className="w-3.5 h-3.5" />
                                        <span>Quant Matrix</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Conflict Alert Banner */}
                                  {hasMatchConflict && (
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                      <span>
                                        <strong>Correlation Alert:</strong> You have multiple selections from this match in your betslip. Sportsbooks may restrict correlated parlays.
                                      </span>
                                    </div>
                                  )}

                                  {/* 1. Asian Handicap Full Matrix */}
                                  <div>
                                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <span>Asian Handicap Lines</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {[
                                        { sel: 'Home -1.5', line: 'home_-1.5', team: homeName },
                                        { sel: 'Away +1.5', line: 'away_+1.5', team: awayName },
                                        { sel: 'Home -0.5', line: 'home_-0.5', team: homeName },
                                        { sel: 'Away +0.5', line: 'away_+0.5', team: awayName },
                                      ].map((item) => {
                                        const oddVal = odds?.handicap_odds?.[item.line] || 1.9;
                                        const probVal =
                                          analysis.trueProbabilities.asianHandicap?.[item.line] || 0.5;
                                        const evVal =
                                          analysis.expectedValues.asianHandicapEV?.[item.line] || 0;
                                        const active = isSelected(
                                          fixture.id,
                                          'Asian Handicap',
                                          item.sel
                                        );

                                        return (
                                          <button
                                            key={item.sel}
                                            type="button"
                                            onClick={() =>
                                              onToggleLeg({
                                                fixtureId: fixture.id,
                                                league: fixture.league,
                                                homeTeam: homeName,
                                                awayTeam: awayName,
                                                homeCrest: fixture.homeTeam?.crest_url,
                                                awayCrest: fixture.awayTeam?.crest_url,
                                                homeForm,
                                                awayForm,
                                                market: 'Asian Handicap',
                                                selection: item.sel,
                                                odds: oddVal,
                                                trueProb: probVal,
                                                ev: evVal,
                                                matchTime: fixture.match_time,
                                              })
                                            }
                                            className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                                              active
                                                ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
                                                : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 text-slate-200'
                                            }`}
                                          >
                                            <span className="truncate">{item.sel}</span>
                                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                              {evVal > 0 && <EVBadge ev={evVal} />}
                                              <span className="font-bold">{oddVal.toFixed(2)}</span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* 2. Multi-Line Goal Totals (Over / Under 1.5, 2.5, 3.5) */}
                                  <div>
                                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <span>Goal Totals (Over / Under)</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                      {[
                                        {
                                          line: '1.5',
                                          overOdd: over15Odds,
                                          underOdd: under15Odds,
                                          overEV: analysis.expectedValues.over15EV,
                                          underEV: analysis.expectedValues.under15EV,
                                          overProb: analysis.trueProbabilities.over15,
                                          underProb: analysis.trueProbabilities.under15,
                                        },
                                        {
                                          line: '2.5',
                                          overOdd: over25Odds,
                                          underOdd: under25Odds,
                                          overEV: over25EV,
                                          underEV: under25EV,
                                          overProb: analysis.trueProbabilities.over25,
                                          underProb: analysis.trueProbabilities.under25,
                                        },
                                        {
                                          line: '3.5',
                                          overOdd: over35Odds,
                                          underOdd: under35Odds,
                                          overEV: analysis.expectedValues.over35EV,
                                          underEV: analysis.expectedValues.under35EV,
                                          overProb: analysis.trueProbabilities.over35,
                                          underProb: analysis.trueProbabilities.under35,
                                        },
                                      ].map((tot) => (
                                        <div
                                          key={tot.line}
                                          className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800"
                                        >
                                          {/* Over */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onToggleLeg({
                                                fixtureId: fixture.id,
                                                league: fixture.league,
                                                homeTeam: homeName,
                                                awayTeam: awayName,
                                                homeCrest: fixture.homeTeam?.crest_url,
                                                awayCrest: fixture.awayTeam?.crest_url,
                                                homeForm,
                                                awayForm,
                                                market: 'Totals',
                                                selection: `Over ${tot.line}`,
                                                odds: tot.overOdd,
                                                trueProb: tot.overProb,
                                                ev: tot.overEV,
                                                matchTime: fixture.match_time,
                                              })
                                            }
                                            className={`flex-1 py-1.5 px-2 rounded font-mono text-xs text-center transition-all cursor-pointer ${
                                              isSelected(fixture.id, 'Totals', `Over ${tot.line}`)
                                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                                : 'hover:bg-slate-800 text-slate-200'
                                            }`}
                                          >
                                            <span className="text-[10px] text-slate-400 block">
                                              Over {tot.line}
                                            </span>
                                            <span className="font-bold">{tot.overOdd.toFixed(2)}</span>
                                          </button>

                                          <span className="text-slate-600 text-xs font-mono">•</span>

                                          {/* Under */}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onToggleLeg({
                                                fixtureId: fixture.id,
                                                league: fixture.league,
                                                homeTeam: homeName,
                                                awayTeam: awayName,
                                                homeCrest: fixture.homeTeam?.crest_url,
                                                awayCrest: fixture.awayTeam?.crest_url,
                                                homeForm,
                                                awayForm,
                                                market: 'Totals',
                                                selection: `Under ${tot.line}`,
                                                odds: tot.underOdd,
                                                trueProb: tot.underProb,
                                                ev: tot.underEV,
                                                matchTime: fixture.match_time,
                                              })
                                            }
                                            className={`flex-1 py-1.5 px-2 rounded font-mono text-xs text-center transition-all cursor-pointer ${
                                              isSelected(fixture.id, 'Totals', `Under ${tot.line}`)
                                                ? 'bg-emerald-500 text-slate-950 font-bold'
                                                : 'hover:bg-slate-800 text-slate-200'
                                            }`}
                                          >
                                            <span className="text-[10px] text-slate-400 block">
                                              Under {tot.line}
                                            </span>
                                            <span className="font-bold">{tot.underOdd.toFixed(2)}</span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* 3. Both Teams To Score (BTTS) */}
                                  <div>
                                    <div className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                      <span>Both Teams To Score (BTTS)</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-w-sm">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggleLeg({
                                            fixtureId: fixture.id,
                                            league: fixture.league,
                                            homeTeam: homeName,
                                            awayTeam: awayName,
                                            homeCrest: fixture.homeTeam?.crest_url,
                                            awayCrest: fixture.awayTeam?.crest_url,
                                            homeForm,
                                            awayForm,
                                            market: 'BTTS',
                                            selection: 'Yes',
                                            odds: bttsYesOdds,
                                            trueProb: analysis.trueProbabilities.bttsYes,
                                            ev: analysis.expectedValues.bttsYesEV,
                                            matchTime: fixture.match_time,
                                          })
                                        }
                                        className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                                          isSelected(fixture.id, 'BTTS', 'Yes')
                                            ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                                            : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 text-slate-200'
                                        }`}
                                      >
                                        <span>Yes</span>
                                        <span className="font-bold">
                                          {bttsYesOdds.toFixed(2)}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          onToggleLeg({
                                            fixtureId: fixture.id,
                                            league: fixture.league,
                                            homeTeam: homeName,
                                            awayTeam: awayName,
                                            homeCrest: fixture.homeTeam?.crest_url,
                                            awayCrest: fixture.awayTeam?.crest_url,
                                            homeForm,
                                            awayForm,
                                            market: 'BTTS',
                                            selection: 'No',
                                            odds: bttsNoOdds,
                                            trueProb: analysis.trueProbabilities.bttsNo,
                                            ev: analysis.expectedValues.bttsNoEV,
                                            matchTime: fixture.match_time,
                                          })
                                        }
                                        className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                                          isSelected(fixture.id, 'BTTS', 'No')
                                            ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                                            : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 text-slate-200'
                                        }`}
                                      >
                                        <span>No</span>
                                        <span className="font-bold">
                                          {bttsNoOdds.toFixed(2)}
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
