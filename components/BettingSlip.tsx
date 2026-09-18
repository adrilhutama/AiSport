'use client';

import React, { useState } from 'react';
import { LegSelection } from '@/types';
import { calculateParlayMetrics, calculateKellyCriterion } from '@/lib/analytics';
import {
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Copy,
  Check,
  Percent,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { EVBadge } from '@/components/StatBadge';
import { TeamCrest } from '@/components/TeamCrest';

interface BettingSlipProps {
  legs: LegSelection[];
  onRemoveLeg: (fixtureId: string, market: string, selection: string) => void;
  onClearSlip: () => void;
}

export const BettingSlip: React.FC<BettingSlipProps> = ({
  legs,
  onRemoveLeg,
  onClearSlip,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [bankroll, setBankroll] = useState<number>(100);
  const [customStake, setCustomStake] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Quantitative calculations
  const parlayMetrics = calculateParlayMetrics(legs);
  const kelly = calculateKellyCriterion(
    bankroll,
    parlayMetrics.totalOdds,
    parlayMetrics.combinedTrueProb
  );

  const activeStake = customStake !== '' ? parseFloat(customStake) || 0 : kelly.recommendedStakeAmount;
  const potentialPayout = Number((activeStake * parlayMetrics.totalOdds).toFixed(2));

  const handleCopySlip = () => {
    if (legs.length === 0) return;
    const summary = [
      `🎯 OddsMatrix Parlay Slip (${legs.length} Legs)`,
      `Total Odds: ${parlayMetrics.totalOdds.toFixed(2)} | True Win%: ${(parlayMetrics.combinedTrueProb * 100).toFixed(1)}% | EV: +${parlayMetrics.expectedValue}%`,
      `Recommended 1/4 Kelly Stake: $${kelly.recommendedStakeAmount} (${kelly.recommendedStakePercent}%)`,
      '------------------------------',
      ...legs.map(
        (l, i) => `${i + 1}. ${l.homeTeam} vs ${l.awayTeam} -> ${l.market}: ${l.selection} @ ${l.odds.toFixed(2)} (${l.ev > 0 ? `+${l.ev}% EV` : ''})`
      ),
      '------------------------------',
      `Calculated by OddsMatrix Quantitative Analytics`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (legs.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[90vh] flex flex-col bg-terminal-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3.5 bg-terminal-850 cursor-pointer border-b border-slate-800 hover:bg-terminal-800/80 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Betting Slip</span>
              <span className="px-2 py-0.2 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {legs.length} {legs.length === 1 ? 'Leg' : 'Legs'}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Total Odds:{' '}
              <span className="font-bold text-cyan-300">
                {parlayMetrics.totalOdds.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClearSlip();
            }}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
            title="Clear all selections"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="text-slate-400 p-1">
            {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[65vh]">
          {/* Correlation or Conflict Warning Banner */}
          {parlayMetrics.hasCorrelation && (
            <div className="p-3 bg-amber-950/60 border border-amber-600/50 rounded-lg text-amber-200 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Correlation Alert: </span>
                {parlayMetrics.correlationMessage}
              </div>
            </div>
          )}

          {/* Legs List */}
          <div className="space-y-2">
            {legs.map((leg) => (
              <div
                key={`${leg.fixtureId}-${leg.market}-${leg.selection}`}
                className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3 flex items-center justify-between text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <TeamCrest src={leg.homeCrest} name={leg.homeTeam} size="xs" />
                    <span>{leg.homeTeam}</span>
                    <span className="text-slate-500 font-normal text-[11px]">vs</span>
                    <TeamCrest src={leg.awayCrest} name={leg.awayTeam} size="xs" />
                    <span>{leg.awayTeam}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span>
                      {leg.market}: <strong className="text-cyan-300">{leg.selection}</strong>
                    </span>
                    {leg.ev > 0 && <EVBadge ev={leg.ev} />}
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-white text-sm bg-slate-800 px-2 py-1 rounded border border-slate-600">
                    {leg.odds.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemoveLeg(leg.fixtureId, leg.market, leg.selection)}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-700/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Parlay Quantitative Metrics Overview */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center font-mono">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Total Odds</div>
              <div className="text-base font-bold text-cyan-400 mt-0.5">
                {parlayMetrics.totalOdds.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">True Prob</div>
              <div className="text-base font-bold text-white mt-0.5">
                {(parlayMetrics.combinedTrueProb * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">EV %</div>
              <div
                className={`text-base font-bold mt-0.5 ${
                  parlayMetrics.expectedValue > 0 ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {parlayMetrics.expectedValue > 0 ? `+${parlayMetrics.expectedValue}%` : `${parlayMetrics.expectedValue}%`}
              </div>
            </div>
          </div>

          {/* Bankroll & Kelly Criterion Calculator */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-400 uppercase font-semibold flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />
                1/4 Kelly Bankroll Sizing
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Capped at 5%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Total Bankroll ($)</label>
                <input
                  type="number"
                  min="1"
                  value={bankroll}
                  onChange={(e) => setBankroll(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Kelly Rec. Stake</label>
                <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-emerald-400 text-xs font-bold flex items-center justify-between">
                  <span>${kelly.recommendedStakeAmount.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({kelly.recommendedStakePercent}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Custom Stake & Payout */}
            <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Wager Stake ($)</label>
                <input
                  type="number"
                  placeholder={kelly.recommendedStakeAmount.toFixed(2)}
                  value={customStake}
                  onChange={(e) => setCustomStake(e.target.value)}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 font-mono text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="text-right">
                <div className="text-[11px] text-slate-400">Potential Payout</div>
                <div className="text-base font-mono font-bold text-emerald-400">
                  ${potentialPayout.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCopySlip}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>Copy Parlay Slip</span>
                </>
              )}
            </button>

            <button
              onClick={onClearSlip}
              className="px-3 py-2.5 rounded-xl font-mono font-bold text-xs uppercase tracking-wider bg-slate-800 hover:bg-rose-950/50 border border-slate-700 text-slate-400 hover:text-rose-300 transition-colors"
              title="Clear Slip"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
