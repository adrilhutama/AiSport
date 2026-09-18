'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LeagueCode, LegSelection, Fixture, AIParlay } from '@/types';
import { Header } from '@/components/Header';
import { LeagueFilter } from '@/components/LeagueFilter';
import { SportsbookSidebar } from '@/components/SportsbookSidebar';
import { SportsbookTable } from '@/components/SportsbookTable';
import { SportsbookBetslip } from '@/components/SportsbookBetslip';
import { ScoreMatrixModal } from '@/components/ScoreMatrixModal';
import { AIParlayCard } from '@/components/AIParlayCard';
import { HitRateTracker } from '@/components/HitRateTracker';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { analyzeFixtureQuant } from '@/lib/analytics';
import { Sparkles, Layers, TrendingUp, Cpu, Database, Calendar } from 'lucide-react';

interface DashboardClientProps {
  initialFixtures: Fixture[];
  initialParlays: AIParlay[];
  dataSource?: 'supabase' | 'mock_fallback';
}

export const DashboardClient: React.FC<DashboardClientProps> = ({
  initialFixtures,
  initialParlays,
  dataSource = 'mock_fallback',
}) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'ai-parlays' | 'builder'>('ai-parlays');
  const [selectedLeague, setSelectedLeague] = useState<LeagueCode | 'ALL'>('ALL');
  const [selectedLegs, setSelectedLegs] = useState<LegSelection[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>(initialFixtures);
  const [parlays, setParlays] = useState<AIParlay[]>(initialParlays);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Live (Ready)');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [matrixFixture, setMatrixFixture] = useState<Fixture | null>(null);

  // Sync state with incoming server props
  useEffect(() => {
    if (initialFixtures && initialFixtures.length > 0) {
      setFixtures(initialFixtures);
    }
  }, [initialFixtures]);

  useEffect(() => {
    if (initialParlays && initialParlays.length > 0) {
      setParlays(initialParlays);
    }
  }, [initialParlays]);

  // Chronologically sort all fixtures by kickoff match_time
  const sortedFixtures = [...fixtures].sort(
    (a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime()
  );

  // Calculate counts for league badges
  const fixtureCounts: Record<LeagueCode | 'ALL', number> = {
    ALL: fixtures.length,
    PL: fixtures.filter((f) => f.league === 'PL').length,
    PD: fixtures.filter((f) => f.league === 'PD').length,
    SA: fixtures.filter((f) => f.league === 'SA').length,
    BL1: fixtures.filter((f) => f.league === 'BL1').length,
    FL1: fixtures.filter((f) => f.league === 'FL1').length,
  };

  // Toggle individual leg in the betting slip
  const handleToggleLeg = (leg: LegSelection) => {
    setSelectedLegs((prev) => {
      const exists = prev.some(
        (l) =>
          l.fixtureId === leg.fixtureId &&
          l.market === leg.market &&
          l.selection === leg.selection
      );
      if (exists) {
        return prev.filter(
          (l) =>
            !(
              l.fixtureId === leg.fixtureId &&
              l.market === leg.market &&
              l.selection === leg.selection
            )
        );
      } else {
        return [...prev, leg];
      }
    });
  };

  const handleRemoveLeg = (fixtureId: string, market: string, selection: string) => {
    setSelectedLegs((prev) =>
      prev.filter(
        (l) =>
          !(l.fixtureId === fixtureId && l.market === market && l.selection === selection)
      )
    );
  };

  const handleClearSlip = () => {
    setSelectedLegs([]);
  };

  // Tail slip loads all legs from an AI curated slip directly into the betting slip
  const handleTailSlip = (legs: LegSelection[]) => {
    setSelectedLegs(legs);
    setSyncToast(`Loaded ${legs.length} legs into Betting Slip!`);
    setTimeout(() => setSyncToast(null), 3000);
  };

  // Background Sync Trigger with Client-Side Invalidation & Live Re-fetch
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync');
      const data = await res.json();
      setLastSyncTime(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      setSyncToast(data.message || 'Market lines synced successfully!');

      router.refresh();

      const freshRes = await fetch('/api/fixtures', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (freshRes.ok) {
        const freshData = await freshRes.json();
        if (freshData.fixtures && freshData.fixtures.length > 0) {
          setFixtures(freshData.fixtures);
        }
        if (freshData.parlays && freshData.parlays.length > 0) {
          setParlays(freshData.parlays);
        }
      }
    } catch (err) {
      setSyncToast('Using updated local consensus odds.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 3000);
    }
  };

  // Count positive EV bets across all active fixtures
  const totalValueBets = fixtures.reduce((acc, f) => {
    if (!f.quantAnalysis) return acc;
    const evs = f.quantAnalysis.expectedValues;
    const values = [
      evs.homeEV,
      evs.drawEV,
      evs.awayEV,
      evs.over15EV,
      evs.under15EV,
      evs.over25EV,
      evs.under25EV,
      evs.over35EV,
      evs.under35EV,
      evs.bttsYesEV,
      evs.bttsNoEV,
      ...Object.values(evs.asianHandicapEV || {}),
    ];
    return acc + values.filter((v) => v > 0).length;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Toast Notification */}
      {syncToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/90 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl text-xs font-mono font-semibold shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top duration-200 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          {syncToast}
        </div>
      )}

      {/* Main App Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastSyncTime={lastSyncTime}
        onSync={handleSync}
        isSyncing={isSyncing}
        totalValueBets={totalValueBets}
        dataSource={dataSource}
      />

      {/* Hero / Terminal Intro Banner */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 py-4 sm:py-5 px-3 sm:px-6 lg:px-8">
        <div className="max-w-[1700px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider mb-1">
              <Cpu className="w-3.5 h-3.5" />
              Automated Quantitative Parlay Architecture
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Top 5 European Leagues Analytics Matrix
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time Bivariate Poisson goal modeling, de-vigged market comparison, +EV leg identification, and Fractional Kelly Criterion bankroll protection.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Source:</span>
              <strong className="text-cyan-300 uppercase">
                {dataSource === 'supabase' ? 'Supabase Live' : 'Live Engine'}
              </strong>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Fixtures:</span>
              <strong className="text-white">{fixtures.length}</strong>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">+EV Bets Detected:</span>
              <strong className="text-emerald-400">{totalValueBets}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3-COLUMN MAIN SPORTSBOOK TERMINAL GRID */}
      <main className="flex-1 max-w-[1700px] mx-auto w-full px-2 sm:px-4 lg:px-6 py-4">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          {/* COLUMN 1: LEFT SIDEBAR (220px - 260px) */}
          <SportsbookSidebar
            selectedLeague={selectedLeague}
            onSelectLeague={(league) => {
              setSelectedLeague(league);
            }}
            leagueCounts={fixtureCounts}
          />

          {/* COLUMN 2: MIDDLE COLUMN: MAIN FEED & HIGH-DENSITY ODDS TABLE */}
          <div className="flex-1 min-w-0 w-full space-y-4">
            {/* Live Score Ticker Strip */}
            <LiveScoreTicker initialNextKickoff={fixtures[0]?.match_time} />

            {/* Historical Track Record & Hit-Rate Tracker */}
            <HitRateTracker parlays={parlays} />

            {/* TAB VIEW A: AI Curated Accumulators */}
            {activeTab === 'ai-parlays' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Today's Curated Quantitative Parlays
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Algorithmically balanced combinations optimized for risk-adjusted growth.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(parlays.filter((p) => p.status === 'pending').length > 0
                    ? parlays.filter((p) => p.status === 'pending').slice(0, 3)
                    : parlays.slice(0, 3)
                  ).map((parlay) => (
                    <AIParlayCard
                      key={parlay.id}
                      parlay={parlay}
                      onTailSlip={handleTailSlip}
                    />
                  ))}
                </div>

                {/* Quick Link to Switch into Odds Board */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <span>Want to build custom slips? Explore high-density odds across all top leagues.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('builder')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shrink-0 cursor-pointer"
                  >
                    View Odds Terminal
                  </button>
                </div>
              </div>
            )}

            {/* TAB VIEW B: High-Density Sportsbook Odds Terminal */}
            {activeTab === 'builder' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/60">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      Live Match Odds & Quant Matrix
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select outcomes to build your custom accumulator. Odds highlighted in emerald carry positive Expected Value (+EV).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Selected: <strong className="text-emerald-400">{selectedLeague === 'ALL' ? 'All Top 5 Leagues' : selectedLeague}</strong></span>
                  </div>
                </div>

                {/* The Sportsbook Table (1xBet / Pinnacle Architecture) */}
                <SportsbookTable
                  fixtures={sortedFixtures}
                  selectedLegs={selectedLegs}
                  onToggleLeg={handleToggleLeg}
                  onOpenMatrix={(fixture) => setMatrixFixture(fixture)}
                  selectedLeague={selectedLeague}
                />
              </div>
            )}
          </div>

          {/* COLUMN 3: RIGHT SIDEBAR: BETSLIP & AI PARLAYS DRAWER (300px - 340px) */}
          <SportsbookBetslip
            legs={selectedLegs}
            onRemoveLeg={handleRemoveLeg}
            onClearSlip={handleClearSlip}
            parlays={parlays}
            onTailSlip={handleTailSlip}
          />
        </div>
      </main>

      {/* 6x6 Bivariate Poisson Score Matrix Modal */}
      {matrixFixture && (
        <ScoreMatrixModal
          fixture={matrixFixture}
          analysis={matrixFixture.quantAnalysis || analyzeFixtureQuant(matrixFixture)}
          onClose={() => setMatrixFixture(null)}
        />
      )}

      {/* Minimal Sportsbook Terminal Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-5 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-semibold">
              OddsMatrix Quantitative Terminal
            </span>
            <span className="text-slate-600">•</span>
            <span>3-Column 1xBet / Pinnacle Desktop Architecture</span>
          </div>
          <div className="text-slate-500 text-[11px]">
            Data sources: Football-Data.org & The Odds API • Zero-Maintenance Serverless
          </div>
        </div>
      </footer>
    </div>
  );
};
