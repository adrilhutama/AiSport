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
    crest_url TEXT,                            -- Official SVG/PNG crest URL from Football-Data.org or Supabase CDN
    rolling_xg NUMERIC(5,2) DEFAULT NULL,      -- Contextual rolling xG from API-Football
    key_injuries_count INT DEFAULT 0,          -- Contextual key starters out
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Fixtures Table
CREATE TABLE IF NOT EXISTS public.fixtures (
    id TEXT PRIMARY KEY,                       -- Fixture identifier, e.g. 'pl-arsenal-chelsea-2026-09-20'
    league TEXT NOT NULL,                      -- 'PL', 'PD', 'SA', 'BL1', 'FL1', 'CL', 'EL'
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
    handicap_odds JSONB DEFAULT '{}',          -- Asian Handicap lines (e.g. {"home_-1.5": 2.60, "away_+1.5": 1.50})
    totals_odds JSONB DEFAULT '{}',            -- Alternate totals (e.g. {"over_1.5": 1.25, "under_1.5": 3.90})
    btts_odds JSONB DEFAULT '{}',              -- Both Teams to Score (e.g. {"btts_yes": 1.75, "btts_no": 2.05})
    is_positive_ev BOOLEAN DEFAULT false,      -- Computed by PL/pgSQL trigger
    ev_home NUMERIC(5,2) DEFAULT 0.00,
    ev_draw NUMERIC(5,2) DEFAULT 0.00,
    ev_away NUMERIC(5,2) DEFAULT 0.00,
    max_ev NUMERIC(5,2) DEFAULT 0.00,
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settled_at TIMESTAMPTZ DEFAULT NULL
);

-- 6. Bet History Table (Settled bets & historical track record)
CREATE TABLE IF NOT EXISTS public.bet_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id TEXT REFERENCES public.fixtures(id) ON DELETE CASCADE,
    parlay_id UUID REFERENCES public.ai_parlays(id) ON DELETE SET NULL,
    market TEXT NOT NULL DEFAULT '1X2',
    market_type TEXT DEFAULT '1X2',
    selection TEXT NOT NULL,
    odds NUMERIC(6,2) NOT NULL,
    actual_score TEXT,
    outcome TEXT DEFAULT 'WON',
    result TEXT NOT NULL DEFAULT 'won' CHECK (result IN ('won', 'lost', 'push')),
    pnl NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    settled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning queries
