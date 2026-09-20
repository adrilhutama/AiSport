-- ==============================================================================
-- OddsMatrix Overhaul Migration: 20260920_sportsbook_overhaul.sql
-- 1. Adds +EV columns to market_odds and contextual fields to teams
-- 2. PL/pgSQL Trigger for automated +EV calculation on insert/update
-- 3. High-performance single-call RPC get_sportsbook_board(league_filter)
-- 4. Supabase Storage bucket initialization for team-crests
-- ==============================================================================

-- 1. Alter market_odds with +EV computation columns
ALTER TABLE public.market_odds
ADD COLUMN IF NOT EXISTS is_positive_ev BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ev_home NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ev_draw NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS ev_away NUMERIC(5,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS max_ev NUMERIC(5,2) DEFAULT 0.00;

-- Alter teams with contextual intelligence columns from API-Football
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS rolling_xg NUMERIC(5,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS key_injuries_count INT DEFAULT 0;

-- Index on is_positive_ev for instant value betting queries
CREATE INDEX IF NOT EXISTS idx_market_odds_positive_ev ON public.market_odds(is_positive_ev);

-- 2. PL/pgSQL Trigger Function: Automated +EV Computation
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
    -- Query team ratings from joined fixture
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

    -- Calculate expected goals (lambda) with baseline European averages
    v_lambda_h := GREATEST(0.3, 1.55 * v_home_attack * v_away_defense);
    v_lambda_a := GREATEST(0.3, 1.25 * v_away_attack * v_home_defense);

    -- Quick approximate true probability calculation from lambdas
    -- Normalizing over typical 1X2 distribution
    v_prob_home := (v_lambda_h / (v_lambda_h + v_lambda_a + 0.90));
    v_prob_draw := (0.90 / (v_lambda_h + v_lambda_a + 0.90));
    v_prob_away := (v_lambda_a / (v_lambda_h + v_lambda_a + 0.90));

    v_p_total := v_prob_home + v_prob_draw + v_prob_away;
    IF v_p_total > 0 THEN
        v_prob_home := v_prob_home / v_p_total;
        v_prob_draw := v_prob_draw / v_p_total;
        v_prob_away := v_prob_away / v_p_total;
    END IF;

    -- Compute expected value %: (P * Odds - 1) * 100, capped safely at +25.0%
    NEW.ev_home := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_home * NEW.home_odds - 1.0) * 100)::numeric, 2)));
    NEW.ev_draw := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_draw * NEW.draw_odds - 1.0) * 100)::numeric, 2)));
    NEW.ev_away := LEAST(25.0, GREATEST(-100.0, ROUND(((v_prob_away * NEW.away_odds - 1.0) * 100)::numeric, 2)));

    NEW.max_ev := GREATEST(NEW.ev_home, NEW.ev_draw, NEW.ev_away, 0.0);
    NEW.is_positive_ev := (NEW.max_ev > 0.0);

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_market_odds_ev ON public.market_odds;
CREATE TRIGGER trg_compute_market_odds_ev
BEFORE INSERT OR UPDATE ON public.market_odds
FOR EACH ROW EXECUTE FUNCTION public.compute_market_odds_ev();

-- 3. High-Performance Single-Call RPC: get_sportsbook_board
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
                'handicap_odds', mo.handicap_odds,
                'totals_odds', mo.totals_odds,
                'btts_odds', mo.btts_odds,
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
    ORDER BY f.match_time ASC;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- 4. Storage Bucket Setup for Team Crests (Public CDN)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-crests', 'team-crests', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access on team-crests bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access on Team Crests'
    ) THEN
        CREATE POLICY "Public Access on Team Crests"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'team-crests');
    END IF;
END $$;
