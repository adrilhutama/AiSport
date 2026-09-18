'use client';

import React from 'react';
import { AIParlay } from '@/types';
import { Award, TrendingUp, CheckCircle, Percent, AlertTriangle } from 'lucide-react';

interface HitRateTrackerProps {
  parlays: AIParlay[];
}

export const HitRateTracker: React.FC<HitRateTrackerProps> = ({ parlays }) => {
  const finished = parlays.filter((p) => p.status === 'won' || p.status === 'lost');
  const wonCount = parlays.filter((p) => p.status === 'won').length;
  const lostCount = parlays.filter((p) => p.status === 'lost').length;
  const pendingCount = parlays.filter((p) => p.status === 'pending').length;

  const isSmallSample = finished.length < 30;

  const hitRate =
    finished.length > 0 ? Number(((wonCount / finished.length) * 100).toFixed(1)) : 0;

  // Assuming flat 1-unit bet on each parlay
  const totalUnitsReturned = parlays
    .filter((p) => p.status === 'won')
    .reduce((acc, p) => acc + (p.total_odds - 1), 0);
  const totalUnitsLost = lostCount * 1.0;
  const netUnits = Number((totalUnitsReturned - totalUnitsLost).toFixed(2));
  const roi =
    finished.length > 0
      ? Number(((netUnits / finished.length) * 100).toFixed(1))
      : 0;

  return (
    <div className="bg-terminal-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider">
            <Award className="w-3.5 h-3.5" />
            Quantitative Track Record
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-0.5">
            <h3 className="text-base font-bold text-white">
              AI Curated Parlay Historical Hit-Rate
            </h3>
            {isSmallSample && (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Preliminary Sample — Low Statistical Significance
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {wonCount} Won
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            {lostCount} Lost
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            {pendingCount} Active
          </span>
        </div>
      </div>

      {isSmallSample && (
        <div className="mt-3 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-3 py-2 flex items-start gap-2 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Notice: Current dataset contains {finished.length} settled slips (&lt;30 sample size). High ROI percentages are subject to small-sample variance.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        {/* Win Rate */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Hit Rate</span>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
            {hitRate}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            {wonCount} of {finished.length} settled
          </div>
        </div>

        {/* Total Net Profit */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Net Profit (1u flat)</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div
            className={`text-xl font-mono font-bold mt-1 ${
              netUnits >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {netUnits >= 0 ? `+${netUnits}u` : `${netUnits}u`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            P&L across closed slips
          </div>
        </div>

        {/* ROI */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Return on Investment</span>
            <Percent className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div
            className={`text-xl font-mono font-bold mt-1 ${
              roi >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {roi >= 0 ? `+${roi}%` : `${roi}%`}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            ROI per unit staked
          </div>
        </div>

        {/* Evaluated Slips */}
        <div className="bg-slate-800/40 border border-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Evaluated</span>
            <span className="text-xs font-mono text-slate-400 font-bold">ALL</span>
          </div>
          <div className="text-xl font-mono font-bold text-white mt-1">
            {parlays.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
            Safe, Value & Lotto slips
          </div>
        </div>
      </div>
    </div>
  );
};
