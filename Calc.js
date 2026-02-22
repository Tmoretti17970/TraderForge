// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Indicator Calculation Engine
// Extracted from v9.3 monolith. Zero logic changes.
// All functions are pure — no DOM, no state, no side effects.
// ═══════════════════════════════════════════════════════════════════

/**
 * Simple Moving Average
 * @param {number[]} d - Close prices
 * @param {number} p - Period
 * @returns {(number|null)[]} SMA values (null for first p-1 elements)
 */
function sma(d, p) {
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let s = 0;
    for (let j = i - p + 1; j <= i; j++) s += d[j];
    return s / p;
  });
}

/**
 * Exponential Moving Average
 * Seed: SMA of first p values. Multiplier: 2 / (p + 1)
 * @param {number[]} d - Close prices
 * @param {number} p - Period
 * @returns {(number|null)[]} EMA values (null for first p-1 elements)
 */
function ema(d, p) {
  if (d.length < p) return d.map(() => null);
  const k = 2 / (p + 1);
  let seed = 0;
  for (let i = 0; i < p; i++) seed += d[i];
  seed /= p;
  const result = d.map(() => null);
  result[p - 1] = seed;
  for (let i = p; i < d.length; i++) {
    result[i] = d[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

/**
 * Weighted Moving Average
 * @param {number[]} d - Close prices
 * @param {number} p - Period
 * @returns {(number|null)[]} WMA values
 */
function wma(d, p) {
  const dn = (p * (p + 1)) / 2;
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let s = 0;
    for (let j = 0; j < p; j++) s += d[i - p + 1 + j] * (j + 1);
    return s / dn;
  });
}

/**
 * Bollinger Bands
 * @param {number[]} d - Close prices
 * @param {number} p - Period (default 20)
 * @param {number} m - Multiplier for std dev (default 2)
 * @returns {({upper: number, middle: number, lower: number}|null)[]}
 */
function bollinger(d, p = 20, m = 2) {
  const smaVals = sma(d, p);
  return d.map((_, i) => {
    if (smaVals[i] == null) return null;
    let sumSq = 0;
    for (let j = i - p + 1; j <= i; j++) sumSq += (d[j] - smaVals[i]) ** 2;
    const stdDev = Math.sqrt(sumSq / p);
    return {
      upper: smaVals[i] + m * stdDev,
      middle: smaVals[i],
      lower: smaVals[i] - m * stdDev,
    };
  });
}

/**
 * Volume Weighted Average Price
 * @param {{ high: number, low: number, close: number, volume?: number }[]} d - OHLCV bars
 * @returns {number[]} Cumulative VWAP values
 */
function vwap(d) {
  let cVP = 0,
    cV = 0;
  return d.map((x) => {
    const tp = (x.high + x.low + x.close) / 3;
    cVP += tp * (x.volume || 1);
    cV += x.volume || 1;
    return cV > 0 ? cVP / cV : tp;
  });
}

/**
 * Relative Strength Index (Wilder's smoothing)
 * @param {number[]} d - Close prices
 * @param {number} p - Period (default 14)
 * @returns {(number|null)[]} RSI values (0-100)
 */
function rsi(d, p = 14) {
  const r = d.map(() => null);
  if (d.length < p + 1) return r;

  let gS = 0,
    lS = 0;
  for (let i = 1; i <= p; i++) {
    const ch = d[i] - d[i - 1];
    if (ch >= 0) gS += ch;
    else lS += Math.abs(ch);
  }
  let avgGain = gS / p;
  let avgLoss = lS / p;

  // Guard: if both avgGain and avgLoss are 0 (flat prices), RSI = 50 (neutral)
  if (avgGain === 0 && avgLoss === 0) {
    r[p] = 50;
  } else {
    r[p] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = p + 1; i < d.length; i++) {
    const ch = d[i] - d[i - 1];
    avgGain = (avgGain * (p - 1) + (ch > 0 ? ch : 0)) / p;
    avgLoss = (avgLoss * (p - 1) + (ch < 0 ? Math.abs(ch) : 0)) / p;

    if (avgGain === 0 && avgLoss === 0) {
      r[i] = 50;
    } else {
      r[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return r;
}

/**
 * MACD (Moving Average Convergence Divergence)
 * @param {number[]} d - Close prices
 * @param {number} f - Fast period (default 12)
 * @param {number} s - Slow period (default 26)
 * @param {number} sig - Signal period (default 9)
 * @returns {({ macd: number|null, signal: number|null, histogram: number|null })[]}
 */
function macd(d, f = 12, s = 26, sig = 9) {
  const eF = ema(d, f);
  const eS = ema(d, s);
  const ml = d.map((_, i) =>
    eF[i] != null && eS[i] != null ? eF[i] - eS[i] : null
  );
  const macdVals = ml.filter((v) => v != null);
  const sigEma = macdVals.length >= sig ? ema(macdVals, sig) : [];

  let sigIdx = 0;
  return d.map((_, i) => {
    if (ml[i] == null) return { macd: null, signal: null, histogram: null };
    const sigVal = sigIdx < sigEma.length ? sigEma[sigIdx] : null;
    sigIdx++;
    return {
      macd: ml[i],
      signal: sigVal,
      histogram: sigVal != null ? ml[i] - sigVal : null,
    };
  });
}

/**
 * Stochastic Oscillator
 * @param {{ high: number, low: number, close: number }[]} d - OHLCV bars
 * @param {number} kP - %K period (default 14)
 * @param {number} dP - %D period (default 3)
 * @returns {({ k: number|null, d: number|null })[]}
 */
function stochastic(d, kP = 14, dP = 3) {
  const r = d.map(() => ({ k: null, d: null }));
  for (let i = kP - 1; i < d.length; i++) {
    let hh = -Infinity,
      ll = Infinity;
    for (let j = i - kP + 1; j <= i; j++) {
      if (d[j].high > hh) hh = d[j].high;
      if (d[j].low < ll) ll = d[j].low;
    }
    const range = hh - ll;
    r[i].k = range > 0 ? ((d[i].close - ll) / range) * 100 : 50;
  }
  // %D = SMA of %K
  for (let i = kP - 1 + dP - 1; i < d.length; i++) {
    let sum = 0;
    for (let j = i - dP + 1; j <= i; j++) sum += r[j].k;
    r[i].d = sum / dP;
  }
  return r;
}

/**
 * Average True Range
 * @param {{ high: number, low: number, close: number }[]} d - OHLCV bars
 * @param {number} p - Period (default 14)
 * @returns {(number|null)[]}
 */
function atr(d, p = 14) {
  const r = d.map(() => null);
  if (d.length < 2) return r;

  const tr = [d[0].high - d[0].low];
  for (let i = 1; i < d.length; i++) {
    tr.push(
      Math.max(
        d[i].high - d[i].low,
        Math.abs(d[i].high - d[i - 1].close),
        Math.abs(d[i].low - d[i - 1].close)
      )
    );
  }

  if (d.length < p) return r;
  let avg = 0;
  for (let i = 0; i < p; i++) avg += tr[i];
  avg /= p;
  r[p - 1] = avg;
  for (let i = p; i < d.length; i++) {
    avg = (avg * (p - 1) + tr[i]) / p;
    r[i] = avg;
  }
  return r;
}

const Calc = { sma, ema, wma, bollinger, vwap, rsi, macd, stochastic, atr };

// ═══════════════════════════════════════════════════════════════════
// Extended Indicators (Script Engine Expansion)
// ═══════════════════════════════════════════════════════════════════

/** Double Exponential Moving Average */
function dema(d, p) {
  const e1 = ema(d, p);
  const e1Clean = e1.map(v => v ?? 0);
  const e2 = ema(e1Clean, p);
  return d.map((_, i) => (e1[i] != null && e2[i] != null) ? 2 * e1[i] - e2[i] : null);
}

/** Triple Exponential Moving Average */
function tema(d, p) {
  const e1 = ema(d, p);
  const e1C = e1.map(v => v ?? 0);
  const e2 = ema(e1C, p);
  const e2C = e2.map(v => v ?? 0);
  const e3 = ema(e2C, p);
  return d.map((_, i) =>
    (e1[i] != null && e2[i] != null && e3[i] != null)
      ? 3 * e1[i] - 3 * e2[i] + e3[i] : null
  );
}

/** Hull Moving Average — smoother than EMA, less lag */
function hullma(d, p) {
  const halfP = Math.max(Math.floor(p / 2), 1);
  const sqrtP = Math.max(Math.round(Math.sqrt(p)), 1);
  const wmaFull = wma(d, p);
  const wmaHalf = wma(d, halfP);
  const diff = d.map((_, i) =>
    (wmaHalf[i] != null && wmaFull[i] != null) ? 2 * wmaHalf[i] - wmaFull[i] : null
  );
  const diffClean = diff.map(v => v ?? 0);
  const hull = wma(diffClean, sqrtP);
  return d.map((_, i) => diff[i] != null && hull[i] != null ? hull[i] : null);
}

/** Average Directional Index — trend strength (0-100) */
function adx(bars, p = 14) {
  const n = bars.length;
  const r = new Array(n).fill(null);
  if (n < p + 1) return r;

  const smoothDMPlus = new Array(n).fill(0);
  const smoothDMMinus = new Array(n).fill(0);
  const smoothTR = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const hi = bars[i].high, lo = bars[i].low, pc = bars[i - 1].close;
    const tr = Math.max(hi - lo, Math.abs(hi - pc), Math.abs(lo - pc));
    const dmPlus = (hi - bars[i - 1].high > bars[i - 1].low - lo)
      ? Math.max(hi - bars[i - 1].high, 0) : 0;
    const dmMinus = (bars[i - 1].low - lo > hi - bars[i - 1].high)
      ? Math.max(bars[i - 1].low - lo, 0) : 0;

    if (i <= p) {
      smoothTR[i] = smoothTR[i - 1] + tr;
      smoothDMPlus[i] = smoothDMPlus[i - 1] + dmPlus;
      smoothDMMinus[i] = smoothDMMinus[i - 1] + dmMinus;
    } else {
      smoothTR[i] = smoothTR[i - 1] - smoothTR[i - 1] / p + tr;
      smoothDMPlus[i] = smoothDMPlus[i - 1] - smoothDMPlus[i - 1] / p + dmPlus;
      smoothDMMinus[i] = smoothDMMinus[i - 1] - smoothDMMinus[i - 1] / p + dmMinus;
    }
  }

  const dx = new Array(n).fill(null);
  for (let i = p; i < n; i++) {
    if (smoothTR[i] === 0) { dx[i] = 0; continue; }
    const diPlus = (smoothDMPlus[i] / smoothTR[i]) * 100;
    const diMinus = (smoothDMMinus[i] / smoothTR[i]) * 100;
    dx[i] = (diPlus + diMinus === 0) ? 0 : Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  }

  // Smooth DX into ADX
  let adxSum = 0;
  for (let i = p; i < 2 * p && i < n; i++) adxSum += (dx[i] || 0);
  if (2 * p - 1 < n) r[2 * p - 1] = adxSum / p;
  for (let i = 2 * p; i < n; i++) {
    r[i] = ((r[i - 1] || 0) * (p - 1) + (dx[i] || 0)) / p;
  }
  return r;
}

/** Commodity Channel Index */
function cci(bars, p = 20) {
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const tpSma = sma(tp, p);
  return tp.map((v, i) => {
    if (tpSma[i] == null) return null;
    let meanDev = 0;
    for (let j = i - p + 1; j <= i; j++) meanDev += Math.abs(tp[j] - tpSma[i]);
    meanDev /= p;
    return meanDev === 0 ? 0 : (v - tpSma[i]) / (0.015 * meanDev);
  });
}

/** Money Flow Index — volume-weighted RSI (0-100) */
function mfi(bars, p = 14) {
  const n = bars.length;
  const r = new Array(n).fill(null);
  if (n < p + 1) return r;

  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  for (let i = p; i < n; i++) {
    let posFlow = 0, negFlow = 0;
    for (let j = i - p + 1; j <= i; j++) {
      const mf = tp[j] * (bars[j].volume || 0);
      if (tp[j] > tp[j - 1]) posFlow += mf;
      else if (tp[j] < tp[j - 1]) negFlow += mf;
    }
    r[i] = negFlow === 0 ? 100 : 100 - 100 / (1 + posFlow / negFlow);
  }
  return r;
}

/** On-Balance Volume — cumulative volume direction */
function obv(bars) {
  const r = [0];
  for (let i = 1; i < bars.length; i++) {
    const dir = bars[i].close > bars[i - 1].close ? 1 :
                bars[i].close < bars[i - 1].close ? -1 : 0;
    r.push(r[i - 1] + dir * (bars[i].volume || 0));
  }
  return r;
}

/** Williams %R — momentum oscillator (-100 to 0) */
function williamsR(bars, p = 14) {
  return bars.map((_, i) => {
    if (i < p - 1) return null;
    let hh = -Infinity, ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (bars[j].high > hh) hh = bars[j].high;
      if (bars[j].low < ll) ll = bars[j].low;
    }
    return hh === ll ? -50 : ((hh - bars[i].close) / (hh - ll)) * -100;
  });
}

/** Supertrend — trend-following overlay */
function supertrend(bars, p = 10, mult = 3) {
  const atrVals = atr(bars, p);
  const n = bars.length;
  const upper = new Array(n).fill(null);
  const lower = new Array(n).fill(null);
  const trend = new Array(n).fill(1); // 1=bull, -1=bear
  const line = new Array(n).fill(null);

  for (let i = 0; i < n; i++) {
    if (atrVals[i] == null) continue;
    const hl2 = (bars[i].high + bars[i].low) / 2;
    upper[i] = hl2 + mult * atrVals[i];
    lower[i] = hl2 - mult * atrVals[i];

    if (i > 0) {
      if (lower[i - 1] != null) lower[i] = Math.max(lower[i], bars[i - 1].close > lower[i - 1] ? lower[i - 1] : lower[i]);
      if (upper[i - 1] != null) upper[i] = Math.min(upper[i], bars[i - 1].close < upper[i - 1] ? upper[i - 1] : upper[i]);

      const prevTrend = trend[i - 1];
      if (prevTrend === 1) {
        trend[i] = bars[i].close < lower[i] ? -1 : 1;
      } else {
        trend[i] = bars[i].close > upper[i] ? 1 : -1;
      }
    }
    line[i] = trend[i] === 1 ? lower[i] : upper[i];
  }
  return { line, trend, upper, lower };
}

/**
 * Ichimoku Cloud
 * @returns {{ tenkan, kijun, senkouA, senkouB, chikou }}
 */
function ichimoku(bars, tenkanP = 9, kijunP = 26, senkouBP = 52, displacement = 26) {
  const n = bars.length;
  const hl = (start, end) => {
    let h = -Infinity, l = Infinity;
    for (let i = start; i <= end; i++) {
      if (bars[i].high > h) h = bars[i].high;
      if (bars[i].low < l) l = bars[i].low;
    }
    return (h + l) / 2;
  };

  const tenkan = bars.map((_, i) => i < tenkanP - 1 ? null : hl(i - tenkanP + 1, i));
  const kijun = bars.map((_, i) => i < kijunP - 1 ? null : hl(i - kijunP + 1, i));

  // Senkou A/B are displaced forward by `displacement` periods
  const senkouA = new Array(n + displacement).fill(null);
  const senkouB = new Array(n + displacement).fill(null);
  for (let i = 0; i < n; i++) {
    if (tenkan[i] != null && kijun[i] != null) {
      senkouA[i + displacement] = (tenkan[i] + kijun[i]) / 2;
    }
    if (i >= senkouBP - 1) {
      senkouB[i + displacement] = hl(i - senkouBP + 1, i);
    }
  }

  // Chikou = close displaced back
  const chikou = new Array(n).fill(null);
  for (let i = displacement; i < n; i++) {
    chikou[i - displacement] = bars[i].close;
  }

  return {
    tenkan: tenkan.slice(0, n),
    kijun: kijun.slice(0, n),
    senkouA: senkouA.slice(0, n),
    senkouB: senkouB.slice(0, n),
    chikou,
  };
}

/** Pivot Points (Standard/Floor) — daily support/resistance levels */
function pivotPoints(bars) {
  if (bars.length === 0) return { pp: null, r1: null, r2: null, r3: null, s1: null, s2: null, s3: null };
  const last = bars[bars.length - 1];
  const pp = (last.high + last.low + last.close) / 3;
  return {
    pp,
    r1: 2 * pp - last.low,
    r2: pp + (last.high - last.low),
    r3: last.high + 2 * (pp - last.low),
    s1: 2 * pp - last.high,
    s2: pp - (last.high - last.low),
    s3: last.low - 2 * (last.high - pp),
  };
}

/** Heikin-Ashi candles — smoothed candlesticks */
function heikinAshi(bars) {
  const ha = [];
  for (let i = 0; i < bars.length; i++) {
    const prev = ha[i - 1] || bars[0];
    const haClose = (bars[i].open + bars[i].high + bars[i].low + bars[i].close) / 4;
    const haOpen = (prev.open + prev.close) / 2;
    ha.push({
      open: haOpen,
      close: haClose,
      high: Math.max(bars[i].high, haOpen, haClose),
      low: Math.min(bars[i].low, haOpen, haClose),
      volume: bars[i].volume,
      time: bars[i].time,
    });
  }
  return ha;
}

/** Linear Regression Line — slope + intercept over window */
function linearRegression(d, p = 20) {
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (let j = 0; j < p; j++) {
      sx += j; sy += d[i - p + 1 + j];
      sxy += j * d[i - p + 1 + j]; sx2 += j * j;
    }
    const denom = p * sx2 - sx * sx;
    if (denom === 0) return d[i];
    const slope = (p * sxy - sx * sy) / denom;
    const intercept = (sy - slope * sx) / p;
    return slope * (p - 1) + intercept;
  });
}

