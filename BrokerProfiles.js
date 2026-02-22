// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Broker CSV Profiles
//
// Auto-detects the broker from CSV headers and applies:
//   1. Custom column mappings (broker-specific header names)
//   2. Field transforms (date format, P&L calculation, side inference)
//   3. Symbol normalization (strip exchange suffixes, etc.)
//
// Supported brokers:
//   - Tradovate          (Execution reports)
//   - NinjaTrader 8      (Trade Performance reports)
//   - ThinkorSwim (TDA)  (Account Statement exports)
//   - TradeStation        (TradeLog exports)
//   - Interactive Brokers (Flex Query trades)
//   - Generic fallback    (autoMap from csv.js)
//
// Usage:
//   const profile = detectBroker(headers);
//   const map = profile.mapColumns(headers);
//   const trade = profile.transform(row, map, rowIndex);
// ═══════════════════════════════════════════════════════════════════

// ─── Profile Definitions ────────────────────────────────────────

const BROKER_PROFILES = {

  // ─── Tradovate ──────────────────────────────────────────────
  tradovate: {
    id: 'tradovate',
    name: 'Tradovate',
    description: 'Tradovate execution / order history CSV',
    // Fingerprint: headers that uniquely identify this broker
    fingerprint: ['orderstatus', 'avgfillprice', 'filledqty'],
    altFingerprints: [['b/s', 'avgprice', 'contract']],
    columnMap: {
      date:       ['timestamp', 'time', 'filltime', 'executiontime'],
      symbol:     ['contract', 'symbol', 'product'],
      side:       ['b/s', 'buysell', 'side', 'action'],
      quantity:   ['filledqty', 'qty', 'quantity', 'size'],
      entryPrice: ['avgfillprice', 'avgprice', 'fillprice', 'price'],
      pnl:        ['pnl', 'realizedpnl', 'pl', 'profit'],
      fees:       ['commission', 'fees', 'totalcommission'],
    },
    sideMap: { buy: 'long', sell: 'short', b: 'long', s: 'short' },
    // Tradovate symbols: "ESZ4" → "ES", "NQH5" → "NQ"
    normalizeSymbol: (sym) => sym.replace(/[A-Z]\d{1,2}$/, ''),
  },

  // ─── NinjaTrader 8 ─────────────────────────────────────────
  ninjatrader: {
    id: 'ninjatrader',
    name: 'NinjaTrader 8',
    description: 'NinjaTrader Trade Performance report',
    fingerprint: ['entryname', 'exitname', 'entryprice'],
    altFingerprints: [['instrument', 'entryprice', 'exitprice', 'profit']],
    columnMap: {
      date:       ['entrytime', 'exittime', 'time'],
      symbol:     ['instrument', 'symbol'],
      side:       ['marketposition', 'direction', 'type'],
      quantity:   ['quantity', 'qty'],
      entryPrice: ['entryprice', 'avgentryprice'],
      exitPrice:  ['exitprice', 'avgexitprice'],
      pnl:        ['profit', 'pnl', 'netprofit'],
      fees:       ['commission', 'totalcommission'],
    },
    sideMap: { long: 'long', short: 'short' },
    // NinjaTrader symbols: "ES 12-24" → "ES"
    normalizeSymbol: (sym) => sym.replace(/\s+\d{2}-\d{2}$/, '').trim(),
  },

  // ─── ThinkorSwim (TD Ameritrade → Schwab) ──────────────────
  thinkorswim: {
    id: 'thinkorswim',
    name: 'ThinkorSwim',
    description: 'TDA / Schwab Account Statement CSV',
    fingerprint: ['exec time', 'spread', 'pos effect'],
    altFingerprints: [['exectime', 'poseffect', 'netprice']],
    columnMap: {
      date:       ['exec time', 'exectime', 'date'],
      symbol:     ['symbol', 'underlying', 'instrument'],
      side:       ['side', 'action', 'pos effect', 'poseffect'],
      quantity:   ['qty', 'quantity', 'amount'],
      entryPrice: ['price', 'avgprice', 'netprice'],
      pnl:        ['p/l', 'pnl', 'profit/loss', 'pl'],
      fees:       ['commissions', 'commission', 'reg fees', 'fees'],
    },
    sideMap: {
      to_open: 'long', to_close: 'short',
      buy: 'long', sell: 'short',
      buy_to_open: 'long', sell_to_close: 'short',
      sell_to_open: 'short', buy_to_close: 'long',
    },
    normalizeSymbol: (sym) => sym.replace(/\s.*$/, '').replace(/^\./, ''),
  },

  // ─── TradeStation ──────────────────────────────────────────
  tradestation: {
    id: 'tradestation',
    name: 'TradeStation',
    description: 'TradeStation TradeLog CSV',
    fingerprint: ['closed date/time', 'filled price'],
    altFingerprints: [['closedt', 'filledprice', 'closedprofit']],
    columnMap: {
      date:       ['closed date/time', 'closedt', 'entrydate', 'date/time'],
      symbol:     ['symbol', 'instrument'],
      side:       ['type', 'side', 'action'],
      quantity:   ['quantity', 'qty', 'filled qty'],
      entryPrice: ['filled price', 'filledprice', 'price', 'entryprice'],
      pnl:        ['closed profit', 'closedprofit', 'p&l', 'pnl'],
      fees:       ['commission', 'fees'],
    },
    sideMap: { buy: 'long', sell: 'short', long: 'long', short: 'short' },
    normalizeSymbol: (sym) => sym.replace(/\s+/g, ''),
  },

  // ─── Interactive Brokers ───────────────────────────────────
  ibkr: {
    id: 'ibkr',
    name: 'Interactive Brokers',
    description: 'IBKR Flex Query / Activity Statement',
    fingerprint: ['tradeid', 'ibcommission', 'conid'],
    altFingerprints: [['transactionid', 'ibcommission'], ['tradedate', 'iborderid']],
    columnMap: {
      date:       ['tradedate', 'datetime', 'date/time', 'tradetime'],
      symbol:     ['symbol', 'underlyingsymbol', 'description'],
      side:       ['buysell', 'side', 'code'],
      quantity:   ['quantity', 'qty', 'tradeqty'],
      entryPrice: ['tradeprice', 'price', 'avgprice'],
      pnl:        ['realizedpnl', 'fifopnlrealized', 'pnl', 'mtmpnl'],
      fees:       ['ibcommission', 'commission', 'totalcommission'],
    },
    sideMap: { buy: 'long', sell: 'short', bot: 'long', sld: 'short' },
    normalizeSymbol: (sym) => sym,
  },

  // ─── Robinhood ──────────────────────────────────────────────
  robinhood: {
    id: 'robinhood',
    name: 'Robinhood',
    description: 'Robinhood activity report CSV',
    fingerprint: ['transcode', 'instrument', 'activitydate'],
    altFingerprints: [['transcode', 'instrument', 'processdate']],
    columnMap: {
      date:       ['activitydate', 'processdate', 'settledate'],
      symbol:     ['instrument'],
      side:       ['transcode'],
      quantity:   ['quantity', 'qty'],
      entryPrice: ['price'],
      pnl:        ['amount'],
      fees:       [],
    },
    sideMap: { buy: 'long', sell: 'short', bto: 'long', stc: 'short', sto: 'short', btc: 'long' },
    normalizeSymbol: (sym) => sym.trim(),
  },

  // ─── Webull ─────────────────────────────────────────────────
  webull: {
    id: 'webull',
    name: 'Webull',
    description: 'Webull order/trade history CSV',
    fingerprint: ['avgprice', 'filledqty', 'status', 'side'],
    altFingerprints: [['filledtime', 'avgprice', 'orderid'], ['underlyingsymbol', 'strikeprice', 'optiontype']],
    columnMap: {
      date:       ['filledtime', 'createdtime'],
      symbol:     ['symbol', 'underlyingsymbol'],
      side:       ['side'],
      quantity:   ['filledqty', 'qty', 'totalqty'],
      entryPrice: ['avgprice', 'price'],
      pnl:        [],
      fees:       [],
    },
    sideMap: { buy: 'long', sell: 'short' },
    normalizeSymbol: (sym) => sym.trim(),
  },

  // ─── MetaTrader 5 ───────────────────────────────────────────
  mt5: {
    id: 'mt5',
    name: 'MetaTrader 5',
    description: 'MT5 positions or deals CSV export',
    fingerprint: ['volume', 'profit', 'swap', 'commission'],
    altFingerprints: [['closetime', 'closeprice', 'profit'], ['direction', 'deal', 'profit']],
    columnMap: {
      date:       ['time', 'opentime'],
      closeDate:  ['closetime'],
      symbol:     ['symbol'],
      side:       ['type'],
      quantity:   ['volume', 'lots'],
      entryPrice: ['price', 'openprice'],
      exitPrice:  ['closeprice'],
      pnl:        ['profit'],
      fees:       ['commission', 'fee', 'swap'],
    },
    sideMap: { buy: 'long', sell: 'short' },
    // Strip broker suffixes: .pro, .raw, .ecn, trailing 'm' for micro forex
    normalizeSymbol: (sym) => {
      let s = sym.replace(/\.(pro|raw|ecn|std|stp)$/i, '').toUpperCase();
      if (/^[A-Z]{6}m$/i.test(s)) s = s.slice(0, -1);
      return s;
    },
  },
};

