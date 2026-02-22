// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Built-in Script Library
//
// Pre-loaded example scripts that demonstrate the scripting API.
// These are read-only — users can duplicate them to customize.
// ═══════════════════════════════════════════════════════════════════

export const BUILTIN_SCRIPTS = [
  {
    id: '__builtin_ema_cross',
    name: 'EMA Crossover',
    description: 'Fast/slow EMA with crossover markers. Classic trend-following signal.',
    category: 'trend',
    builtin: true,
    enabled: false,
    params: {},
    code: `const fast = param('fast', 9, { min: 2, max: 50, label: 'Fast Period' });
const slow = param('slow', 21, { min: 5, max: 200, label: 'Slow Period' });

const fastLine = ema(close, fast);
const slowLine = ema(close, slow);

plot(fastLine, { color: '#22c55e', label: 'Fast EMA', lineWidth: 1.5 });
plot(slowLine, { color: '#ef4444', label: 'Slow EMA', lineWidth: 1.5 });

// Mark crossover signals
const bullCross = crossover(fastLine, slowLine);
const bearCross = crossunder(fastLine, slowLine);
for (let i = 0; i < barCount; i++) {
  tick();
  if (bullCross[i]) marker(i, { color: '#22c55e', position: 'below', shape: 'triangle' });
  if (bearCross[i]) marker(i, { color: '#ef4444', position: 'above', shape: 'triangle' });
}`,
  },
  {
    id: '__builtin_bb_squeeze',
    name: 'Bollinger Squeeze',
    description: 'Bollinger Bands with bandwidth histogram. Low bandwidth = squeeze = breakout incoming.',
    category: 'volatility',
    builtin: true,
    enabled: false,
    params: {},
    code: `const period = param('period', 20, { min: 5, max: 50, label: 'Period' });
const mult = param('mult', 2, { min: 0.5, max: 4, step: 0.5, label: 'Std Dev' });

const bb = bollinger(close, period, mult);
const upper = bb.map(b => b ? b.upper : null);
const lower = bb.map(b => b ? b.lower : null);
const mid = bb.map(b => b ? b.mid : null);

band(upper, lower, { color: '#3b82f6', fillColor: '#3b82f620', label: 'BB' });
plot(mid, { color: '#3b82f650', label: 'BB Mid', lineWidth: 1 });

// Bandwidth histogram (normalized)
const bw = upper.map((u, i) => {
  tick();
  if (u == null || lower[i] == null || mid[i] == null || mid[i] === 0) return null;
  return ((u - lower[i]) / mid[i]) * 100;
});
histogram(bw, { colorUp: '#3b82f6', colorDown: '#3b82f650', label: 'Bandwidth %' });`,
  },
  {
    id: '__builtin_rsi_divergence',
    name: 'RSI with Levels',
    description: 'RSI oscillator with overbought/oversold zones and dynamic coloring.',
    category: 'momentum',
    builtin: true,
    enabled: false,
    params: {},
    code: `const period = param('period', 14, { min: 2, max: 50, label: 'RSI Period' });
const ob = param('overbought', 70, { min: 50, max: 90, label: 'Overbought' });
const os = param('oversold', 30, { min: 10, max: 50, label: 'Oversold' });

const rsiValues = rsi(close, period);

plot(rsiValues, {
  color: '#a855f7',
  label: 'RSI',
  lineWidth: 2,
  overlay: false,
});

hline(ob, { color: '#ef4444', style: 'dashed', label: 'OB' });
hline(os, { color: '#22c55e', style: 'dashed', label: 'OS' });
hline(50, { color: '#5d637740', style: 'dotted' });

// Mark extremes
for (let i = 1; i < barCount; i++) {
  tick();
  if (rsiValues[i] == null) continue;
  if (rsiValues[i] > ob && rsiValues[i - 1] <= ob)
    marker(i, { color: '#ef4444', position: 'above', shape: 'diamond' });
  if (rsiValues[i] < os && rsiValues[i - 1] >= os)
    marker(i, { color: '#22c55e', position: 'below', shape: 'diamond' });
}`,
  },
  {
    id: '__builtin_volume_profile',
    name: 'Volume Spike',
    description: 'Highlights bars where volume exceeds 2x the average. Useful for spotting institutional activity.',
    category: 'volume',
    builtin: true,
    enabled: false,
    params: {},
    code: `const lookback = param('lookback', 20, { min: 5, max: 100, label: 'Avg Lookback' });
const threshold = param('threshold', 2.0, { min: 1.0, max: 5.0, step: 0.5, label: 'Spike Mult' });

const avgVol = sma(volume, lookback);

const spikeData = volume.map((v, i) => {
  tick();
  if (avgVol[i] == null || avgVol[i] === 0) return null;
  return v / avgVol[i]; // ratio vs average
});

histogram(spikeData, {
  colorUp: '#22c55e',
  colorDown: '#5d637750',
  label: 'Vol Ratio',
});

hline(threshold, { color: '#f59e0b', style: 'dashed', label: 'Spike Level' });

// Mark spike bars
for (let i = 0; i < barCount; i++) {
  tick();
  if (spikeData[i] != null && spikeData[i] >= threshold) {
    marker(i, {
      color: '#f59e0b',
      position: close[i] > open[i] ? 'below' : 'above',
      shape: 'circle',
    });
  }
}`,
  },
  {
    id: '__builtin_momentum',
    name: 'Momentum Ribbon',
    description: 'Multi-EMA ribbon showing trend strength. Green when aligned bullish, red when bearish.',
    category: 'trend',
    builtin: true,
    enabled: false,
    params: {},
    code: `const p1 = param('p1', 8, { min: 2, max: 30, label: 'Fastest' });
const p2 = param('p2', 13, { min: 5, max: 50, label: 'Fast' });
const p3 = param('p3', 21, { min: 10, max: 80, label: 'Medium' });
const p4 = param('p4', 55, { min: 20, max: 200, label: 'Slow' });

const e1 = ema(close, p1);
const e2 = ema(close, p2);
const e3 = ema(close, p3);
const e4 = ema(close, p4);

// Color based on alignment
const bullish = '#22c55e';
const bearish = '#ef4444';
const neutral = '#5d6377';

plot(e1, { color: bullish, label: 'EMA ' + p1, lineWidth: 1, opacity: 0.9 });
plot(e2, { color: bullish, label: 'EMA ' + p2, lineWidth: 1, opacity: 0.7 });
plot(e3, { color: bearish, label: 'EMA ' + p3, lineWidth: 1, opacity: 0.7 });
plot(e4, { color: bearish, label: 'EMA ' + p4, lineWidth: 1, opacity: 0.9 });

// Fill between fastest and slowest
band(e1, e4, {
  color: '#3b82f6',
  fillColor: '#3b82f610',
  label: 'Ribbon',
});`,
  },
  {
    id: '__builtin_atr_bands',
    name: 'ATR Channels',
    description: 'Price channels based on ATR distance from EMA. Dynamic support/resistance.',
    category: 'volatility',
    builtin: true,
    enabled: false,
    params: {},
    code: `const emaPeriod = param('emaPeriod', 21, { min: 5, max: 100, label: 'EMA Period' });
const atrPeriod = param('atrPeriod', 14, { min: 5, max: 50, label: 'ATR Period' });
const mult = param('mult', 2.0, { min: 0.5, max: 5, step: 0.5, label: 'ATR Mult' });

const basis = ema(close, emaPeriod);
const atrValues = atr(bars, atrPeriod);

const upper = basis.map((b, i) => {
  tick();
  return (b != null && atrValues[i] != null) ? b + atrValues[i] * mult : null;
});
const lower = basis.map((b, i) => {
  tick();
  return (b != null && atrValues[i] != null) ? b - atrValues[i] * mult : null;
});

plot(basis, { color: '#06b6d4', label: 'EMA', lineWidth: 1.5 });
band(upper, lower, { color: '#06b6d4', fillColor: '#06b6d412', label: 'ATR Channel' });`,
  },

  // ═══ NEW SCRIPTS: Extended Indicator Library ═══════════════

  {
    id: 'supertrend',
    name: 'Supertrend',
    description: 'Trend-following overlay that flips between support and resistance. Green = bullish, Red = bearish.',
    category: 'trend',
    tags: ['overlay', 'trend', 'supertrend'],
    code: `const period = param('period', 10, { min: 5, max: 30, label: 'ATR Period' });
const mult = param('mult', 3, { min: 1, max: 6, step: 0.5, label: 'Multiplier' });

const st = supertrend(null, period, mult);

// Color-code by trend direction
const bullLine = st.line.map((v, i) => st.trend[i] === 1 ? v : null);
const bearLine = st.line.map((v, i) => st.trend[i] === -1 ? v : null);

plot(bullLine, { color: '#22c55e', label: 'Supertrend Bull', lineWidth: 2 });
plot(bearLine, { color: '#ef4444', label: 'Supertrend Bear', lineWidth: 2 });

// Mark trend flips
const flips = st.trend.map((t, i) => i > 0 && t !== st.trend[i - 1]);
for (let i = 0; i < flips.length; i++) {
  tick();
  if (flips[i]) {
    marker(i, { position: st.trend[i] === 1 ? 'below' : 'above',
      color: st.trend[i] === 1 ? '#22c55e' : '#ef4444', shape: 'diamond' });
  }
}`,
  },

  {
    id: 'ichimoku-cloud',
    name: 'Ichimoku Cloud',
    description: 'Full Ichimoku Kinko Hyo system: Tenkan, Kijun, cloud (Senkou A/B), and Chikou.',
    category: 'trend',
    tags: ['overlay', 'trend', 'ichimoku', 'cloud'],
    code: `const tenkanP = param('tenkan', 9, { min: 5, max: 20, label: 'Tenkan Period' });
const kijunP = param('kijun', 26, { min: 15, max: 52, label: 'Kijun Period' });
const senkouBP = param('senkouB', 52, { min: 26, max: 100, label: 'Senkou B Period' });

const ichi = ichimoku(null, tenkanP, kijunP, senkouBP);

plot(ichi.tenkan, { color: '#06b6d4', label: 'Tenkan', lineWidth: 1 });
plot(ichi.kijun, { color: '#f59e0b', label: 'Kijun', lineWidth: 1.5 });
band(ichi.senkouA, ichi.senkouB, { color: '#22c55e', fillColor: '#22c55e10', label: 'Cloud' });
plot(ichi.chikou, { color: '#a855f7', label: 'Chikou', lineWidth: 1, style: 'dotted' });`,
  },

  {
    id: 'adx-trend-strength',
    name: 'ADX Trend Strength',
    description: 'Average Directional Index measures trend strength (not direction). Above 25 = strong trend.',
    category: 'momentum',
    tags: ['subpane', 'trend', 'adx'],
    code: `const period = param('period', 14, { min: 7, max: 30, label: 'ADX Period' });
const threshold = param('threshold', 25, { min: 15, max: 40, label: 'Strong Threshold' });

const adxValues = adx(null, period);

// Color by strength
const strong = adxValues.map(v => v != null && v >= threshold ? v : null);
const weak = adxValues.map(v => v != null && v < threshold ? v : null);

plot(strong, { color: '#22c55e', label: 'ADX Strong', lineWidth: 2, pane: 'adx' });
plot(weak, { color: '#6b7280', label: 'ADX Weak', lineWidth: 1.5, pane: 'adx' });
hline(threshold, { color: '#f59e0b', style: 'dashed', pane: 'adx' });`,
  },

  {
    id: 'cci-divergence',
    name: 'CCI with Zones',
    description: 'Commodity Channel Index with overbought/oversold zones. Classic mean-reversion signal.',
    category: 'momentum',
    tags: ['subpane', 'oscillator', 'cci', 'mean-reversion'],
    code: `const period = param('period', 20, { min: 10, max: 50, label: 'CCI Period' });
const ob = param('overbought', 100, { min: 50, max: 200, label: 'Overbought' });
const os = param('oversold', -100, { min: -200, max: -50, label: 'Oversold' });

const cciValues = cci(null, period);

const obZone = cciValues.map(v => v != null && v > ob ? v : null);
const osZone = cciValues.map(v => v != null && v < os ? v : null);
const neutral = cciValues.map(v => v != null && v >= os && v <= ob ? v : null);

plot(obZone, { color: '#ef4444', label: 'CCI OB', lineWidth: 2, pane: 'cci' });
plot(osZone, { color: '#22c55e', label: 'CCI OS', lineWidth: 2, pane: 'cci' });
plot(neutral, { color: '#6366f1', label: 'CCI', lineWidth: 1.5, pane: 'cci' });
hline(ob, { color: '#ef444440', style: 'dashed', pane: 'cci' });
hline(os, { color: '#22c55e40', style: 'dashed', pane: 'cci' });
hline(0, { color: '#6b728040', style: 'dotted', pane: 'cci' });`,
  },

  {
    id: 'mfi-money-flow',
    name: 'Money Flow Index',
    description: 'Volume-weighted RSI. Combines price and volume to identify buying/selling pressure.',
    category: 'volume',
    tags: ['subpane', 'volume', 'mfi', 'oscillator'],
    code: `const period = param('period', 14, { min: 5, max: 30, label: 'MFI Period' });

const mfiValues = mfi(null, period);

const ob = mfiValues.map(v => v != null && v > 80 ? v : null);
const os = mfiValues.map(v => v != null && v < 20 ? v : null);
const mid = mfiValues.map(v => v != null && v >= 20 && v <= 80 ? v : null);

plot(ob, { color: '#ef4444', label: 'MFI OB', lineWidth: 2, pane: 'mfi' });
plot(os, { color: '#22c55e', label: 'MFI OS', lineWidth: 2, pane: 'mfi' });
plot(mid, { color: '#3b82f6', label: 'MFI', lineWidth: 1.5, pane: 'mfi' });
hline(80, { color: '#ef444430', style: 'dashed', pane: 'mfi' });
hline(20, { color: '#22c55e30', style: 'dashed', pane: 'mfi' });`,
  },

  {
    id: 'obv-divergence',
    name: 'OBV with Signal',
    description: 'On-Balance Volume with EMA signal line. Divergences between OBV and price reveal hidden strength.',
    category: 'volume',
    tags: ['subpane', 'volume', 'obv'],
    code: `const signalP = param('signal', 20, { min: 5, max: 50, label: 'Signal Period' });

const obvValues = obv(null);
const signal = ema(obvValues, signalP);

// Histogram: OBV above/below signal
const hist = obvValues.map((v, i) =>
  (signal[i] != null) ? v - signal[i] : null
);
const histUp = hist.map(v => v != null && v >= 0 ? v : null);
const histDown = hist.map(v => v != null && v < 0 ? v : null);

plot(obvValues, { color: '#6366f1', label: 'OBV', lineWidth: 1.5, pane: 'obv' });
plot(signal, { color: '#f59e0b', label: 'Signal', lineWidth: 1, pane: 'obv' });`,
  },

  {
    id: 'hull-moving-average',
    name: 'Hull MA',
    description: 'Alan Hull\'s smoothed moving average — dramatically reduces lag while maintaining smoothness.',
    category: 'trend',
    tags: ['overlay', 'trend', 'hull', 'moving-average'],
    code: `const period = param('period', 20, { min: 5, max: 100, label: 'HMA Period' });

const hma = hullma(close, period);

// Color by slope direction
const rising = hma.map((v, i) => {
  tick();
  return (v != null && i > 0 && hma[i-1] != null && v >= hma[i-1]) ? v : null;
});
const falling = hma.map((v, i) => {
  tick();
  return (v != null && i > 0 && hma[i-1] != null && v < hma[i-1]) ? v : null;
});

plot(rising, { color: '#22c55e', label: 'HMA ↑', lineWidth: 2.5 });
plot(falling, { color: '#ef4444', label: 'HMA ↓', lineWidth: 2.5 });`,
  },

  {
    id: 'williams-r',
    name: 'Williams %R',
    description: 'Larry Williams momentum oscillator (-100 to 0). Fast, responsive overbought/oversold indicator.',
    category: 'momentum',
    tags: ['subpane', 'oscillator', 'williams', 'momentum'],
    code: `const period = param('period', 14, { min: 5, max: 30, label: 'Period' });

const wr = williamsR(null, period);

const ob = wr.map(v => v != null && v > -20 ? v : null);
const os = wr.map(v => v != null && v < -80 ? v : null);
const mid = wr.map(v => v != null && v >= -80 && v <= -20 ? v : null);

plot(ob, { color: '#ef4444', label: '%R OB', lineWidth: 2, pane: 'wr' });
plot(os, { color: '#22c55e', label: '%R OS', lineWidth: 2, pane: 'wr' });
plot(mid, { color: '#8b5cf6', label: '%R', lineWidth: 1.5, pane: 'wr' });
hline(-20, { color: '#ef444430', style: 'dashed', pane: 'wr' });
hline(-80, { color: '#22c55e30', style: 'dashed', pane: 'wr' });
hline(-50, { color: '#6b728030', style: 'dotted', pane: 'wr' });`,
  },

  // ─── NEW SCRIPTS ────────────────────────────────────────────

  {
    id: 'keltner-channels',
    name: 'Keltner Channels',
    description: 'EMA-based channels using ATR width. Price outside channels = high volatility breakout.',
    category: 'volatility',
    tags: ['keltner', 'channels', 'atr', 'breakout'],
    code: `const emaPeriod = param('EMA Period', 20, { min: 5, max: 50 });
const atrPeriod = param('ATR Period', 10, { min: 5, max: 30 });
const mult = param('Multiplier', 1.5, { min: 0.5, max: 4, step: 0.5 });

const kc = keltner(null, emaPeriod, atrPeriod, mult);
const upper = kc.map(k => k ? k.upper : null);
const lower = kc.map(k => k ? k.lower : null);
const mid = kc.map(k => k ? k.mid : null);

band(upper, lower, { color: '#3b82f6', fillColor: '#3b82f610', label: 'Keltner' });
plot(mid, { color: '#3b82f6', label: 'KC Mid', lineWidth: 1, style: 'dashed' });`,
  },

  {
    id: 'donchian-channels',
    name: 'Donchian Channels',
    description: 'Highest high / lowest low over N bars. Classic breakout system — Turtle Traders used this.',
    category: 'volatility',
    tags: ['donchian', 'channels', 'breakout', 'turtle'],
    code: `const period = param('Period', 20, { min: 5, max: 100 });

const dc = donchian(null, period);
const upper = dc.map(d => d ? d.upper : null);
const lower = dc.map(d => d ? d.lower : null);
const mid = dc.map(d => d ? d.mid : null);

band(upper, lower, { color: '#f59e0b', fillColor: '#f59e0b10', label: 'Donchian' });
plot(mid, { color: '#f59e0b80', label: 'Mid', lineWidth: 1, style: 'dotted' });

// Breakout markers
const breakUp = close.map((c, i) => upper[i] != null && i > 0 && c >= upper[i] && close[i-1] < upper[i]);
const breakDn = close.map((c, i) => lower[i] != null && i > 0 && c <= lower[i] && close[i-1] > lower[i]);

breakUp.forEach((b, i) => { if (b) marker(i, { position: 'below', color: '#22c55e', shape: 'triangle' }); });
breakDn.forEach((b, i) => { if (b) marker(i, { position: 'above', color: '#ef4444', shape: 'triangle' }); });`,
  },

  {
    id: 'supertrend-indicator',
    name: 'Supertrend',
    description: 'Trend-following indicator that flips between support and resistance. Green = bullish, red = bearish.',
    category: 'trend',
    tags: ['supertrend', 'trend', 'support', 'resistance'],
    code: `const period = param('Period', 10, { min: 5, max: 30 });
const mult = param('Multiplier', 3, { min: 1, max: 5, step: 0.5 });

const st = supertrend(null, period, mult);
const bull = st.line.map((v, i) => st.trend[i] === 1 ? v : null);
const bear = st.line.map((v, i) => st.trend[i] === -1 ? v : null);

plot(bull, { color: '#22c55e', label: 'ST Bull', lineWidth: 2 });
plot(bear, { color: '#ef4444', label: 'ST Bear', lineWidth: 2 });

// Flip markers
for (let i = 1; i < st.trend.length; i++) {
  if (st.trend[i] != null && st.trend[i-1] != null) {
    if (st.trend[i] === 1 && st.trend[i-1] === -1)
      marker(i, { position: 'below', color: '#22c55e', shape: 'diamond' });
    if (st.trend[i] === -1 && st.trend[i-1] === 1)
      marker(i, { position: 'above', color: '#ef4444', shape: 'diamond' });
  }
}`,
  },

  {
    id: 'vwap-bands',
    name: 'VWAP with Bands',
    description: 'VWAP with ±1 and ±2 standard deviation bands. Institutional traders watch these levels.',
    category: 'volume',
    tags: ['vwap', 'bands', 'institutional', 'mean-reversion'],
    code: `const vwapLine = vwap();
const dev = stdev(close, 20);

const upper1 = vwapLine.map((v, i) => v != null && dev[i] != null ? v + dev[i] : null);
const lower1 = vwapLine.map((v, i) => v != null && dev[i] != null ? v - dev[i] : null);
const upper2 = vwapLine.map((v, i) => v != null && dev[i] != null ? v + 2 * dev[i] : null);
const lower2 = vwapLine.map((v, i) => v != null && dev[i] != null ? v - 2 * dev[i] : null);

plot(vwapLine, { color: '#8b5cf6', label: 'VWAP', lineWidth: 2 });
band(upper1, lower1, { color: '#8b5cf640', fillColor: '#8b5cf608', label: '±1σ' });
band(upper2, lower2, { color: '#8b5cf620', fillColor: '#8b5cf604', label: '±2σ' });`,
  },

  {
    id: 'macd-histogram-pro',
    name: 'MACD Histogram Pro',
    description: 'MACD with color-coded histogram showing momentum acceleration/deceleration.',
    category: 'momentum',
    tags: ['macd', 'histogram', 'momentum', 'divergence'],
    code: `const fast = param('Fast', 12, { min: 5, max: 30 });
const slow = param('Slow', 26, { min: 15, max: 50 });
const sig = param('Signal', 9, { min: 3, max: 20 });

const m = macd(close, fast, slow, sig);
const macdLine = m.map(v => v ? v.macd : null);
const signalLine = m.map(v => v ? v.signal : null);
const hist = m.map(v => v ? v.histogram : null);

// Color histogram by momentum direction
const histUp = hist.map((v, i) => v != null && v > 0 && (i === 0 || hist[i-1] == null || v >= hist[i-1]) ? v : null);
const histUpWeak = hist.map((v, i) => v != null && v > 0 && i > 0 && hist[i-1] != null && v < hist[i-1] ? v : null);
const histDn = hist.map((v, i) => v != null && v < 0 && (i === 0 || hist[i-1] == null || v <= hist[i-1]) ? v : null);
const histDnWeak = hist.map((v, i) => v != null && v < 0 && i > 0 && hist[i-1] != null && v > hist[i-1] ? v : null);

plot(histUp, { color: '#22c55e', label: 'Hist +↑', type: 'histogram', pane: 'macd' });
plot(histUpWeak, { color: '#22c55e60', label: 'Hist +↓', type: 'histogram', pane: 'macd' });
plot(histDn, { color: '#ef4444', label: 'Hist -↓', type: 'histogram', pane: 'macd' });
plot(histDnWeak, { color: '#ef444460', label: 'Hist -↑', type: 'histogram', pane: 'macd' });
plot(macdLine, { color: '#3b82f6', label: 'MACD', lineWidth: 1.5, pane: 'macd' });
plot(signalLine, { color: '#f59e0b', label: 'Signal', lineWidth: 1.5, pane: 'macd' });`,
  },

  {
    id: 'adx-trend-strength',
    name: 'ADX Trend Strength',
    description: 'ADX with color zones: green (strong trend >25), yellow (developing), red (range-bound <20).',
    category: 'trend',
    tags: ['adx', 'trend', 'strength', 'directional'],
    code: `const period = param('Period', 14, { min: 5, max: 30 });

const adxResult = adx(null, period);
const adxLine = adxResult.map(a => a ? a.adx : null);
const plusDI = adxResult.map(a => a ? a.plusDI : null);
const minusDI = adxResult.map(a => a ? a.minusDI : null);

// Color-coded ADX
const strong = adxLine.map(v => v != null && v >= 25 ? v : null);
const developing = adxLine.map(v => v != null && v >= 20 && v < 25 ? v : null);
const weak = adxLine.map(v => v != null && v < 20 ? v : null);

plot(strong, { color: '#22c55e', label: 'ADX Strong', lineWidth: 2.5, pane: 'adx' });
plot(developing, { color: '#f59e0b', label: 'ADX Dev', lineWidth: 2, pane: 'adx' });
plot(weak, { color: '#ef4444', label: 'ADX Weak', lineWidth: 1.5, pane: 'adx' });
plot(plusDI, { color: '#3b82f680', label: '+DI', lineWidth: 1, pane: 'adx' });
plot(minusDI, { color: '#ef444480', label: '-DI', lineWidth: 1, pane: 'adx' });
hline(25, { color: '#22c55e30', style: 'dashed', pane: 'adx' });
hline(20, { color: '#ef444430', style: 'dashed', pane: 'adx' });`,
  },

  {
    id: 'chaikin-money-flow',
    name: 'Chaikin Money Flow',
    description: 'Measures buying/selling pressure. Positive = accumulation, negative = distribution.',
    category: 'volume',
    tags: ['cmf', 'chaikin', 'money-flow', 'accumulation'],
    code: `const period = param('Period', 20, { min: 5, max: 50 });

const cmfValues = cmf(null, period);

const bullCmf = cmfValues.map(v => v != null && v > 0 ? v : null);
const bearCmf = cmfValues.map(v => v != null && v <= 0 ? v : null);

plot(bullCmf, { color: '#22c55e', label: 'CMF +', type: 'histogram', pane: 'cmf' });
plot(bearCmf, { color: '#ef4444', label: 'CMF -', type: 'histogram', pane: 'cmf' });
hline(0, { color: '#6b728050', pane: 'cmf' });
hline(0.05, { color: '#22c55e20', style: 'dotted', pane: 'cmf' });
hline(-0.05, { color: '#ef444420', style: 'dotted', pane: 'cmf' });`,
  },

  {
    id: 'multi-momentum',
    name: 'Multi-Momentum Scanner',
    description: 'RSI + ROC + MFI combined view. When all three align, momentum is strongest.',
    category: 'momentum',
    tags: ['rsi', 'roc', 'mfi', 'multi', 'scanner'],
    code: `const period = param('Period', 14, { min: 5, max: 30 });

const rsiVals = rsi(close, period);
const rocVals = roc(close, period);
const mfiVals = mfi(null, period);

// Normalize all to 0-100 for comparison
const rocNorm = rocVals.map(v => v != null ? 50 + v : null);

plot(rsiVals, { color: '#8b5cf6', label: 'RSI', lineWidth: 1.5, pane: 'mom' });
plot(rocNorm, { color: '#f59e0b', label: 'ROC (norm)', lineWidth: 1, pane: 'mom' });
plot(mfiVals, { color: '#06b6d4', label: 'MFI', lineWidth: 1, pane: 'mom' });
hline(70, { color: '#ef444430', style: 'dashed', pane: 'mom' });
hline(30, { color: '#22c55e30', style: 'dashed', pane: 'mom' });
hline(50, { color: '#6b728030', style: 'dotted', pane: 'mom' });

// Confluence markers on main chart
for (let i = 0; i < close.length; i++) {
  if (rsiVals[i] > 70 && mfiVals[i] > 80 && rocNorm[i] > 65)
    marker(i, { position: 'above', color: '#ef4444', shape: 'circle' });
  if (rsiVals[i] < 30 && mfiVals[i] < 20 && rocNorm[i] < 35)
    marker(i, { position: 'below', color: '#22c55e', shape: 'circle' });
}`,
  },
];

export const SCRIPT_CATEGORIES = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'trend', label: 'Trend', icon: '📈' },
  { id: 'momentum', label: 'Momentum', icon: '⚡' },
  { id: 'volatility', label: 'Volatility', icon: '🌊' },
  { id: 'volume', label: 'Volume', icon: '📊' },
  { id: 'oscillator', label: 'Oscillators', icon: '〰️' },
  { id: 'custom', label: 'Custom', icon: '🔧' },
];

export default BUILTIN_SCRIPTS;
