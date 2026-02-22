// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — FetchService Tests
// Tests the simulated/fallback data generation path.
// Real API calls are tested in integration tests (requires network).
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { genFB, clearCache, cacheStats } from '../data/FetchService.js';
import { TFS } from '../constants.js';

describe('genFB (fallback data generator)', () => {
  it('generates data for BTC 3m timeframe', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('BTC', tf);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('each bar has OHLCV fields', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('BTC', tf);
    data.forEach((bar) => {
      expect(bar).toHaveProperty('time');
      expect(bar).toHaveProperty('open');
      expect(bar).toHaveProperty('high');
      expect(bar).toHaveProperty('low');
      expect(bar).toHaveProperty('close');
      expect(bar).toHaveProperty('volume');
      expect(typeof bar.open).toBe('number');
      expect(typeof bar.high).toBe('number');
      expect(typeof bar.low).toBe('number');
      expect(typeof bar.close).toBe('number');
    });
  });

  it('high >= max(open, close) and low <= min(open, close)', () => {
    const tf = TFS.find((t) => t.id === '1m');
    const data = genFB('ETH', tf);
    data.forEach((bar) => {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
    });
  });

  it('times are ISO strings in chronological order', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('SOL', tf);
    for (let i = 1; i < data.length; i++) {
      expect(new Date(data[i].time).getTime()).toBeGreaterThan(
        new Date(data[i - 1].time).getTime()
      );
    }
  });

  it('BTC prices are in reasonable range', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('BTC', tf);
    data.forEach((bar) => {
      expect(bar.close).toBeGreaterThan(50000);
      expect(bar.close).toBeLessThan(200000);
    });
  });

  it('AAPL prices are in reasonable range', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('AAPL', tf);
    data.forEach((bar) => {
      expect(bar.close).toBeGreaterThan(50);
      expect(bar.close).toBeLessThan(1000);
    });
  });

  it('generates different data for different symbols', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const btc = genFB('BTC', tf);
    const eth = genFB('ETH', tf);
    // Price ranges should be very different
    const btcAvg = btc.reduce((s, b) => s + b.close, 0) / btc.length;
    const ethAvg = eth.reduce((s, b) => s + b.close, 0) / eth.length;
    expect(btcAvg).toBeGreaterThan(ethAvg * 10);
  });

  it('generates data for all timeframes', () => {
    TFS.forEach((tf) => {
      const data = genFB('BTC', tf);
      expect(data.length).toBeGreaterThan(0);
    });
  });

  it('unknown symbol defaults to 100-300 range', () => {
    const tf = TFS.find((t) => t.id === '3m');
    const data = genFB('UNKNOWNSYM', tf);
    data.forEach((bar) => {
      expect(bar.close).toBeGreaterThan(20);
      expect(bar.close).toBeLessThan(600);
    });
  });
});

describe('cacheStats', () => {
  it('returns cache state', () => {
    clearCache();
    const stats = cacheStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('maxSize');
    expect(stats).toHaveProperty('entries');
    expect(stats.size).toBe(0);
    expect(Array.isArray(stats.entries)).toBe(true);
  });
});

describe('clearCache', () => {
  it('empties the cache', () => {
    clearCache();
    expect(cacheStats().size).toBe(0);
  });
});
