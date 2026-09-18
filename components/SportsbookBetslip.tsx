'use client';

import React, { useState } from 'react';
import { LegSelection, AIParlay } from '@/types';
import { calculateParlayMetrics, calculateKellyCriterion } from '@/lib/analytics';
import { AIParlayCard } from '@/components/AIParlayCard';
import { EVBadge } from '@/components/StatBadge';
import { TeamCrest } from '@/components/TeamCrest';
import {
  Receipt,
  Sparkles,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Coins,
  Percent,
  TrendingUp,
  X,
} from 'lucide-react';

interface SportsbookBetslipProps {
  legs: LegSelection[];
  onRemoveLeg: (fixtureId: string, market: string, selection: string) => void;
  onClearSlip: () => void;
  parlays: AIParlay[];
  onTailSlip: (tailLegs: LegSelection[]) => void;
}

export const SportsbookBetslip: React.FC<SportsbookBetslipProps> = ({
  legs,
  onRemoveLeg,
  onClearSlip,
  parlays,
  onTailSlip,
}) => {
  const [activeTab, setActiveTab] = useState<'betslip' | 'ai-parlays'>('betslip');
  const [bankroll, setBankroll] = useState<number>(100);
  const [customStake, setCustomStake] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // quantitative calculations
  const parlayMetrics = calculateParlayMetrics(legs);
  const kelly = calculateKellyCriterion(
    bankroll,
    parlayMetrics.totalOdds,
    parlayMetrics.combinedTrueProb
  );

  // Automatically switch to betslip tab when legs are added
  React.useEffect(() => {
    if (legs.length > 0) {
      setActiveTab('betslip');
    }
  }, [legs.length]);

  const activeStake = customStake !== '' ? parseFloat(customStake) || 0 : kelly.recommendedStakeAmount;
  const potentialPayout = Number((activeStake * parlayMetrics.totalOdds).toFixed(2));

  // Check for conflicts across legs
  const fixtureIdCounts = legs.reduce((acc, l) => {
    acc[l.fixtureId] = (acc[l.fixtureId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const hasConflict = Object.values(fixtureIdCounts).some((c) => c > 1);

  const handleCopySlip = () => {
    if (legs.length === 0) return;
    const summary = [
      `🎯 OddsMatrix Slip Taruhan (${legs.length} Legs)`,
      `Total Odds: ${parlayMetrics.totalOdds.toFixed(2)} | True Win%: ${(parlayMetrics.combinedTrueProb * 100).toFixed(1)}% | EV: +${parlayMetrics.expectedValue}%`,
      `Recommended 1/4 Kelly Stake: $${kelly.recommendedStakeAmount} (${kelly.recommendedStakePercent}%)`,
      '------------------------------',
      ...legs.map(
        (l, i) => `${i + 1}. ${l.homeTeam} vs ${l.awayTeam} -> ${l.market}: ${l.selection} @ ${l.odds.toFixed(2)} (${l.ev > 0 ? `+${l.ev}% EV` : ''})`
      ),
      '------------------------------',
      `Calculated by OddsMatrix Quantitative Terminal`
    ].join('\n');

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTailAndSwitch = (tailLegs: LegSelection[]) => {
    onTailSlip(tailLegs);
    setActiveTab('betslip');
  };

  const activeCuratedSlips = parlays.filter((p) => p.status === 'pending');
  const displayCuratedSlips = activeCuratedSlips.length > 0 ? activeCuratedSlips : parlays.slice(0, 3);

  return (
    <aside className="w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-slate-900/90 border border-slate-800/80 rounded-xl overflow-hidden shadow-xl lg:sticky lg:top-[76px] lg:max-h-[calc(100vh-92px)] flex flex-col">
      {/* Top Drawer Tabs */}
      <div className="grid grid-cols-2 border-b border-slate-800/80 bg-slate-950 select-none">
        <button
          type="button"
          onClick={() => setActiveTab('betslip')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-bold transition-all border-b-2 ${
            activeTab === 'betslip'
              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Slip Taruhan / Betslip</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] ${
              legs.length > 0
                ? 'bg-emerald-500/20 text-emerald-300 font-extrabold'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            {legs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ai-parlays')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-mono font-bold transition-all border-b-2 ${
            activeTab === 'ai-parlays'
              ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>AI Parlays Curated</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
            3
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: BETSLIP */}
      {activeTab === 'betslip' && (
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between p-3.5 space-y-4">
          {legs.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3 my-auto">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-500">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Betting Slip Kosong</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Pilih odds di odds table untuk memasukkan taruhan, atau gunakan AI Curated Parlay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('ai-parlays')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Lihat AI Curated Parlays</span>
              </button>
            </div>
          ) : (
            <>
              {/* Selected Legs List */}
              <div className="space-y-2.5">
                {/* Clear Slip Action */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                  <div className="text-xs font-mono font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>Betting Slip</span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({legs.length} {legs.length === 1 ? 'Outcome' : 'Accumulator'})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onClearSlip}
                    className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 transition-colors"
                    title="Clear all selections"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Semua</span>
                  </button>
                </div>

                {/* Conflict Alert Banner */}
                {hasConflict && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>
                      <strong>Correlation Alert:</strong> Dua atau lebih opsi berasal dari laga yang sama.
                    </span>
                  </div>
                )}

                {/* Individual Leg Cards */}
                <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar pr-0.5">
                  {legs.map((leg, idx) => (
                    <div
                      key={`${leg.fixtureId}-${leg.market}-${leg.selection}-${idx}`}
                      className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-start justify-between gap-2 text-xs group hover:border-slate-700 transition-all"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        {/* Teams */}
                        <div className="flex items-center gap-1 font-semibold text-slate-200 truncate">
                          <TeamCrest src={leg.homeCrest} name={leg.homeTeam} size="xs" />
                          <span className="truncate">{leg.homeTeam}</span>
                          <span className="text-slate-500 text-[10px]">vs</span>
                          <TeamCrest src={leg.awayCrest} name={leg.awayTeam} size="xs" />
                          <span className="truncate">{leg.awayTeam}</span>
                        </div>

                        {/* Market & Pick */}
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <div>
                            <span className="text-slate-500">{leg.market}:</span>{' '}
                            <strong className="text-emerald-400 font-semibold">{leg.selection}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Odds & Remove */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {leg.ev > 0 && <EVBadge ev={leg.ev} />}
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-white text-xs">
                          {leg.odds.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveLeg(leg.fixtureId, leg.market, leg.selection)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Hapus pilihan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantitative Metrics & Sizing */}
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                {/* Metric Summary Grid */}
                <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-xs">
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Total Odds</div>
                    <div className="text-sm font-extrabold text-emerald-400">
                      {parlayMetrics.totalOdds.toFixed(2)}x
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Win Chance</div>
                    <div className="text-sm font-bold text-white">
                      {(parlayMetrics.combinedTrueProb * 100).toFixed(1)}%
                    </div>
                  </div>

                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-500 uppercase">Edge (+EV)</div>
                    <div className="text-sm font-bold text-emerald-400">
                      +{parlayMetrics.expectedValue}%
                    </div>
                  </div>
                </div>

                {/* Kelly Criterion Bankroll Input */}
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 text-cyan-400" />
                      1/4 Kelly Bankroll Sizing
                    </span>
                    <span className="text-emerald-400 font-bold">
                      {kelly.recommendedStakePercent}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-mono text-slate-500 block mb-0.5">
                        Total Bankroll ($)
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={bankroll}
                        onChange={(e) => setBankroll(Math.max(1, parseFloat(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-mono text-slate-500 block mb-0.5">
                        Suggested Stake ($)
                      </label>
                      <input
                        type="number"
                        placeholder={`$${kelly.recommendedStakeAmount}`}
                        value={customStake}
                        onChange={(e) => setCustomStake(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-slate-400">
                    <span>Est. Payout:</span>
                    <strong className="text-white">${potentialPayout}</strong>
                  </div>
                </div>

                {/* Primary Action Button: Pasang Taruhan / Copy Parlay Slip */}
                <button
                  type="button"
                  onClick={handleCopySlip}
                  className="w-full py-2.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-mono font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-slate-950" />
                      <span>Copied! (Slip Tersalin)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-950" />
                      <span>Pasang Taruhan / Copy Parlay Slip</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: AI PARLAYS */}
      {activeTab === 'ai-parlays' && (
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
          <div className="pb-1 border-b border-slate-800/60 flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              AI Curated Accumulators
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
              Live Edge
            </span>
          </div>

          <div className="space-y-3">
            {displayCuratedSlips.map((slip) => (
              <AIParlayCard
                key={slip.id}
                parlay={slip}
                onTailSlip={handleTailAndSwitch}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
