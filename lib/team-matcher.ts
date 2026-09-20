/**
 * Team Normalizer and Fuzzy Matcher
 * Links disparate team naming conventions between Football-Data.org and The Odds API.
 */

import { LeagueCode } from '@/types';

export const TEAM_ALIASES_BY_LEAGUE: Record<LeagueCode, Record<string, string[]>> = {
  PL: {
    'arsenal': ['arsenal', 'arsenal fc'],
    'aston-villa': ['aston villa', 'aston villa fc', 'villa'],
    'bournemouth': ['bournemouth', 'afc bournemouth'],
    'brentford': ['brentford', 'brentford fc'],
    'brighton': ['brighton', 'brighton and hove albion', 'brighton & hove albion', 'brighton & hove albion fc'],
    'chelsea': ['chelsea', 'chelsea fc'],
    'crystal-palace': ['crystal palace', 'crystal palace fc'],
    'everton': ['everton', 'everton fc'],
    'fulham': ['fulham', 'fulham fc'],
    'ipswich': ['ipswich town', 'ipswich', 'ipswich town fc'],
    'leicester': ['leicester city', 'leicester', 'leicester city fc'],
    'liverpool': ['liverpool', 'liverpool fc'],
    'manchester-city': ['manchester city', 'man city', 'manchester city fc'],
    'manchester-united': ['manchester united', 'man united', 'man utd', 'manchester united fc'],
    'newcastle': ['newcastle united', 'newcastle', 'newcastle united fc'],
    'nottingham-forest': ['nottingham forest', 'nottingham forest fc', 'nottm forest'],
    'southampton': ['southampton', 'southampton fc'],
    'tottenham': ['tottenham hotspur', 'tottenham', 'tottenham hotspur fc', 'spurs'],
    'west-ham': ['west ham united', 'west ham', 'west ham united fc'],
    'wolves': ['wolverhampton wanderers', 'wolves', 'wolverhampton wanderers fc', 'wolverhampton'],
  },

  PD: {
    'real-madrid': ['real madrid', 'real madrid cf', 'real madrid club de futbol', 'madrid', 'rmcf', 'real-madrid'],
    'barcelona': ['barcelona', 'fc barcelona'],
    'atletico-madrid': ['atletico madrid', 'atletico de madrid', 'club atletico de madrid'],
    'athletic-bilbao': ['athletic bilbao', 'athletic club', 'athletic club bilbao'],
    'real-sociedad': ['real sociedad', 'real sociedad de futbol'],
    'villarreal': ['villarreal', 'villarreal cf'],
    'real-betis': ['real betis', 'real betis balompie', 'betis'],
    'sevilla': ['sevilla', 'sevilla fc'],
    'girona': ['girona', 'girona fc'],
    'celta-vigo': ['celta vigo', 'rc celta de vigo', 'celta de vigo'],
    'osasuna': ['osasuna', 'ca osasuna'],
    'valencia': ['valencia', 'valencia cf'],
    'mallorca': ['mallorca', 'rcd mallorca'],
    'rayo-vallecano': ['rayo vallecano'],
    'alaves': ['alaves', 'deportivo alaves'],
    'getafe': ['getafe', 'getafe cf'],
    'las-palmas': ['las palmas', 'ud las palmas'],
    'leganes': ['leganes', 'cd leganes'],
    'espanyol': ['espanyol', 'rcd espanyol de barcelona'],
    'valladolid': ['real valladolid', 'valladolid', 'real valladolid cf'],
  },

  SA: {
    'inter': ['inter milan', 'internazionale', 'inter', 'fc internazionale milano'],
    'ac-milan': ['ac milan', 'milan'],
    'juventus': ['juventus', 'juventus fc', 'juve'],
    'napoli': ['napoli', 'ssc napoli'],
    'atalanta': ['atalanta', 'atalanta bc'],
    'roma': ['roma', 'as roma'],
    'lazio': ['lazio', 'ss lazio'],
    'fiorentina': ['fiorentina', 'acf fiorentina'],
    'bologna': ['bologna', 'bologna fc 1909'],
    'torino': ['torino', 'torino fc'],
    'udinese': ['udinese', 'udinese calcio'],
    'genoa': ['genoa', 'genoa cfc'],
    'parma': ['parma', 'parma calcio 1913'],
    'verona': ['hellas verona', 'verona', 'hellas verona fc'],
    'como': ['como', 'como 1907'],
    'cagliari': ['cagliari', 'cagliari calcio'],
    'empoli': ['empoli', 'empoli fc'],
    'lecce': ['lecce', 'us lecce'],
    'monza': ['monza', 'ac monza'],
    'venezia': ['venezia', 'venezia fc'],
  },

  BL1: {
    'bayern-munich': ['bayern munich', 'bayern münchen', 'fc bayern münchen', 'bayern'],
    'leverkusen': ['bayer leverkusen', 'bayer 04 leverkusen', 'leverkusen'],
    'dortmund': ['borussia dortmund', 'dortmund', 'bvb'],
    'rb-leipzig': ['rb leipzig', 'leipzig', 'rasenballsport leipzig'],
    'stuttgart': ['vfb stuttgart', 'stuttgart'],
    'eintracht-frankfurt': ['eintracht frankfurt', 'frankfurt'],
    'freiburg': ['sc freiburg', 'freiburg'],
    'hoffenheim': ['tsg hoffenheim', 'hoffenheim', 'tsg 1899 hoffenheim'],
    'werder-bremen': ['werder bremen', 'sv werder bremen', 'bremen'],
    'monchengladbach': ['borussia monchengladbach', 'borussia mönchengladbach', 'mönchengladbach', 'monchengladbach'],
    'union-berlin': ['union berlin', '1. fc union berlin'],
    'wolfsburg': ['vfl wolfsburg', 'wolfsburg'],
    'augsburg': ['fc augsburg', 'augsburg'],
    'mainz': ['mainz', '1. fsv mainz 05', 'fsv mainz 05'],
    'heidenheim': ['1. fc heidenheim 1846', 'heidenheim', '1. fc heidenheim'],
    'st-pauli': ['fc st. pauli', 'st. pauli', 'st pauli'],
    'bochum': ['vfl bochum', 'vfl bochum 1848', 'bochum'],
    'holstein-kiel': ['holstein kiel', 'kiel'],
    'hamburger-sv': ['hamburger sv', 'hsv', 'hamburg'],
  },

  FL1: {
    'psg': ['paris saint-germain', 'paris saint germain', 'psg', 'paris saint-germain fc'],
    'marseille': ['olympique de marseille', 'marseille', 'om'],
    'monaco': ['as monaco', 'monaco', 'as monaco fc'],
    'lille': ['lille', 'losc lille', 'losc'],
    'lyon': ['olympique lyonnais', 'lyon', 'ol'],
    'lens': ['rc lens', 'lens'],
    'nice': ['ogc nice', 'nice'],
    'rennes': ['stade rennais', 'rennes', 'stade rennais fc'],
    'brest': ['stade brestois 29', 'brest', 'stade brestois'],
    'reims': ['stade de reims', 'reims'],
    'strasbourg': ['rc strasbourg alsace', 'strasbourg', 'rc strasbourg'],
    'toulouse': ['toulouse', 'toulouse fc'],
    'nantes': ['fc nantes', 'nantes'],
    'montpellier': ['montpellier', 'montpellier hsc'],
    'le-havre': ['le havre', 'le havre ac'],
    'auxerre': ['aj auxerre', 'auxerre'],
    'angers': ['angers sco', 'angers'],
    'saint-etienne': ['as saint-étienne', 'as saint-etienne', 'saint-étienne', 'saint-etienne'],
  },

  CL: {
    'real-madrid-cl': ['real madrid cl', 'real madrid ucl', 'real madrid', 'real madrid cf', 'madrid'],
    'man-city-cl': ['manchester city cl', 'man city cl', 'manchester city', 'man city'],
    'bayern-munich-cl': ['bayern munich cl', 'bayern munich', 'bayern'],
    'bayer-leverkusen-cl': ['bayer leverkusen cl', 'bayer leverkusen', 'leverkusen'],
    'sporting-cp': ['sporting cp', 'sporting clube de portugal', 'sporting lisbon', 'sporting'],
    'celtic': ['celtic', 'celtic fc'],
  },

  EL: {
    'roma-el': ['as roma el', 'roma el', 'as roma', 'roma'],
    'porto': ['fc porto', 'porto'],
    'athletic-bilbao-el': ['athletic club el', 'athletic bilbao el', 'athletic club', 'athletic bilbao'],
    'galatasaray': ['galatasaray', 'galatasaray sk'],
    'ajax': ['ajax', 'afc ajax'],
    'fenerbahce': ['fenerbahce', 'fenerbahce sk'],
  },
};

