// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.3 — Price Action Intelligence Engine
// Sprint 7 C7.1/C7.3/C7.5/C7.9: Pure-function analysis engine.
//
// Modules:
//   1. Support/Resistance level detection (pivot clustering)
//   2. Candlestick pattern recognition (12 patterns)
//   3. Swing high/low detection (for auto-Fib)
//   4. RSI/MACD divergence detection
//
// All functions are pure — no side effects, no state.
// Input: OHLCV array. Output: structured analysis results.
// ═══════════════════════════════════════════════════════════════════

// ─── Helpers ────────────────────────────────────────────────────

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function bodySize(bar) { return Math.abs(bar.close - bar.open); }
function wickUpper(bar) { return bar.high - Math.max(bar.open, bar.close); }
function wickLower(bar) { return Math.min(bar.open, bar.close) - bar.low; }
function range(bar) { return bar.high - bar.low || 0.0001; }
function isBullish(bar) { return bar.close > bar.open; }
function isBearish(bar) { return bar.close < bar.open; }
function midpoint(bar) { return (bar.high + bar.low) / 2; }

// ═══════════════════════════════════════════════════════════════════
// 1. SUPPORT / RESISTANCE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Detect pivot highs and lows using a lookback window.
 * A pivot high is a bar whose high is higher than `strength` bars on each side.
 * @param {Array} data - OHLCV array
 * @param {number} strength - Number of bars on each side to confirm pivot (default 5)
 * @returns {{ pivotHighs: Array, pivotLows: Array }}
 */
export function detectPivots(data, strength = 5) {
  const pivotHighs = [];
  const pivotLows = [];

  for (let i = strength; i < data.length - strength; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= strength; j++) {
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) isHigh = false;
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) pivotHighs.push({ idx: i, price: data[i].high, type: 'high', timestamp: data[i].timestamp || data[i].date });
    if (isLow) pivotLows.push({ idx: i, price: data[i].low, type: 'low', timestamp: data[i].timestamp || data[i].date });
  }

  return { pivotHighs, pivotLows };
}

/**
 * Cluster pivots into S/R zones by grouping nearby prices.
 * @param {Array} pivots - Array of { price, type, idx }
 * @param {number} clusterPct - Percentage tolerance for grouping (default 0.5%)
 * @returns {Array<{ price: number, strength: number, type: string, touches: number, firstIdx: number, lastIdx: number }>}
 */
export function clusterPivots(pivots, clusterPct = 0.005) {
  if (!pivots.length) return [];

  // Sort by price
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const zones = [];
  let cluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = cluster[cluster.length - 1];
    if (Math.abs(sorted[i].price - last.price) / last.price <= clusterPct) {
      cluster.push(sorted[i]);
    } else {
      zones.push(buildZone(cluster));
      cluster = [sorted[i]];
    }
  }
  zones.push(buildZone(cluster));

  return zones.sort((a, b) => b.strength - a.strength);
}

function buildZone(cluster) {
  const prices = cluster.map(c => c.price);
  const avgPrice = avg(prices);
  const types = cluster.map(c => c.type);
  const hasHigh = types.includes('high');
  const hasLow = types.includes('low');

  return {
    price: Math.round(avgPrice * 100) / 100,
    strength: cluster.length,
    type: hasHigh && hasLow ? 'both' : hasHigh ? 'resistance' : 'support',
    touches: cluster.length,
    firstIdx: Math.min(...cluster.map(c => c.idx)),
    lastIdx: Math.max(...cluster.map(c => c.idx)),
    range: {
      low: Math.min(...prices),
      high: Math.max(...prices),
    },
  };
}

/**
 * Full S/R analysis pipeline.
 * @param {Array} data - OHLCV array
 * @param {Object} opts
 * @param {number} opts.strength - Pivot lookback (default 5)
 * @param {number} opts.maxLevels - Maximum levels to return (default 8)
 * @param {number} opts.clusterPct - Grouping tolerance (default 0.5%)
 * @returns {Array} Top S/R levels sorted by strength
 */
