-- ==============================================================================
-- Migration: 20260920_fix_handicap_odds_settlement.sql
-- 1. Adds missing handicap_odds, totals_odds, btts_odds jsonb columns to market_odds
-- 2. Adds match score & settlement fields to fixtures
-- 3. Adds contextual intelligence columns to teams (missing_players, avg_xg_for, avg_xg_against)
-- 4. Creates bet_history table for quantitative track record tracking
-- 5. Updates get_sportsbook_board() with COALESCE to prevent Error 42703
-- ==============================================================================

-- 1. Ensure market_odds columns exist with proper defaults
ALTER TABLE public.market_odds 
ADD COLUMN IF NOT EXISTS handicap_odds JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS totals_odds JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS btts_odds JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure fixtures table has scores and settlement columns
ALTER TABLE public.fixtures
ADD COLUMN IF NOT EXISTS score_home INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS score_away INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ DEFAULT NULL;

-- 3. Ensure teams table has contextual intelligence fields from API-Sports
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS missing_players JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS avg_xg_for NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avg_xg_against NUMERIC(5,2) DEFAULT NULL;

-- 4. Bet History table for settled bets
CREATE TABLE IF NOT EXISTS public.bet_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id TEXT REFERENCES public.fixtures(id) ON DELETE CASCADE,
    parlay_id UUID REFERENCES public.ai_parlays(id) ON DELETE SET NULL,
    market TEXT NOT NULL,
    selection TEXT NOT NULL,
    odds NUMERIC(6,2) NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('won', 'lost', 'push')),
    pnl NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    settled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bet_history_settled_at ON public.bet_history(settled_at DESC);

-- 5. Safe get_sportsbook_board() RPC preventing Error 42703 and filtering active matches
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
      -- Retention rule: Keep matches starting from 3 hours ago (live/ongoing) onwards
      AND (f.status != 'FINISHED' OR f.match_time >= NOW() - INTERVAL '3 hours')
    ORDER BY f.match_time ASC;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;
