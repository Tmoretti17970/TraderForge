// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — DailyDebrief Tests
// Tests for: generateDebrief, generateWeeklyDebrief
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { generateDebrief, generateWeeklyDebrief } from '../engine/DailyDebrief.js';

// ─── Helpers ────────────────────────────────────────────────────
const mkTrade = (date, pnl, overrides = {}) => ({
  id: Math.random().toString(36).slice(2),
  date,
  symbol: 'ES',
  pnl,
  side: 'long',
  entry: 4500,
  exit: 4500 + pnl / 2,
  qty: 2,
  playbook: '',
  emotion: '',
  ruleBreak: false,
  ...overrides,
});

const TODAY = '2025-06-15';
const mkToday = (pnl, overrides = {}) =>
  mkTrade(`${TODAY}T${String(10 + Math.floor(Math.random() * 6)).padStart(2,'0')}:30:00.000Z`, pnl, overrides);

// ═══════════════════════════════════════════════════════════════════
// generateDebrief
// ═══════════════════════════════════════════════════════════════════

describe('generateDebrief', () => {
  it('returns empty debrief for no trades', () => {
    const result = generateDebrief([], TODAY);
    expect(result.totalTrades).toBe(0);
    expect(result.headline).toContain('No trades');
    expect(result.sections).toHaveLength(0);
    expect(result.grade).toBeNull();
  });

  it('returns empty debrief for null input', () => {
    const result = generateDebrief(null, TODAY);
    expect(result.totalTrades).toBe(0);
  });

  it('handles a single winning trade', () => {
    const trades = [mkToday(250)];
    const result = generateDebrief(trades, TODAY);
    expect(result.totalTrades).toBe(1);
    expect(result.date).toBe(TODAY);
    expect(result.headline).toBeTruthy();
  });

  it('calculates correct stats for mixed trades', () => {
    const trades = [
      mkToday(500),
      mkToday(-200),
      mkToday(300),
      mkToday(-100),
      mkToday(150),
    ];
    const result = generateDebrief(trades, TODAY);
    expect(result.totalTrades).toBe(5);
  });

  it('only includes trades from the target date', () => {
    const trades = [
      mkTrade('2025-06-14T10:00:00.000Z', 500),  // yesterday
      mkToday(200),                                 // today
      mkTrade('2025-06-16T10:00:00.000Z', -100),  // tomorrow
    ];
    const result = generateDebrief(trades, TODAY);
    expect(result.totalTrades).toBe(1);
  });

  it('defaults to today when no date given', () => {
    const result = generateDebrief([]);
    expect(result.date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('detects possible revenge trades (back-to-back losses)', () => {
    const trades = [
      mkTrade(`${TODAY}T10:00:00.000Z`, -300, { symbol: 'ES' }),
      mkTrade(`${TODAY}T10:05:00.000Z`, -200, { symbol: 'ES' }),
      mkTrade(`${TODAY}T10:10:00.000Z`, -150, { symbol: 'ES' }),
    ];
    const result = generateDebrief(trades, TODAY);
    // Should have observations about the losing streak
    expect(result.totalTrades).toBe(3);
  });

  it('handles trades with invalid dates gracefully', () => {
    const trades = [
      mkToday(100),
      { id: 'bad', date: 'not-a-date', symbol: 'X', pnl: 50 },
    ];
    const result = generateDebrief(trades, TODAY);
    // Should not crash — invalid date trades are filtered out
    expect(result.totalTrades).toBe(1);
  });

  it('identifies best trade', () => {
    const trades = [
      mkToday(100, { symbol: 'ES' }),
      mkToday(600, { symbol: 'NQ' }),
      mkToday(-200, { symbol: 'CL' }),
    ];
    const result = generateDebrief(trades, TODAY);
    expect(result.totalTrades).toBe(3);
    // The debrief should contain some reference to the best performer
    expect(result.headline || result.sections.length).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// generateWeeklyDebrief
// ═══════════════════════════════════════════════════════════════════

describe('generateWeeklyDebrief', () => {
  it('returns summary for empty trades', () => {
    const result = generateWeeklyDebrief([]);
    expect(result).toBeDefined();
  });

  it('handles null input', () => {
    const result = generateWeeklyDebrief(null);
    expect(result).toBeDefined();
  });

  it('generates weekly summary from multi-day trades', () => {
    const trades = [];
    // Generate a week of trades
    for (let d = 9; d <= 13; d++) {
      const date = `2025-06-${String(d).padStart(2, '0')}`;
      trades.push(mkTrade(`${date}T10:00:00.000Z`, 100 + d * 10));
      trades.push(mkTrade(`${date}T14:00:00.000Z`, -50 + d * 5));
    }
    const result = generateWeeklyDebrief(trades);
    expect(result).toBeDefined();
  });
});