export function detectSupportResistance(data, opts = {}) {
  const { strength = 5, maxLevels = 8, clusterPct = 0.005 } = opts;
  if (!data || data.length < strength * 3) return [];

  const { pivotHighs, pivotLows } = detectPivots(data, strength);
  const allPivots = [...pivotHighs, ...pivotLows];
  const zones = clusterPivots(allPivots, clusterPct);

  // Filter: only keep zones with 2+ touches
  const strong = zones.filter(z => z.touches >= 2);

  // Classify relative to current price
  const lastPrice = data[data.length - 1].close;
  return strong.slice(0, maxLevels).map(z => ({
    ...z,
    relation: z.price > lastPrice ? 'above' : z.price < lastPrice ? 'below' : 'at',
    distance: Math.abs(z.price - lastPrice),
    distancePct: Math.round(Math.abs(z.price - lastPrice) / lastPrice * 10000) / 100,
  }));
}

// ═══════════════════════════════════════════════════════════════════
// 2. CANDLESTICK PATTERN RECOGNITION
// ═══════════════════════════════════════════════════════════════════

const PATTERNS = {
  // Single-bar patterns
  doji:           { bars: 1, bias: 'neutral',  label: 'Doji',            icon: '✚' },
  hammer:         { bars: 1, bias: 'bullish',  label: 'Hammer',          icon: '🔨' },
  invHammer:      { bars: 1, bias: 'bullish',  label: 'Inv Hammer',      icon: '⬆' },
  shootingStar:   { bars: 1, bias: 'bearish',  label: 'Shooting Star',   icon: '💫' },
  hangingMan:     { bars: 1, bias: 'bearish',  label: 'Hanging Man',     icon: '🪢' },
  marubozu:       { bars: 1, bias: 'trend',    label: 'Marubozu',        icon: '█' },
  spinningTop:    { bars: 1, bias: 'neutral',  label: 'Spinning Top',    icon: '◈' },

  // Two-bar patterns
  bullEngulf:     { bars: 2, bias: 'bullish',  label: 'Bull Engulfing',  icon: '🟢' },
  bearEngulf:     { bars: 2, bias: 'bearish',  label: 'Bear Engulfing',  icon: '🔴' },
  piercingLine:   { bars: 2, bias: 'bullish',  label: 'Piercing Line',   icon: '📌' },
  darkCloud:      { bars: 2, bias: 'bearish',  label: 'Dark Cloud',      icon: '🌧' },
  tweezerTop:     { bars: 2, bias: 'bearish',  label: 'Tweezer Top',     icon: '⚡' },
  tweezerBottom:  { bars: 2, bias: 'bullish',  label: 'Tweezer Bottom',  icon: '⚡' },

  // Three-bar patterns
  morningStar:    { bars: 3, bias: 'bullish',  label: 'Morning Star',    icon: '⭐' },
  eveningStar:    { bars: 3, bias: 'bearish',  label: 'Evening Star',    icon: '🌙' },
  threeWhite:     { bars: 3, bias: 'bullish',  label: '3 White Soldiers', icon: '🪖' },
  threeBlack:     { bars: 3, bias: 'bearish',  label: '3 Black Crows',   icon: '🐦' },
};

/**
 * Scan OHLCV data for candlestick patterns.
 * @param {Array} data - OHLCV array
 * @param {number} lookback - How many recent bars to scan (default: all)
 * @returns {Array<{ pattern: string, idx: number, bias: string, label: string, icon: string, confidence: number }>}
 */
