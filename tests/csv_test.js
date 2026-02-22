import { describe, it, expect } from 'vitest';
import {
  parseCSVRaw, autoMap, parseNumeric, parseDate,
  normTrade, tradeHash, importCSV, exportCSV,
} from '../csv.js';

// ─── parseNumeric ───────────────────────────────────────────────
describe('parseNumeric', () => {
  it('parses plain numbers', () => {
    expect(parseNumeric('123.45')).toBe(123.45);
    expect(parseNumeric('-67.89')).toBe(-67.89);
  });
  it('strips dollar signs', () => {
    expect(parseNumeric('$1234.56')).toBe(1234.56);
    expect(parseNumeric('-$500')).toBe(-500);
  });
  it('strips commas', () => {
    expect(parseNumeric('1,234.56')).toBe(1234.56);
    expect(parseNumeric('$1,234,567.89')).toBe(1234567.89);
  });
  it('handles parentheses as negative', () => {
    expect(parseNumeric('(500)')).toBe(-500);
    expect(parseNumeric('($1,234.56)')).toBe(-1234.56);
  });
  it('strips currency symbols', () => {
    expect(parseNumeric('€100')).toBe(100);
    expect(parseNumeric('£50.25')).toBe(50.25);
    expect(parseNumeric('¥1000')).toBe(1000);
  });
  it('returns NaN for empty/null', () => {
    expect(isNaN(parseNumeric(''))).toBe(true);
    expect(isNaN(parseNumeric(null))).toBe(true);
    expect(isNaN(parseNumeric(undefined))).toBe(true);
  });
  it('returns NaN for non-numeric text', () => {
    expect(isNaN(parseNumeric('N/A'))).toBe(true);
    expect(isNaN(parseNumeric('abc'))).toBe(true);
  });
  it('passes through numbers', () => {
    expect(parseNumeric(42)).toBe(42);
    expect(parseNumeric(-3.14)).toBe(-3.14);
  });
});

// ─── parseDate ──────────────────────────────────────────────────
describe('parseDate', () => {
  it('parses ISO 8601', () => {
    const r = parseDate('2025-01-15T10:30:00Z');
    expect(r.valid).toBe(true);
    expect(r.date.getFullYear()).toBe(2025);
  });
  it('parses ISO date only', () => {
    const r = parseDate('2025-01-15');
    expect(r.valid).toBe(true);
  });
  it('parses US format MM/DD/YYYY', () => {
    const r = parseDate('01/15/2025');
    expect(r.valid).toBe(true);
    expect(r.date.getMonth()).toBe(0); // January
    expect(r.date.getDate()).toBe(15);
  });
  it('returns invalid for garbage', () => {
    const r = parseDate('not-a-date');
    expect(r.valid).toBe(false);
  });
  it('returns invalid for null/empty', () => {
    expect(parseDate(null).valid).toBe(false);
    expect(parseDate('').valid).toBe(false);
  });
});

// ─── parseCSVRaw ────────────────────────────────────────────────
describe('parseCSVRaw', () => {
  it('parses simple CSV', () => {
    const r = parseCSVRaw('Date,Symbol,PnL\n2025-01-01,BTC,100\n2025-01-02,ETH,-50');
    expect(r.headers).toEqual(['Date', 'Symbol', 'PnL']);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]).toEqual(['2025-01-01', 'BTC', '100']);
  });

  it('handles quoted fields with commas', () => {
    const r = parseCSVRaw('Name,Amount\n"Smith, John",100\nJane,200');
    expect(r.rows[0][0]).toBe('Smith, John');
    expect(r.rows[0][1]).toBe('100');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const r = parseCSVRaw('Name,Note\n"He said ""hello""",100');
    expect(r.rows[0][0]).toBe('He said "hello"');
  });

  it('handles \\r\\n line endings', () => {
    const r = parseCSVRaw('A,B\r\n1,2\r\n3,4');
    expect(r.rows.length).toBe(2);
  });

  it('strips BOM', () => {
    const r = parseCSVRaw('\uFEFFDate,PnL\n2025-01-01,100');
    expect(r.headers[0]).toBe('Date');
  });

  it('detects tab delimiter', () => {
    const r = parseCSVRaw('Date\tSymbol\tPnL\n2025-01-01\tBTC\t100');
    expect(r.delimiter).toBe('\t');
    expect(r.rows[0]).toEqual(['2025-01-01', 'BTC', '100']);
  });

  it('detects semicolon delimiter', () => {
    const r = parseCSVRaw('Date;Symbol;PnL\n2025-01-01;BTC;100');
    expect(r.delimiter).toBe(';');
    expect(r.rows[0]).toEqual(['2025-01-01', 'BTC', '100']);
  });

  it('returns empty for null/empty input', () => {
    expect(parseCSVRaw(null).headers).toEqual([]);
    expect(parseCSVRaw('').headers).toEqual([]);
  });

  it('filters empty rows', () => {
    const r = parseCSVRaw('A,B\n1,2\n\n3,4\n');
    expect(r.rows.length).toBe(2);
  });
});