/** Standard Deviation over rolling window */
function stdev(d, p = 20) {
  const avg = sma(d, p);
  return d.map((_, i) => {
    if (avg[i] == null) return null;
    let sumSq = 0;
    for (let j = i - p + 1; j <= i; j++) sumSq += (d[j] - avg[i]) ** 2;
    return Math.sqrt(sumSq / p);
  });
}

// ─── Keltner Channels ───────────────────────────────────────────
function keltner(bars, emaPeriod = 20, atrPeriod = 10, mult = 1.5) {
  const closes = bars.map(b => b.close);
  const mid = ema(closes, emaPeriod);
  const atrVals = atr(bars, atrPeriod);
  return bars.map((_, i) => {
    if (mid[i] == null || atrVals[i] == null) return null;
    return { upper: mid[i] + mult * atrVals[i], mid: mid[i], lower: mid[i] - mult * atrVals[i] };
  });
}

// ─── Donchian Channels ──────────────────────────────────────────
function donchian(bars, p = 20) {
  return bars.map((_, i) => {
    if (i < p - 1) return null;
    let hi = -Infinity, lo = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (bars[j].high > hi) hi = bars[j].high;
      if (bars[j].low < lo) lo = bars[j].low;
    }
    return { upper: hi, mid: (hi + lo) / 2, lower: lo };
  });
}

