'use client';

import React, { useState, useEffect } from 'react';
import { Radio, Clock, Flame } from 'lucide-react';
import { TeamCrest } from '@/components/TeamCrest';

export interface LiveMatch {
  id: string | number;
  league?: string;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  minute?: number | string | null;
}

interface LiveScoreTickerProps {
  initialNextKickoff?: string | null;
}

export const LiveScoreTicker: React.FC<LiveScoreTickerProps> = ({ initialNextKickoff }) => {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [nextKickoff, setNextKickoff] = useState<string | null>(initialNextKickoff || null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLiveScores = async () => {
    try {
      const res = await fetch('/api/livescore');
      if (res.ok) {
        const data = await res.json();
        setMatches(data.matches || []);
        if (data.nextKickoff) {
          setNextKickoff(data.nextKickoff);
        }
      }
    } catch (err) {
      console.warn('[LiveScoreTicker] Failed to poll live scores:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveScores();
    const interval = setInterval(fetchLiveScores, 60000); // 60s client polling interval
    return () => clearInterval(interval);
  }, []);

  const formatKickoffTime = (timestamp?: string | null) => {
    if (!timestamp) return 'Upcoming Matchday';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
        ' (' + date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ')';
    } catch {
      return 'Upcoming Matchday';
    }
  };

  return (
    <div className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl px-3.5 py-2.5 shadow-md backdrop-blur-sm">
      {matches.length > 0 ? (
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          {/* Header pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-mono font-bold shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <span>LIVE MATCHES ({matches.length})</span>
          </div>

          {/* Matches Scroll List */}
          <div className="flex items-center gap-2.5 flex-1">
            {matches.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-lg text-xs shrink-0 transition-colors"
              >
                {/* Minute / Status badge */}
                <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 font-mono font-bold text-[10px] border border-rose-800/40">
                  {typeof m.minute === 'number' ? `${m.minute}'` : m.minute || 'LIVE'}
                </span>

                {/* Home Team */}
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <TeamCrest src={m.homeCrest || undefined} name={m.homeTeam} size="xs" />
                  <span className="truncate max-w-[90px]">{m.homeTeam}</span>
                </div>

                {/* Score */}
                <div className="font-mono font-extrabold text-sm px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700/60 text-white tracking-wider">
                  {m.homeScore} - {m.awayScore}
                </div>

                {/* Away Team */}
                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                  <span className="truncate max-w-[90px]">{m.awayTeam}</span>
                  <TeamCrest src={m.awayCrest || undefined} name={m.awayTeam} size="xs" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Subtle Collapsed Ribbon (Empty State) */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              Radar Active
            </span>
            <span className="text-slate-300">
              No matches currently in play
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400 inline" />
              Next kickoff: <strong className="text-slate-200 font-semibold">{formatKickoffTime(nextKickoff)}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Auto-refresh 60s</span>
          </div>
        </div>
      )}
    </div>
  );
};
