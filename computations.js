// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Indicator Computations
// Pure math functions. No rendering, no state, no side effects.
//
// Every function takes an array of bars (or closes) and returns
// an array of computed values aligned 1:1 with the input.
// NaN is used for periods where insufficient data exists.
//
// Indicators implemented:
//   Overlay:  SMA, EMA, WMA, DEMA, TEMA, Bollinger Bands, VWAP,
//             Supertrend, Ichimoku Cloud
//   Pane:     RSI, MACD, Stochastic, ATR, ADX, CCI, MFI,
//             Williams %R, OBV, Rate of Change
// ═══════════════════════════════════════════════════════════════════

/**
 * Extract close prices from bar array.
 * @param {Array<{close: number}>} bars
 * @returns {number[]}
 */
export function closes(bars) { return bars.map(b => b.close); }
export function highs(bars)  { return bars.map(b => b.high); }
export function lows(bars)   { return bars.map(b => b.low); }
export function volumes(bars){ return bars.map(b => b.volume || 0); }

// ═══════════════════════════════════════════════════════════════
// Moving Averages
// ═══════════════════════════════════════════════════════════════

/**
 * Simple Moving Average.
 * @param {number[]} src    - Source values
 * @param {number}   period - Lookback period
 * @returns {number[]}
 */
export function sma(src, period) {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    sum += src[i] - src[i - period];
    out[i] = sum / period;
  }
  return out;
}

/**
 * Exponential Moving Average.
 * @param {number[]} src
 * @param {number}   period
 * @returns {number[]}
 */
export function ema(src, period) {
  const out = new Array(src.length).fill(NaN);
  if (period > src.length) return out;

  const k = 2 / (period + 1);

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += src[i];
  out[period - 1] = sum / period;

  for (let i = period; i < src.length; i++) {
    out[i] = src[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

/**
 * Weighted Moving Average.
 */
export function wma(src, period) {
  const out = new Array(src.length).fill(NaN);
  const denom = (period * (period + 1)) / 2;

  for (let i = period - 1; i < src.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += src[i - period + 1 + j] * (j + 1);
    }
    out[i] = sum / denom;
  }
  return out;
}

/**
 * Double EMA (DEMA).
 */
export function dema(src, period) {
  const e1 = ema(src, period);
  const e2 = ema(e1.map(v => isNaN(v) ? 0 : v), period);
  return e1.map((v, i) => isNaN(v) || isNaN(e2[i]) ? NaN : 2 * v - e2[i]);
}

/**
 * Triple EMA (TEMA).
 */
export function tema(src, period) {
  const e1 = ema(src, period);
  const clean1 = e1.map(v => isNaN(v) ? 0 : v);
  const e2 = ema(clean1, period);
  const clean2 = e2.map(v => isNaN(v) ? 0 : v);
  const e3 = ema(clean2, period);
  return e1.map((v, i) => {
    if (isNaN(v) || isNaN(e2[i]) || isNaN(e3[i])) return NaN;
    return 3 * v - 3 * e2[i] + e3[i];
  });
}


// ═══════════════════════════════════════════════════════════════
// Bollinger Bands
// ═══════════════════════════════════════════════════════════════

/**
 * Bollinger Bands.
 * @param {number[]} src
 * @param {number}   period   - SMA period (default 20)
 * @param {number}   stdDev   - Standard deviation multiplier (default 2)
 * @returns {{ middle: number[], upper: number[], lower: number[] }}
 */
export function bollingerBands(src, period = 20, stdDev = 2) {
  const middle = sma(src, period);
  const upper = new Array(src.length).fill(NaN);
  const lower = new Array(src.length).fill(NaN);

  for (let i = period - 1; i < src.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = src[j] - middle[i];
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);
    upper[i] = middle[i] + stdDev * sd;
    lower[i] = middle[i] - stdDev * sd;
  }

  return { middle, upper, lower };
}


// ═══════════════════════════════════════════════════════════════
// VWAP (Volume Weighted Average Price)
// ═══════════════════════════════════════════════════════════════

/**
 * VWAP — resets at each new day boundary.
 * @param {Array<{high:number, low:number, close:number, volume:number, time:number}>} bars
 * @returns {number[]}
 */
export function vwap(bars) {
  const out = new Array(bars.length).fill(NaN);
  let cumTPV = 0, cumVol = 0, lastDay = -1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const day = new Date(b.time).getUTCDate();

    // Reset on new day
    if (day !== lastDay) {
      cumTPV = 0;
      cumVol = 0;
      lastDay = day;
    }

    const tp = (b.high + b.low + b.close) / 3;
    cumTPV += tp * (b.volume || 0);
    cumVol += b.volume || 0;

    out[i] = cumVol > 0 ? cumTPV / cumVol : NaN;
  }

  return out;
}