// Flattened dictionary prioritizing domestic leagues over continental cups
export const TEAM_ALIASES: Record<string, string[]> = {
  ...TEAM_ALIASES_BY_LEAGUE.CL,
  ...TEAM_ALIASES_BY_LEAGUE.EL,
  ...TEAM_ALIASES_BY_LEAGUE.PL,
  ...TEAM_ALIASES_BY_LEAGUE.PD,
  ...TEAM_ALIASES_BY_LEAGUE.SA,
  ...TEAM_ALIASES_BY_LEAGUE.BL1,
  ...TEAM_ALIASES_BY_LEAGUE.FL1,
};

/**
 * Identify which league a team ID belongs to
 */
export function getTeamLeague(teamId: string): LeagueCode | undefined {
  for (const [league, teams] of Object.entries(TEAM_ALIASES_BY_LEAGUE)) {
    if (teams[teamId]) {
      return league as LeagueCode;
    }
  }
  return undefined;
}

/**
 * Standardize string by lowercasing, removing special symbols, and trimming
 */
export function cleanTeamString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents (e.g. München -> Munchen)
    .replace(/[^a-z0-9\s]/g, ' ')   // replace non-alphanumeric with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance calculation for string similarity
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Similarity ratio between 0.0 and 1.0
 */
