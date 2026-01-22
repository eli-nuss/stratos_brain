/**
 * Fuzzy Search Utilities
 * 
 * Provides fuzzy matching capabilities for the unified search:
 * - Levenshtein distance for typo tolerance
 * - Ticker/company name aliases for common mappings
 * - Scoring algorithm for relevance ranking
 * 
 * @version 1.0.0
 */

// ============================================================================
// Ticker Aliases - Map common names to their actual tickers
// ============================================================================

export const TICKER_ALIASES: Record<string, string[]> = {
  // Big Tech
  'GOOGL': ['google', 'alphabet', 'goog'],
  'GOOG': ['google', 'alphabet', 'googl'],
  'META': ['facebook', 'fb', 'instagram', 'whatsapp', 'meta platforms'],
  'AMZN': ['amazon', 'aws'],
  'AAPL': ['apple', 'iphone', 'mac', 'ipad'],
  'MSFT': ['microsoft', 'windows', 'azure', 'xbox'],
  'NVDA': ['nvidia', 'nvdia', 'nvidea', 'geforce', 'cuda'],
  'TSLA': ['tesla', 'tesle', 'elon', 'musk'],
  'NFLX': ['netflix', 'netflx'],
  'AMD': ['amd', 'advanced micro', 'radeon', 'ryzen'],
  'INTC': ['intel', 'intl'],
  
  // Finance
  'JPM': ['jpmorgan', 'jp morgan', 'chase', 'jamie dimon'],
  'BAC': ['bank of america', 'bofa', 'boa'],
  'WFC': ['wells fargo', 'wells'],
  'GS': ['goldman', 'goldman sachs'],
  'MS': ['morgan stanley'],
  'V': ['visa'],
  'MA': ['mastercard', 'master card'],
  'PYPL': ['paypal', 'pay pal'],
  'SQ': ['square', 'block', 'cash app'],
  'COIN': ['coinbase'],
  
  // Healthcare
  'JNJ': ['johnson', 'johnson & johnson', 'j&j'],
  'PFE': ['pfizer'],
  'MRNA': ['moderna'],
  'UNH': ['united health', 'unitedhealth', 'unitedhealthcare'],
  'LLY': ['eli lilly', 'lilly'],
  'ABBV': ['abbvie'],
  
  // Retail/Consumer
  'WMT': ['walmart', 'wal-mart', 'wal mart'],
  'TGT': ['target'],
  'COST': ['costco'],
  'HD': ['home depot', 'homedepot'],
  'LOW': ['lowes', "lowe's"],
  'NKE': ['nike'],
  'SBUX': ['starbucks', 'starbux'],
  'MCD': ['mcdonalds', "mcdonald's", 'mcd'],
  'KO': ['coca cola', 'coca-cola', 'coke'],
  'PEP': ['pepsi', 'pepsico'],
  'DIS': ['disney', 'walt disney'],
  
  // Energy
  'XOM': ['exxon', 'exxonmobil', 'exxon mobil'],
  'CVX': ['chevron'],
  'COP': ['conocophillips', 'conoco'],
  'OXY': ['occidental'],
  
  // Telecom
  'T': ['at&t', 'att', 'at and t'],
  'VZ': ['verizon'],
  'TMUS': ['t-mobile', 'tmobile', 't mobile'],
  
  // Industrial
  'BA': ['boeing'],
  'CAT': ['caterpillar'],
  'GE': ['general electric'],
  'MMM': ['3m', 'three m'],
  'HON': ['honeywell'],
  'UPS': ['ups', 'united parcel'],
  'FDX': ['fedex', 'fed ex', 'federal express'],
  
  // Semiconductors
  'TSM': ['tsmc', 'taiwan semi', 'taiwan semiconductor'],
  'AVGO': ['broadcom'],
  'QCOM': ['qualcomm'],
  'MU': ['micron'],
  'AMAT': ['applied materials'],
  'LRCX': ['lam research'],
  'KLAC': ['kla'],
  'ASML': ['asml'],
  
  // Software/Cloud
  'CRM': ['salesforce', 'sales force'],
  'ORCL': ['oracle'],
  'ADBE': ['adobe'],
  'NOW': ['servicenow', 'service now'],
  'SNOW': ['snowflake'],
  'PLTR': ['palantir'],
  'DDOG': ['datadog', 'data dog'],
  'NET': ['cloudflare', 'cloud flare'],
  'ZS': ['zscaler'],
  'CRWD': ['crowdstrike', 'crowd strike'],
  'PANW': ['palo alto', 'paloalto'],
  'FTNT': ['fortinet'],
  'OKTA': ['okta'],
  'TWLO': ['twilio'],
  'ZM': ['zoom'],
  'DOCU': ['docusign', 'docu sign'],
  'SHOP': ['shopify'],
  'UBER': ['uber'],
  'LYFT': ['lyft'],
  'ABNB': ['airbnb', 'air bnb'],
  'DASH': ['doordash', 'door dash'],
  'RBLX': ['roblox'],
  'U': ['unity'],
  
  // EV/Auto
  'RIVN': ['rivian'],
  'LCID': ['lucid'],
  'F': ['ford'],
  'GM': ['general motors', 'gm'],
  'TM': ['toyota'],
  
  // Space
  'RKLB': ['rocket lab', 'rocketlab'],
  'SPCE': ['virgin galactic', 'virgin'],
  'LMT': ['lockheed', 'lockheed martin'],
  'NOC': ['northrop', 'northrop grumman'],
  'RTX': ['raytheon'],
  
  // Crypto-related
  'MSTR': ['microstrategy', 'micro strategy', 'saylor'],
  'MARA': ['marathon', 'marathon digital'],
  'RIOT': ['riot', 'riot platforms'],
  'CLSK': ['cleanspark', 'clean spark'],
  
  // Popular Crypto
  'BTC': ['bitcoin', 'btc'],
  'ETH': ['ethereum', 'eth', 'ether'],
  'SOL': ['solana', 'sol'],
  'DOGE': ['dogecoin', 'doge'],
  'XRP': ['ripple', 'xrp'],
  'ADA': ['cardano', 'ada'],
  'AVAX': ['avalanche', 'avax'],
  'DOT': ['polkadot', 'dot'],
  'MATIC': ['polygon', 'matic'],
  'LINK': ['chainlink', 'link'],
  'UNI': ['uniswap', 'uni'],
  'AAVE': ['aave'],
  'LTC': ['litecoin', 'ltc'],
  'ATOM': ['cosmos', 'atom'],
  'APT': ['aptos', 'apt'],
  'ARB': ['arbitrum', 'arb'],
  'OP': ['optimism', 'op'],
  'SUI': ['sui'],
  'SEI': ['sei'],
  'INJ': ['injective', 'inj'],
  'TIA': ['celestia', 'tia'],
  'NEAR': ['near', 'near protocol'],
  'FTM': ['fantom', 'ftm'],
  'RENDER': ['render', 'rndr'],
  'FET': ['fetch', 'fetch.ai', 'fet'],
  'TAO': ['bittensor', 'tao'],
  'WLD': ['worldcoin', 'world coin', 'wld'],
  'PEPE': ['pepe'],
  'SHIB': ['shiba', 'shiba inu', 'shib'],
  'BONK': ['bonk'],
  'WIF': ['dogwifhat', 'wif'],
};

