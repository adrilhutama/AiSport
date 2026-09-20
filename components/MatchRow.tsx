'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, MarketType, BetSelection } from '@/types';
import { analyzeFixtureQuant, generateFormFallback } from '@/lib/analytics';
import { TeamCrest } from '@/components/TeamCrest';
import {
  BarChart2,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
} from 'lucide-react';

interface MatchRowProps {
  fixture: Fixture;
  selectedLegs: LegSelection[];
  onToggleLeg: (leg: LegSelection) => void;
  onOpenMatrix: (fixture: Fixture) => void;
  isRecentlyUpdated?: boolean;
}

export const MatchRow: React.FC<MatchRowProps> = ({
  fixture,
  selectedLegs,
  onToggleLeg,
  onOpenMatrix,
  isRecentlyUpdated = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedTotalLine, setSelectedTotalLine] = useState<'1.5' | '2.5' | '3.5'>('2.5');

  const qa = fixture.quantAnalysis || analyzeFixtureQuant(fixture);
  const odds = fixture.marketOdds;

  const homeTeam = fixture.homeTeam?.name || 'Home Team';
  const awayTeam = fixture.awayTeam?.name || 'Away Team';
  const homeCrest = fixture.homeTeam?.crest_url;
  const awayCrest = fixture.awayTeam?.crest_url;

  // Form fallback
  const rawHomeForm = fixture.homeTeam?.form;
  const rawAwayForm = fixture.awayTeam?.form;
  const homeForm = rawHomeForm && rawHomeForm !== 'N/A' && rawHomeForm !== 'DDDDD'
    ? rawHomeForm
    : generateFormFallback(fixture.home_team_id, fixture.homeTeam?.attack_rating, fixture.homeTeam?.defense_rating);
  const awayForm = rawAwayForm && rawAwayForm !== 'N/A' && rawAwayForm !== 'DDDDD'
    ? rawAwayForm
    : generateFormFallback(fixture.away_team_id, fixture.awayTeam?.attack_rating, fixture.awayTeam?.defense_rating);

  const isSelected = (market: MarketType, selection: BetSelection) => {
    return selectedLegs.some(
      (l) => l.fixtureId === fixture.id && l.market === market && l.selection === selection
    );
  };

  const handleChipClick = (
    market: MarketType,
    selection: BetSelection,
    oddValue: number,
    trueProb: number,
    ev: number
  ) => {
    onToggleLeg({
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam,
      awayTeam,
      homeCrest,
      awayCrest,
      homeForm,
      awayForm,
      market,
      selection,
      odds: oddValue,
      trueProb,
      ev,
      matchTime: fixture.match_time,
    });
  };

  // Kickoff time formatting
  const matchDate = new Date(fixture.match_time);
  const timeStr = !isNaN(matchDate.getTime())
    ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    : '19:00';
  const dateStr = !isNaN(matchDate.getTime())
    ? matchDate.toLocaleDateString([], { day: '2-digit', month: 'short' })
    : '20 Sep';

  // 1X2 Values
  const hOdds = odds?.home_odds || 2.0;
  const dOdds = odds?.draw_odds || 3.2;
  const aOdds = odds?.away_odds || 3.5;

  // Totals Odds for chosen line
  const totalsRecord = odds?.totals_odds || {};
  const currentOverOdds =
    selectedTotalLine === '1.5'
      ? totalsRecord['over_1.5'] || Number(Math.max(1.18, (odds?.over_25_odds || 1.85) * 0.72).toFixed(2))
      : selectedTotalLine === '3.5'
      ? totalsRecord['over_3.5'] || Number(Math.max(2.15, (odds?.over_25_odds || 1.85) * 1.70).toFixed(2))
      : odds?.over_25_odds || totalsRecord['over_2.5'] || 1.85;

  const currentUnderOdds =
    selectedTotalLine === '1.5'
      ? totalsRecord['under_1.5'] || Number(Math.max(2.85, (odds?.under_25_odds || 1.95) * 1.65).toFixed(2))
      : selectedTotalLine === '3.5'
      ? totalsRecord['under_3.5'] || Number(Math.max(1.24, (odds?.under_25_odds || 1.95) * 0.72).toFixed(2))
      : odds?.under_25_odds || totalsRecord['under_2.5'] || 1.95;

  const currentOverProb =
    selectedTotalLine === '1.5'
      ? qa.trueProbabilities.over15
      : selectedTotalLine === '3.5'
      ? qa.trueProbabilities.over35
      : qa.trueProbabilities.over25;

  const currentUnderProb =
    selectedTotalLine === '1.5'
      ? qa.trueProbabilities.under15
      : selectedTotalLine === '3.5'
      ? qa.trueProbabilities.under35
      : qa.trueProbabilities.under25;

  const currentOverEV =
    selectedTotalLine === '1.5'
      ? qa.expectedValues.over15EV
      : selectedTotalLine === '3.5'
      ? qa.expectedValues.over35EV
      : qa.expectedValues.over25EV;

  const currentUnderEV =
    selectedTotalLine === '1.5'
      ? qa.expectedValues.under15EV
      : selectedTotalLine === '3.5'
      ? qa.expectedValues.under35EV
      : qa.expectedValues.under25EV;

  // Primary Asian Handicap lines (-0.5 / +0.5)
  const ahRecord = odds?.handicap_odds || {};
  const ahHomeOdds = ahRecord['home_-0.5'] || hOdds;
  const ahAwayOdds = ahRecord['away_+0.5'] || Number(Math.max(1.22, (1.05 + 1.2 / (hOdds > 1.1 ? hOdds : 1.1))).toFixed(2));
  const ahHomeProb = qa.trueProbabilities.asianHandicap['home_-0.5'] || qa.trueProbabilities.home;
  const ahAwayProb = qa.trueProbabilities.asianHandicap['away_+0.5'] || (1 - qa.trueProbabilities.home);
  const ahHomeEV = qa.expectedValues.asianHandicapEV?.['home_-0.5'] || qa.expectedValues.homeEV;
  const ahAwayEV = qa.expectedValues.asianHandicapEV?.['away_+0.5'] || 0;

  // Render form pills helper
  const renderFormPills = (formStr: string) => {
    return (
      <div className="flex items-center gap-0.5">
        {formStr.slice(-5).split('').map((char, i) => {
          const c = char.toUpperCase();
          const colorClass =
            c === 'W'
              ? 'bg-emerald-500 text-slate-950'
              : c === 'D'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-rose-500 text-white';
          return (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center font-mono font-bold text-[9px] leading-none ${colorClass}`}
              title={`Match ${i + 1}: ${c === 'W' ? 'Won' : c === 'D' ? 'Draw' : 'Lost'}`}
            >
              {c}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`border-b border-slate-800/80 transition-colors min-w-[760px] ${
        isRecentlyUpdated ? 'bg-emerald-950/25 ring-1 ring-emerald-500/40' : 'hover:bg-slate-800/30'
      }`}
    >
      {/* Primary Uniform Row (~56px height) */}
      <div className="min-h-[58px] py-1.5 px-3 grid grid-cols-12 gap-2 items-center text-xs">
        {/* Cell 1: Time & Event (Col span: 4 lg:3) */}
        <div className="col-span-5 lg:col-span-4 flex items-center gap-2">
          {/* Kickoff timestamp */}
          <div className="flex flex-col items-center justify-center shrink-0 w-11 text-[10px] font-mono text-slate-400 border-r border-slate-800 pr-1.5">
            <span className="text-slate-200 font-bold">{timeStr}</span>
            <span className="text-[9px] text-slate-500">{dateStr}</span>
          </div>

          {/* Teams stacked vertically */}
          <div className="flex flex-col gap-0.5 min-w-[120px] flex-1">
            {/* Home team */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700/60 overflow-hidden">
                  <TeamCrest src={homeCrest} name={homeTeam} size="xs" />
                </div>
                <span className="font-bold text-white text-xs whitespace-nowrap" title={homeTeam}>
                  {homeTeam}
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                {renderFormPills(homeForm)}
              </div>
            </div>

            {/* Away team */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-slate-800 border border-slate-700/60 overflow-hidden">
                  <TeamCrest src={awayCrest} name={awayTeam} size="xs" />
                </div>
                <span className="font-bold text-white text-xs whitespace-nowrap" title={awayTeam}>
                  {awayTeam}
                </span>
              </div>
              <div className="hidden sm:block shrink-0">
                {renderFormPills(awayForm)}
              </div>
            </div>
          </div>

          {/* Mini 6x6 Matrix Modal Trigger */}
          <button
            type="button"
            onClick={() => onOpenMatrix(fixture)}
            className="flex items-center gap-1 px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700/60 transition-colors text-[10px] font-mono shrink-0 cursor-pointer"
            title="Open 6x6 Bivariate Poisson Score Heatmap"
          >
            <BarChart2 className="w-3 h-3 text-cyan-400" />
            <span className="hidden xl:inline">Matrix</span>
          </button>
        </div>

        {/* Cell 2: 1X2 Market Chips (Col span: 3) */}
        <div className="col-span-3 flex items-center gap-1">
          {/* 1 */}
          <button
            type="button"
            onClick={() => handleChipClick('1X2', '1', hOdds, qa.trueProbabilities.home, qa.expectedValues.homeEV)}
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('1X2', '1')
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">1</span>
              <span className="font-bold">{hOdds.toFixed(2)}</span>
            </div>
            {qa.expectedValues.homeEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{qa.expectedValues.homeEV.toFixed(1)}% EV
              </span>
            )}
          </button>

          {/* X */}
          <button
            type="button"
            onClick={() => handleChipClick('1X2', 'X', dOdds, qa.trueProbabilities.draw, qa.expectedValues.drawEV)}
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('1X2', 'X')
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">X</span>
              <span className="font-bold">{dOdds.toFixed(2)}</span>
            </div>
            {qa.expectedValues.drawEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{qa.expectedValues.drawEV.toFixed(1)}% EV
              </span>
            )}
          </button>

          {/* 2 */}
          <button
            type="button"
            onClick={() => handleChipClick('1X2', '2', aOdds, qa.trueProbabilities.away, qa.expectedValues.awayEV)}
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('1X2', '2')
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">2</span>
              <span className="font-bold">{aOdds.toFixed(2)}</span>
            </div>
            {qa.expectedValues.awayEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{qa.expectedValues.awayEV.toFixed(1)}% EV
              </span>
            )}
          </button>
        </div>

        {/* Cell 3: Asian Handicap / Primary Spreads (Col span: 2) */}
        <div className="col-span-2 hidden md:flex items-center gap-1">
          {/* Home -0.5 */}
          <button
            type="button"
            onClick={() => handleChipClick('Asian Handicap', 'Home -0.5', ahHomeOdds, ahHomeProb, ahHomeEV)}
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('Asian Handicap', 'Home -0.5')
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
            title="Asian Handicap Home -0.5"
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">-0.5</span>
              <span className="font-bold">{ahHomeOdds.toFixed(2)}</span>
            </div>
            {ahHomeEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{ahHomeEV.toFixed(1)}% EV
              </span>
            )}
          </button>

          {/* Away +0.5 */}
          <button
            type="button"
            onClick={() => handleChipClick('Asian Handicap', 'Away +0.5', ahAwayOdds, ahAwayProb, ahAwayEV)}
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('Asian Handicap', 'Away +0.5')
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
            title="Asian Handicap Away +0.5"
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">+0.5</span>
              <span className="font-bold">{ahAwayOdds.toFixed(2)}</span>
            </div>
            {ahAwayEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{ahAwayEV.toFixed(1)}% EV
              </span>
            )}
          </button>
        </div>

        {/* Cell 4: Totals / Over-Under (Col span: 2) */}
        <div className="col-span-3 md:col-span-2 flex items-center gap-1">
          {/* Over */}
          <button
            type="button"
            onClick={() =>
              handleChipClick(
                'Totals',
                `Over ${selectedTotalLine}`,
                currentOverOdds,
                currentOverProb,
                currentOverEV
              )
            }
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('Totals', `Over ${selectedTotalLine}`)
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">O {selectedTotalLine}</span>
              <span className="font-bold">{currentOverOdds.toFixed(2)}</span>
            </div>
            {currentOverEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{currentOverEV.toFixed(1)}% EV
              </span>
            )}
          </button>

          {/* Under */}
          <button
            type="button"
            onClick={() =>
              handleChipClick(
                'Totals',
                `Under ${selectedTotalLine}`,
                currentUnderOdds,
                currentUnderProb,
                currentUnderEV
              )
            }
            className={`flex-1 h-9 flex flex-col items-center justify-center rounded px-1 text-[11px] font-mono transition-all border ${
              isSelected('Totals', `Under ${selectedTotalLine}`)
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-xs'
                : 'bg-slate-900/90 text-slate-200 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-slate-400">U {selectedTotalLine}</span>
              <span className="font-bold">{currentUnderOdds.toFixed(2)}</span>
            </div>
            {currentUnderEV > 0 && (
              <span className="text-[8px] text-emerald-400 font-semibold leading-none">
                +{currentUnderEV.toFixed(1)}% EV
              </span>
            )}
          </button>
        </div>

        {/* Cell 5: More Markets Accordion Expander (Col span: 1) */}
        <div className="col-span-1 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`px-2 py-1.5 rounded flex items-center gap-1 text-[10px] font-mono font-bold transition-all border ${
              isExpanded
                ? 'bg-slate-800 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
            title="Toggle BTTS and Alternate Markets"
          >
            <span>+6</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Accordion Expander Drawer (Reveals BTTS & Alternate Spreads/Totals) */}
      {isExpanded && (
        <div className="bg-slate-950/80 border-t border-slate-800/80 p-3 space-y-3 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. BTTS (Both Teams to Score) */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold">
                <span>Both Teams to Score</span>
                <span className="text-slate-500">BTTS</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {/* Yes */}
                <button
                  type="button"
                  onClick={() =>
                    handleChipClick(
                      'BTTS',
                      'Yes',
                      odds?.btts_odds?.['btts_yes'] || 1.75,
                      qa.trueProbabilities.bttsYes,
                      qa.expectedValues.bttsYesEV
                    )
                  }
                  className={`py-1.5 px-2 rounded text-xs font-mono flex items-center justify-between border transition-all ${
                    isSelected('BTTS', 'Yes')
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-slate-400">Yes</span>
                  <span className="font-bold">{(odds?.btts_odds?.['btts_yes'] || 1.75).toFixed(2)}</span>
                </button>

                {/* No */}
                <button
                  type="button"
                  onClick={() =>
                    handleChipClick(
                      'BTTS',
                      'No',
                      odds?.btts_odds?.['btts_no'] || 2.05,
                      qa.trueProbabilities.bttsNo,
                      qa.expectedValues.bttsNoEV
                    )
                  }
                  className={`py-1.5 px-2 rounded text-xs font-mono flex items-center justify-between border transition-all ${
                    isSelected('BTTS', 'No')
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-slate-400">No</span>
                  <span className="font-bold">{(odds?.btts_odds?.['btts_no'] || 2.05).toFixed(2)}</span>
                </button>
              </div>
            </div>

            {/* 2. Alternate Totals Line Switcher */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold">
                <span>Alternate Goal Lines</span>
                <div className="flex items-center gap-1">
                  {(['1.5', '2.5', '3.5'] as const).map((line) => (
                    <button
                      key={line}
                      type="button"
                      onClick={() => setSelectedTotalLine(line)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                        selectedTotalLine === line
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {line}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
                <div className="text-[11px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 flex justify-between">
                  <span>Over {selectedTotalLine}</span>
                  <strong className="text-slate-200">{currentOverOdds.toFixed(2)}</strong>
                </div>
                <div className="text-[11px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 flex justify-between">
                  <span>Under {selectedTotalLine}</span>
                  <strong className="text-slate-200">{currentUnderOdds.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* 3. Alternate Handicap Lines */}
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold">
                <span>Spread Matrix</span>
                <span className="text-slate-500">AH (+/-1.5)</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    handleChipClick(
                      'Asian Handicap',
                      'Home -1.5',
                      ahRecord['home_-1.5'] || Number((hOdds * 1.52).toFixed(2)),
                      qa.trueProbabilities.asianHandicap['home_-1.5'] || 0.25,
                      qa.expectedValues.asianHandicapEV?.['home_-1.5'] || 0
                    )
                  }
                  className={`py-1.5 px-2 rounded text-xs font-mono flex items-center justify-between border transition-all ${
                    isSelected('Asian Handicap', 'Home -1.5')
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-slate-400">-1.5</span>
                  <span className="font-bold">
                    {(ahRecord['home_-1.5'] || Number((hOdds * 1.52).toFixed(2))).toFixed(2)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleChipClick(
                      'Asian Handicap',
                      'Away +1.5',
                      ahRecord['away_+1.5'] || 1.45,
                      qa.trueProbabilities.asianHandicap['away_+1.5'] || 0.75,
                      qa.expectedValues.asianHandicapEV?.['away_+1.5'] || 0
                    )
                  }
                  className={`py-1.5 px-2 rounded text-xs font-mono flex items-center justify-between border transition-all ${
                    isSelected('Asian Handicap', 'Away +1.5')
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                      : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="text-slate-400">+1.5</span>
                  <span className="font-bold">
                    {(ahRecord['away_+1.5'] || 1.45).toFixed(2)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