// ═══════════════════════════════════════════════════════════════
// RSI (Relative Strength Index)
// ═══════════════════════════════════════════════════════════════

/**
 * RSI using Wilder's smoothing method.
 * @param {number[]} src
 * @param {number}   period - Default 14
 * @returns {number[]}
 */
export function rsi(src, period = 14) {
  const out = new Array(src.length).fill(NaN);
  if (src.length < period + 1) return out;

  let avgGain = 0, avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = src[i] - src[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;

  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's smoothing
  for (let i = period + 1; i < src.length; i++) {
    const change = src[i] - src[i - 1];
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}


// ═══════════════════════════════════════════════════════════════
// MACD (Moving Average Convergence Divergence)
// ═══════════════════════════════════════════════════════════════

/**
 * MACD.
 * @param {number[]} src
 * @param {number}   fast   - Fast EMA period (default 12)
 * @param {number}   slow   - Slow EMA period (default 26)
 * @param {number}   signal - Signal EMA period (default 9)
 * @returns {{ macd: number[], signal: number[], histogram: number[] }}
 */
export function macd(src, fast = 12, slow = 26, signal = 9) {
  const fastEma = ema(src, fast);
  const slowEma = ema(src, slow);

  const macdLine = fastEma.map((f, i) =>
    isNaN(f) || isNaN(slowEma[i]) ? NaN : f - slowEma[i]
  );

  const cleanMacd = macdLine.map(v => isNaN(v) ? 0 : v);
  const signalLine = ema(cleanMacd, signal);

  // Fix: only show signal where MACD is valid
  const firstValid = macdLine.findIndex(v => !isNaN(v));
  const signalOut = signalLine.map((v, i) =>
    i < firstValid + signal - 1 ? NaN : v
  );

  const histogram = macdLine.map((m, i) =>
    isNaN(m) || isNaN(signalOut[i]) ? NaN : m - signalOut[i]
  );

  return { macd: macdLine, signal: signalOut, histogram };
}


// ═══════════════════════════════════════════════════════════════
// Stochastic Oscillator
// ═══════════════════════════════════════════════════════════════

/**
 * Stochastic %K and %D.
 * @param {Array<{high:number, low:number, close:number}>} bars
 * @param {number} kPeriod - %K period (default 14)
 * @param {number} dPeriod - %D smoothing (default 3)
 * @returns {{ k: number[], d: number[] }}
 */
export function stochastic(bars, kPeriod = 14, dPeriod = 3) {
  const k = new Array(bars.length).fill(NaN);

  for (let i = kPeriod - 1; i < bars.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    k[i] = range === 0 ? 50 : ((bars[i].close - low) / range) * 100;
  }

  const d = sma(k.map(v => isNaN(v) ? 0 : v), dPeriod);
  // Fix alignment
  const firstK = k.findIndex(v => !isNaN(v));
  for (let i = 0; i < firstK + dPeriod - 1; i++) d[i] = NaN;

  return { k, d };
}


// ═══════════════════════════════════════════════════════════════
// ATR (Average True Range)
// ═══════════════════════════════════════════════════════════════

/**
 * True Range.
 */
export function trueRange(bars) {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const prev = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
}

/**
 * ATR using Wilder's smoothing.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function atr(bars, period = 14) {
  const tr = trueRange(bars);
  const out = new Array(bars.length).fill(NaN);

  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  out[period - 1] = sum / period;

  for (let i = period; i < bars.length; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
// ADX (Average Directional Index)
// ═══════════════════════════════════════════════════════════════

/**
 * ADX with +DI and -DI.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {{ adx: number[], plusDI: number[], minusDI: number[] }}
 */
export function adx(bars, period = 14) {
  const len = bars.length;
  const plusDI = new Array(len).fill(NaN);
  const minusDI = new Array(len).fill(NaN);
  const adxOut = new Array(len).fill(NaN);

  const tr = trueRange(bars);

  // +DM and -DM
  const plusDM = new Array(len).fill(0);
  const minusDM = new Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  // Smoothed TR, +DM, -DM
  let sTR = 0, sPDM = 0, sMDM = 0;
  for (let i = 0; i < period; i++) { sTR += tr[i]; sPDM += plusDM[i]; sMDM += minusDM[i]; }

  for (let i = period; i < len; i++) {
    sTR = sTR - sTR / period + tr[i];
    sPDM = sPDM - sPDM / period + plusDM[i];
    sMDM = sMDM - sMDM / period + minusDM[i];

    plusDI[i] = sTR > 0 ? (sPDM / sTR) * 100 : 0;
    minusDI[i] = sTR > 0 ? (sMDM / sTR) * 100 : 0;
  }

  // DX and ADX
  const dx = new Array(len).fill(NaN);
  for (let i = period; i < len; i++) {
    const sum = plusDI[i] + minusDI[i];
    dx[i] = sum > 0 ? Math.abs(plusDI[i] - minusDI[i]) / sum * 100 : 0;
  }

  let adxSum = 0;
  const adxStart = period * 2;
  for (let i = period; i < adxStart && i < len; i++) adxSum += (isNaN(dx[i]) ? 0 : dx[i]);
  if (adxStart < len) adxOut[adxStart - 1] = adxSum / period;

  for (let i = adxStart; i < len; i++) {
    adxOut[i] = (adxOut[i - 1] * (period - 1) + (isNaN(dx[i]) ? 0 : dx[i])) / period;
  }

  return { adx: adxOut, plusDI, minusDI };
}


// ═══════════════════════════════════════════════════════════════
// CCI (Commodity Channel Index)
// ═══════════════════════════════════════════════════════════════

/**
 * CCI.
 * @param {Array} bars
 * @param {number} period - Default 20
 * @returns {number[]}
 */
export function cci(bars, period = 20) {
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const tpSma = sma(tp, period);
  const out = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    let meanDev = 0;
    for (let j = i - period + 1; j <= i; j++) {
      meanDev += Math.abs(tp[j] - tpSma[i]);
    }
    meanDev /= period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * meanDev);
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
// OBV (On Balance Volume)
// ═══════════════════════════════════════════════════════════════

/**
 * OBV.
 * @param {Array} bars
 * @returns {number[]}
 */
export function obv(bars) {
  const out = new Array(bars.length);
  out[0] = bars[0]?.volume || 0;

  for (let i = 1; i < bars.length; i++) {
    if (bars[i].close > bars[i - 1].close) out[i] = out[i - 1] + (bars[i].volume || 0);
    else if (bars[i].close < bars[i - 1].close) out[i] = out[i - 1] - (bars[i].volume || 0);
    else out[i] = out[i - 1];
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
// Williams %R
// ═══════════════════════════════════════════════════════════════

/**
 * Williams %R.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function williamsR(bars, period = 14) {
  const out = new Array(bars.length).fill(NaN);

  for (let i = period - 1; i < bars.length; i++) {
    let high = -Infinity, low = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (bars[j].high > high) high = bars[j].high;
      if (bars[j].low < low) low = bars[j].low;
    }
    const range = high - low;
    out[i] = range === 0 ? -50 : ((high - bars[i].close) / range) * -100;
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
// ROC (Rate of Change)
// ═══════════════════════════════════════════════════════════════

/**
 * ROC (percentage).
 * @param {number[]} src
 * @param {number}   period - Default 12
 * @returns {number[]}
 */
export function roc(src, period = 12) {
  const out = new Array(src.length).fill(NaN);
  for (let i = period; i < src.length; i++) {
    out[i] = src[i - period] === 0 ? 0 : ((src[i] - src[i - period]) / src[i - period]) * 100;
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════
// MFI (Money Flow Index)
// ═══════════════════════════════════════════════════════════════

/**
 * MFI.
 * @param {Array} bars
 * @param {number} period - Default 14
 * @returns {number[]}
 */
export function mfi(bars, period = 14) {
  const out = new Array(bars.length).fill(NaN);
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);

  for (let i = period; i < bars.length; i++) {
    let posMF = 0, negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const mf = tp[j] * (bars[j].volume || 0);
      if (tp[j] > tp[j - 1]) posMF += mf;
      else if (tp[j] < tp[j - 1]) negMF += mf;
    }
    out[i] = negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF);
  }
  return out;
}