// Build reverse lookup: alias -> ticker
export const ALIAS_TO_TICKER: Map<string, string[]> = new Map();

// Initialize the reverse lookup
Object.entries(TICKER_ALIASES).forEach(([ticker, aliases]) => {
  aliases.forEach((alias) => {
    const normalizedAlias = alias.toLowerCase();
    const existing = ALIAS_TO_TICKER.get(normalizedAlias) || [];
    if (!existing.includes(ticker)) {
      existing.push(ticker);
      ALIAS_TO_TICKER.set(normalizedAlias, existing);
    }
  });
});

// ============================================================================
// Levenshtein Distance - For typo tolerance
// ============================================================================

/**
 * Calculate the Levenshtein distance between two strings
 * This measures the minimum number of single-character edits needed
 * to change one string into the other.
 */
export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  // Quick checks
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  if (a === b) return 0;

  // Create distance matrix
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= aLen; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= bLen; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[aLen][bLen];
}

/**
 * Calculate similarity ratio (0-1) based on Levenshtein distance
 * 1 = identical, 0 = completely different
 */
export function similarityRatio(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

// ============================================================================
// Fuzzy Match Scoring
// ============================================================================

export interface FuzzyMatchResult {
  score: number;          // 0-100, higher is better
  matchType: 'exact' | 'starts_with' | 'contains' | 'alias' | 'fuzzy' | 'none';
  matchedAlias?: string;  // If matched via alias
  matchedTicker?: string; // If query was an alias, this is the resolved ticker
}

/**
 * Calculate a fuzzy match score between a query and a target string
 * Returns a score from 0-100 and the type of match
 */
export function fuzzyMatch(
  query: string,
  target: string,
  targetAliases?: string[]
): FuzzyMatchResult {
  const queryLower = query.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  // Empty query matches nothing
  if (!queryLower) {
    return { score: 0, matchType: 'none' };
  }

  // Exact match - highest score
  if (queryLower === targetLower) {
    return { score: 100, matchType: 'exact' };
  }

  // Starts with - very high score
  if (targetLower.startsWith(queryLower)) {
    // Bonus for shorter targets (more precise match)
    const lengthBonus = Math.max(0, 10 - (targetLower.length - queryLower.length));
    return { score: 90 + lengthBonus, matchType: 'starts_with' };
  }

  // Check aliases
  if (targetAliases) {
    for (const alias of targetAliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === queryLower) {
        return { score: 95, matchType: 'alias', matchedAlias: alias };
      }
      if (aliasLower.startsWith(queryLower)) {
        return { score: 85, matchType: 'alias', matchedAlias: alias };
      }
      if (aliasLower.includes(queryLower)) {
        return { score: 70, matchType: 'alias', matchedAlias: alias };
      }
    }
  }

  // Contains - good score
  if (targetLower.includes(queryLower)) {
    // Earlier position = better score
    const position = targetLower.indexOf(queryLower);
    const positionPenalty = Math.min(position * 2, 20);
    return { score: 80 - positionPenalty, matchType: 'contains' };
  }

  // Fuzzy match using Levenshtein distance
  // Only consider fuzzy matches for queries of 3+ characters
  if (queryLower.length >= 3) {
    const similarity = similarityRatio(queryLower, targetLower);
    
    // Also check similarity against the start of the target
    const targetStart = targetLower.substring(0, queryLower.length + 2);
    const startSimilarity = similarityRatio(queryLower, targetStart);
    
    const bestSimilarity = Math.max(similarity, startSimilarity);
    
    // Only return fuzzy match if similarity is above threshold
    if (bestSimilarity >= 0.6) {
      return { score: Math.round(bestSimilarity * 60), matchType: 'fuzzy' };
    }
    
    // Check fuzzy match against aliases
    if (targetAliases) {
      for (const alias of targetAliases) {
        const aliasSimilarity = similarityRatio(queryLower, alias.toLowerCase());
        if (aliasSimilarity >= 0.7) {
          return { 
            score: Math.round(aliasSimilarity * 55), 
            matchType: 'fuzzy',
            matchedAlias: alias 
          };
        }
      }
    }
  }

  return { score: 0, matchType: 'none' };
}

