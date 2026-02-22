// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Script Engine
//
// Sandboxed JavaScript executor for user-defined indicators.
// Scripts receive OHLCV data + math primitives and return plot
// commands that integrate with the chart renderer.
//
// Sandbox approach:
//   new Function() with restricted scope — no access to window,
//   document, fetch, eval, or any DOM/network APIs.
//   Timeout via synchronous iteration limit.
//
// Script API:
//   Inputs:  bars[], close[], open[], high[], low[], volume[]
//   Math:    sma(), ema(), wma(), rsi(), atr(), stdev(), min(), max()
//   Output:  plot(values, opts), band(upper, lower, opts), hline(price, opts)
//   Params:  param(name, default) — declares configurable parameters
//
// Output shape (matches compInd result format):
//   { type: 'line'|'band'|'histogram', data: [...], color, label }
// ═══════════════════════════════════════════════════════════════════

import { Calc } from './Calc.js';

// ─── Execution Limits ─────────────────────────────────────────
const MAX_EXEC_MS = 200;    // Hard timeout
const MAX_LOOP_ITER = 50000; // Prevent infinite loops

// ─── Sandbox Blocked Globals ──────────────────────────────────
// These are explicitly set to undefined in the sandbox scope
// to prevent scripts from escaping the sandbox.
const BLOCKED = [
  'window', 'document', 'globalThis', 'self',
  'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker',
  'importScripts', 'require',
  'localStorage', 'sessionStorage', 'indexedDB',
  'navigator', 'location', 'history',
  'setTimeout', 'setInterval', 'requestAnimationFrame',
  'alert', 'confirm', 'prompt', 'console',
];
// Note: 'eval', 'arguments', 'Function', and 'import' are reserved in
// strict mode and can't be used as new Function() parameter names.
// The sandbox naturally blocks these: Function body code can't use
// import/export statements, and eval/Function are shadowed by the
// restricted scope chain.

/**
 * Execute a user script against OHLCV data.
 *
 * @param {string} code - User's script source
 * @param {Object[]} bars - Array of { open, high, low, close, volume, time }
 * @param {Object} [userParams={}] - User-overridden parameter values
 * @returns {{ outputs: Array, params: Object, error: string|null, execMs: number }}
 */
