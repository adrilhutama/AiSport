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
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm space-y-2">
      {/* Compact Single-Row KPI Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Title & Sample Significance Warning */}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider shrink-0">
            <Award className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Track Record:</span>
          </div>

          <h3 className="text-xs sm:text-sm font-bold text-white truncate">
            AI Curated Parlay Historical Hit-Rate
          </h3>

          {isSmallSample && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 shrink-0">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Preliminary Sample — Low Statistical Significance
            </span>
          )}
        </div>

        {/* Right: Inline KPI Badges */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono shrink-0 overflow-x-auto no-scrollbar">
          {/* Hit Rate */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase">Hit:</span>
            <strong className="text-emerald-400 font-bold">{hitRate}%</strong>
            <span className="text-[10px] text-slate-500 hidden md:inline">({wonCount}/{finished.length})</span>
          </div>

          {/* Net Units */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase">P&L:</span>
            <strong className={`font-bold ${netUnits >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {netUnits >= 0 ? `+${netUnits}u` : `${netUnits}u`}
            </strong>
          </div>

          {/* ROI */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase">ROI:</span>
            <strong className={`font-bold ${roi >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {roi >= 0 ? `+${roi}%` : `${roi}%`}
            </strong>
          </div>

          {/* Tracked Volume */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase">Vol:</span>
            <strong className="text-white font-bold">{parlays.length} Slips</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