// ─── Broker Detection ───────────────────────────────────────────

/**
 * Normalize a header for comparison (lowercase, strip non-alphanumeric).
 * @param {string} h
 * @returns {string}
 */
function normalizeHeader(h) {
  return (h || '').toLowerCase().replace(/[^a-z0-9/]/g, '');
}

/**
 * Score how well a broker profile matches a set of headers.
 * @param {Object} profile
 * @param {string[]} normalizedHeaders
 * @returns {number} 0-1 confidence score
 */
function scoreProfile(profile, normalizedHeaders) {
  let best = 0;

  // Check primary fingerprint
  const primaryMatch = profile.fingerprint.filter(fp =>
    normalizedHeaders.some(h => h.includes(fp.replace(/[^a-z0-9/]/g, '')))
  ).length;
  best = Math.max(best, primaryMatch / profile.fingerprint.length);

  // Check alt fingerprints
  if (profile.altFingerprints) {
    for (const alt of profile.altFingerprints) {
      const altMatch = alt.filter(fp =>
        normalizedHeaders.some(h => h.includes(fp.replace(/[^a-z0-9/]/g, '')))
      ).length;
      best = Math.max(best, altMatch / alt.length);
    }
  }

  return best;
}

/**
 * Auto-detect broker from CSV headers.
 *
 * @param {string[]} headers - Raw CSV headers
 * @returns {{ broker: Object|null, confidence: number, allScores: Array }}
 */