/**
 * Check if a query matches a ticker via alias lookup
 * Returns the matching tickers if found
 */
export function resolveTickerAlias(query: string): string[] {
  const queryLower = query.toLowerCase().trim();
  
  // Direct alias lookup
  const directMatch = ALIAS_TO_TICKER.get(queryLower);
  if (directMatch) {
    return directMatch;
  }
  
  // Partial alias match
  const partialMatches: string[] = [];
  ALIAS_TO_TICKER.forEach((tickers, alias) => {
    if (alias.startsWith(queryLower) || alias.includes(queryLower)) {
      tickers.forEach((ticker) => {
        if (!partialMatches.includes(ticker)) {
          partialMatches.push(ticker);
        }
      });
    }
  });
  
  return partialMatches;
}

/**
 * Get aliases for a ticker symbol
 */
export function getTickerAliases(ticker: string): string[] {
  return TICKER_ALIASES[ticker.toUpperCase()] || [];
}

// ============================================================================
// Fuzzy Search for Arrays
// ============================================================================

export interface FuzzySearchOptions {
  /** Minimum score to include in results (0-100) */
  minScore?: number;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Keys to search in objects */
  keys?: string[];
  /** Whether to include alias matches */
  includeAliases?: boolean;
}

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matchType: FuzzyMatchResult['matchType'];
  matchedField?: string;
  matchedAlias?: string;
}

/**
 * Perform fuzzy search on an array of items
 */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  getSearchableText: (item: T) => { text: string; field: string; aliases?: string[] }[],
  options: FuzzySearchOptions = {}
): FuzzySearchResult<T>[] {
  const {
    minScore = 30,
    maxResults = 50,
    includeAliases = true,
  } = options;

  if (!query.trim()) {
    return [];
  }

  const results: FuzzySearchResult<T>[] = [];

  items.forEach((item) => {
    const searchableTexts = getSearchableText(item);
    let bestMatch: FuzzySearchResult<T> | null = null;

    searchableTexts.forEach(({ text, field, aliases }) => {
      const match = fuzzyMatch(
        query,
        text,
        includeAliases ? aliases : undefined
      );

      if (match.score >= minScore) {
        if (!bestMatch || match.score > bestMatch.score) {
          bestMatch = {
            item,
            score: match.score,
            matchType: match.matchType,
            matchedField: field,
            matchedAlias: match.matchedAlias,
          };
        }
      }
    });

    if (bestMatch) {
      results.push(bestMatch);
    }
  });

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}