// ─── autoMap ────────────────────────────────────────────────────
describe('autoMap', () => {
  it('maps standard headers', () => {
    const m = autoMap(['Date', 'Symbol', 'Side', 'P&L', 'Fees']);
    expect(m.date).toBe(0);
    expect(m.symbol).toBe(1);
    expect(m.side).toBe(2);
    expect(m.pnl).toBe(3);
    expect(m.fees).toBe(4);
  });
  it('maps alternative header names', () => {
    const m = autoMap(['DateTime', 'Ticker', 'Direction', 'Profit', 'Commission']);
    expect(m.date).toBe(0);
    expect(m.symbol).toBe(1);
    expect(m.side).toBe(2);
    expect(m.pnl).toBe(3);
    expect(m.fees).toBe(4);
  });
  it('case insensitive', () => {
    const m = autoMap(['DATE', 'SYMBOL', 'PNL']);
    expect(m.date).toBe(0);
    expect(m.symbol).toBe(1);
    expect(m.pnl).toBe(2);
  });
  it('returns -1 for missing fields', () => {
    const m = autoMap(['Foo', 'Bar']);
    expect(m.date).toBe(-1);
    expect(m.pnl).toBe(-1);
  });
});

// ─── normTrade ──────────────────────────────────────────────────
describe('normTrade', () => {
  const stdMap = { date: 0, symbol: 1, side: 2, pnl: 3, fees: 4,
    quantity: -1, entryPrice: -1, rMultiple: -1, emotion: -1,
    playbook: -1, tags: -1, notes: -1 };

  it('normalizes valid row', () => {
    const { trade, status } = normTrade(
      ['2025-01-15', 'BTC', 'long', '100', '5'], stdMap, 1
    );
    expect(status).toBe('valid');
    expect(trade.symbol).toBe('BTC');
    expect(trade.pnl).toBe(100);
    expect(trade.fees).toBe(5);
    expect(trade.side).toBe('long');
  });

  it('strips currency from P&L', () => {
    const { trade } = normTrade(
      ['2025-01-15', 'ETH', 'short', '$1,234.56', '0'], stdMap, 1
    );
    expect(trade.pnl).toBe(1234.56);
  });

  it('maps sell/short/s to short', () => {
    ['short', 'sell', 's'].forEach((side) => {
      const { trade } = normTrade(
        ['2025-01-15', 'BTC', side, '100', '0'], stdMap, 1
      );
      expect(trade.side).toBe('short');
    });
  });

  it('defaults unknown side to long with warning', () => {
    const { trade, status } = normTrade(
      ['2025-01-15', 'BTC', 'sideways', '100', '0'], stdMap, 1
    );
    expect(trade.side).toBe('long');
    expect(status).toBe('warning');
  });

  it('returns error for invalid date', () => {
    const { trade, status } = normTrade(
      ['not-a-date', 'BTC', 'long', '100', '0'], stdMap, 1
    );
    expect(status).toBe('error');
    expect(trade).toBeNull();
  });

  it('returns error for invalid P&L', () => {
    const { trade, status } = normTrade(
      ['2025-01-15', 'BTC', 'long', 'N/A', '0'], stdMap, 1
    );
    expect(status).toBe('error');
    expect(trade).toBeNull();
  });

  it('defaults missing symbol to UNKNOWN with warning', () => {
    const mapNoSym = { ...stdMap, symbol: -1 };
    const { trade, status } = normTrade(
      ['2025-01-15', 'BTC', 'long', '100', '0'], mapNoSym, 1
    );
    expect(trade.symbol).toBe('UNKNOWN');
    expect(status).toBe('warning');
  });

  it('takes absolute value of negative fees', () => {
    const { trade, issues } = normTrade(
      ['2025-01-15', 'BTC', 'long', '100', '-5'], stdMap, 1
    );
    expect(trade.fees).toBe(5);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('generates unique IDs', () => {
    const { trade: t1 } = normTrade(['2025-01-15', 'BTC', 'long', '100', '0'], stdMap, 1);
    const { trade: t2 } = normTrade(['2025-01-15', 'BTC', 'long', '100', '0'], stdMap, 2);
    expect(t1.id).not.toBe(t2.id);
  });
});

// ─── tradeHash ──────────────────────────────────────────────────
describe('tradeHash', () => {
  it('same trade produces same hash', () => {
    const t = { date: '2025-01-15T10:30:00Z', symbol: 'BTC', pnl: 100 };
    expect(tradeHash(t)).toBe(tradeHash(t));
  });
  it('different pnl produces different hash', () => {
    const t1 = { date: '2025-01-15T10:30:00Z', symbol: 'BTC', pnl: 100 };
    const t2 = { date: '2025-01-15T10:30:00Z', symbol: 'BTC', pnl: 200 };
    expect(tradeHash(t1)).not.toBe(tradeHash(t2));
  });
  it('different symbol produces different hash', () => {
    const t1 = { date: '2025-01-15T10:30:00Z', symbol: 'BTC', pnl: 100 };
    const t2 = { date: '2025-01-15T10:30:00Z', symbol: 'ETH', pnl: 100 };
    expect(tradeHash(t1)).not.toBe(tradeHash(t2));
  });
  it('ignores seconds (rounds to minute)', () => {
    const t1 = { date: '2025-01-15T10:30:00Z', symbol: 'BTC', pnl: 100 };
    const t2 = { date: '2025-01-15T10:30:45Z', symbol: 'BTC', pnl: 100 };
    expect(tradeHash(t1)).toBe(tradeHash(t2));
  });
});

// ─── importCSV (full pipeline) ──────────────────────────────────
describe('importCSV', () => {
  it('imports valid CSV', () => {
    const csv = 'Date,Symbol,Side,P&L\n2025-01-01,BTC,long,100\n2025-01-02,ETH,short,-50';
    const r = importCSV(csv);
    expect(r.trades.length).toBe(2);
    expect(r.valid).toBe(2);
    expect(r.errors).toBe(0);
  });

  it('reports errors for invalid rows', () => {
    const csv = 'Date,Symbol,PnL\n2025-01-01,BTC,100\nnot-a-date,ETH,200\n2025-01-03,SOL,N/A';
    const r = importCSV(csv);
    expect(r.trades.length).toBe(1); // only first row valid
    expect(r.errors).toBe(2);
  });

  it('detects missing required columns', () => {
    const csv = 'Name,Amount\nJohn,100';
    const r = importCSV(csv);
    expect(r.trades.length).toBe(0);
    expect(r.issues[0]).toContain('Required columns not found');
  });

  it('handles empty CSV', () => {
    const r = importCSV('');
    expect(r.trades.length).toBe(0);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  it('header-only CSV returns 0 trades', () => {
    const r = importCSV('Date,Symbol,PnL');
    expect(r.trades.length).toBe(0);
    expect(r.valid).toBe(0);
  });

  it('detects duplicates against existing trades', () => {
    const existing = [
      { date: '2025-01-01T00:00:00.000Z', symbol: 'BTC', pnl: 100 },
    ];
    const csv = 'Date,Symbol,PnL\n2025-01-01,BTC,100\n2025-01-02,ETH,200';
    const r = importCSV(csv, existing);
    expect(r.duplicates).toBe(1);
    expect(r.trades.length).toBe(1); // only ETH imported
  });

  it('detects duplicates within the CSV itself', () => {
    const csv = 'Date,Symbol,PnL\n2025-01-01,BTC,100\n2025-01-01,BTC,100';
    const r = importCSV(csv);
    expect(r.duplicates).toBe(1);
    expect(r.trades.length).toBe(1);
  });

  it('handles currency-formatted P&L', () => {
    const csv = 'Date,Symbol,Profit\n2025-01-01,BTC,"$1,234.56"';
    const r = importCSV(csv);
    expect(r.trades.length).toBe(1);
    expect(r.trades[0].pnl).toBe(1234.56);
  });

  it('handles tab-delimited files', () => {
    const csv = 'Date\tSymbol\tPnL\n2025-01-01\tBTC\t100';
    const r = importCSV(csv);
    expect(r.trades.length).toBe(1);
  });

  it('returns headers for debugging', () => {
    const csv = 'Date,Symbol,PnL\n2025-01-01,BTC,100';
    const r = importCSV(csv);
    expect(r.headers).toEqual(['Date', 'Symbol', 'PnL']);
  });
});

// ─── exportCSV ──────────────────────────────────────────────────
describe('exportCSV', () => {
  it('produces valid CSV with headers', () => {
    const trades = [{
      date: '2025-01-15', symbol: 'BTC', side: 'long', quantity: 1,
      entryPrice: 45000, pnl: 500, fees: 10, rMultiple: 2,
      emotion: 'calm', tags: ['scalp', 'breakout'],
    }];
    const csv = exportCSV(trades);
    expect(csv.startsWith('Date,Symbol,Side')).toBe(true);
    expect(csv).toContain('BTC');
    expect(csv).toContain('500');
    expect(csv).toContain('scalp;breakout');
  });

  it('handles empty trades', () => {
    const csv = exportCSV([]);
    expect(csv.startsWith('Date,Symbol,Side')).toBe(true);
  });
});