// ─── Volume Weighted Moving Average ─────────────────────────────
function vwma(bars, p = 20) {
  return bars.map((_, i) => {
    if (i < p - 1) return null;
    let sumCV = 0, sumV = 0;
    for (let j = i - p + 1; j <= i; j++) {
      sumCV += bars[j].close * (bars[j].volume || 1);
      sumV += bars[j].volume || 1;
    }
    return sumV ? sumCV / sumV : null;
  });
}

// ─── Chaikin Money Flow ─────────────────────────────────────────
function cmf(bars, p = 20) {
  return bars.map((_, i) => {
    if (i < p - 1) return null;
    let sumMFV = 0, sumV = 0;
    for (let j = i - p + 1; j <= i; j++) {
      const hl = bars[j].high - bars[j].low;
      const mfm = hl === 0 ? 0 : ((bars[j].close - bars[j].low) - (bars[j].high - bars[j].close)) / hl;
      sumMFV += mfm * (bars[j].volume || 1);
      sumV += bars[j].volume || 1;
    }
    return sumV ? sumMFV / sumV : 0;
  });
}

// ─── Rate of Change ─────────────────────────────────────────────
function roc(d, p = 12) {
  return d.map((v, i) => {
    if (i < p || v == null || d[i - p] == null || d[i - p] === 0) return null;
    return ((v - d[i - p]) / d[i - p]) * 100;
  });
}