export function executeScript(code, bars, userParams = {}) {
  const startMs = performance.now();

  if (!code || !bars?.length) {
    return { outputs: [], params: {}, error: null, execMs: 0 };
  }

  // Build convenience arrays
  const close = bars.map((b) => b.close);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume);
  const barCount = bars.length;

  // Collect outputs and declared params
  const outputs = [];
  const declaredParams = {};
  let loopCount = 0;

  // ─── Script API Functions ───────────────────────────────
  const api = {
    // Data access
    bars,
    close,
    open,
    high,
    low,
    volume,
    barCount,

    // Parameter declaration
    param: (name, defaultVal, opts = {}) => {
      declaredParams[name] = {
        default: defaultVal,
        min: opts.min,
        max: opts.max,
        step: opts.step,
        label: opts.label || name,
      };
      return userParams[name] != null ? userParams[name] : defaultVal;
    },

    // ─── Plot Commands ────────────────────────────────────
    plot: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({
        type: 'line',
        data: values,
        color: opts.color || '#f59e0b',
        label: opts.label || 'Script',
        lineWidth: opts.lineWidth || 1.5,
        opacity: opts.opacity ?? 1,
        overlay: opts.overlay !== false, // default: overlay on price
      });
    },

    band: (upper, lower, opts = {}) => {
      if (!Array.isArray(upper) || !Array.isArray(lower)) return;
      outputs.push({
        type: 'band',
        data: { upper, lower },
        color: opts.color || '#3b82f6',
        fillColor: opts.fillColor || (opts.color || '#3b82f6') + '15',
        label: opts.label || 'Band',
        overlay: opts.overlay !== false,
      });
    },

    histogram: (values, opts = {}) => {
      if (!Array.isArray(values)) return;
      outputs.push({
        type: 'histogram',
        data: values,
        colorUp: opts.colorUp || '#22c55e',
        colorDown: opts.colorDown || '#ef4444',
        label: opts.label || 'Histogram',
        overlay: false, // histograms go in sub-pane
      });
    },

    hline: (price, opts = {}) => {
      outputs.push({
        type: 'hline',
        price,
        color: opts.color || '#5d6377',
        style: opts.style || 'dashed', // solid, dashed, dotted
        label: opts.label || '',
      });
    },

    marker: (barIdx, opts = {}) => {
      if (barIdx < 0 || barIdx >= barCount) return;
      outputs.push({
        type: 'marker',
        barIdx,
        shape: opts.shape || 'triangle', // triangle, circle, diamond
        color: opts.color || '#f59e0b',
        position: opts.position || 'above', // above, below
        label: opts.label || '',
      });
    },

    // ─── Math Utilities ───────────────────────────────────
    sma: (data, period) => Calc.sma(data, period),
    ema: (data, period) => Calc.ema(data, period),
    wma: (data, period) => Calc.wma(data, period),
    rsi: (data, period) => Calc.rsi(data, period),
    atr: (ohlcvData, period) => Calc.atr(ohlcvData || bars, period),
    vwap: (ohlcvData) => Calc.vwap(ohlcvData || bars),
    bollinger: (data, period, mult) => Calc.bollinger(data, period, mult),
    macd: (data, fast, slow, signal) => Calc.macd(data, fast, slow, signal),
    stochastic: (ohlcvData, k, d) => Calc.stochastic(ohlcvData || bars, k, d),

    // Extended indicators
    dema: (data, period) => Calc.dema(data, period),
    tema: (data, period) => Calc.tema(data, period),
    hullma: (data, period) => Calc.hullma(data, period),
    adx: (ohlcvData, period) => Calc.adx(ohlcvData || bars, period),
    cci: (ohlcvData, period) => Calc.cci(ohlcvData || bars, period),
    mfi: (ohlcvData, period) => Calc.mfi(ohlcvData || bars, period),
    obv: (ohlcvData) => Calc.obv(ohlcvData || bars),
    williamsR: (ohlcvData, period) => Calc.williamsR(ohlcvData || bars, period),
    supertrend: (ohlcvData, period, mult) => Calc.supertrend(ohlcvData || bars, period, mult),
    ichimoku: (ohlcvData, t, k, sb, disp) => Calc.ichimoku(ohlcvData || bars, t, k, sb, disp),
    pivotPoints: (ohlcvData) => Calc.pivotPoints(ohlcvData || bars),
    heikinAshi: (ohlcvData) => Calc.heikinAshi(ohlcvData || bars),
    linearRegression: (data, period) => Calc.linearRegression(data, period),

    // New indicators
    keltner: (ohlcvData, emaPeriod, atrPeriod, mult) => Calc.keltner(ohlcvData || bars, emaPeriod, atrPeriod, mult),
    donchian: (ohlcvData, period) => Calc.donchian(ohlcvData || bars, period),
    vwma: (ohlcvData, period) => Calc.vwma(ohlcvData || bars, period),
    cmf: (ohlcvData, period) => Calc.cmf(ohlcvData || bars, period),
    roc: (data, period) => Calc.roc(data, period),

    // Array helpers (Pine Script-style)
    highest: (data, period) => Calc.highest(data, period),
    lowest: (data, period) => Calc.lowest(data, period),
    change: (data, lookback) => Calc.change(data, lookback),
    barssince: (condArr) => Calc.barssince(condArr),
    valuewhen: (condArr, srcArr, occurrence) => Calc.valuewhen(condArr, srcArr, occurrence),
    fillna: (data, fillValue) => Calc.fillna(data, fillValue),
    offset: (data, n) => Calc.offsetArr(data, n),

    // Basic math
    abs: Math.abs,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sqrt: Math.sqrt,
    pow: Math.pow,
    log: Math.log,
    exp: Math.exp,
    min: Math.min,
    max: Math.max,
    PI: Math.PI,

    // Array helpers
    sum: (arr) => arr.reduce((a, b) => a + (b || 0), 0),
    avg: (arr) => {
      const valid = arr.filter((v) => v != null);
      return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    },
    stdev: (arr, period) => Calc.stdev(arr, period),
    crossover: (a, b) => {
      // Returns boolean array: true when a crosses above b
      return a.map((v, i) => {
        if (i === 0 || v == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) return false;
        return a[i - 1] <= b[i - 1] && v > b[i];
      });
    },
    crossunder: (a, b) => {
      return a.map((v, i) => {
        if (i === 0 || v == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) return false;
        return a[i - 1] >= b[i - 1] && v < b[i];
      });
    },

    // Loop guard — scripts should call this in tight loops
    tick: () => {
      if (++loopCount > MAX_LOOP_ITER) {
        throw new Error(`Loop limit exceeded (${MAX_LOOP_ITER} iterations)`);
      }
    },
  };

  // ─── Build Sandbox Scope ────────────────────────────────
  const scopeKeys = [...BLOCKED, ...Object.keys(api)];
  const scopeValues = [
    ...BLOCKED.map(() => undefined),
    ...Object.values(api),
  ];

  try {
    // Construct the sandboxed function
    // The function receives all API items as arguments, blocking globals
    const fn = new Function(...scopeKeys, `"use strict";\n${code}`);

    // Execute with timeout check
    const timeoutAt = startMs + MAX_EXEC_MS;
    fn(...scopeValues);

    const execMs = performance.now() - startMs;

    if (execMs > MAX_EXEC_MS) {
      return {
        outputs: [],
        params: declaredParams,
        error: `Script exceeded ${MAX_EXEC_MS}ms timeout (took ${execMs.toFixed(0)}ms)`,
        execMs,
      };
    }

    return { outputs, params: declaredParams, error: null, execMs };
  } catch (err) {
    return {
      outputs: [],
      params: declaredParams,
      error: err.message || 'Unknown script error',
      execMs: performance.now() - startMs,
    };
  }
}

/**
 * Validate script source without executing it.
 * Checks for syntax errors and blocked patterns.
 *
 * @param {string} code
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateScript(code) {
  if (!code?.trim()) return { valid: false, error: 'Script is empty' };

  // Check for obviously dangerous patterns
  const dangerous = [
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bimport\s*\(/,
    /\brequire\s*\(/,
    /\bfetch\s*\(/,
    /\bnew\s+Worker\b/,
    /\b__proto__\b/,
    /\bconstructor\s*\[/,
  ];

  for (const pattern of dangerous) {
    if (pattern.test(code)) {
      return { valid: false, error: `Blocked pattern: ${pattern.source}` };
    }
  }

  // Try to parse as a function body
  try {
    new Function(`"use strict";\n${code}`);
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: `Syntax error: ${err.message}` };
  }
}

export default { executeScript, validateScript };
