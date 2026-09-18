'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, QuantMatchAnalysis, BetSelection, MarketType } from '@/types';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { FormBadges, EVBadge } from '@/components/StatBadge';
import { ScoreMatrixModal } from '@/components/ScoreMatrixModal';
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
      <div className="bg-terminal-900 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700/80 shadow-sm flex flex-col justify-between">
        {/* Top bar: League, kickoff time, Poisson Matrix inspection button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base" role="img" aria-label={leagueInfo.name}>
              {leagueInfo.flag}
            </span>
            <span className="font-semibold text-slate-300">{leagueInfo.name}</span>
            <span className="text-slate-400">•</span>
            <span className="flex items-center gap-1 text-slate-400 font-mono">
              <Clock className="w-3 h-3" />
              {dateFormatted} {timeFormatted}
            </span>
          </div>

          <button
            onClick={() => setShowMatrixModal(true)}
            className="flex items-center gap-1 text-[11px] font-mono font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 border border-cyan-800/40 hover:bg-cyan-900/50 px-2 py-1 rounded transition-colors"
            title="Inspect 6x6 Score Probability Heatmap"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Quant Matrix
          </button>
        </div>

        {/* Team Matchup & Stats */}
        <div className="py-3 space-y-2.5">
          {/* Home Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm sm:text-base">
                {fixture.homeTeam?.name}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                (Att: {fixture.homeTeam?.attack_rating.toFixed(2)} | Def: {fixture.homeTeam?.defense_rating.toFixed(2)})
              </span>
            </div>
            {fixture.homeTeam?.form && <FormBadges form={fixture.homeTeam.form} />}
          </div>

          {/* Away Team */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white text-sm sm:text-base">
                {fixture.awayTeam?.name}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                (Att: {fixture.awayTeam?.attack_rating.toFixed(2)} | Def: {fixture.awayTeam?.defense_rating.toFixed(2)})
              </span>
            </div>
            {fixture.awayTeam?.form && <FormBadges form={fixture.awayTeam.form} />}
          </div>
        </div>

        {/* Odds & Market Buttons */}
        <div className="pt-2 space-y-2 border-t border-slate-800/60">
          {/* 1X2 Market */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
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
                className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-mono ${
                  isSelected('1X2', '1')
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">1</span>
                  <span className="font-semibold text-white text-sm">
                    {(odds?.home_odds || 2.0).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.home * 100).toFixed(0)}% True
                </div>
                {analysis.expectedValues.homeEV > 0 && (
                  <div className="mt-1">
                    <EVBadge ev={analysis.expectedValues.homeEV} />
                  </div>
                )}
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
                className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-mono ${
                  isSelected('1X2', 'X')
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">X</span>
                  <span className="font-semibold text-white text-sm">
                    {(odds?.draw_odds || 3.2).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.draw * 100).toFixed(0)}% True
                </div>
                {analysis.expectedValues.drawEV > 0 && (
                  <div className="mt-1">
                    <EVBadge ev={analysis.expectedValues.drawEV} />
                  </div>
                )}
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
                className={`relative flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-mono ${
                  isSelected('1X2', '2')
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-bold">2</span>
                  <span className="font-semibold text-white text-sm">
                    {(odds?.away_odds || 3.5).toFixed(2)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {(analysis.trueProbabilities.away * 100).toFixed(0)}% True
                </div>
                {analysis.expectedValues.awayEV > 0 && (
                  <div className="mt-1">
                    <EVBadge ev={analysis.expectedValues.awayEV} />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Over / Under 2.5 Market */}
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
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
                className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all text-xs font-mono ${
                  isSelected('Totals', 'Over 2.5')
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className="text-white font-medium text-xs">Over 2.5</div>
                  <div className="text-[10px] text-slate-400">
                    {(analysis.trueProbabilities.over25 * 100).toFixed(0)}% True
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {analysis.expectedValues.over25EV > 0 && (
                    <EVBadge ev={analysis.expectedValues.over25EV} />
                  )}
                  <span className="font-semibold text-white text-sm">
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
                className={`relative flex items-center justify-between px-3 py-1.5 rounded-lg border transition-all text-xs font-mono ${
                  isSelected('Totals', 'Under 2.5')
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600 hover:bg-slate-800 text-slate-200'
                }`}
              >
                <div className="text-left">
                  <div className="text-white font-medium text-xs">Under 2.5</div>
                  <div className="text-[10px] text-slate-400">
                    {(analysis.trueProbabilities.under25 * 100).toFixed(0)}% True
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {analysis.expectedValues.under25EV > 0 && (
                    <EVBadge ev={analysis.expectedValues.under25EV} />
                  )}
                  <span className="font-semibold text-white text-sm">
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