export function detectCandlestickPatterns(data, lookback = 0) {
  const results = [];
  const start = lookback > 0 ? Math.max(2, data.length - lookback) : 2;
  const avgRange = avg(data.slice(Math.max(0, data.length - 20)).map(range));

  for (let i = start; i < data.length; i++) {
    const c = data[i];           // current
    const p = data[i - 1];       // previous
    const pp = i >= 2 ? data[i - 2] : null; // 2 bars ago

    const body = bodySize(c);
    const rng = range(c);
    const upper = wickUpper(c);
    const lower = wickLower(c);
    const bodyRatio = body / rng;

    // ── Single-bar patterns ────────────────────────────────

    // Doji: very small body relative to range
    if (bodyRatio < 0.1 && rng > avgRange * 0.5) {
      results.push(hit('doji', i, 0.7));
    }

    // Hammer: small body at top, long lower wick (2x+ body), in downtrend context
    if (lower > body * 2 && upper < body * 0.5 && body > 0 && isDownContext(data, i)) {
      results.push(hit('hammer', i, 0.75));
    }

    // Inverted Hammer: small body at bottom, long upper wick, in downtrend
    if (upper > body * 2 && lower < body * 0.5 && body > 0 && isDownContext(data, i)) {
      results.push(hit('invHammer', i, 0.65));
    }

    // Shooting Star: long upper wick, small body at bottom, in uptrend
    if (upper > body * 2 && lower < body * 0.5 && body > 0 && isUpContext(data, i)) {
      results.push(hit('shootingStar', i, 0.75));
    }

    // Hanging Man: long lower wick, in uptrend
    if (lower > body * 2 && upper < body * 0.5 && body > 0 && isUpContext(data, i)) {
      results.push(hit('hangingMan', i, 0.65));
    }

    // Marubozu: very large body, tiny wicks
    if (bodyRatio > 0.85 && rng > avgRange * 1.2) {
      results.push(hit('marubozu', i, 0.6, isBullish(c) ? 'bullish' : 'bearish'));
    }

    // Spinning Top: small body, both wicks larger than body
    if (bodyRatio > 0.15 && bodyRatio < 0.4 && upper > body && lower > body) {
      results.push(hit('spinningTop', i, 0.5));
    }

    // ── Two-bar patterns ───────────────────────────────────

    // Bullish Engulfing
    if (isBearish(p) && isBullish(c) && c.open <= p.close && c.close >= p.open && bodySize(c) > bodySize(p)) {
      results.push(hit('bullEngulf', i, 0.8));
    }

    // Bearish Engulfing
    if (isBullish(p) && isBearish(c) && c.open >= p.close && c.close <= p.open && bodySize(c) > bodySize(p)) {
      results.push(hit('bearEngulf', i, 0.8));
    }

    // Piercing Line: bearish then bullish opening below prev low, closing above 50% of prev body
    if (isBearish(p) && isBullish(c) && c.open < p.low && c.close > (p.open + p.close) / 2) {
      results.push(hit('piercingLine', i, 0.7));
    }

    // Dark Cloud Cover: bullish then bearish opening above prev high, closing below 50%
    if (isBullish(p) && isBearish(c) && c.open > p.high && c.close < (p.open + p.close) / 2) {
      results.push(hit('darkCloud', i, 0.7));
    }

    // Tweezer Top: same highs in uptrend
    if (Math.abs(c.high - p.high) / avgRange < 0.02 && isUpContext(data, i)) {
      results.push(hit('tweezerTop', i, 0.6));
    }

    // Tweezer Bottom: same lows in downtrend
    if (Math.abs(c.low - p.low) / avgRange < 0.02 && isDownContext(data, i)) {
      results.push(hit('tweezerBottom', i, 0.6));
    }

    // ── Three-bar patterns ─────────────────────────────────
    if (!pp) continue;

    // Morning Star: bearish → small body (doji-ish) → bullish
    if (isBearish(pp) && bodySize(p) < bodySize(pp) * 0.3 && isBullish(c) &&
        c.close > (pp.open + pp.close) / 2) {
      results.push(hit('morningStar', i, 0.85));
    }

    // Evening Star: bullish → small body → bearish
    if (isBullish(pp) && bodySize(p) < bodySize(pp) * 0.3 && isBearish(c) &&
        c.close < (pp.open + pp.close) / 2) {
      results.push(hit('eveningStar', i, 0.85));
    }

    // Three White Soldiers: 3 consecutive bullish bars, each closing higher
    if (isBullish(pp) && isBullish(p) && isBullish(c) &&
        p.close > pp.close && c.close > p.close &&
        bodySize(pp) > avgRange * 0.3 && bodySize(p) > avgRange * 0.3 && bodySize(c) > avgRange * 0.3) {
      results.push(hit('threeWhite', i, 0.75));
    }

    // Three Black Crows: 3 consecutive bearish bars
    if (isBearish(pp) && isBearish(p) && isBearish(c) &&
        p.close < pp.close && c.close < p.close &&
        bodySize(pp) > avgRange * 0.3 && bodySize(p) > avgRange * 0.3 && bodySize(c) > avgRange * 0.3) {
      results.push(hit('threeBlack', i, 0.75));
    }
  }

  return results;
}

