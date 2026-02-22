// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — CSV Import/Export
// Extracted from v9.3 monolith with improved validation.
// ═══════════════════════════════════════════════════════════════════

import { uid } from './utils.js';
import { roundField } from './engine/Money.js';
import { detectBroker as _detectBroker, mapColumnsForBroker as _mapColumnsForBroker } from './engine/BrokerProfiles.js';

/**
 * Export trades to CSV string
 * @param {Array} trades
 * @returns {string} CSV content
 */
function exportCSV(trades) {
  const h = 'Date,Symbol,Side,Qty,Entry,P&L,Fees,R,Emotion,Tags\n';
  const rows = trades.map((t) =>
    [
      t.date,
      t.symbol,
      t.side,
      t.quantity,
      t.entryPrice || '',
      t.pnl,
      t.fees || 0,
      t.rMultiple ?? '',
      t.emotion || '',
      (t.tags || []).join(';'),
    ].join(',')
  );
  return h + rows.join('\n');
}

/**
 * Parse a raw CSV string into rows of values.
 * Handles: quoted fields, commas inside quotes, different line endings.
 *
 * @param {string} text - Raw CSV content
 * @returns {{ headers: string[], rows: string[][], delimiter: string }}
 */
function parseCSVRaw(text) {
  if (!text || typeof text !== 'string') return { headers: [], rows: [], delimiter: ',' };

  // Strip BOM
  let clean = text.trim();
  if (clean.charCodeAt(0) === 0xfeff) clean = clean.slice(1);

  // Detect delimiter
  const firstLine = clean.split(/\r?\n/)[0];
  let delimiter = ',';
  if (firstLine.split('\t').length > firstLine.split(',').length) delimiter = '\t';
  else if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';

  // Parse with quote awareness
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === delimiter) {
        current.push(field.trim());
        field = '';
        i++;
      } else if (ch === '\r' && clean[i + 1] === '\n') {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = '';
        i += 2;
      } else if (ch === '\n') {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push last field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field.trim());
    rows.push(current);
  }

  // Filter empty rows
  const filtered = rows.filter((r) => r.some((cell) => cell.length > 0));
  if (filtered.length < 1) return { headers: [], rows: [], delimiter };

  const headers = filtered[0];
  return { headers, rows: filtered.slice(1), delimiter };
}

/**
 * Auto-map CSV headers to TradeForge fields.
 * Tries multiple common header names for each field.
 *
 * @param {string[]} headers - Header row from CSV
 * @returns {Object} Map of field name to column index (-1 if not found)
 */
