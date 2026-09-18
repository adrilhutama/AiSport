'use client';

import React from 'react';
import { Fixture, QuantMatchAnalysis } from '@/types';
import { X, Sparkles, Activity } from 'lucide-react';

interface ScoreMatrixModalProps {
  fixture: Fixture;
  analysis: QuantMatchAnalysis;
  onClose: () => void;
}

export const ScoreMatrixModal: React.FC<ScoreMatrixModalProps> = ({
  fixture,
  analysis,
  onClose,
}) => {
  const { scoreMatrix, lambdaHome, lambdaAway, trueProbabilities } = analysis;
  const homeName = fixture.homeTeam?.name || 'Home';
  const awayName = fixture.awayTeam?.name || 'Away';

  // Find maximum cell probability for color scale normalization
  let maxCell = 0;
  for (let h = 0; h < 6; h++) {
    for (let a = 0; a < 6; a++) {
      if (scoreMatrix[h][a] > maxCell) maxCell = scoreMatrix[h][a];
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-terminal-900 border border-slate-700/70 rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              Bivariate Poisson Quant Model
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              {homeName} vs {awayName}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              6×6 Score Probability Heatmap & Derived Market Probabilities
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expected Goals Indicators */}
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">{homeName} Expected Goals (λ)</div>
            <div className="text-xl font-mono font-bold text-cyan-400 mt-0.5">
              {lambdaHome.toFixed(2)} <span className="text-xs font-normal text-slate-400">goals</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Att: {fixture.homeTeam?.attack_rating.toFixed(2)} × Def: {fixture.awayTeam?.defense_rating.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
            <div className="text-xs text-slate-400">{awayName} Expected Goals (λ)</div>
            <div className="text-xl font-mono font-bold text-cyan-400 mt-0.5">
              {lambdaAway.toFixed(2)} <span className="text-xs font-normal text-slate-400">goals</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Att: {fixture.awayTeam?.attack_rating.toFixed(2)} × Def: {fixture.homeTeam?.defense_rating.toFixed(2)}
            </div>
          </div>
        </div>

        {/* 6x6 Heatmap Grid */}
        <div className="my-4 overflow-x-auto">
          <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span>Home Goals (Rows 0-5) ↓ &nbsp; Away Goals (Cols 0-5) →</span>
            <span className="text-[11px] text-slate-400">Higher % = brighter green</span>
          </div>

          <div className="min-w-[420px] bg-terminal-950 p-3 rounded-lg border border-slate-800">
            {/* Column headers: Away scores */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs text-slate-400 pb-1 border-b border-slate-800/80">
              <div className="text-slate-400 font-bold">H \ A</div>
              {[0, 1, 2, 3, 4, 5].map((a) => (
                <div key={a} className="font-semibold text-slate-300">
                  {a}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            {[0, 1, 2, 3, 4, 5].map((h) => (
              <div key={h} className="grid grid-cols-7 gap-1 text-center font-mono text-xs pt-1">
                <div className="font-semibold text-slate-300 flex items-center justify-center">
                  {h}
                </div>
                {[0, 1, 2, 3, 4, 5].map((a) => {
                  const prob = scoreMatrix[h][a];
                  const pct = (prob * 100).toFixed(1);
                  const intensity = maxCell > 0 ? prob / maxCell : 0;
                  
                  // Gradient based on intensity
                  const bgStyle =
                    intensity > 0.65
                      ? 'bg-emerald-500/40 text-emerald-200 border-emerald-500/50 font-bold'
                      : intensity > 0.35
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-600/30'
                      : intensity > 0.15
                      ? 'bg-slate-800/90 text-slate-300 border-slate-700/40'
                      : 'bg-slate-900/50 text-slate-500 border-slate-800/30';

                  return (
                    <div
                      key={a}
                      title={`Score: ${h}-${a} (${pct}%)`}
                      className={`h-8 flex flex-col items-center justify-center rounded border text-[11px] transition-transform hover:scale-105 ${bgStyle}`}
                    >
                      {pct}%
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Derived True Probabilities Summary */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-center font-mono">
          <div className="bg-slate-800/40 p-2 rounded border border-slate-800">
            <div className="text-[11px] text-slate-400">Home Win (1)</div>
            <div className="text-sm font-bold text-white">
              {(trueProbabilities.home * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400">Fair: {(1 / trueProbabilities.home).toFixed(2)}</div>
          </div>
          <div className="bg-slate-800/40 p-2 rounded border border-slate-800">
            <div className="text-[11px] text-slate-400">Draw (X)</div>
            <div className="text-sm font-bold text-white">
              {(trueProbabilities.draw * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400">Fair: {(1 / trueProbabilities.draw).toFixed(2)}</div>
          </div>
          <div className="bg-slate-800/40 p-2 rounded border border-slate-800">
            <div className="text-[11px] text-slate-400">Away Win (2)</div>
            <div className="text-sm font-bold text-white">
              {(trueProbabilities.away * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-400">Fair: {(1 / trueProbabilities.away).toFixed(2)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 text-center font-mono">
          <div className="bg-slate-800/40 p-2 rounded border border-slate-800 flex items-center justify-between px-3">
            <span className="text-[11px] text-slate-400">Over 2.5 Goals:</span>
            <span className="text-sm font-bold text-white">
              {(trueProbabilities.over25 * 100).toFixed(1)}%
            </span>
          </div>
          <div className="bg-slate-800/40 p-2 rounded border border-slate-800 flex items-center justify-between px-3">
            <span className="text-[11px] text-slate-400">Under 2.5 Goals:</span>
            <span className="text-sm font-bold text-white">
              {(trueProbabilities.under25 * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
