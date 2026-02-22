// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Import / Export Engine (Sprint 7)
//
// Export: CSV, JSON, Markdown analytics report
// Import: TradeForge JSON, generic CSV, + 5 broker-specific parsers
//         with auto-detection.
//
// Broker profiles:
//   1. Tradovate — futures, CSV with "Buy"/"Sell" action column
//   2. NinjaTrader — Performance export, "Market"/"Entry"/"Exit" rows
//   3. ThinkorSwim — Account Statement export, multi-leg handling
//   4. TradeStation — TradeLog CSV format
//   5. Interactive Brokers — Flex Query CSV format
//
// Usage:
//   import { exportCSV, exportJSON, importFile, detectBroker } from './ImportExport.js';
// ═══════════════════════════════════════════════════════════════════

// ─── EXPORT ─────────────────────────────────────────────────────

const TRADE_FIELDS = [
  'id', 'date', 'closeDate', 'symbol', 'side', 'entry', 'exit', 'quantity',
  'pnl', 'fees', 'stopLoss', 'takeProfit', 'rMultiple', 'playbook',
  'assetClass', 'emotion', 'notes', 'ruleBreak', 'tags',
];

/**
 * Export trades as CSV string.
 * @param {Object[]} trades
 * @param {Object} [opts] - { fields, dateFrom, dateTo }
 * @returns {string} CSV content
 */
function exportCSV(trades, opts = {}) {
  const fields = opts.fields || TRADE_FIELDS;
  let data = [...trades];

  // Date filter
  if (opts.dateFrom) data = data.filter(t => t.date >= opts.dateFrom);
  if (opts.dateTo) data = data.filter(t => t.date <= opts.dateTo);

  // Sort by date
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const header = fields.join(',');
  const rows = data.map(t =>
    fields.map(f => {
      let val = t[f];
      if (val == null) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      if (Array.isArray(val)) return `"${val.join(';')}"`;
      return String(val);
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Export trades as JSON string.
 * @param {Object[]} trades
 * @param {Object} [opts] - { dateFrom, dateTo, pretty }
 * @returns {string} JSON content
 */
function exportJSON(trades, opts = {}) {
  let data = [...trades];
  if (opts.dateFrom) data = data.filter(t => t.date >= opts.dateFrom);
  if (opts.dateTo) data = data.filter(t => t.date <= opts.dateTo);
  data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const exportObj = {
    version: 'tradeforge-v10',
    exportedAt: new Date().toISOString(),
    tradeCount: data.length,
    trades: data,
  };

  return opts.pretty !== false ? JSON.stringify(exportObj, null, 2) : JSON.stringify(exportObj);
}

/**
 * Trigger browser file download.
 * @param {string} content - File content
 * @param {string} filename - Download filename
 * @param {string} [mime] - MIME type
 */
function downloadFile(content, filename, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── IMPORT ─────────────────────────────────────────────────────

/**
 * Parse a CSV string into rows of objects.
 * Handles quoted fields with commas and newlines.
 */
function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === '\n' && !inQuote) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuote) {
      // skip CR
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = [];
    let val = '';
    let q = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') {
        if (q && lines[i][j + 1] === '"') { val += '"'; j++; }
        else q = !q;
      } else if (c === ',' && !q) {
        vals.push(val.trim());
        val = '';
      } else {
        val += c;
      }
    }
    vals.push(val.trim());

    const row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
    rows.push(row);
  }

  return rows;
}

// ─── Broker Detection ───────────────────────────────────────────

/**
 * Auto-detect broker from CSV headers.
 * @param {string[]} headers - CSV column headers
 * @returns {string} Broker ID or 'generic'
 */
