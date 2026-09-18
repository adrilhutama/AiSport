'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, RefreshCw, Layers, Sparkles } from 'lucide-react';

interface HeaderProps {
  activeTab: 'ai-parlays' | 'builder';
  onTabChange: (tab: 'ai-parlays' | 'builder') => void;
  lastSyncTime: string;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  lastSyncTime,
  onSync,
  isSyncing,
}) => {
  const router = useRouter();

  const handleSyncClick = async () => {
    await onSync();
    try {
      router.refresh();
    } catch (e) {
      // ignore
    }
  };
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/80 bg-terminal-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between py-3 gap-3">
          {/* Logo & Terminal Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-emerald-600 to-teal-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-950/50">
              <div className="w-full h-full bg-terminal-950 rounded-[10px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-white font-mono">
                  ODDS<span className="text-cyan-400">MATRIX</span>
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                  TOP 5 LEAGUES
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Bivariate Poisson Quantitative Model & +EV Parlay Terminal
              </p>
            </div>
          </div>

          {/* Controls: Sync Button & View Mode Navigation */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {/* View Mode Switcher */}
            <div className="flex items-center bg-terminal-900 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => onTabChange('ai-parlays')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  activeTab === 'ai-parlays'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Parlays</span>
              </button>
              <button
                onClick={() => onTabChange('builder')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  activeTab === 'builder'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Match Builder</span>
              </button>
            </div>

            {/* Sync Trigger & Cache Status */}
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-[11px] font-mono text-slate-400">
                Synced: {lastSyncTime}
              </span>
              <button
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-750 border border-slate-700 active:scale-95 transition-all disabled:opacity-60"
                title="Sync latest match data and market lines"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Lines'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
