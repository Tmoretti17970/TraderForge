// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — demoData Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { genDemoData, genRandomTrades, uid, isoAt } from '../data/demoData.js';

// ═══ uid ════════════════════════════════════════════════════════
describe('uid', () => {
  it('returns a string', () => {
    expect(typeof uid()).toBe('string');
  });

  it('starts with tf_', () => {
    expect(uid().startsWith('tf_')).toBe(true);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => uid()));
    expect(ids.size).toBe(100);
  });
});

// ═══ isoAt ══════════════════════════════════════════════════════
describe('isoAt', () => {
  it('returns ISO string', () => {
    const result = isoAt(0, 10, 30);
    expect(result).toContain('T');
    expect(result).toContain('Z');
    expect(new Date(result).toISOString()).toBe(result);
  });

  it('days ago shifts the date', () => {
    const today = isoAt(0, 12, 0);
    const yesterday = isoAt(1, 12, 0);
    const todayDate = new Date(today);
    const yestDate = new Date(yesterday);
    const diff = todayDate - yestDate;
    expect(diff).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(diff).toBeLessThan(25 * 60 * 60 * 1000);
  });

  it('sets correct hour', () => {
    const result = isoAt(0, 14, 45);
    const d = new Date(result);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(45);
  });
});

// ═══ genDemoData ════════════════════════════════════════════════
describe('genDemoData', () => {
  it('returns trades and playbooks', () => {
    const { trades, playbooks } = genDemoData();
    expect(Array.isArray(trades)).toBe(true);
    expect(Array.isArray(playbooks)).toBe(true);
    expect(trades.length).toBeGreaterThan(0);
    expect(playbooks.length).toBeGreaterThan(0);
  });

  it('trades have required fields', () => {
    const { trades } = genDemoData();
    trades.forEach((t) => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('date');
      expect(t).toHaveProperty('symbol');
      expect(t).toHaveProperty('side');
      expect(t).toHaveProperty('pnl');
      expect(typeof t.pnl).toBe('number');
      expect(typeof t.date).toBe('string');
    });
  });

  it('trades have valid dates', () => {
    const { trades } = genDemoData();
    trades.forEach((t) => {
      const d = new Date(t.date);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  it('trades have mix of winners and losers', () => {
    const { trades } = genDemoData();
    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl < 0);
    expect(wins.length).toBeGreaterThan(0);
    expect(losses.length).toBeGreaterThan(0);
  });

  it('trades have mix of sides', () => {
    const { trades } = genDemoData();
    const longs = trades.filter((t) => t.side === 'long');
    const shorts = trades.filter((t) => t.side === 'short');
    expect(longs.length).toBeGreaterThan(0);
    expect(shorts.length).toBeGreaterThan(0);
  });

  it('trades have multiple symbols', () => {
    const { trades } = genDemoData();
    const symbols = new Set(trades.map((t) => t.symbol));
    expect(symbols.size).toBeGreaterThan(3);
  });

  it('playbooks have id, name, rules', () => {
    const { playbooks } = genDemoData();
    playbooks.forEach((pb) => {
      expect(pb).toHaveProperty('id');
      expect(pb).toHaveProperty('name');
      expect(pb).toHaveProperty('rules');
      expect(Array.isArray(pb.rules)).toBe(true);
      expect(pb.rules.length).toBeGreaterThan(0);
    });
  });

  it('trade IDs are unique', () => {
    const { trades } = genDemoData();
    const ids = new Set(trades.map((t) => t.id));
    expect(ids.size).toBe(trades.length);
  });

  it('some trades have rMultiple', () => {
    const { trades } = genDemoData();
    const withR = trades.filter((t) => t.rMultiple != null);
    expect(withR.length).toBeGreaterThan(0);
  });

  it('some trades have emotions', () => {
    const { trades } = genDemoData();
    const withEmo = trades.filter((t) => t.emotion);
    expect(withEmo.length).toBeGreaterThan(0);
  });
});

// ═══ genRandomTrades ════════════════════════════════════════════
describe('genRandomTrades', () => {
  it('generates N trades', () => {
    const trades = genRandomTrades(50);
    expect(trades.length).toBe(50);
  });

  it('generates 0 trades for n=0', () => {
    expect(genRandomTrades(0).length).toBe(0);
  });

  it('each trade has required fields', () => {
    const trades = genRandomTrades(10);
    trades.forEach((t) => {
      expect(t).toHaveProperty('id');
      expect(t).toHaveProperty('date');
      expect(t).toHaveProperty('symbol');
      expect(t).toHaveProperty('side');
      expect(t).toHaveProperty('pnl');
      expect(typeof t.pnl).toBe('number');
    });
  });

  it('uses custom symbol pool', () => {
    const trades = genRandomTrades(20, { symbols: ['XYZ', 'ABC'] });
    const symbols = new Set(trades.map((t) => t.symbol));
    symbols.forEach((s) => {
      expect(['XYZ', 'ABC']).toContain(s);
    });
  });

  it('respects maxPnl range', () => {
    const trades = genRandomTrades(100, { maxPnl: 500 });
    trades.forEach((t) => {
      expect(Math.abs(t.pnl)).toBeLessThan(2000); // max is maxPnl * 2 * random spread
    });
  });

  it('has unique IDs', () => {
    const trades = genRandomTrades(100);
    const ids = new Set(trades.map((t) => t.id));
    expect(ids.size).toBe(100);
  });

  it('has valid dates', () => {
    const trades = genRandomTrades(20);
    trades.forEach((t) => {
      const d = new Date(t.date);
      expect(isNaN(d.getTime())).toBe(false);
    });
  });

  it('has mix of sides', () => {
    const trades = genRandomTrades(100);
    const sides = new Set(trades.map((t) => t.side));
    expect(sides.has('long')).toBe(true);
    expect(sides.has('short')).toBe(true);
  });
});