function hit(patternId, idx, confidence, biasOverride) {
  const meta = PATTERNS[patternId];
  return {
    pattern: patternId,
    idx,
    bias: biasOverride || meta.bias,
    label: meta.label,
    icon: meta.icon,
    confidence,
    bars: meta.bars,
  };
}

// Trend context: check if last 5 bars are mostly up/down
function isUpContext(data, i, lookback = 5) {
  let up = 0;
  for (let j = Math.max(0, i - lookback); j < i; j++) {
    if (data[j].close > data[j].open) up++;
  }
  return up >= Math.ceil(lookback * 0.6);
}

function isDownContext(data, i, lookback = 5) {
  let down = 0;
  for (let j = Math.max(0, i - lookback); j < i; j++) {
    if (data[j].close < data[j].open) down++;
  }
  return down >= Math.ceil(lookback * 0.6);
}

// ═══════════════════════════════════════════════════════════════════
// 3. SWING HIGH/LOW DETECTION (for Auto-Fib)
// ═══════════════════════════════════════════════════════════════════

/**
 * Find the most recent significant swing high and swing low.
 * Used for auto-placing Fibonacci retracement.
 *
 * @param {Array} data - OHLCV array
 * @param {number} strength - Pivot strength (default 8)
 * @returns {{ swingHigh: { idx, price }, swingLow: { idx, price }, direction: 'up'|'down' } | null}
 */
export function detectSwings(data, strength = 8) {
  if (!data || data.length < strength * 3) return null;

  const { pivotHighs, pivotLows } = detectPivots(data, strength);

  if (!pivotHighs.length || !pivotLows.length) return null;

  // Get most recent swing high and low
  const lastHigh = pivotHighs[pivotHighs.length - 1];
  const lastLow = pivotLows[pivotLows.length - 1];

  // Direction: if high came after low → upswing, else → downswing
  const direction = lastHigh.idx > lastLow.idx ? 'up' : 'down';

  return {
    swingHigh: { idx: lastHigh.idx, price: lastHigh.price },
    swingLow: { idx: lastLow.idx, price: lastLow.price },
    direction,
  };
}

/**
 * Generate auto-Fib retracement points from detected swings.
 * Returns a drawing object compatible with drawingTools.js
 *
 * @param {Array} data
 * @param {number} strength
 * @returns {Object|null} Drawing object { type: 'fib', points, color, auto: true }
 */