export function stringSimilarity(s1: string, s2: string): number {
  const c1 = cleanTeamString(s1);
  const c2 = cleanTeamString(s2);
  if (c1 === c2) return 1.0;
  if (!c1.length || !c2.length) return 0.0;

  // Exact substring check only if length is substantial (> 3 chars) to avoid false positives
  if (c1.length > 3 && c2.length > 3 && (c1.includes(c2) || c2.includes(c1))) {
    const minLen = Math.min(c1.length, c2.length);
    const maxLen = Math.max(c1.length, c2.length);
    return Math.max(0.85, minLen / maxLen);
  }

  const dist = levenshteinDistance(c1, c2);
  const maxLen = Math.max(c1.length, c2.length);
  return 1 - dist / maxLen;
}

/**
 * Match a raw team name against the normalized dictionary.
 * If leagueCode is provided, search is STRICTLY isolated to that league.
 * Returns the normalized canonical ID (e.g., 'arsenal') or undefined if no confident match.
 */
export function findNormalizedTeamId(rawName: string, leagueCode?: LeagueCode): string | undefined {
  const cleaned = cleanTeamString(rawName);
  if (!cleaned) return undefined;

  const targetDict: Record<string, string[]> = leagueCode
    ? TEAM_ALIASES_BY_LEAGUE[leagueCode] || {}
    : TEAM_ALIASES;

  const tokens = cleaned.split(/\s+/);

  // 1. Exact alias match
  for (const [id, aliases] of Object.entries(targetDict)) {
    for (const alias of aliases) {
      const cleanedAlias = cleanTeamString(alias);
      if (cleaned === cleanedAlias) {
        return id;
      }
    }
  }

  // 2. Token / word boundary match (handles abbreviations like 'bvb', 'om', 'ol' safely)
  for (const [id, aliases] of Object.entries(targetDict)) {
    for (const alias of aliases) {
      const cleanedAlias = cleanTeamString(alias);
      if (cleanedAlias.length <= 3) {
        // Only match short aliases as exact token words, NEVER as arbitrary substrings
        if (tokens.includes(cleanedAlias)) {
          return id;
        }
      } else {
        // Longer alias: safe for whole-token or substantial substring
        if (tokens.includes(cleanedAlias) || cleaned.includes(cleanedAlias) || cleanedAlias.includes(cleaned)) {
          return id;
        }
      }
    }
  }

  // 3. Fuzzy similarity fallback (threshold >= 0.75)
  let bestMatch: { id: string; score: number } = { id: '', score: 0 };
  for (const [id, aliases] of Object.entries(targetDict)) {
    for (const alias of aliases) {
      const score = stringSimilarity(cleaned, alias);
      if (score > bestMatch.score) {
        bestMatch = { id, score };
      }
    }
  }

  if (bestMatch.score >= 0.75) {
    return bestMatch.id;
  }

  return undefined;
}