function detectBroker(headers) {
  const h = headers.map(s => (s || '').toLowerCase().trim());
  const joined = h.join('|');

  // Tradovate: has "B/S" or "Buy/Sell" and "Instrument" columns
  if ((h.includes('b/s') || h.includes('buy/sell')) && h.includes('instrument')) return 'tradovate';

  // NinjaTrader: has "Entry price" and "Exit price" columns
  if (h.includes('entry price') && h.includes('exit price') && h.includes('instrument')) return 'ninjatrader';

  // ThinkorSwim: has "Exec Time" and "Spread" columns
  if (h.includes('exec time') && (h.includes('spread') || h.includes('pos effect'))) return 'thinkorswim';

  // TradeStation: has "Symbol" and "Entry Price" and "Close Price"
  if (h.includes('close price') && h.includes('entry price') && h.includes('symbol')) return 'tradestation';

  // IBKR: has "DataDiscriminator" or "ClientAccountID"
  if (h.includes('datadiscriminator') || h.includes('clientaccountid') || joined.includes('tradeid')) return 'ibkr';

  // Robinhood: has "Trans Code" and "Instrument" columns
  if (h.includes('trans code') && h.includes('instrument')) return 'robinhood';

  // Webull: has "Avg Price" + "Filled Qty" + "Side" + "Status"
  if ((h.includes('avg price') || h.includes('filled qty')) && h.includes('side') && h.includes('status')) return 'webull';

  // MetaTrader 5 Positions: has "Volume" and "Profit" with "Close Time"
  if (h.includes('volume') && h.includes('profit') && (h.includes('close time') || h.includes('close price'))) {
    // Distinguish from TradeStation by checking for MT5-specific columns
    if (h.includes('swap') || h.includes('commission') || h.includes('ticket')) return 'mt5';
  }
  // MetaTrader 5 Deals: has "Direction" and "Deal" columns
  if (h.includes('direction') && h.includes('deal') && h.includes('profit')) return 'mt5';

  // TradeForge native CSV
  if (h.includes('id') && h.includes('playbook') && h.includes('rmultiple')) return 'tradeforge';

  return 'generic';
}

// ─── Broker Parsers ─────────────────────────────────────────────

function _uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _parseNum(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(/[$,()]/g, '').trim());
  return isNaN(n) ? null : n;
}

function _parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Tradovate ────────────────────────────────────────────────────

function parseTradovate(rows) {
  return rows.map(r => {
    const side = (r['B/S'] || r['Buy/Sell'] || '').toLowerCase().includes('buy') ? 'long' : 'short';
    return {
      id: _uid(),
      date: _parseDate(r['Date'] || r['Time'] || r['Fill Time']),
      symbol: r['Instrument'] || r['Contract'] || '',
      side,
      entry: _parseNum(r['Price'] || r['Fill Price'] || r['Avg Price']),
      exit: _parseNum(r['Exit Price'] || r['Close Price']),
      quantity: _parseNum(r['Qty'] || r['Quantity'] || r['Filled Qty']) || 1,
      pnl: _parseNum(r['P&L'] || r['PnL'] || r['Profit/Loss'] || r['Net P&L']),
      fees: _parseNum(r['Commission'] || r['Fees'] || r['Total Fees']),
      assetClass: 'futures',
      notes: `Imported from Tradovate`,
    };
  }).filter(t => t.date && t.symbol);
}

// ── NinjaTrader ──────────────────────────────────────────────────

function parseNinjaTrader(rows) {
  return rows.map(r => {
    const side = (r['Market pos.'] || r['Type'] || '').toLowerCase().includes('long') ? 'long' : 'short';
    return {
      id: _uid(),
      date: _parseDate(r['Entry time'] || r['Entry Time']),
      closeDate: _parseDate(r['Exit time'] || r['Exit Time']),
      symbol: r['Instrument'] || '',
      side,
      entry: _parseNum(r['Entry price'] || r['Entry Price']),
      exit: _parseNum(r['Exit price'] || r['Exit Price']),
      quantity: _parseNum(r['Quantity'] || r['Qty']) || 1,
      pnl: _parseNum(r['Profit'] || r['P&L'] || r['Net profit']),
      fees: _parseNum(r['Commission'] || r['Comm.']),
      assetClass: 'futures',
      notes: `Imported from NinjaTrader`,
    };
  }).filter(t => t.date && t.symbol);
}

// ── ThinkorSwim ──────────────────────────────────────────────────

function parseThinkorSwim(rows) {
  return rows.map(r => {
    const posEffect = (r['Pos Effect'] || r['Side'] || '').toUpperCase();
    const side = posEffect.includes('TO OPEN')
      ? ((r['Side'] || '').includes('BUY') ? 'long' : 'short')
      : ((r['Side'] || '').includes('SELL') ? 'long' : 'short');
    return {
      id: _uid(),
      date: _parseDate(r['Exec Time'] || r['Date']),
      symbol: (r['Symbol'] || r['Underlying'] || '').replace(/\s+/g, ''),
      side,
      entry: _parseNum(r['Price'] || r['Avg Price']),
      exit: null, // TOS doesn't pair entries/exits in a single row
      quantity: _parseNum(r['Qty'] || r['Quantity']) || 1,
      pnl: _parseNum(r['P/L'] || r['P&L'] || r['Net Liq']),
      fees: _parseNum(r['Commission'] || r['Comm'] || r['Reg Fees']),
      assetClass: (r['Spread'] || r['Type'] || '').toLowerCase().includes('option') ? 'options' : 'equities',
      notes: `Imported from ThinkorSwim. ${r['Spread'] || ''}`.trim(),
    };
  }).filter(t => t.date && t.symbol);
}