function detectBroker(headers) {
  if (!headers?.length) return { broker: null, confidence: 0, allScores: [] };

  const normalizedHeaders = headers.map(normalizeHeader);
  const scores = [];

  for (const [id, profile] of Object.entries(BROKER_PROFILES)) {
    const score = scoreProfile(profile, normalizedHeaders);
    scores.push({ id, name: profile.name, score });
  }

  scores.sort((a, b) => b.score - a.score);

  const top = scores[0];
  if (top.score >= 0.6) {
    return {
      broker: BROKER_PROFILES[top.id],
      confidence: top.score,
      allScores: scores,
    };
  }

  return { broker: null, confidence: 0, allScores: scores };
}

// ─── Column Mapping (broker-aware) ──────────────────────────────

/**
 * Build a column index map using a broker profile's column definitions.
 *
 * @param {string[]} headers - Raw CSV headers
 * @param {Object} profile - Broker profile (or null for generic)
 * @returns {Object} Map of field name to column index
 */
function mapColumnsForBroker(headers, profile) {
  if (!profile) return null; // Fall back to csv.js autoMap

  const normalizedHeaders = headers.map(normalizeHeader);
  const map = {};

  for (const [field, aliases] of Object.entries(profile.columnMap)) {
    map[field] = -1;

    for (const alias of aliases) {
      const normalAlias = alias.replace(/[^a-z0-9/]/g, '');
      // Exact match first
      const exactIdx = normalizedHeaders.indexOf(normalAlias);
      if (exactIdx >= 0) { map[field] = exactIdx; break; }
      // Partial match
      const partialIdx = normalizedHeaders.findIndex(h => h.includes(normalAlias));
      if (partialIdx >= 0) { map[field] = partialIdx; break; }
    }
  }

  return map;
}

/**
 * Normalize a side string using a broker's side map.
 * @param {string} rawSide
 * @param {Object} sideMap
 * @returns {'long'|'short'}
 */
function normalizeSide(rawSide, sideMap) {
  if (!rawSide) return 'long';
  const key = rawSide.toLowerCase().replace(/[\s_-]/g, '_').trim();

  if (sideMap[key]) return sideMap[key];

  // Generic fallback
  if (['buy', 'long', 'b', 'l'].includes(key)) return 'long';
  if (['sell', 'short', 's', 'ss'].includes(key)) return 'short';

  return 'long';
}

/**
 * Get detected broker summary for display in UI.
 * @param {Object} detection - Result from detectBroker()
 * @returns {{ icon: string, label: string, detail: string }}
 */
function brokerBadge(detection) {
  if (!detection?.broker) {
    return { icon: '📋', label: 'Generic CSV', detail: 'Using automatic column detection' };
  }

  const icons = {
    tradovate: '🔷', ninjatrader: '🟩', thinkorswim: '🟦',
    tradestation: '🟥', ibkr: '🟨', robinhood: '🟢', webull: '🔵', mt5: '🟠',
  };

  return {
    icon: icons[detection.broker.id] || '📊',
    label: detection.broker.name,
    detail: `${Math.round(detection.confidence * 100)}% match — ${detection.broker.description}`,
  };
}

// ─── Exports ────────────────────────────────────────────────────

export {
  BROKER_PROFILES,
  detectBroker,
  mapColumnsForBroker,
  normalizeSide,
  normalizeHeader,
  scoreProfile,
  brokerBadge,
};
export default detectBroker;
