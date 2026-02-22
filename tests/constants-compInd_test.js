// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Constants & compInd Tests
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  C, F, M, TFS, CRYPTO_IDS, isCrypto, IND_CAT, ICATS,
  CHART_TYPES, EMOJIS, DEFAULT_SETTINGS, OV_COLORS,
} from '../constants.js';
import { compInd, computeIndicators } from '../engine/compInd.js';

// ═══ Constants ══════════════════════════════════════════════════
describe('Constants', () => {
  it('C has required color keys', () => {
    const required = ['bg', 'bg2', 'sf', 'bd', 't1', 't2', 't3', 'b', 'g', 'r', 'y', 'bullish', 'bearish'];
    required.forEach((k) => {
      expect(typeof C[k]).toBe('string');
      expect(C[k].startsWith('#')).toBe(true);
    });
  });

  it('F and M are font strings', () => {
    expect(F).toContain('Outfit');
    expect(M).toContain('Mono');
  });

  it('TFS has 6 timeframes with required fields', () => {
    expect(TFS.length).toBe(6);
    TFS.forEach((tf) => {
      expect(tf).toHaveProperty('id');
      expect(tf).toHaveProperty('label');
      expect(tf).toHaveProperty('cgDays');
      expect(tf).toHaveProperty('yhInt');
      expect(tf).toHaveProperty('fb');
      expect(typeof tf.fb).toBe('number');
    });
  });

  it('CRYPTO_IDS maps common tickers', () => {
    expect(CRYPTO_IDS.BTC).toBe('bitcoin');
    expect(CRYPTO_IDS.ETH).toBe('ethereum');
    expect(CRYPTO_IDS.SOL).toBe('solana');
  });

  it('isCrypto identifies crypto symbols', () => {
    expect(isCrypto('BTC')).toBe(true);
    expect(isCrypto('btc')).toBe(true);
    expect(isCrypto('AAPL')).toBe(false);
    expect(isCrypto('')).toBe(false);
    expect(isCrypto(null)).toBe(false);
  });

  it('IND_CAT has 9 indicators', () => {
    expect(IND_CAT.length).toBe(9);
    const ids = IND_CAT.map((i) => i.id);
    expect(ids).toContain('sma');
    expect(ids).toContain('rsi');
    expect(ids).toContain('macd');
    expect(ids).toContain('atr');
  });

  it('IND_CAT entries have required fields', () => {
    IND_CAT.forEach((ind) => {
      expect(ind).toHaveProperty('id');
      expect(ind).toHaveProperty('name');
      expect(ind).toHaveProperty('cat');
      expect(ind).toHaveProperty('pane');
      expect(Array.isArray(ind.params)).toBe(true);
    });
  });

  it('ICATS has filter categories', () => {
    expect(ICATS.length).toBe(4);
    expect(ICATS[0].id).toBe('all');
  });

  it('CHART_TYPES has 6 types', () => {
    expect(CHART_TYPES.length).toBe(6);
    const ids = CHART_TYPES.map((ct) => ct.id);
    expect(ids).toContain('candles');
    expect(ids).toContain('line');
    expect(ids).toContain('ohlc');
  });

  it('EMOJIS has entries with e and l', () => {
    expect(EMOJIS.length).toBeGreaterThan(0);
    EMOJIS.forEach((em) => {
      expect(typeof em.e).toBe('string');
      expect(typeof em.l).toBe('string');
    });
  });

  it('DEFAULT_SETTINGS has required keys', () => {
    expect(DEFAULT_SETTINGS).toHaveProperty('dailyLossLimit');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultSymbol');
    expect(DEFAULT_SETTINGS).toHaveProperty('defaultTf');
    expect(DEFAULT_SETTINGS.dailyLossLimit).toBe(0);
  });

  it('OV_COLORS has at least 6 colors', () => {
    expect(OV_COLORS.length).toBeGreaterThanOrEqual(6);
    OV_COLORS.forEach((c) => expect(typeof c).toBe('string'));
  });
});