// ── TradeStation ─────────────────────────────────────────────────

function parseTradeStation(rows) {
  return rows.map(r => {
    const side = (r['Type'] || r['Side'] || '').toLowerCase().includes('buy') ? 'long' : 'short';
    return {
      id: _uid(),
      date: _parseDate(r['Entry Date'] || r['Date']),
      closeDate: _parseDate(r['Exit Date'] || r['Close Date']),
      symbol: r['Symbol'] || '',
      side,
      entry: _parseNum(r['Entry Price']),
      exit: _parseNum(r['Close Price'] || r['Exit Price']),
      quantity: _parseNum(r['Quantity'] || r['Shares']) || 1,
      pnl: _parseNum(r['Profit'] || r['P&L'] || r['Net Profit']),
      fees: _parseNum(r['Commission'] || r['Comm']),
      assetClass: 'equities',
      notes: `Imported from TradeStation`,
    };
  }).filter(t => t.date && t.symbol);
}

// ── Interactive Brokers (Flex Query) ─────────────────────────────

function parseIBKR(rows) {
  // IBKR Flex Query can have multiple row types; filter to trades only
  const tradeRows = rows.filter(r =>
    (r['DataDiscriminator'] || '').toLowerCase().includes('trade') ||
    (r['Header'] || '').toLowerCase().includes('trade') ||
    r['TradeID']
  );

  return (tradeRows.length > 0 ? tradeRows : rows).map(r => {
    const side = (r['Buy/Sell'] || r['Side'] || r['Code'] || '').toUpperCase();
    return {
      id: _uid(),
      date: _parseDate(r['TradeDate'] || r['DateTime'] || r['Date/Time'] || r['Date']),
      symbol: r['Symbol'] || r['UnderlyingSymbol'] || '',
      side: side.includes('BUY') || side.includes('BOT') ? 'long' : 'short',
      entry: _parseNum(r['TradePrice'] || r['Price'] || r['T. Price']),
      exit: null,
      quantity: Math.abs(_parseNum(r['Quantity'] || r['Shares']) || 1),
      pnl: _parseNum(r['FifoPnlRealized'] || r['RealizedP/L'] || r['MTM P/L'] || r['NetCash']),
      fees: _parseNum(r['IBCommission'] || r['Commission'] || r['Comm/Fee']),
      assetClass: (r['AssetClass'] || r['SecType'] || 'STK').toUpperCase() === 'STK' ? 'equities'
        : (r['AssetClass'] || '').toUpperCase() === 'OPT' ? 'options'
        : (r['AssetClass'] || '').toUpperCase() === 'FUT' ? 'futures'
        : 'equities',
      notes: `Imported from IBKR. ${r['Description'] || ''}`.trim(),
    };
  }).filter(t => t.date && t.symbol);
}

// ── Generic CSV ──────────────────────────────────────────────────

function parseGenericCSV(rows) {
  return rows.map(r => {
    // Try common column name variations
    const symbol = r['Symbol'] || r['symbol'] || r['Ticker'] || r['ticker'] || r['Instrument'] || '';
    const date = _parseDate(r['Date'] || r['date'] || r['Time'] || r['Timestamp'] || r['Entry Date'] || r['datetime']);
    const pnl = _parseNum(r['P&L'] || r['PnL'] || r['pnl'] || r['Profit'] || r['profit'] || r['Net P&L'] || r['P/L']);
    const side = (r['Side'] || r['side'] || r['Direction'] || r['Type'] || r['B/S'] || '').toLowerCase();

    return {
      id: _uid(),
      date,
      symbol,
      side: side.includes('buy') || side.includes('long') ? 'long' : side.includes('sell') || side.includes('short') ? 'short' : 'long',
      entry: _parseNum(r['Entry'] || r['entry'] || r['Entry Price'] || r['Open Price'] || r['Price']),
      exit: _parseNum(r['Exit'] || r['exit'] || r['Exit Price'] || r['Close Price']),
      quantity: _parseNum(r['Quantity'] || r['Qty'] || r['quantity'] || r['Shares'] || r['Size']) || 1,
      pnl,
      fees: _parseNum(r['Fees'] || r['fees'] || r['Commission'] || r['commission']),
      notes: r['Notes'] || r['notes'] || r['Comment'] || '',
    };
  }).filter(t => t.date && t.symbol);
}