CREATE INDEX IF NOT EXISTS idx_fixtures_league ON public.fixtures(league);
CREATE INDEX IF NOT EXISTS idx_fixtures_match_time ON public.fixtures(match_time);
CREATE INDEX IF NOT EXISTS idx_teams_league ON public.teams(league);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_category ON public.ai_parlays(category);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_status ON public.ai_parlays(status);
CREATE INDEX IF NOT EXISTS idx_ai_parlays_created_at ON public.ai_parlays(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_history_settled_at ON public.bet_history(settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_history_fixture ON public.bet_history(fixture_id);

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

-- Automated +EV Computation Trigger on market_odds
CREATE OR REPLACE FUNCTION public.compute_market_odds_ev()
RETURNS TRIGGER AS $$
DECLARE
    v_home_attack NUMERIC(5,2) := 1.15;
    v_home_defense NUMERIC(5,2) := 0.90;
    v_away_attack NUMERIC(5,2) := 1.05;
    v_away_defense NUMERIC(5,2) := 1.05;
    v_lambda_h NUMERIC(6,3);
    v_lambda_a NUMERIC(6,3);
    v_prob_home NUMERIC(6,4);
    v_prob_draw NUMERIC(6,4);
    v_prob_away NUMERIC(6,4);
    v_p_total NUMERIC(6,4);
BEGIN
    SELECT 
        COALESCE(ht.attack_rating, 1.15),
        COALESCE(ht.defense_rating, 0.90),
        COALESCE(at.attack_rating, 1.05),
        COALESCE(at.defense_rating, 1.05)
    INTO 
        v_home_attack, v_home_defense, v_away_attack, v_away_defense
    FROM public.fixtures f
    LEFT JOIN public.teams ht ON f.home_team_id = ht.id
    LEFT JOIN public.teams at ON f.away_team_id = at.id
    WHERE f.id = NEW.fixture_id;

    v_lambda_h := GREATEST(0.3, 1.55 * v_home_attack * v_away_defense);
    v_lambda_a := GREATEST(0.3, 1.25 * v_away_attack * v_home_defense);

    v_prob_home := (v_lambda_h / (v_lambda_h + v_lambda_a + 0.90));
    v_prob_draw := (0.90 / (v_lambda_h + v_lambda_a + 0.90));
    v_prob_away := (v_lambda_a / (v_lambda_h + v_lambda_a + 0.90));

    v_p_total := v_prob_home + v_prob_draw + v_prob_away;
    IF v_p_total > 0 THEN
        v_prob_home := v_prob_home / v_p_total;
        v_prob_draw := v_prob_draw / v_p_total;
        v_prob_away := v_prob_away / v_p_total;
    END IF;

    NEW.ev_home := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_home * NEW.home_odds - 1.0) * 100)::numeric, 2)));
    NEW.ev_draw := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_draw * NEW.draw_odds - 1.0) * 100)::numeric, 2)));
    NEW.ev_away := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_away * NEW.away_odds - 1.0) * 100)::numeric, 2)));

    NEW.max_ev := GREATEST(NEW.ev_home, NEW.ev_draw, NEW.ev_away, 0.0);
    NEW.is_positive_ev := (NEW.max_ev > 0.0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_market_odds_ev ON public.market_odds;
CREATE TRIGGER trg_compute_market_odds_ev
BEFORE INSERT OR UPDATE ON public.market_odds
FOR EACH ROW EXECUTE FUNCTION public.compute_market_odds_ev();

-- High-Performance Single-Call RPC: get_sportsbook_board
CREATE OR REPLACE FUNCTION public.get_sportsbook_board(league_filter TEXT DEFAULT 'ALL')
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', f.id,
            'league', f.league,
            'home_team_id', f.home_team_id,
            'away_team_id', f.away_team_id,
            'match_time', f.match_time,
            'status', f.status,
            'homeTeam', jsonb_build_object(
                'id', ht.id,
                'league', ht.league,
                'name', ht.name,
                'aliases', ht.aliases,
                'attack_rating', ht.attack_rating,
                'defense_rating', ht.defense_rating,
                'form', ht.form,
                'crest_url', ht.crest_url,
                'rolling_xg', ht.rolling_xg,
                'key_injuries_count', ht.key_injuries_count
            ),
            'awayTeam', jsonb_build_object(
                'id', at.id,
                'league', at.league,
                'name', at.name,
                'aliases', at.aliases,
                'attack_rating', at.attack_rating,
                'defense_rating', at.defense_rating,
                'form', at.form,
                'crest_url', at.crest_url,
                'rolling_xg', at.rolling_xg,
                'key_injuries_count', at.key_injuries_count
            ),
            'marketOdds', jsonb_build_object(
                'fixture_id', mo.fixture_id,
                'bookmaker', mo.bookmaker,
                'home_odds', mo.home_odds,
                'draw_odds', mo.draw_odds,
                'away_odds', mo.away_odds,
                'over_25_odds', mo.over_25_odds,
                'under_25_odds', mo.under_25_odds,
                'handicap_odds', COALESCE(mo.handicap_odds, '{}'::jsonb),
                'totals_odds', COALESCE(mo.totals_odds, '{}'::jsonb),
                'btts_odds', COALESCE(mo.btts_odds, '{}'::jsonb),
                'is_positive_ev', mo.is_positive_ev,
                'ev_home', mo.ev_home,
                'ev_draw', mo.ev_draw,
                'ev_away', mo.ev_away,
                'max_ev', mo.max_ev,
                'updated_at', mo.updated_at
            )
        )
    )
    INTO result
    FROM public.fixtures f
    LEFT JOIN public.teams ht ON f.home_team_id = ht.id
    LEFT JOIN public.teams at ON f.away_team_id = at.id
    LEFT JOIN public.market_odds mo ON f.id = mo.fixture_id
    WHERE (league_filter = 'ALL' OR league_filter IS NULL OR f.league = league_filter)
      AND f.status IN ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'HALFTIME')
      AND f.match_time >= NOW() - INTERVAL '3 hours'
    ORDER BY f.match_time ASC;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Storage Bucket for Team Crests (Public CDN)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-crests', 'team-crests', true)
ON CONFLICT (id) DO UPDATE SET public = true;

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
