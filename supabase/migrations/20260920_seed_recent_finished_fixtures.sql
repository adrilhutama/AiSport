-- Seed finished historical match results for dynamic form calculation
-- Especially Arsenal's last 5 fixtures with the recent Brighton defeat (L)

INSERT INTO fixtures (id, league, home_team_id, away_team_id, match_time, status, score_home, score_away)
VALUES
  ('pl-ars-bha-fin', 'PL', 'arsenal', 'brighton', '2026-09-13T16:30:00Z', 'FINISHED', 1, 2),
  ('pl-ars-wol-fin', 'PL', 'arsenal', 'wolves', '2026-09-06T14:00:00Z', 'FINISHED', 2, 0),
  ('pl-ast-ars-fin', 'PL', 'aston-villa', 'arsenal', '2026-08-30T16:30:00Z', 'FINISHED', 0, 2),
  ('pl-ars-lei-fin', 'PL', 'arsenal', 'leicester', '2026-08-23T14:00:00Z', 'FINISHED', 3, 0),
  ('pl-eve-ars-fin', 'PL', 'everton', 'arsenal', '2026-08-16T16:30:00Z', 'FINISHED', 0, 1)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  score_home = EXCLUDED.score_home,
  score_away = EXCLUDED.score_away;

-- Update teams table with accurate form
UPDATE teams SET form = 'WWWWL' WHERE id = 'arsenal';