// ─── Array Helpers (for scripts) ────────────────────────────────

function highest(d, p) {
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let m = -Infinity;
    for (let j = i - p + 1; j <= i; j++) if (d[j] != null && d[j] > m) m = d[j];
    return m === -Infinity ? null : m;
  });
}

function lowest(d, p) {
  return d.map((_, i) => {
    if (i < p - 1) return null;
    let m = Infinity;
    for (let j = i - p + 1; j <= i; j++) if (d[j] != null && d[j] < m) m = d[j];
    return m === Infinity ? null : m;
  });
}

function change(d, lookback = 1) {
  return d.map((v, i) => {
    if (i < lookback || v == null || d[i - lookback] == null) return null;
    return v - d[i - lookback];
  });
}

function barssince(condArr) {
  const result = condArr.map(() => null);
  let count = null;
  for (let i = 0; i < condArr.length; i++) {
    if (condArr[i]) count = 0;
    else if (count !== null) count++;
    result[i] = count;
  }
  return result;
}

function valuewhen(condArr, srcArr, occurrence = 0) {
  const result = srcArr.map(() => null);
  const hits = [];
  for (let i = 0; i < condArr.length; i++) {
    if (condArr[i]) hits.push(i);
    if (hits.length > occurrence) {
      result[i] = srcArr[hits[hits.length - 1 - occurrence]];
    }
  }
  return result;
}

function fillna(d, fillValue = 0) {
  let last = fillValue;
  return d.map(v => { if (v != null) { last = v; return v; } return last; });
}

function offsetArr(d, n) {
  if (n >= 0) return [...Array(n).fill(null), ...d.slice(0, d.length - n)];
  return [...d.slice(-n), ...Array(-n).fill(null)];
}

// ── Update Calc object and exports ──────────────────────────────

Object.assign(Calc, {
  dema, tema, hullma, adx, cci, mfi, obv, williamsR,
  supertrend, ichimoku, pivotPoints, heikinAshi,
  linearRegression, stdev,
  keltner, donchian, vwma, cmf, roc,
  highest, lowest, change, barssince, valuewhen, fillna, offsetArr,
});

export {
  Calc,
  sma, ema, wma, bollinger, vwap, rsi, macd, stochastic, atr,
  dema, tema, hullma, adx, cci, mfi, obv, williamsR,
  supertrend, ichimoku, pivotPoints, heikinAshi,
  linearRegression, stdev,
  keltner, donchian, vwma, cmf, roc,
  highest, lowest, change, barssince, valuewhen, fillna, offsetArr,
};
export default Calc;