// ── TradeForge Native ────────────────────────────────────────────

function parseTradeForgeCSV(rows) {
  return rows.map(r => ({
    id: r['id'] || _uid(),
    date: r['date'] || null,
    closeDate: r['closeDate'] || null,
    symbol: r['symbol'] || '',
    side: r['side'] || 'long',
    entry: _parseNum(r['entry']),
    exit: _parseNum(r['exit']),
    quantity: _parseNum(r['quantity']) || 1,
    pnl: _parseNum(r['pnl']),
    fees: _parseNum(r['fees']),
    stopLoss: _parseNum(r['stopLoss']),
    takeProfit: _parseNum(r['takeProfit']),
    rMultiple: _parseNum(r['rMultiple']),
    playbook: r['playbook'] || '',
    assetClass: r['assetClass'] || '',
    emotion: r['emotion'] || '',
    notes: r['notes'] || '',
    ruleBreak: r['ruleBreak'] === 'true',
    tags: r['tags'] ? r['tags'].split(';').filter(Boolean) : [],
  })).filter(t => t.date && t.symbol);
}

// ── Robinhood ───────────────────────────────────────────────────
// Dates: M/DD/YYYY (quoted). Prices: "$175.84" ($ prefix, quoted)
// Amounts: "($43.64)" = negative (accounting notation)
// Trans Codes: BTO (buy to open), STC (sell to close), STO, BTC, BUY, SELL

function parseRobinhood(rows) {
  return rows.map(r => {
    const code = (r['Trans Code'] || '').toUpperCase().trim();
    // Skip non-trade rows (dividends, deposits, interest, ACH, etc.)
    if (!['BUY', 'SELL', 'BTO', 'STC', 'STO', 'BTC'].includes(code)) return null;

    const symbol = (r['Instrument'] || '').trim();
    if (!symbol) return null;

    const isBuy = code === 'BUY' || code === 'BTO' || code === 'BTC';
    const isOption = ['BTO', 'STC', 'STO', 'BTC'].includes(code);

    // Parse RH price format: "$175.84"
    const rawPrice = r['Price'] || '';
    const price = _parseNum(String(rawPrice).replace(/^\$/, ''));

    // Parse RH amount format: "($43.64)" = negative
    const rawAmount = r['Amount'] || '';
    const amtStr = String(rawAmount).trim();
    const isNeg = amtStr.startsWith('(') && amtStr.endsWith(')');
    const amount = _parseNum(isNeg ? amtStr.slice(1, -1) : amtStr);
    const signedAmount = isNeg ? -(amount || 0) : amount;

    return {
      id: _uid(),
      date: _parseDate(r['Activity Date']),
      symbol,
      side: isBuy ? 'long' : 'short',
      entry: price,
      exit: null,
      quantity: Math.abs(_parseNum(r['Quantity']) || 0),
      pnl: null, // Must pair entries/exits via reconcile engine
      fees: null,
      amount: signedAmount,
      assetClass: isOption ? 'options' : 'stock',
      positionEffect: (code === 'BTO' || code === 'STO') ? 'open' : (code === 'STC' || code === 'BTC') ? 'close' : null,
      notes: `Imported from Robinhood | ${r['Description'] || ''}`.trim(),
    };
  }).filter(Boolean).filter(t => t.date && t.symbol);
}

// ── Webull ───────────────────────────────────────────────────────
// Separate files for stocks vs options (both handled here).
// No commission data in export. Must filter Status = "Filled".
// Dates: "MM/DD/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM:SS"

