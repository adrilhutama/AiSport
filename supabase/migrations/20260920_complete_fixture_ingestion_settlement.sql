-- Migration: 20260920_complete_fixture_ingestion_settlement.sql
-- Completes fixture ingestion schema, API-Sports context columns, settlement tracking, and safe active board filtering

-- 1. Ensure market_odds has full multi-market JSONB columns
ALTER TABLE public.market_odds
ADD COLUMN IF NOT EXISTS handicap_odds JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS totals_odds JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS btts_odds JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure fixtures table has score and settlement tracking columns
ALTER TABLE public.fixtures
ADD COLUMN IF NOT EXISTS score_home INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS score_away INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Ensure teams table has contextual intelligence fields from API-Sports
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS key_injuries_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS missing_players JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS avg_xg_for NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avg_xg_against NUMERIC(5,2) DEFAULT NULL;

-- 4. Ensure bet_history table has all settlement fields
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

ALTER TABLE public.bet_history
ADD COLUMN IF NOT EXISTS market_type TEXT DEFAULT '1X2',
ADD COLUMN IF NOT EXISTS actual_score TEXT,
ADD COLUMN IF NOT EXISTS outcome TEXT DEFAULT 'WON';

CREATE INDEX IF NOT EXISTS idx_bet_history_settled_at ON public.bet_history(settled_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_history_fixture ON public.bet_history(fixture_id);

-- 5. Updated get_sportsbook_board() RPC function:
-- - Uses COALESCE to prevent Error 42703
-- - Filters matches: status IN ('SCHEDULED', 'TIMED', 'IN_PLAY', 'PAUSED', 'HALFTIME') AND match_time >= NOW() - INTERVAL '3 hours'
-- - Never hides live or ongoing matches from the UI
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
            'score_home', f.score_home,
            'score_away', f.score_away,
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
                'key_injuries_count', ht.key_injuries_count,
                'missing_players', COALESCE(ht.missing_players, '[]'::jsonb),
                'avg_xg_for', ht.avg_xg_for,
                'avg_xg_against', ht.avg_xg_against
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
                'key_injuries_count', at.key_injuries_count,
                'missing_players', COALESCE(at.missing_players, '[]'::jsonb),
                'avg_xg_for', at.avg_xg_for,
                'avg_xg_against', at.avg_xg_against
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
