'use client';

import React from 'react';
import { AIParlay, LegSelection } from '@/types';
import { ShieldCheck, TrendingUp, Sparkles, CheckCircle2, XCircle, Clock, ArrowRight } from 'lucide-react';
import { EVBadge, FormBadges } from '@/components/StatBadge';
import { TeamCrest } from '@/components/TeamCrest';

interface AIParlayCardProps {
  parlay: AIParlay;
  onTailSlip: (legs: LegSelection[]) => void;
}

export const AIParlayCard: React.FC<AIParlayCardProps> = ({ parlay, onTailSlip }) => {
  const getCategoryTheme = () => {
    switch (parlay.category) {
      case 'safe':
        return {
          icon: <ShieldCheck className="w-4 h-4 text-cyan-400" />,
          label: 'Safe Combo',
          badgeStyle: 'bg-cyan-950/60 border-cyan-700/50 text-cyan-300',
          borderHover: 'hover:border-cyan-500/50',
        };
      case 'value':
        return {
          icon: <TrendingUp className="w-4 h-4 text-emerald-400" />,
          label: 'Value Seeker',
          badgeStyle: 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300',
          borderHover: 'hover:border-emerald-500/50',
        };
      case 'lotto':
        return {
          icon: <Sparkles className="w-4 h-4 text-amber-400" />,
          label: 'Weekend Lotto',
          badgeStyle: 'bg-amber-950/60 border-amber-700/50 text-amber-300',
          borderHover: 'hover:border-amber-500/50',
        };
    }
  };

  const getStatusBadge = () => {
    switch (parlay.status) {
      case 'won':
        return (
          <span className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3.5 h-3.5" />
            WON
          </span>
        );
      case 'lost':
        return (
          <span className="flex items-center gap-1 text-xs font-mono font-bold text-rose-400 bg-rose-950/80 border border-rose-700 px-2 py-0.5 rounded">
            <XCircle className="w-3.5 h-3.5" />
            LOST
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs font-mono font-medium text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
            <Clock className="w-3.5 h-3.5" />
            PENDING
          </span>
        );
    }
  };

  const theme = getCategoryTheme();

  return (
    <div
      className={`bg-terminal-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between transition-all ${theme.borderHover} shadow-md`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${theme.badgeStyle}`}
            >
              {theme.icon}
              {theme.label}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {parlay.legs.length} Legs
            </span>
          </div>
          {getStatusBadge()}
        </div>

        {/* Title & Description */}
        <div className="mt-3">
          <h4 className="text-base font-bold text-white">{parlay.title}</h4>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {parlay.description}
          </p>
        </div>

        {/* Legs List */}
        <div className="my-4 space-y-2">
          {parlay.legs.map((leg, idx) => (
            <div
              key={idx}
              className="bg-slate-800/40 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-200">
                  <TeamCrest src={leg.homeCrest} name={leg.homeTeam} size="xs" />
                  <span>{leg.homeTeam}</span>
                  {leg.homeForm && <FormBadges form={leg.homeForm} />}
                  <span className="text-slate-500 font-normal text-[10px]">vs</span>
                  <TeamCrest src={leg.awayCrest} name={leg.awayTeam} size="xs" />
                  <span>{leg.awayTeam}</span>
                  {leg.awayForm && <FormBadges form={leg.awayForm} />}
                </div>
                <div className="text-slate-400 text-[11px] font-mono">
                  {leg.market}: <span className="text-cyan-300 font-semibold">{leg.selection}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono">
                {leg.ev > 0 && <EVBadge ev={leg.ev} />}
                <span className="font-bold text-white text-sm bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  {leg.odds.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quantitative Summary & Tail Action */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center font-mono">
          <div className="bg-slate-800/50 p-2 rounded border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Total Odds</div>
            <div className="text-base font-bold text-cyan-400">
              {parlay.total_odds.toFixed(2)}
            </div>
          </div>
          <div className="bg-slate-800/50 p-2 rounded border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Win Chance</div>
            <div className="text-base font-bold text-white">
              {(parlay.true_probability * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-800/50 p-2 rounded border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase">Edge (+EV)</div>
            <div className="text-base font-bold text-emerald-400">
              +{parlay.expected_value.toFixed(1)}%
            </div>
          </div>
        </div>

        <button
          onClick={() => onTailSlip(parlay.legs)}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-md transition-all active:scale-[0.99]"
        >
          <span>Tail This Parlay Slip</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