function parseWebull(rows) {
  return rows.map(r => {
    const status = (r['Status'] || '').toLowerCase();
    if (status && status !== 'filled') return null;

    const symbol = r['Symbol'] || r['Underlying Symbol'] || '';
    if (!symbol) return null;

    const side = (r['Side'] || '').toUpperCase();
    const isBuy = side === 'BUY';
    const isOption = !!(r['Expiration Date'] || r['Strike Price'] || r['Option Type']);

    return {
      id: _uid(),
      date: _parseDate(r['Filled Time'] || r['Created Time']),
      symbol: symbol.trim(),
      side: isBuy ? 'long' : 'short',
      entry: _parseNum(r['Avg Price'] || r['Price']),
      exit: null,
      quantity: _parseNum(r['Filled Qty'] || r['Qty'] || r['Total Qty']) || 1,
      pnl: null,
      fees: null, // Webull doesn't include fees in export
      assetClass: isOption ? 'options' : 'stock',
      optionType: r['Option Type'] || null,
      strikePrice: _parseNum(r['Strike Price']),
      expirationDate: _parseDate(r['Expiration Date']),
      notes: `Imported from Webull`,
    };
  }).filter(Boolean).filter(t => t.date && t.symbol);
}

// ── MetaTrader 5 ────────────────────────────────────────────────
// Native CSV export (Positions view or Deals view).
// Dates: "YYYY.MM.DD HH:MM:SS" (period-separated).
// Broker suffixes common: "EURUSDm", "EURUSD.pro"

