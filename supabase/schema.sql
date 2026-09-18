-- OddsMatrix: Supabase Database Schema
-- Focus: European Top 5 Leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1)

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Teams Table
CREATE TABLE IF NOT EXISTS public.teams (
    id TEXT PRIMARY KEY,                       -- Normalized team slug, e.g. 'arsenal', 'real-madrid'
    league TEXT NOT NULL,                      -- 'PL', 'PD', 'SA', 'BL1', 'FL1'
    name TEXT NOT NULL,                        -- Official team display name
    aliases TEXT[] DEFAULT '{}',               -- Array of known alternate names for fuzzy matching
    attack_rating NUMERIC(5,2) DEFAULT 1.00,   -- Relative attacking strength (1.00 = league baseline)
    defense_rating NUMERIC(5,2) DEFAULT 1.00,  -- Relative defensive conceded multiplier (1.00 = baseline)
    form TEXT DEFAULT 'N/A',                   -- Last 5 matches (W, D, L) string
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Fixtures Table
CREATE TABLE IF NOT EXISTS public.fixtures (
    id TEXT PRIMARY KEY,                       -- Fixture identifier, e.g. 'pl-arsenal-chelsea-2026-09-20'
    league TEXT NOT NULL,                      -- 'PL', 'PD', 'SA', 'BL1', 'FL1'
    home_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    away_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
    match_time TIMESTAMPTZ NOT NULL,           -- Scheduled kickoff time in UTC
    status TEXT DEFAULT 'SCHEDULED',           -- 'SCHEDULED', 'TIMED', 'IN_PLAY', 'FINISHED'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Market Odds Table
CREATE TABLE IF NOT EXISTS public.market_odds (
    fixture_id TEXT PRIMARY KEY REFERENCES public.fixtures(id) ON DELETE CASCADE,
    bookmaker TEXT NOT NULL DEFAULT 'Consensus',
    home_odds NUMERIC(6,2) NOT NULL,           -- 1X2 Home Win decimal odds (e.g. 1.85)
    draw_odds NUMERIC(6,2) NOT NULL,           -- 1X2 Draw decimal odds (e.g. 3.40)
    away_odds NUMERIC(6,2) NOT NULL,           -- 1X2 Away Win decimal odds (e.g. 4.20)
    over_25_odds NUMERIC(6,2) NOT NULL,        -- Over 2.5 goals decimal odds (e.g. 1.72)
    under_25_odds NUMERIC(6,2) NOT NULL,       -- Under 2.5 goals decimal odds (e.g. 2.10)
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AI Parlays Table (Curated slips & historical performance tracking)
CREATE TABLE IF NOT EXISTS public.ai_parlays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL CHECK (category IN ('safe', 'value', 'lotto')),
    legs JSONB NOT NULL,                       -- Array of selected legs with match, market, selection, odds
    total_odds NUMERIC(8,2) NOT NULL,
    true_probability NUMERIC(5,4) NOT NULL,    -- Quantitative model calculated probability (0.0000 - 1.0000)
    expected_value NUMERIC(6,2) NOT NULL,      -- Expected Value % (e.g. +14.5%)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_fixtures_league ON public.fixtures(league);
CREATE INDEX IF NOT EXISTS idx_fixtures_match_time ON public.fixtures(match_time);
CREATE INDEX IF NOT EXISTS idx_teams_league ON public.teams(league);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_category ON public.ai_parlays(category);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_status ON public.ai_parlays(status);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_created_at ON public.ai_parlays(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_odds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_parlays ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public read access for web users
CREATE POLICY "Allow public read on teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow public read on fixtures" ON public.fixtures FOR SELECT USING (true);
CREATE POLICY "Allow public read on market_odds" ON public.market_odds FOR SELECT USING (true);
CREATE POLICY "Allow public read on ai_parlays" ON public.ai_parlays FOR SELECT USING (true);

-- RLS Policies: Write access for service role only (API sync)
CREATE POLICY "Allow service-role write on teams" ON public.teams FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service-role write on fixtures" ON public.fixtures FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service-role write on market_odds" ON public.market_odds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service-role write on ai_parlays" ON public.ai_parlays FOR ALL USING (auth.role() = 'service_role');

-- Automated updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_fixtures_updated_at
BEFORE UPDATE ON public.fixtures
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_market_odds_updated_at
BEFORE UPDATE ON public.market_odds
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed Historical AI Parlays for Hit-Rate Tracker Verification
INSERT INTO public.ai_parlays (category, legs, total_odds, true_probability, expected_value, status, created_at)
VALUES
(
    'safe',
    '[
        {"fixtureId": "pl-1", "homeTeam": "Arsenal", "awayTeam": "Everton", "selection": "1", "market": "1X2", "odds": 1.38, "ev": 8.5},
        {"fixtureId": "pd-1", "homeTeam": "Real Madrid", "awayTeam": "Mallorca", "selection": "1", "market": "1X2", "odds": 1.25, "ev": 6.2},
        {"fixtureId": "bl-1", "homeTeam": "Bayern Munich", "awayTeam": "Bremen", "selection": "Over 2.5", "market": "Totals", "odds": 1.40, "ev": 9.1}
    ]'::jsonb,
    2.42,
    0.4850,
    17.37,
    'won',
    NOW() - INTERVAL '4 days'
),
(
    'value',
    '[
        {"fixtureId": "sa-1", "homeTeam": "Inter Milan", "awayTeam": "Fiorentina", "selection": "1", "market": "1X2", "odds": 1.62, "ev": 11.2},
        {"fixtureId": "fl-1", "homeTeam": "Marseille", "awayTeam": "Nantes", "selection": "Over 2.5", "market": "Totals", "odds": 1.75, "ev": 13.8},
        {"fixtureId": "pl-2", "homeTeam": "Liverpool", "awayTeam": "Bournemouth", "selection": "Over 2.5", "market": "Totals", "odds": 1.48, "ev": 10.4}
    ]'::jsonb,
    4.20,
    0.2840,
    19.28,
    'won',
    NOW() - INTERVAL '3 days'
),
(
    'safe',
    '[
        {"fixtureId": "pd-2", "homeTeam": "Barcelona", "awayTeam": "Getafe", "selection": "1", "market": "1X2", "odds": 1.30, "ev": 7.4},
        {"fixtureId": "bl-2", "homeTeam": "Bayer Leverkusen", "awayTeam": "Wolfsburg", "selection": "1", "market": "1X2", "odds": 1.55, "ev": 8.9}
    ]'::jsonb,
    2.02,
    0.5400,
    9.08,
    'lost',
    NOW() - INTERVAL '2 days'
),
(
    'value',
    '[
        {"fixtureId": "pl-3", "homeTeam": "Manchester City", "awayTeam": "Brentford", "selection": "1", "market": "1X2", "odds": 1.32, "ev": 9.6},
        {"fixtureId": "sa-2", "homeTeam": "Juventus", "awayTeam": "Genoa", "selection": "Under 2.5", "market": "Totals", "odds": 1.70, "ev": 14.1},
        {"fixtureId": "fl-2", "homeTeam": "PSG", "awayTeam": "Rennes", "selection": "Over 2.5", "market": "Totals", "odds": 1.50, "ev": 10.5}
    ]'::jsonb,
    3.37,
    0.3450,
    16.27,
    'won',
    NOW() - INTERVAL '1 day'
),
(
    'lotto',
    '[
        {"fixtureId": "pl-4", "homeTeam": "Aston Villa", "awayTeam": "Wolves", "selection": "1", "market": "1X2", "odds": 1.60, "ev": 8.2},
        {"fixtureId": "pd-3", "homeTeam": "Atletico Madrid", "awayTeam": "Celta Vigo", "selection": "1", "market": "1X2", "odds": 1.52, "ev": 7.1},
        {"fixtureId": "sa-3", "homeTeam": "AC Milan", "awayTeam": "Lazio", "selection": "Over 2.5", "market": "Totals", "odds": 1.85, "ev": 12.0},
        {"fixtureId": "bl-3", "homeTeam": "Dortmund", "awayTeam": "Bochum", "selection": "1", "market": "1X2", "odds": 1.35, "ev": 8.0},
        {"fixtureId": "fl-3", "homeTeam": "Monaco", "awayTeam": "Montpellier", "selection": "Over 2.5", "market": "Totals", "odds": 1.62, "ev": 11.5}
    ]'::jsonb,
    9.86,
    0.1280,
    26.21,
    'pending',
    NOW()
);
