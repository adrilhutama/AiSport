-- Migration: 20260920_purge_synthetic_european_fixtures.sql
-- Purges artificial and fabricated Champions League & Europa League mock fixtures

DELETE FROM public.market_odds 
WHERE fixture_id IN (
    'cl-rma-spo', 
    'cl-mci-lev', 
    'cl-bay-cel', 
    'el-aja-fen', 
    'el-por-gal', 
    'el-rom-ath'
);

DELETE FROM public.fixtures 
WHERE id IN (
    'cl-rma-spo', 
    'cl-mci-lev', 
    'cl-bay-cel', 
    'el-aja-fen', 
    'el-por-gal', 
    'el-rom-ath'
);