// ═══ compInd ════════════════════════════════════════════════════
const mkBars = (n = 30) =>
  Array.from({ length: n }, (_, i) => ({
    time: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    open: 100 + Math.sin(i * 0.3) * 10,
    high: 100 + Math.sin(i * 0.3) * 10 + 5,
    low: 100 + Math.sin(i * 0.3) * 10 - 5,
    close: 100 + Math.cos(i * 0.3) * 10,
    volume: 1000 + i * 100,
  }));

describe('compInd', () => {
  const bars = mkBars(50);

  it('computes SMA', () => {
    const r = compInd({ type: 'sma', params: { period: 10 } }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
    expect(r.data[0]).toBeNull();
    expect(r.data[9]).not.toBeNull();
  });

  it('computes EMA', () => {
    const r = compInd({ type: 'ema', params: { period: 10 } }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
  });

  it('computes WMA', () => {
    const r = compInd({ type: 'wma', params: { period: 10 } }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
  });

  it('computes Bollinger Bands', () => {
    const r = compInd({ type: 'bollinger', params: { period: 20, multiplier: 2 } }, bars);
    expect(r.type).toBe('bollinger');
    expect(r.data.length).toBe(bars.length);
    const valid = r.data.find((d) => d && d.middle !== null);
    expect(valid).toBeDefined();
    expect(valid.upper).toBeGreaterThanOrEqual(valid.middle);
    expect(valid.lower).toBeLessThanOrEqual(valid.middle);
  });

  it('computes VWAP', () => {
    const r = compInd({ type: 'vwap', params: {} }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
  });

  it('computes RSI', () => {
    const r = compInd({ type: 'rsi', params: { period: 14 } }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
    const vals = r.data.filter((v) => v !== null);
    vals.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('computes MACD', () => {
    const r = compInd({ type: 'macd', params: { fast: 12, slow: 26, signal: 9 } }, bars);
    expect(r.type).toBe('macd');
    expect(r.data.length).toBe(bars.length);
    const valid = r.data.find((d) => d && d.macd !== null);
    expect(valid).toBeDefined();
    expect(valid).toHaveProperty('macd');
    expect(valid).toHaveProperty('signal');
    expect(valid).toHaveProperty('histogram');
  });

  it('computes Stochastic', () => {
    const r = compInd({ type: 'stochastic', params: { kPeriod: 14, dPeriod: 3 } }, bars);
    expect(r.type).toBe('stochastic');
    expect(r.data.length).toBe(bars.length);
  });

  it('computes ATR', () => {
    const r = compInd({ type: 'atr', params: { period: 14 } }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
    const vals = r.data.filter((v) => v !== null);
    vals.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('unknown type returns null array', () => {
    const r = compInd({ type: 'unknown_indicator' }, bars);
    expect(r.type).toBe('line');
    expect(r.data.every((v) => v === null)).toBe(true);
  });

  it('uses default params when none provided', () => {
    const r = compInd({ type: 'sma' }, bars);
    expect(r.type).toBe('line');
    expect(r.data.length).toBe(bars.length);
    expect(r.data[18]).toBeNull();
    expect(r.data[19]).not.toBeNull();
  });
});

describe('computeIndicators', () => {
  const bars = mkBars(50);

  it('computes multiple indicators at once', () => {
    const indicators = [
      { type: 'sma', params: { period: 10 } },
      { type: 'rsi', params: { period: 14 } },
    ];
    const results = computeIndicators(indicators, bars);
    expect(results.length).toBe(2);
    expect(results[0].type).toBe('sma');
    expect(results[0].result.type).toBe('line');
    expect(results[1].type).toBe('rsi');
    expect(results[1].result.type).toBe('line');
  });

  it('returns empty for no data', () => {
    expect(computeIndicators([{ type: 'sma' }], null)).toEqual([]);
    expect(computeIndicators([{ type: 'sma' }], [])).toEqual([]);
  });

  it('returns empty for no indicators', () => {
    expect(computeIndicators(null, bars)).toEqual([]);
    expect(computeIndicators([], bars)).toEqual([]);
  });

  it('preserves original indicator config in output', () => {
    const indicators = [
      { type: 'ema', params: { period: 21 }, color: '#ff0000', id: 'custom' },
    ];
    const results = computeIndicators(indicators, bars);
    expect(results[0].color).toBe('#ff0000');
    expect(results[0].id).toBe('custom');
    expect(results[0].params.period).toBe(21);
  });
});
