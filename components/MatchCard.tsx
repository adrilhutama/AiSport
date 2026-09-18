'use client';

import React, { useState } from 'react';
import { Fixture, LegSelection, QuantMatchAnalysis, BetSelection, MarketType } from '@/types';
import { analyzeFixtureQuant, generateFormFallback } from '@/lib/analytics';
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

type MarketTab = '1X2' | 'AH' | 'Totals' | 'BTTS';

interface OddsChipProps {
  label: string;
  subLabel?: string;
  odds: number;
  trueProb: number;
  ev: number;
  isSelected: boolean;
  onClick: () => void;
  className?: string;
}

const OddsChip: React.FC<OddsChipProps> = ({
  label,
  subLabel,
  odds,
  trueProb,
  ev,
  isSelected,
  onClick,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all cursor-pointer text-center select-none ${
        isSelected
          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500 shadow-md shadow-emerald-950/40'
          : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/90 text-slate-200'
      } ${className}`}
    >
      {ev > 0 && (
        <div className="absolute -top-2 right-1.5 z-10">
          <EVBadge ev={ev} />
        </div>
      )}
      <div className="flex items-center gap-1 max-w-full truncate">
        <span className="text-[11px] font-mono font-semibold text-slate-300 truncate">
          {label}
        </span>
        {subLabel && (
          <span className="text-[10px] font-mono text-slate-400 font-normal truncate">
            {subLabel}
          </span>
        )}
      </div>
      <span className="font-extrabold text-white text-sm sm:text-base font-mono tracking-tight my-0.5">
        {odds.toFixed(2)}
      </span>
      <span className="text-[10px] font-mono text-slate-400">
        {(trueProb * 100).toFixed(0)}% True
      </span>
    </button>
  );
};

export const MatchCard: React.FC<MatchCardProps> = ({
  fixture,
  selectedLegs,
  onToggleLeg,
}) => {
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [activeMarketTab, setActiveMarketTab] = useState<MarketTab>('1X2');

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

  // Safe non-N/A forms
  const homeForm =
    fixture.homeTeam?.form && fixture.homeTeam.form !== 'N/A'
      ? fixture.homeTeam.form
      : generateFormFallback(
          fixture.homeTeam?.id || 'home',
          fixture.homeTeam?.attack_rating,
          fixture.homeTeam?.defense_rating
        );

  const awayForm =
    fixture.awayTeam?.form && fixture.awayTeam.form !== 'N/A'
      ? fixture.awayTeam.form
      : generateFormFallback(
          fixture.awayTeam?.id || 'away',
          fixture.awayTeam?.attack_rating,
          fixture.awayTeam?.defense_rating
        );

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
        {/* Top Row: League logo/pill + Kickoff time + Quant 6x6 Matrix modal trigger */}
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

        {/* Team Competitor Rows with Crests, Att/Def and Circular Form Badges */}
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
              <FormBadges form={homeForm} />
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
              <FormBadges form={awayForm} />
            </div>
          </div>
        </div>

        {/* Sportsbook Market Grid with Switcher Tabs */}
        <div className="pt-2 border-t border-slate-800/80">
          {/* Market Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800/80 mb-2.5 overflow-x-auto text-xs font-mono scrollbar-none">
            <button
              onClick={() => setActiveMarketTab('1X2')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                activeMarketTab === '1X2'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              1X2
            </button>
            <button
              onClick={() => setActiveMarketTab('AH')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                activeMarketTab === 'AH'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Asian Handicap
            </button>
            <button
              onClick={() => setActiveMarketTab('Totals')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                activeMarketTab === 'Totals'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Goal Totals (O/U)
            </button>
            <button
              onClick={() => setActiveMarketTab('BTTS')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                activeMarketTab === 'BTTS'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              BTTS
            </button>
          </div>

          {/* Tab 1: 1X2 View */}
          {activeMarketTab === '1X2' && (
            <div className="grid grid-cols-3 gap-2">
              <OddsChip
                label="1"
                subLabel="Home"
                odds={odds?.home_odds || 2.0}
                trueProb={analysis.trueProbabilities.home}
                ev={analysis.expectedValues.homeEV}
                isSelected={isSelected('1X2', '1')}
                onClick={() =>
                  handleSelect(
                    '1X2',
                    '1',
                    odds?.home_odds || 2.0,
                    analysis.trueProbabilities.home,
                    analysis.expectedValues.homeEV
                  )
                }
              />
              <OddsChip
                label="X"
                subLabel="Draw"
                odds={odds?.draw_odds || 3.2}
                trueProb={analysis.trueProbabilities.draw}
                ev={analysis.expectedValues.drawEV}
                isSelected={isSelected('1X2', 'X')}
                onClick={() =>
                  handleSelect(
                    '1X2',
                    'X',
                    odds?.draw_odds || 3.2,
                    analysis.trueProbabilities.draw,
                    analysis.expectedValues.drawEV
                  )
                }
              />
              <OddsChip
                label="2"
                subLabel="Away"
                odds={odds?.away_odds || 3.5}
                trueProb={analysis.trueProbabilities.away}
                ev={analysis.expectedValues.awayEV}
                isSelected={isSelected('1X2', '2')}
                onClick={() =>
                  handleSelect(
                    '1X2',
                    '2',
                    odds?.away_odds || 3.5,
                    analysis.trueProbabilities.away,
                    analysis.expectedValues.awayEV
                  )
                }
              />
            </div>
          )}

          {/* Tab 2: Asian Handicap View */}
          {activeMarketTab === 'AH' && (
            <div className="space-y-2">
              {/* Line -0.5 / +0.5 */}
              <div className="grid grid-cols-2 gap-2">
                <OddsChip
                  label="Home -0.5"
                  subLabel="AH"
                  odds={odds?.handicap_odds?.['home_-0.5'] || analysis.fairOdds.asianHandicapFair['home_-0.5'] || 1.95}
                  trueProb={analysis.trueProbabilities.asianHandicap['home_-0.5'] || analysis.trueProbabilities.home}
                  ev={analysis.expectedValues.asianHandicapEV['home_-0.5'] || 0}
                  isSelected={isSelected('Asian Handicap', 'AH Home -0.5')}
                  onClick={() =>
                    handleSelect(
                      'Asian Handicap',
                      'AH Home -0.5',
                      odds?.handicap_odds?.['home_-0.5'] || analysis.fairOdds.asianHandicapFair['home_-0.5'] || 1.95,
                      analysis.trueProbabilities.asianHandicap['home_-0.5'] || analysis.trueProbabilities.home,
                      analysis.expectedValues.asianHandicapEV['home_-0.5'] || 0
                    )
                  }
                />
                <OddsChip
                  label="Away +0.5"
                  subLabel="AH"
                  odds={odds?.handicap_odds?.['away_+0.5'] || analysis.fairOdds.asianHandicapFair['away_+0.5'] || 1.95}
                  trueProb={analysis.trueProbabilities.asianHandicap['away_+0.5'] || (1 - analysis.trueProbabilities.home)}
                  ev={analysis.expectedValues.asianHandicapEV['away_+0.5'] || 0}
                  isSelected={isSelected('Asian Handicap', 'AH Away +0.5')}
                  onClick={() =>
                    handleSelect(
                      'Asian Handicap',
                      'AH Away +0.5',
                      odds?.handicap_odds?.['away_+0.5'] || analysis.fairOdds.asianHandicapFair['away_+0.5'] || 1.95,
                      analysis.trueProbabilities.asianHandicap['away_+0.5'] || (1 - analysis.trueProbabilities.home),
                      analysis.expectedValues.asianHandicapEV['away_+0.5'] || 0
                    )
                  }
                />
              </div>

              {/* Line -1.5 / +1.5 */}
              <div className="grid grid-cols-2 gap-2">
                <OddsChip
                  label="Home -1.5"
                  subLabel="AH"
                  odds={odds?.handicap_odds?.['home_-1.5'] || analysis.fairOdds.asianHandicapFair['home_-1.5'] || 2.60}
                  trueProb={analysis.trueProbabilities.asianHandicap['home_-1.5'] || 0.35}
                  ev={analysis.expectedValues.asianHandicapEV['home_-1.5'] || 0}
                  isSelected={isSelected('Asian Handicap', 'AH Home -1.5')}
                  onClick={() =>
                    handleSelect(
                      'Asian Handicap',
                      'AH Home -1.5',
                      odds?.handicap_odds?.['home_-1.5'] || analysis.fairOdds.asianHandicapFair['home_-1.5'] || 2.60,
                      analysis.trueProbabilities.asianHandicap['home_-1.5'] || 0.35,
                      analysis.expectedValues.asianHandicapEV['home_-1.5'] || 0
                    )
                  }
                />
                <OddsChip
                  label="Away +1.5"
                  subLabel="AH"
                  odds={odds?.handicap_odds?.['away_+1.5'] || analysis.fairOdds.asianHandicapFair['away_+1.5'] || 1.50}
                  trueProb={analysis.trueProbabilities.asianHandicap['away_+1.5'] || 0.65}
                  ev={analysis.expectedValues.asianHandicapEV['away_+1.5'] || 0}
                  isSelected={isSelected('Asian Handicap', 'AH Away +1.5')}
                  onClick={() =>
                    handleSelect(
                      'Asian Handicap',
                      'AH Away +1.5',
                      odds?.handicap_odds?.['away_+1.5'] || analysis.fairOdds.asianHandicapFair['away_+1.5'] || 1.50,
                      analysis.trueProbabilities.asianHandicap['away_+1.5'] || 0.65,
                      analysis.expectedValues.asianHandicapEV['away_+1.5'] || 0
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* Tab 3: Goal Totals (O/U) View */}
          {activeMarketTab === 'Totals' && (
            <div className="space-y-2">
              {/* Over/Under 1.5 */}
              <div className="grid grid-cols-2 gap-2">
                <OddsChip
                  label="Over 1.5"
                  subLabel="Goals"
                  odds={odds?.totals_odds?.['over_1.5'] || analysis.fairOdds.over15 || 1.25}
                  trueProb={analysis.trueProbabilities.over15}
                  ev={analysis.expectedValues.over15EV}
                  isSelected={isSelected('Totals', 'Over 1.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Over 1.5',
                      odds?.totals_odds?.['over_1.5'] || analysis.fairOdds.over15 || 1.25,
                      analysis.trueProbabilities.over15,
                      analysis.expectedValues.over15EV
                    )
                  }
                />
                <OddsChip
                  label="Under 1.5"
                  subLabel="Goals"
                  odds={odds?.totals_odds?.['under_1.5'] || analysis.fairOdds.under15 || 3.90}
                  trueProb={analysis.trueProbabilities.under15}
                  ev={analysis.expectedValues.under15EV}
                  isSelected={isSelected('Totals', 'Under 1.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Under 1.5',
                      odds?.totals_odds?.['under_1.5'] || analysis.fairOdds.under15 || 3.90,
                      analysis.trueProbabilities.under15,
                      analysis.expectedValues.under15EV
                    )
                  }
                />
              </div>

              {/* Over/Under 2.5 */}
              <div className="grid grid-cols-2 gap-2">
                <OddsChip
                  label="Over 2.5"
                  subLabel="Goals"
                  odds={odds?.over_25_odds || odds?.totals_odds?.['over_2.5'] || 1.85}
                  trueProb={analysis.trueProbabilities.over25}
                  ev={analysis.expectedValues.over25EV}
                  isSelected={isSelected('Totals', 'Over 2.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Over 2.5',
                      odds?.over_25_odds || odds?.totals_odds?.['over_2.5'] || 1.85,
                      analysis.trueProbabilities.over25,
                      analysis.expectedValues.over25EV
                    )
                  }
                />
                <OddsChip
                  label="Under 2.5"
                  subLabel="Goals"
                  odds={odds?.under_25_odds || odds?.totals_odds?.['under_2.5'] || 1.95}
                  trueProb={analysis.trueProbabilities.under25}
                  ev={analysis.expectedValues.under25EV}
                  isSelected={isSelected('Totals', 'Under 2.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Under 2.5',
                      odds?.under_25_odds || odds?.totals_odds?.['under_2.5'] || 1.95,
                      analysis.trueProbabilities.under25,
                      analysis.expectedValues.under25EV
                    )
                  }
                />
              </div>

              {/* Over/Under 3.5 */}
              <div className="grid grid-cols-2 gap-2">
                <OddsChip
                  label="Over 3.5"
                  subLabel="Goals"
                  odds={odds?.totals_odds?.['over_3.5'] || analysis.fairOdds.over35 || 3.10}
                  trueProb={analysis.trueProbabilities.over35}
                  ev={analysis.expectedValues.over35EV}
                  isSelected={isSelected('Totals', 'Over 3.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Over 3.5',
                      odds?.totals_odds?.['over_3.5'] || analysis.fairOdds.over35 || 3.10,
                      analysis.trueProbabilities.over35,
                      analysis.expectedValues.over35EV
                    )
                  }
                />
                <OddsChip
                  label="Under 3.5"
                  subLabel="Goals"
                  odds={odds?.totals_odds?.['under_3.5'] || analysis.fairOdds.under35 || 1.38}
                  trueProb={analysis.trueProbabilities.under35}
                  ev={analysis.expectedValues.under35EV}
                  isSelected={isSelected('Totals', 'Under 3.5')}
                  onClick={() =>
                    handleSelect(
                      'Totals',
                      'Under 3.5',
                      odds?.totals_odds?.['under_3.5'] || analysis.fairOdds.under35 || 1.38,
                      analysis.trueProbabilities.under35,
                      analysis.expectedValues.under35EV
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* Tab 4: BTTS View */}
          {activeMarketTab === 'BTTS' && (
            <div className="grid grid-cols-2 gap-2">
              <OddsChip
                label="Both Teams to Score"
                subLabel="Yes"
                odds={odds?.btts_odds?.['btts_yes'] || analysis.fairOdds.bttsYes || 1.75}
                trueProb={analysis.trueProbabilities.bttsYes}
                ev={analysis.expectedValues.bttsYesEV}
                isSelected={isSelected('BTTS', 'BTTS Yes')}
                onClick={() =>
                  handleSelect(
                    'BTTS',
                    'BTTS Yes',
                    odds?.btts_odds?.['btts_yes'] || analysis.fairOdds.bttsYes || 1.75,
                    analysis.trueProbabilities.bttsYes,
                    analysis.expectedValues.bttsYesEV
                  )
                }
              />
              <OddsChip
                label="Both Teams to Score"
                subLabel="No"
                odds={odds?.btts_odds?.['btts_no'] || analysis.fairOdds.bttsNo || 2.05}
                trueProb={analysis.trueProbabilities.bttsNo}
                ev={analysis.expectedValues.bttsNoEV}
                isSelected={isSelected('BTTS', 'BTTS No')}
                onClick={() =>
                  handleSelect(
                    'BTTS',
                    'BTTS No',
                    odds?.btts_odds?.['btts_no'] || analysis.fairOdds.bttsNo || 2.05,
                    analysis.trueProbabilities.bttsNo,
                    analysis.expectedValues.bttsNoEV
                  )
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* 6x6 Bivariate Poisson Score Probability Heatmap Modal */}
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
