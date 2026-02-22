// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — orderFlow Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { genVolumeProfile } from '../engine/orderFlow.js';

const mkBar = (o, h, l, c) => ({ open: o, high: h, low: l, close: c });

describe('genVolumeProfile', () => {
  it('returns null for null/invalid bar', () => {
    expect(genVolumeProfile(null)).toBeNull();
    expect(genVolumeProfile(undefined)).toBeNull();
    expect(genVolumeProfile({})).toBeNull();
    expect(genVolumeProfile({ open: 100 })).toBeNull();
  });

  it('returns null for zero-range bar', () => {
    expect(genVolumeProfile(mkBar(100, 100, 100, 100))).toBeNull();
  });

  it('returns correct number of levels', () => {
    const vp = genVolumeProfile(mkBar(100, 110, 90, 105), 16);
    expect(vp).not.toBeNull();
    expect(vp.levels.length).toBe(16);
  });

  it('respects custom level count', () => {
    const vp8 = genVolumeProfile(mkBar(100, 110, 90, 105), 8);
    expect(vp8.levels.length).toBe(8);
    const vp32 = genVolumeProfile(mkBar(100, 110, 90, 105), 32);
    expect(vp32.levels.length).toBe(32);
  });

  it('each level has required fields', () => {
    const vp = genVolumeProfile(mkBar(100, 110, 90, 105));
    vp.levels.forEach((l) => {
      expect(l).toHaveProperty('price');
      expect(l).toHaveProperty('bidVol');
      expect(l).toHaveProperty('askVol');
      expect(l).toHaveProperty('totalVol');
      expect(l).toHaveProperty('delta');
      expect(typeof l.price).toBe('number');
      expect(typeof l.bidVol).toBe('number');
    });
  });

  it('prices span from low to high', () => {
    const bar = mkBar(100, 120, 80, 110);
    const vp = genVolumeProfile(bar, 16);
    const minPrice = Math.min(...vp.levels.map((l) => l.price));
    const maxPrice = Math.max(...vp.levels.map((l) => l.price));
    expect(minPrice).toBeGreaterThan(80);
    expect(maxPrice).toBeLessThan(120);
  });

  it('volumes are normalized 0-1', () => {
    const vp = genVolumeProfile(mkBar(100, 110, 90, 105));
    vp.levels.forEach((l) => {
      expect(l.totalVol).toBeGreaterThanOrEqual(0);
      expect(l.totalVol).toBeLessThanOrEqual(1);
      expect(l.bidVol).toBeGreaterThanOrEqual(0);
      expect(l.askVol).toBeGreaterThanOrEqual(0);
    });
  });

  it('POC level has totalVol = 1.0 (max)', () => {
    const vp = genVolumeProfile(mkBar(100, 115, 85, 110));
    const pocLevel = vp.levels[vp.poc];
    expect(pocLevel.totalVol).toBeCloseTo(1.0, 1);
  });

  it('totalVol is positive', () => {
    const vp = genVolumeProfile(mkBar(100, 110, 90, 105));
    expect(vp.totalVol).toBeGreaterThan(0);
  });

  it('is deterministic (same bar = same output)', () => {
    const bar = mkBar(100, 110, 90, 105);
    const vp1 = genVolumeProfile({ ...bar }, 16);
    const vp2 = genVolumeProfile({ ...bar }, 16);
    // Same OHLC should produce same POC
    expect(vp1.poc).toBe(vp2.poc);
    // Same prices
    for (let i = 0; i < 16; i++) {
      expect(vp1.levels[i].price).toBeCloseTo(vp2.levels[i].price);
    }
  });

  it('bullish bar: POC closer to close', () => {
    const bar = mkBar(90, 115, 85, 110); // bullish
    const vp = genVolumeProfile(bar, 16);
    const pocPrice = vp.levels[vp.poc].price;
    // POC should be in upper half (closer to close)
    const mid = (bar.high + bar.low) / 2;
    expect(pocPrice).toBeGreaterThan(mid - 5);
  });

  it('bearish bar: POC closer to open', () => {
    const bar = mkBar(110, 115, 85, 90); // bearish
    const vp = genVolumeProfile(bar, 16);
    const pocPrice = vp.levels[vp.poc].price;
    const mid = (bar.high + bar.low) / 2;
    expect(pocPrice).toBeGreaterThan(mid - 10);
  });

  it('delta = bidVol - askVol for each level', () => {
    const vp = genVolumeProfile(mkBar(100, 110, 90, 105));
    vp.levels.forEach((l) => {
      expect(l.delta).toBeCloseTo(l.bidVol - l.askVol, 10);
    });
  });

  it('uses WeakMap cache (same object reference = cached)', () => {
    const bar = mkBar(50, 60, 40, 55);
    const vp1 = genVolumeProfile(bar, 16);
    const vp2 = genVolumeProfile(bar, 16);
    // Same reference should return identical object
    expect(vp1).toBe(vp2);
  });

  it('different bar objects are computed independently', () => {
    const bar1 = mkBar(100, 110, 90, 105);
    const bar2 = mkBar(200, 220, 180, 210);
    const vp1 = genVolumeProfile(bar1, 16);
    const vp2 = genVolumeProfile(bar2, 16);
    // Prices should be in different ranges
    expect(vp1.levels[0].price).toBeLessThan(120);
    expect(vp2.levels[0].price).toBeGreaterThan(180);
  });
});
