'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LeagueCode, LegSelection, Fixture, AIParlay } from '@/types';
import { Header } from '@/components/Header';
import { LeagueFilter } from '@/components/LeagueFilter';
import { MatchCard } from '@/components/MatchCard';
import { AIParlayCard } from '@/components/AIParlayCard';
import { HitRateTracker } from '@/components/HitRateTracker';
import { BettingSlip } from '@/components/BettingSlip';
import { LiveScoreTicker } from '@/components/LiveScoreTicker';
import { Sparkles, Layers, TrendingUp, Cpu, Info, Database, Calendar } from 'lucide-react';

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
  const [showAllMatches, setShowAllMatches] = useState<boolean>(false);

  // Sync state with incoming server props when router.refresh() resolves
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

  // Filter fixtures according to selected league
  const leagueFilteredFixtures =
    selectedLeague === 'ALL'
      ? sortedFixtures
      : sortedFixtures.filter((f) => f.league === selectedLeague);

  // Gameweek / Upcoming round grouping: limit to max 10 matches per league by default
  const displayedFixtures = showAllMatches
    ? leagueFilteredFixtures
    : selectedLeague === 'ALL'
    ? (() => {
        const leagueCounts: Record<string, number> = {};
        return leagueFilteredFixtures.filter((f) => {
          leagueCounts[f.league] = (leagueCounts[f.league] || 0) + 1;
          return leagueCounts[f.league] <= 10;
        });
      })()
    : leagueFilteredFixtures.slice(0, 10);

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

      // 1. Invalidate Next.js App Router client cache
      router.refresh();

      // 2. Directly fetch latest Supabase data with no-store cache control
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
    <div className="min-h-screen bg-terminal-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
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
      <div className="border-b border-slate-800/80 bg-terminal-900/40 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider mb-1">
              <Cpu className="w-3.5 h-3.5" />
              Automated Quantitative Parlay Architecture
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Top 5 European Leagues Analytics Matrix
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Real-time Bivariate Poisson goal modeling, de-vigged market comparison, +EV leg identification, and Fractional Kelly Criterion bankroll protection.
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Source:</span>
              <strong className="text-cyan-300 uppercase">{dataSource === 'supabase' ? 'Supabase Live' : 'Live Engine'}</strong>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Fixtures:</span>
              <strong className="text-white">{fixtures.length}</strong>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">+EV Bets Detected:</span>
              <strong className="text-emerald-400">{totalValueBets}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-time Live Score Ticker */}
        <LiveScoreTicker initialNextKickoff={fixtures[0]?.match_time} />

        {/* VIEW A: AI Curated Parlays */}
        {activeTab === 'ai-parlays' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Historical Track Record & Hit-Rate */}
            <HitRateTracker parlays={parlays} />

            {/* Curated Slips Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Today's Curated Quantitative Parlays
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Algorithmically balanced combinations optimized for risk-adjusted growth.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            </div>

            {/* Educational Info Card */}
            <div className="bg-terminal-900/60 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-slate-200">Quantitative Model Note: </strong>
                Curated slips employ independent joint Poisson probabilities across the Premier League, La Liga, Serie A, Bundesliga, and Ligue 1. Click <em>"Tail This Parlay Slip"</em> to test custom bankrolls and calculate 1/4 Kelly stake allocations in real-time.
              </div>
            </div>
          </div>
        )}

        {/* VIEW B: Interactive Parlay Builder */}
        {activeTab === 'builder' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* League Selection Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Live Match Odds & Quant Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select outcomes to build your custom accumulator. Odds highlighted in emerald carry positive Expected Value (+EV).
                </p>
              </div>
              <LeagueFilter
                selectedLeague={selectedLeague}
                onSelectLeague={setSelectedLeague}
                fixtureCounts={fixtureCounts}
              />
            </div>

            {/* Gameweek Round Indicator & View Toggle */}
            {displayedFixtures.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-400 bg-terminal-900/60 border border-slate-800/80 px-3.5 py-2 rounded-xl">
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    Round: <strong className="text-white">{showAllMatches ? 'All Scheduled Matches' : 'Upcoming Matchday Round'}</strong> ({displayedFixtures.length} matches sorted by kickoff)
                  </span>
                </div>
                {leagueFilteredFixtures.length > 10 && (
                  <button
                    onClick={() => setShowAllMatches(!showAllMatches)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline text-left sm:text-right"
                  >
                    {showAllMatches ? 'Show Upcoming Round Only (Max 10)' : `Show All ${leagueFilteredFixtures.length} Matches`}
                  </button>
                )}
              </div>
            )}

            {/* Match Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedFixtures.map((fixture) => (
                <MatchCard
                  key={fixture.id}
                  fixture={fixture}
                  selectedLegs={selectedLegs}
                  onToggleLeg={handleToggleLeg}
                />
              ))}
            </div>

            {displayedFixtures.length === 0 && (
              <div className="bg-terminal-900 border border-slate-800 rounded-xl p-12 text-center">
                <p className="text-sm text-slate-400">
                  No upcoming fixtures found for the selected league filter.
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Betting Slip Drawer */}
      <BettingSlip
        legs={selectedLegs}
        onRemoveLeg={handleRemoveLeg}
        onClearSlip={handleClearSlip}
      />

      {/* Minimal Footer */}
      <footer className="border-t border-slate-800/80 bg-terminal-950 py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>OddsMatrix Quantitative Engine • Zero-Maintenance Serverless</span>
          </div>
          <div>
            Data sources: Football-Data.org & The Odds API • For analytical and educational use only
          </div>
        </div>
      </footer>
    </div>
  );
};
