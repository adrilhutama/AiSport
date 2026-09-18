'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, QuantMatchAnalysis, BetSelection, MarketType } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { FormBadges, EVBadge } from '@/components/StatBadge';
import { ScoreMatrixModal } from '@/components/ScoreMatrixModal';
import { TeamCrest } from '@/components/TeamCrest';
import { BarChart3, Clock } from 'lucide-react';
import { LEAGUES_DATA } from '@/lib/mock-data';

interface MatchCardProps {
  fixture: Fixture;
  selectedLegs: LegSelection[];
  onToggleLeg: (leg: LegSelection) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({
  fixture,
  selectedLegs,
  onToggleLeg,
}) => {
  const [showMatrixModal, setShowMatrixModal] = useState(false);

  // Compute quantitative metrics if not already attached
  const analysis: QuantMatchAnalysis =
    fixture.quantAnalysis || analyzeFixtureQuant(fixture);

  const leagueInfo = LEAGUES_DATA[fixture.league] || LEAGUES_DATA.PL;
  const odds = fixture.marketOdds;

  // Format date and time
  const matchDate = new Date(fixture.match_time);
  const timeFormatted = matchDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFormatted = matchDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Helper to check if a specific selection is active in the betting slip
  const isSelected = (market: MarketType, selection: BetSelection) => {
    return selectedLegs.some(
      (l) => l.fixtureId === fixture.id && l.market === market && l.selection === selection
    );
  };

  // Helper to construct leg selection payload
  const handleSelect = (
    market: MarketType,
    selection: BetSelection,
    oddValue: number,
    trueProb: number,
    ev: number
  ) => {
    const leg: LegSelection = {
      fixtureId: fixture.id,
      league: fixture.league,
      homeTeam: fixture.homeTeam?.name || 'Home',
      awayTeam: fixture.awayTeam?.name || 'Away',
      homeCrest: fixture.homeTeam?.crest_url,
      awayCrest: fixture.awayTeam?.crest_url,
      market,
      selection,
      odds: oddValue,
      trueProb,
      ev,
      matchTime: fixture.match_time,
    };
    onToggleLeg(leg);
  };

  return (
    <>
      <div className="bg-terminal-900/90 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700 shadow-sm flex flex-col justify-between group">
        {/* Row 1: Match metadata, league pill, and live status badge */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            {leagueInfo.emblem_url ? (
              <img
                src={leagueInfo.emblem_url}
                alt={leagueInfo.name}
                className="w-4 h-4 object-contain filter brightness-110"
              />
            ) : (
              <span className="text-sm" role="img" aria-label={leagueInfo.name}>
                {leagueInfo.flag}
              </span>
            )}
            <span className="font-semibold text-slate-200">{leagueInfo.name}</span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" />
              {dateFormatted} {timeFormatted}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700/60">
              {fixture.status || 'SCHEDULED'}
            </span>
            <button
              onClick={() => setShowMatrixModal(true)}
              className="flex items-center gap-1 text-[11px] font-mono font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 hover:bg-cyan-900/50 px-2 py-0.5 rounded transition-colors"
              title="Inspect 6x6 Score Probability Heatmap"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Quant Matrix</span>
            </button>
          </div>
        </div>

        {/* Rows 2 & 3: Team Matchup & Real Form Outcome Pills */}
        <div className="py-3.5 space-y-2.5">
          {/* Home Team Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamCrest
                src={fixture.homeTeam?.crest_url}
                name={fixture.homeTeam?.name || 'Home'}
                size="md"
              />
              <div className="truncate">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight truncate block">
                  {fixture.homeTeam?.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block -mt-0.5">
                  Att: {fixture.homeTeam?.attack_rating.toFixed(2)} • Def: {fixture.homeTeam?.defense_rating.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="shrink-0 ml-2">
              <FormBadges form={fixture.homeTeam?.form || 'N/A'} />
            </div>
          </div>

          {/* Away Team Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamCrest
                src={fixture.awayTeam?.crest_url}
                name={fixture.awayTeam?.name || 'Away'}
                size="md"
              />
              <div className="truncate">
                <span className="font-bold text-white text-sm sm:text-base tracking-tight truncate block">
                  {fixture.awayTeam?.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400 block -mt-0.5">
                  Att: {fixture.awayTeam?.attack_rating.toFixed(2)} • Def: {fixture.awayTeam?.defense_rating.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="shrink-0 ml-2">
              <FormBadges form={fixture.awayTeam?.form || 'N/A'} />
            </div>
          </div>
        </div>

        {/* Pinnacle / Stake Style Market Odds Board */}
        <div className="pt-2 space-y-2.5 border-t border-slate-800/80">
          {/* 1X2 Full Time Result */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Full Time Result (1X2)</span>
              <span className="text-[10px] text-slate-400">Pinnacle Consensus</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* Home Win (1) */}
              <button
                onClick={() =>
                  handleSelect(
                    '1X2',
                    '1',
                    odds?.home_odds || 2.0,
                    analysis.trueProbabilities.home,
                    analysis.expectedValues.homeEV
                  )
                }
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-mono select-none ${
                  isSelected('1X2', '1')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                {analysis.expectedValues.homeEV > 0 && (
                  <div className="absolute -top-2 right-1.5 z-10">
                    <EVBadge ev={analysis.expectedValues.homeEV} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold text-xs">1</span>
                  <span className="font-extrabold text-white text-sm sm:text-base">
                    {(odds?.home_odds || 2.0).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.home * 100).toFixed(0)}% True
                </div>
              </button>

              {/* Draw (X) */}
              <button
                onClick={() =>
                  handleSelect(
                    '1X2',
                    'X',
                    odds?.draw_odds || 3.2,
                    analysis.trueProbabilities.draw,
                    analysis.expectedValues.drawEV
                  )
                }
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-mono select-none ${
                  isSelected('1X2', 'X')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                {analysis.expectedValues.drawEV > 0 && (
                  <div className="absolute -top-2 right-1.5 z-10">
                    <EVBadge ev={analysis.expectedValues.drawEV} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold text-xs">X</span>
                  <span className="font-extrabold text-white text-sm sm:text-base">
                    {(odds?.draw_odds || 3.2).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.draw * 100).toFixed(0)}% True
                </div>
              </button>

              {/* Away Win (2) */}
              <button
                onClick={() =>
                  handleSelect(
                    '1X2',
                    '2',
                    odds?.away_odds || 3.5,
                    analysis.trueProbabilities.away,
                    analysis.expectedValues.awayEV
                  )
                }
                className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-mono select-none ${
                  isSelected('1X2', '2')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                {analysis.expectedValues.awayEV > 0 && (
                  <div className="absolute -top-2 right-1.5 z-10">
                    <EVBadge ev={analysis.expectedValues.awayEV} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 font-bold text-xs">2</span>
                  <span className="font-extrabold text-white text-sm sm:text-base">
                    {(odds?.away_odds || 3.5).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.away * 100).toFixed(0)}% True
                </div>
              </button>
            </div>
          </div>

          {/* Goals Totals (Over/Under 2.5) */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Goals (Totals)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Over 2.5 */}
              <button
                onClick={() =>
                  handleSelect(
                    'Totals',
                    'Over 2.5',
                    odds?.over_25_odds || 1.85,
                    analysis.trueProbabilities.over25,
                    analysis.expectedValues.over25EV
                  )
                }
                className={`relative flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-xs font-mono select-none ${
                  isSelected('Totals', 'Over 2.5')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className="text-white font-semibold text-xs">Over 2.5</div>
                  <div className="text-[10px] text-slate-400">
                    {(analysis.trueProbabilities.over25 * 100).toFixed(0)}% True
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {analysis.expectedValues.over25EV > 0 && (
                    <EVBadge ev={analysis.expectedValues.over25EV} />
                  )}
                  <span className="font-extrabold text-white text-sm sm:text-base">
                    {(odds?.over_25_odds || 1.85).toFixed(2)}
                  </span>
                </div>
              </button>

              {/* Under 2.5 */}
              <button
                onClick={() =>
                  handleSelect(
                    'Totals',
                    'Under 2.5',
                    odds?.under_25_odds || 1.95,
                    analysis.trueProbabilities.under25,
                    analysis.expectedValues.under25EV
                  )
                }
                className={`relative flex items-center justify-between px-3 py-2 rounded-xl border transition-all text-xs font-mono select-none ${
                  isSelected('Totals', 'Under 2.5')
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 text-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className="text-white font-semibold text-xs">Under 2.5</div>
                  <div className="text-[10px] text-slate-400">
                    {(analysis.trueProbabilities.under25 * 100).toFixed(0)}% True
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {analysis.expectedValues.under25EV > 0 && (
                    <EVBadge ev={analysis.expectedValues.under25EV} />
                  )}
                  <span className="font-extrabold text-white text-sm sm:text-base">
                    {(odds?.under_25_odds || 1.95).toFixed(2)}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quant Score Heatmap Modal */}
      {showMatrixModal && (
        <ScoreMatrixModal
          fixture={fixture}
          analysis={analysis}
          onClose={() => setShowMatrixModal(false)}
        />
      )}
    </>
  );
};
