// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — RiskPresets Tests
// Tests for: calcPositionSize, calcKelly, validateTradeRisk, presets
// Sprint 11: Testing Suite
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PRESETS,
  DEFAULT_RISK_PARAMS,
  calcPositionSize,
  calcKelly,
  validateTradeRisk,
  getPreset,
  listPresets,
} from '../engine/RiskPresets.js';

// ═══════════════════════════════════════════════════════════════════
// calcPositionSize
// ═══════════════════════════════════════════════════════════════════

describe('calcPositionSize', () => {
  it('calculates correct position size for 1% risk', () => {
    const result = calcPositionSize({
      accountSize: 100000,
      riskPct: 1.0,
      stopDistance: 10,
      tickValue: 1,
      tickSize: 1,
    });
    // 1% of 100k = $1000 risk, 10 ticks * $1/tick = $10/contract
    // 1000 / 10 = 100 contracts
    expect(result.contracts).toBe(100);
    expect(result.riskDollars).toBe(1000);
    expect(result.riskPct).toBeCloseTo(1.0, 1);
  });

  it('uses fixed dollar risk when riskDollar > 0', () => {
    const result = calcPositionSize({
      accountSize: 100000,
      riskPct: 1.0,       // ignored because riskDollar is set
      riskDollar: 500,
      stopDistance: 10,
      tickValue: 1,
      tickSize: 1,
    });
    // $500 / ($10/contract) = 50 contracts
    expect(result.contracts).toBe(50);
    expect(result.riskDollars).toBe(500);
  });

  it('handles ES futures (tickValue=12.50, tickSize=0.25)', () => {
    const result = calcPositionSize({
      accountSize: 50000,
      riskPct: 2.0,
      stopDistance: 5,       // 5 points
      tickValue: 12.50,
      tickSize: 0.25,
    });
    // 2% of 50k = $1000 risk
    // 5 points / 0.25 ticks = 20 ticks, 20 * $12.50 = $250/contract
    // 1000 / 250 = 4 contracts
    expect(result.contracts).toBe(4);
    expect(result.riskDollars).toBe(1000);
  });

  it('enforces maxContracts cap', () => {
    const result = calcPositionSize({
      accountSize: 1000000,
      riskPct: 5.0,
      stopDistance: 1,
      tickValue: 1,
      tickSize: 1,
      maxContracts: 10,
    });
    expect(result.contracts).toBe(10);
  });

  it('returns zero for zero account size', () => {
    const result = calcPositionSize({
      accountSize: 0,
      riskPct: 1.0,
      stopDistance: 10,
    });
    expect(result.contracts).toBe(0);
    expect(result.riskDollars).toBe(0);
  });

  it('returns zero for zero stop distance', () => {
    const result = calcPositionSize({
      accountSize: 100000,
      riskPct: 1.0,
      stopDistance: 0,
    });
    expect(result.contracts).toBe(0);
  });

  it('returns zero for negative account size', () => {
    const result = calcPositionSize({
      accountSize: -5000,
      riskPct: 1.0,
      stopDistance: 10,
    });
    expect(result.contracts).toBe(0);
  });

  it('floors contracts to whole number', () => {
    const result = calcPositionSize({
      accountSize: 10000,
      riskPct: 1.0,
      stopDistance: 7,    // $100 / $7 = 14.28 → 14
      tickValue: 1,
      tickSize: 1,
    });
    expect(result.contracts).toBe(14);
    expect(Number.isInteger(result.contracts)).toBe(true);
  });

  it('recalculates actual risk after flooring', () => {
    const result = calcPositionSize({
      accountSize: 10000,
      riskPct: 1.0,
      stopDistance: 7,
      tickValue: 1,
      tickSize: 1,
    });
    // 14 contracts * $7 = $98 actual risk, not $100
    expect(result.riskDollars).toBe(98);
    expect(result.riskPct).toBeCloseTo(0.98, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// calcKelly
// ═══════════════════════════════════════════════════════════════════

describe('calcKelly', () => {
  it('calculates correct half-Kelly for typical stats', () => {
    const result = calcKelly({
      winRate: 0.55,
      avgWin: 200,
      avgLoss: 100,
      fraction: 0.5,
      accountSize: 100000,
    });
    // b = 200/100 = 2, p = 0.55, q = 0.45
    // fullKelly = (2*0.55 - 0.45) / 2 = (1.10 - 0.45) / 2 = 0.325
    // halfKelly = 0.325 * 0.5 = 0.1625 → 16.25%
    expect(result.fullKellyPct).toBeCloseTo(32.5, 0);
    expect(result.kellyPct).toBeCloseTo(16.25, 0);
    expect(result.riskDollars).toBeCloseTo(16250, -1);
  });

  it('returns zero for zero win rate', () => {
    const result = calcKelly({
      winRate: 0,
      avgWin: 200,
      avgLoss: 100,
      accountSize: 100000,
    });
    expect(result.kellyPct).toBe(0);
    expect(result.riskDollars).toBe(0);
  });

  it('returns zero for win rate of 1.0', () => {
    const result = calcKelly({
      winRate: 1.0,
      avgWin: 200,
      avgLoss: 100,
      accountSize: 100000,
    });
    expect(result.kellyPct).toBe(0);
  });

  it('returns zero when avgLoss is zero', () => {
    const result = calcKelly({
      winRate: 0.5,
      avgWin: 200,
      avgLoss: 0,
      accountSize: 100000,
    });
    expect(result.kellyPct).toBe(0);
  });

  it('clamps negative Kelly to zero (losing edge)', () => {
    const result = calcKelly({
      winRate: 0.2,    // low win rate
      avgWin: 100,
      avgLoss: 200,    // bigger losses than wins
      fraction: 1.0,
      accountSize: 100000,
    });
    // b = 0.5, fullKelly = (0.5*0.2 - 0.8) / 0.5 = (0.1 - 0.8)/0.5 = -1.4 → clamped to 0
    expect(result.kellyPct).toBe(0);
    expect(result.fullKellyPct).toBe(0);
    expect(result.riskDollars).toBe(0);
  });

  it('respects quarter-Kelly fraction', () => {
    const full = calcKelly({
      winRate: 0.55,
      avgWin: 200,
      avgLoss: 100,
      fraction: 1.0,
      accountSize: 100000,
    });
    const quarter = calcKelly({
      winRate: 0.55,
      avgWin: 200,
      avgLoss: 100,
      fraction: 0.25,
      accountSize: 100000,
    });
    expect(quarter.kellyPct).toBeCloseTo(full.kellyPct * 0.25, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// validateTradeRisk
// ═══════════════════════════════════════════════════════════════════

describe('validateTradeRisk', () => {
  const params = {
    maxDailyTrades: 10,
    maxOpenPositions: 3,
    dailyLossLimit: 1000,
  };

  it('allows trade when all limits clear', () => {
    const { allowed, warnings } = validateTradeRisk({}, params, {
      todayCount: 5,
      openPositions: 1,
      todayPnl: 200,
    });
    expect(allowed).toBe(true);
    expect(warnings).toHaveLength(0);
  });

  it('blocks when max daily trades reached', () => {
    const { allowed, warnings } = validateTradeRisk({}, params, {
      todayCount: 10,
    });
    expect(allowed).toBe(false);
    expect(warnings[0]).toMatch(/Max daily trades/);
  });

  it('blocks when max open positions reached', () => {
    const { allowed, warnings } = validateTradeRisk({}, params, {
      openPositions: 3,
    });
    expect(allowed).toBe(false);
    expect(warnings[0]).toMatch(/Max open positions/);
  });

  it('blocks when daily loss limit breached', () => {
    const { allowed, warnings } = validateTradeRisk({}, params, {
      todayPnl: -1200,
    });
    expect(allowed).toBe(false);
    expect(warnings[0]).toMatch(/Daily loss limit/);
  });

  it('collects multiple warnings at once', () => {
    const { allowed, warnings } = validateTradeRisk({}, params, {
      todayCount: 10,
      openPositions: 3,
      todayPnl: -1500,
    });
    expect(allowed).toBe(false);
    expect(warnings).toHaveLength(3);
  });

  it('ignores limits set to 0 (unlimited)', () => {
    const unlimitedParams = {
      maxDailyTrades: 0,
      maxOpenPositions: 0,
      dailyLossLimit: 0,
    };
    const { allowed } = validateTradeRisk({}, unlimitedParams, {
      todayCount: 999,
      openPositions: 50,
      todayPnl: -999999,
    });
    expect(allowed).toBe(true);
  });

  it('handles missing context gracefully', () => {
    const { allowed } = validateTradeRisk({}, params, {});
    expect(allowed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Preset Management
// ═══════════════════════════════════════════════════════════════════

describe('Presets', () => {
  it('has 4 built-in presets', () => {
    expect(BUILT_IN_PRESETS).toHaveLength(4);
  });

  it('getPreset returns correct preset by ID', () => {
    const aggressive = getPreset('aggressive');
    expect(aggressive).not.toBeNull();
    expect(aggressive.name).toBe('Aggressive');
    expect(aggressive.params.riskPerTradePct).toBe(2.0);
  });

  it('getPreset returns null for unknown ID', () => {
    expect(getPreset('nonexistent')).toBeNull();
  });

  it('listPresets returns a copy (not the original)', () => {
    const list = listPresets();
    expect(list).toHaveLength(4);
    list.push({ id: 'fake' });
    expect(BUILT_IN_PRESETS).toHaveLength(4);
  });

  it('all presets have required fields', () => {
    for (const p of BUILT_IN_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.params.riskPerTradePct).toBeGreaterThan(0);
      expect(p.params.positionSizing).toBeTruthy();
    }
  });

  it('DEFAULT_RISK_PARAMS has all expected keys', () => {
    const keys = ['riskPerTradePct', 'riskPerTradeDollar', 'dailyLossLimit',
      'maxDailyTrades', 'maxOpenPositions', 'riskFreeRate', 'positionSizing', 'kellyFraction'];
    for (const k of keys) {
      expect(k in DEFAULT_RISK_PARAMS).toBe(true);
    }
  });
});