function _parseMT5Date(val) {
  if (!val) return null;
  // Convert "2024.01.15 09:30:45" → "2024-01-15T09:30:45"
  const s = String(val).trim().replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function _cleanMT5Symbol(raw) {
  // Strip broker suffixes: .pro, .raw, .ecn, .std, .stp
  let sym = (raw || '').replace(/\.(pro|raw|ecn|std|stp)$/i, '').toUpperCase();
  // Strip trailing 'm' only if the base looks like a forex pair (6 alpha chars)
  // e.g. "EURUSDm" → "EURUSD" but "XAUUSD" stays "XAUUSD"
  if (/^[A-Z]{6}m$/i.test(sym)) sym = sym.slice(0, -1);
  return sym;
}

function _guessMT5AssetClass(sym) {
  const s = sym.toUpperCase();
  // Check futures/index patterns FIRST (some like XAUUSD are also 6 alpha chars)
  if (/^(XAUUSD|XAGUSD|XBRUSD|XTIUSD|XPTUSD|US30|US500|US100|USTEC|UK100|DE30|JP225)/.test(s)) return 'futures';
  if (/^[A-Z]{6}$/.test(s)) return 'forex';
  return 'stock';
}

function parseMT5(rows) {
  // Detect if Positions view (has Close Time) or Deals view (has Direction)
  const firstRow = rows[0] || {};
  const hasCloseTime = 'Close Time' in firstRow || 'close time' in firstRow;
  const hasDirection = 'Direction' in firstRow || 'direction' in firstRow;

  if (hasCloseTime) {
    // Positions view — each row is a complete trade
    return rows.map(r => {
      const type = (r['Type'] || '').toLowerCase();
      if (type !== 'buy' && type !== 'sell') return null;

      const symbol = _cleanMT5Symbol(r['Symbol']);
      if (!symbol) return null;

      return {
        id: _uid(),
        date: _parseMT5Date(r['Time'] || r['Open Time']),
        closeDate: _parseMT5Date(r['Close Time']),
        symbol,
        side: type === 'buy' ? 'long' : 'short',
        entry: _parseNum(r['Price'] || r['Open Price']),
        exit: _parseNum(r['Close Price']),
        quantity: _parseNum(r['Volume'] || r['Lots']) || 1,
        pnl: _parseNum(r['Profit']),
        fees: (_parseNum(r['Commission']) || 0) + (_parseNum(r['Fee']) || 0) + (_parseNum(r['Swap']) || 0),
        assetClass: _guessMT5AssetClass(symbol),
        notes: `Imported from MetaTrader 5`,
      };
    }).filter(Boolean).filter(t => t.date && t.symbol);
  }

  if (hasDirection) {
    // Deals view — only use "Out" or "In-Out" deals (they carry P&L)
    const outDeals = rows.filter(r => {
      const dir = (r['Direction'] || '').toLowerCase();
      return dir === 'out' || dir === 'in-out' || dir === 'in/out';
    });

    return (outDeals.length > 0 ? outDeals : rows).map(r => {
      const symbol = _cleanMT5Symbol(r['Symbol']);
      if (!symbol) return null;

      return {
        id: _uid(),
        date: _parseMT5Date(r['Time']),
        symbol,
        side: (r['Type'] || '').toLowerCase() === 'buy' ? 'short' : 'long', // Closing deal: buy = closing short
        entry: null,
        exit: _parseNum(r['Price']),
        quantity: _parseNum(r['Volume']) || 1,
        pnl: _parseNum(r['Profit']),
        fees: (_parseNum(r['Commission']) || 0) + (_parseNum(r['Fee']) || 0) + (_parseNum(r['Swap']) || 0),
        assetClass: _guessMT5AssetClass(symbol),
        notes: `Imported from MetaTrader 5`,
      };
    }).filter(Boolean).filter(t => t.date && t.symbol);
  }

  // Fallback: try generic parsing
  return parseGenericCSV(rows);
}

// ─── Parser Router ──────────────────────────────────────────────

const BROKER_PARSERS = {
  tradovate: parseTradovate,
  ninjatrader: parseNinjaTrader,
  thinkorswim: parseThinkorSwim,
  tradestation: parseTradeStation,
  ibkr: parseIBKR,
  robinhood: parseRobinhood,
  webull: parseWebull,
  mt5: parseMT5,
  tradeforge: parseTradeForgeCSV,
  generic: parseGenericCSV,
};

const BROKER_LABELS = {
  tradovate: 'Tradovate',
  ninjatrader: 'NinjaTrader',
  thinkorswim: 'ThinkorSwim',
  tradestation: 'TradeStation',
  ibkr: 'Interactive Brokers',
  robinhood: 'Robinhood',
  webull: 'Webull',
  mt5: 'MetaTrader 5',
  tradeforge: 'TradeForge',
  generic: 'Generic CSV',
};

// ─── Main Import Function ───────────────────────────────────────

/**
 * Import trades from a file (CSV or JSON).
 *
 * @param {File} file - Browser File object
 * @param {string} [forceBroker] - Force a specific broker parser
 * @returns {Promise<{ ok: boolean, trades: Object[], broker: string, error?: string }>}
 */
async function importFile(file, forceBroker = null) {
  try {
    const text = await file.text();
    const name = (file.name || '').toLowerCase();

    // ─── JSON Import ──────────────────────────────────────
    if (name.endsWith('.json')) {
      const json = JSON.parse(text);
      let rawTrades = [];
      if (json.trades && Array.isArray(json.trades)) {
        rawTrades = json.trades;
      } else if (Array.isArray(json)) {
        rawTrades = json;
      }
      if (rawTrades.length === 0) {
        return { ok: false, trades: [], broker: 'unknown', error: 'JSON file does not contain a trades array.' };
      }
      const { trades: normalized } = normalizeImported(rawTrades);
      return { ok: true, trades: normalized, broker: 'tradeforge', count: normalized.length };
    }

    // ─── CSV Import ───────────────────────────────────────
    const rows = parseCSV(text);
    if (rows.length === 0) {
      return { ok: false, trades: [], broker: 'unknown', error: 'No data rows found in CSV.' };
    }

    const headers = Object.keys(rows[0]);
    const broker = forceBroker || detectBroker(headers);
    const parser = BROKER_PARSERS[broker] || BROKER_PARSERS.generic;
    const rawTrades = parser(rows);

    // Normalize through schema validator
    const { trades: normalized, errors: schemaErrors } = normalizeImported(rawTrades);

    return {
      ok: true,
      trades: normalized,
      broker,
      brokerLabel: BROKER_LABELS[broker] || broker,
      count: normalized.length,
      skipped: rows.length - normalized.length,
      schemaErrors: schemaErrors.length > 0 ? schemaErrors : undefined,
    };
  } catch (e) {
    return { ok: false, trades: [], broker: 'unknown', error: e.message };
  }
}

// ─── Schema Normalization ────────────────────────────────────────

import { normalizeBatch } from '../engine/TradeSchema.js';

/**
 * Normalize an array of imported trades through the schema validator.
 * @param {Object[]} trades
 * @returns {{ trades: Object[], errors: Array }}
 */
function normalizeImported(trades) {
  if (!trades?.length) return { trades: [], errors: [] };
  return normalizeBatch(trades);
}

// ─── Exports ────────────────────────────────────────────────────

export {
  exportCSV,
  exportJSON,
  downloadFile,
  importFile,
  parseCSV,
  detectBroker,
  normalizeImported,
  TRADE_FIELDS,
  BROKER_LABELS,
  BROKER_PARSERS,
};
