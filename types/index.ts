export type LeagueCode = 'PL' | 'PD' | 'SA' | 'BL1' | 'FL1';

export interface LeagueInfo {
  code: LeagueCode;
  oddsApiKey: string;
  name: string;
  country: string;
  flag: string;
  emblem_url?: string;
  avgHomeGoals: number;
  avgAwayGoals: number;
}

export interface Team {
  id: string;
  league: LeagueCode;
  name: string;
  aliases: string[];
  attack_rating: number;  // Relative attacking multiplier (1.0 = league average)
  defense_rating: number; // Relative defensive goals conceded multiplier (1.0 = average)
  form: string;           // e.g. "WWDLW"
  crest_url?: string;     // Official SVG/PNG crest URL from Football-Data.org
  logo_url?: string;      // Alias for crest_url
}

export interface MarketOdds {
  fixture_id: string;
  bookmaker: string;
  home_odds: number;
  draw_odds: number;
  away_odds: number;
  over_25_odds: number;
  under_25_odds: number;
  handicap_odds?: Record<string, number>; // e.g. { 'home_-1.5': 2.60, 'away_+1.5': 1.52, 'home_-0.5': 1.75, 'away_+0.5': 2.10, ... }
  totals_odds?: Record<string, number>;   // e.g. { 'over_1.5': 1.25, 'under_1.5': 4.00, 'over_2.5': 1.85, 'under_2.5': 1.95, 'over_3.5': 3.10, 'under_3.5': 1.38 }
  btts_odds?: Record<string, number>;     // e.g. { 'btts_yes': 1.75, 'btts_no': 2.05 }
  updated_at?: string;
}

export interface Fixture {
  id: string;
  league: LeagueCode;
  home_team_id: string;
  away_team_id: string;
  match_time: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'FINISHED';
  homeTeam?: Team;
  awayTeam?: Team;
  marketOdds?: MarketOdds;
  quantAnalysis?: QuantMatchAnalysis;
}

export interface QuantMatchAnalysis {
  lambdaHome: number;
  lambdaAway: number;
  scoreMatrix: number[][]; // 6x6 score probability matrix [homeScore][awayScore]
  trueProbabilities: {
    home: number;
    draw: number;
    away: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
    bttsYes: number;
    bttsNo: number;
    asianHandicap: Record<string, number>; // e.g. 'home_-0.5', 'away_+0.5', 'home_-1.5', 'away_+1.5', etc.
  };
  expectedValues: {
    homeEV: number;
    drawEV: number;
    awayEV: number;
    over15EV: number;
    under15EV: number;
    over25EV: number;
    under25EV: number;
    over35EV: number;
    under35EV: number;
    bttsYesEV: number;
    bttsNoEV: number;
    asianHandicapEV: Record<string, number>;
  };
  fairOdds: {
    home: number;
    draw: number;
    away: number;
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
    bttsYes: number;
    bttsNo: number;
    asianHandicapFair: Record<string, number>;
  };
}

export type MarketType = '1X2' | 'Asian Handicap' | 'Totals' | 'BTTS';
export type BetSelection = string;

export interface LegSelection {
  fixtureId: string;
  league: LeagueCode;
  homeTeam: string;
  awayTeam: string;
  homeCrest?: string;
  awayCrest?: string;
  market: MarketType;
  selection: BetSelection;
  odds: number;
  trueProb: number;
  ev: number;
  matchTime: string;
}

export interface AIParlay {
  id: string;
  category: 'safe' | 'value' | 'lotto';
  title: string;
  description: string;
  legs: LegSelection[];
  total_odds: number;
  true_probability: number;
  expected_value: number;
  status: 'pending' | 'won' | 'lost';
  created_at: string;
}

export interface BankrollCalculation {
  bankroll: number;
  kellyFraction: number; // e.g. 0.25 (Quarter Kelly)
  recommendedStakePercent: number; // e.g. 3.4%
  recommendedStakeAmount: number;  // e.g. $3.40
  expectedProfit: number;
  potentialPayout: number;
}
