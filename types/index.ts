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
    over25: number;
    under25: number;
    bttsYes: number;
    bttsNo: number;
  };
  expectedValues: {
    homeEV: number;
    drawEV: number;
    awayEV: number;
    over25EV: number;
    under25EV: number;
  };
  fairOdds: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
  };
}

export type MarketType = '1X2' | 'Totals';
export type BetSelection = '1' | 'X' | '2' | 'Over 2.5' | 'Under 2.5';

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