function autoMap(headers) {
  const lHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const find = (...patterns) => {
    for (const p of patterns) {
      const idx = lHeaders.indexOf(p);
      if (idx >= 0) return idx;
    }
    // Partial match
    for (const p of patterns) {
      const idx = lHeaders.findIndex((h) => h.includes(p));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  return {
    date: find('date', 'datetime', 'time', 'timestamp', 'opentime', 'closetime'),
    symbol: find('symbol', 'ticker', 'instrument', 'asset', 'market'),
    side: find('side', 'direction', 'type', 'action', 'buysell'),
    quantity: find('quantity', 'qty', 'size', 'lots', 'contracts', 'amount', 'volume'),
    entryPrice: find('entry', 'entryprice', 'price', 'open', 'openprice', 'avgprice'),
    pnl: find('pnl', 'profit', 'profitloss', 'pl', 'realizedpnl', 'netpnl', 'gain'),
    fees: find('fees', 'commission', 'commissions', 'cost'),
    rMultiple: find('rmultiple', 'r', 'rratio', 'riskreward'),
    emotion: find('emotion', 'mood', 'feeling', 'state'),
    playbook: find('playbook', 'strategy', 'setup', 'pattern'),
    tags: find('tags', 'labels', 'categories'),
    notes: find('notes', 'comment', 'comments', 'description'),
  };
}

/**
 * Parse a numeric string that may contain currency symbols, commas, parentheses.
 * e.g., "$1,234.56" → 1234.56, "(500)" → -500, "-$3.50" → -3.50
 *
 * @param {string|number} v
 * @returns {number} Parsed number, or NaN if unparseable
 */
function parseNumeric(v) {
  if (typeof v === 'number') return v;
  if (v == null || v === '') return NaN;
  let s = String(v).trim();

  // Check for parentheses notation: (500) means -500
  const parens = /^\((.+)\)$/.test(s);
  if (parens) s = s.slice(1, -1);

  // Strip currency symbols and commas
  s = s.replace(/[$€£¥₿,]/g, '');

  const n = parseFloat(s);
  return parens ? -Math.abs(n) : n;
}

/**
 * Validate and parse a date string.
 * Handles: ISO 8601, US format (MM/DD/YYYY), European (DD/MM/YYYY guess)
 *
 * @param {string} v - Date string
 * @returns {{ date: Date|null, valid: boolean, warning?: string }}
 */
function parseDate(v) {
  if (!v || typeof v !== 'string') return { date: null, valid: false };

  const s = v.trim();
  const d = new Date(s);

  if (!isNaN(d.getTime())) {
    return { date: d, valid: true };
  }

  // Try MM/DD/YYYY
  const usMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
  if (usMatch) {
    const [, m, day, y, rest] = usMatch;
    const attempt = new Date(`${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}${rest}`);
    if (!isNaN(attempt.getTime())) return { date: attempt, valid: true };
  }

  return { date: null, valid: false, warning: `Unparseable date: "${s}"` };
}

/**
 * Normalize a single CSV row into a TradeForge trade object.
 * Returns the trade object plus any validation warnings/errors.
 *
 * @param {string[]} row - CSV row values
 * @param {Object} map - Column index map from autoMap()
 * @param {number} rowIndex - Row number for error reporting
 * @returns {{ trade: Object|null, status: 'valid'|'warning'|'error', issues: string[] }}
 */
function normTrade(row, map, rowIndex) {
  const issues = [];
  const get = (field) => (map[field] >= 0 && map[field] < row.length ? row[map[field]] : null);

  // ─── Date (required) ──────────────────────────────────────────
  const rawDate = get('date');
  const { date, valid: dateValid, warning: dateWarn } = parseDate(rawDate);
  if (!dateValid) {
    issues.push(dateWarn || `Row ${rowIndex}: Missing or invalid date`);
    return { trade: null, status: 'error', issues };
  }

  // ─── P&L (required) ───────────────────────────────────────────
  const rawPnl = get('pnl');
  const pnl = parseNumeric(rawPnl);
  if (isNaN(pnl)) {
    issues.push(`Row ${rowIndex}: Missing or invalid P&L value "${rawPnl}"`);
    return { trade: null, status: 'error', issues };
  }

  // ─── Symbol (required) ────────────────────────────────────────
  const symbol = (get('symbol') || 'UNKNOWN').toUpperCase().trim();
  if (symbol === 'UNKNOWN') {
    issues.push(`Row ${rowIndex}: Missing symbol, defaulting to UNKNOWN`);
  }

  // ─── Side ─────────────────────────────────────────────────────
  const rawSide = (get('side') || '').toLowerCase().trim();
  let side = 'long';
  if (['short', 'sell', 's'].includes(rawSide)) side = 'short';
  else if (['long', 'buy', 'b', 'l'].includes(rawSide)) side = 'long';
  else if (rawSide) issues.push(`Row ${rowIndex}: Unknown side "${rawSide}", defaulting to long`);

  // ─── Numeric fields (optional) ────────────────────────────────
  const quantity = parseNumeric(get('quantity'));
  const entryPrice = parseNumeric(get('entryPrice'));
  const fees = parseNumeric(get('fees'));
  const rMultiple = parseNumeric(get('rMultiple'));

  if (!isNaN(fees) && fees < 0) {
    issues.push(`Row ${rowIndex}: Negative fees (${fees}), taking absolute value`);
  }

  // ─── Text fields ──────────────────────────────────────────────
  const emotion = get('emotion') || '';
  const playbook = get('playbook') || '';
  const notes = get('notes') || '';
  const rawTags = get('tags') || '';
  const tags = rawTags
    .split(/[;,|]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const status = issues.length > 0 ? 'warning' : 'valid';

  const trade = {
    id: uid(),
    date: date.toISOString(),
    symbol,
    side,
    quantity: isNaN(quantity) ? 1 : Math.abs(quantity),
    entryPrice: isNaN(entryPrice) ? 0 : roundField(entryPrice, 'entry'),
    pnl: roundField(pnl, 'pnl'),
    fees: isNaN(fees) ? 0 : roundField(Math.abs(fees), 'fees'),
    rMultiple: isNaN(rMultiple) ? null : rMultiple,
    emotion,
    playbook,
    notes,
    tags,
    followedRules: true,
    assetClass: 'other',
    _moneyV: 1,
  };

  return { trade, status, issues };
}

/**
 * Generate a deduplication hash for a trade.
 * Uses date (rounded to minute) + symbol + pnl.
 *
 * @param {Object} trade
 * @returns {string}
 */
function tradeHash(trade) {
  const dateKey = trade.date.slice(0, 16); // YYYY-MM-DDTHH:MM
  const pnlKey = Math.round(trade.pnl * 100);
  return `${dateKey}|${trade.symbol}|${pnlKey}`;
}

/**
 * Full CSV import pipeline: parse → validate → return preview.
 *
 * @param {string} text - Raw CSV content
 * @param {Object[]} [existingTrades=[]] - Existing trades for deduplication
 * @returns {{ trades: Object[], valid: number, warnings: number, errors: number,
 *             duplicates: number, issues: string[], headers: string[] }}
 */
function importCSV(text, existingTrades = []) {
  const { headers, rows, delimiter } = parseCSVRaw(text);

  if (headers.length === 0) {
    return {
      trades: [],
      valid: 0,
      warnings: 0,
      errors: 0,
      duplicates: 0,
      issues: ['Empty or invalid CSV file'],
      headers: [],
      broker: null,
    };
  }

  // Try broker-specific detection first, merge with generic autoMap
  let map = autoMap(headers);
  let brokerDetection = null;
  try {
    brokerDetection = _detectBroker(headers);
    if (brokerDetection.broker) {
      const brokerMap = _mapColumnsForBroker(headers, brokerDetection.broker);
      if (brokerMap) {
        // Merge: broker-specific columns override autoMap, but only where found
        for (const [field, idx] of Object.entries(brokerMap)) {
          if (idx >= 0) map[field] = idx;
        }
      }
    }
  } catch (_) {
    // BrokerProfiles detection failed — use generic mapping
  }

  if (map.date < 0 || map.pnl < 0) {
    const missing = [];
    if (map.date < 0) missing.push('date');
    if (map.pnl < 0) missing.push('P&L');
    return {
      trades: [],
      valid: 0,
      warnings: 0,
      errors: 0,
      duplicates: 0,
      issues: [`Required columns not found: ${missing.join(', ')}. Found headers: ${headers.join(', ')}`],
      headers,
      broker: brokerDetection,
    };
  }

  // Build existing trade hash set for deduplication
  const existingHashes = new Set(existingTrades.map(tradeHash));

  const trades = [];
  let valid = 0,
    warnings = 0,
    errors = 0,
    duplicates = 0;
  const issues = [];

  for (let i = 0; i < rows.length; i++) {
    const result = normTrade(rows[i], map, i + 2); // +2 for 1-indexed + header row

    // Apply broker-specific symbol normalization
    if (result.trade && brokerDetection?.broker?.normalizeSymbol) {
      result.trade.symbol = brokerDetection.broker.normalizeSymbol(result.trade.symbol);
    }

    if (result.status === 'error') {
      errors++;
      issues.push(...result.issues);
      continue;
    }

    // Check for duplicates
    const hash = tradeHash(result.trade);
    if (existingHashes.has(hash)) {
      duplicates++;
      issues.push(`Row ${i + 2}: Duplicate of existing trade (${result.trade.symbol} ${result.trade.date.slice(0, 10)})`);
      continue;
    }
    existingHashes.add(hash);

    if (result.status === 'warning') {
      warnings++;
      issues.push(...result.issues);
    } else {
      valid++;
    }

    trades.push(result.trade);
  }

  return { trades, valid, warnings, errors, duplicates, issues, headers, broker: brokerDetection };
}

export {
  exportCSV,
  parseCSVRaw,
  autoMap,
  parseNumeric,
  parseDate,
  normTrade,
  tradeHash,
  importCSV,
};