export function autoFibRetracement(data, strength = 8) {
  const swings = detectSwings(data, strength);
  if (!swings) return null;

  const { swingHigh, swingLow, direction } = swings;

  // Fib from swing low to swing high (or vice versa depending on direction)
  const p1 = direction === 'up'
    ? { price: swingLow.price, barIdx: swingLow.idx }
    : { price: swingHigh.price, barIdx: swingHigh.idx };
  const p2 = direction === 'up'
    ? { price: swingHigh.price, barIdx: swingHigh.idx }
    : { price: swingLow.price, barIdx: swingLow.idx };

  return {
    type: 'fib',
    points: [p1, p2],
    color: '#22c55e',
    auto: true,
    id: 'auto-fib',
    visible: true,
    label: `Auto Fib (${direction === 'up' ? '↑' : '↓'})`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 4. DIVERGENCE DETECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Compute RSI values for divergence detection.
 * @param {Array} data - OHLCV array
 * @param {number} period - RSI period (default 14)
 * @returns {number[]} RSI values (NaN for insufficient data)
 */
export function computeRSI(data, period = 14) {
  const rsi = new Array(data.length).fill(NaN);
  if (data.length < period + 1) return rsi;

  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

/**
 * Detect RSI divergences against price.
 * @param {Array} data - OHLCV array
 * @param {Object} opts
 * @returns {Array<{ type: 'bullish'|'bearish', startIdx, endIdx, priceStart, priceEnd, rsiStart, rsiEnd }>}
 */
export function detectDivergences(data, opts = {}) {
  const { period = 14, pivotStrength = 5 } = opts;
  if (!data || data.length < period + pivotStrength * 3) return [];

  const rsi = computeRSI(data, period);
  const { pivotHighs, pivotLows } = detectPivots(data, pivotStrength);

  const divergences = [];

  // Bullish divergence: price makes lower low, RSI makes higher low
  for (let i = 1; i < pivotLows.length; i++) {
    const prev = pivotLows[i - 1];
    const curr = pivotLows[i];
    const rsiPrev = rsi[prev.idx];
    const rsiCurr = rsi[curr.idx];

    if (!isNaN(rsiPrev) && !isNaN(rsiCurr) &&
        curr.price < prev.price && rsiCurr > rsiPrev) {
      divergences.push({
        type: 'bullish',
        startIdx: prev.idx,
        endIdx: curr.idx,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: rsiPrev,
        rsiEnd: rsiCurr,
      });
    }
  }

  // Bearish divergence: price makes higher high, RSI makes lower high
  for (let i = 1; i < pivotHighs.length; i++) {
    const prev = pivotHighs[i - 1];
    const curr = pivotHighs[i];
    const rsiPrev = rsi[prev.idx];
    const rsiCurr = rsi[curr.idx];

    if (!isNaN(rsiPrev) && !isNaN(rsiCurr) &&
        curr.price > prev.price && rsiCurr < rsiPrev) {
      divergences.push({
        type: 'bearish',
        startIdx: prev.idx,
        endIdx: curr.idx,
        priceStart: prev.price,
        priceEnd: curr.price,
        rsiStart: rsiPrev,
        rsiEnd: rsiCurr,
      });
    }
  }

  return divergences;
}

// ═══════════════════════════════════════════════════════════════════
// 5. DRAWING ALERT — check if price touches any user drawing
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if the latest price is near any user drawing levels.
 * @param {Array} drawings - User drawing objects
 * @param {Object} lastBar - Most recent OHLCV bar
 * @param {number} tolerancePct - % tolerance (default 0.1%)
 * @returns {Array<{ drawingId, drawingType, level, distance, direction }>}
 */
export function checkDrawingProximity(drawings, lastBar, tolerancePct = 0.001) {
  if (!drawings?.length || !lastBar) return [];

  const price = lastBar.close;
  const hits = [];

  for (const d of drawings) {
    if (!d.visible || !d.points?.length) continue;

    let levels = [];

    // Extract price levels from different drawing types
    if (d.type === 'hlevel' || d.type === 'hray') {
      levels = [d.points[0].price];
    } else if (d.type === 'trendline' || d.type === 'ray' || d.type === 'extended') {
      // Use both endpoint prices
      levels = d.points.map(p => p.price);
    } else if (d.type === 'fib' && d.points.length === 2) {
      // Fib levels: 0, 23.6, 38.2, 50, 61.8, 78.6, 100
      const [p1, p2] = d.points;
      const diff = p2.price - p1.price;
      levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(l => p1.price + diff * l);
    } else if (d.type === 'rectangle' && d.points.length === 2) {
      levels = d.points.map(p => p.price);
    }

    for (const level of levels) {
      const distance = Math.abs(price - level);
      const distPct = distance / price;
      if (distPct <= tolerancePct) {
        hits.push({
          drawingId: d.id,
          drawingType: d.type,
          level,
          distance,
          distancePct: Math.round(distPct * 10000) / 100,
          direction: price > level ? 'above' : 'below',
        });
      }
    }
  }

  return hits;
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED ANALYSIS — run all detectors at once
// ═══════════════════════════════════════════════════════════════════

/**
 * Run full price action analysis on OHLCV data.
 * @param {Array} data
 * @param {Object} opts
 * @returns {{ levels: Array, patterns: Array, swings: Object|null, autoFib: Object|null, divergences: Array }}
 */
export function analyzeAll(data, opts = {}) {
  if (!data?.length) return { levels: [], patterns: [], swings: null, autoFib: null, divergences: [] };

  return {
    levels: detectSupportResistance(data, opts),
    patterns: detectCandlestickPatterns(data, opts.patternLookback || 50),
    swings: detectSwings(data, opts.swingStrength || 8),
    autoFib: autoFibRetracement(data, opts.swingStrength || 8),
    divergences: detectDivergences(data, opts),
  };
}

export { PATTERNS };
