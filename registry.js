// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Indicator Registry
// Central registry of all indicators with metadata, default params,
// computation bindings, and rendering configuration.
//
// Two rendering modes:
//   overlay — renders on the main chart pane (SMA, EMA, BB, VWAP)
//   pane    — renders in a separate pane below (RSI, MACD, Stoch)
//
// Each indicator definition:
//   - id, name, shortName
//   - mode: 'overlay' | 'pane'
//   - params: configurable parameters with defaults
//   - outputs: what the compute function returns
//   - compute(bars, params): returns computed values
//   - render config: colors, line styles, fills, bands
// ═══════════════════════════════════════════════════════════════════

import * as C from './computations.js';

/**
 * @typedef {Object} IndicatorOutput
 * @property {string} key    - Output key name
 * @property {string} label  - Display label
 * @property {string} color  - Default color
 * @property {number} width  - Line width
 * @property {string} type   - 'line' | 'histogram' | 'band' | 'dots'
 * @property {number[]} [dash] - Dash pattern
 */

/**
 * @typedef {Object} IndicatorDef
 * @property {string}   id
 * @property {string}   name
 * @property {string}   shortName
 * @property {string}   mode       - 'overlay' | 'pane'
 * @property {Object}   params     - { paramName: { default, min, max, step, label } }
 * @property {IndicatorOutput[]} outputs
 * @property {Function} compute    - (bars, params) => { [outputKey]: number[] }
 * @property {Object}   [paneConfig] - For pane indicators: { min, max, bands }
 */

/** All built-in indicators */
export const INDICATORS = {

  // ═══ Overlay Indicators ═══

  sma: {
    id: 'sma',
    name: 'Simple Moving Average',
    shortName: 'SMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'sma', label: 'SMA', color: '#2962FF', width: 2, type: 'line' },
    ],
    compute(bars, params) {
      return { sma: C.sma(C.closes(bars), params.period) };
    },
  },

  ema: {
    id: 'ema',
    name: 'Exponential Moving Average',
    shortName: 'EMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'ema', label: 'EMA', color: '#FF6D00', width: 2, type: 'line' },
    ],
    compute(bars, params) {
      return { ema: C.ema(C.closes(bars), params.period) };
    },
  },

  wma: {
    id: 'wma',
    name: 'Weighted Moving Average',
    shortName: 'WMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'wma', label: 'WMA', color: '#AB47BC', width: 2, type: 'line' },
    ],
    compute(bars, params) {
      return { wma: C.wma(C.closes(bars), params.period) };
    },
  },

  dema: {
    id: 'dema',
    name: 'Double EMA',
    shortName: 'DEMA',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 2, max: 500, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'dema', label: 'DEMA', color: '#00BCD4', width: 2, type: 'line' },
    ],
    compute(bars, params) {
      return { dema: C.dema(C.closes(bars), params.period) };
    },
  },

  bb: {
    id: 'bb',
    name: 'Bollinger Bands',
    shortName: 'BB',
    mode: 'overlay',
    params: {
      period: { default: 20, min: 5, max: 200, step: 1, label: 'Period' },
      stdDev: { default: 2, min: 0.5, max: 5, step: 0.5, label: 'Std Dev' },
    },
    outputs: [
      { key: 'upper',  label: 'Upper',  color: '#2962FF', width: 1, type: 'line', dash: [] },
      { key: 'middle', label: 'Middle', color: '#2962FF', width: 1, type: 'line', dash: [4, 4] },
      { key: 'lower',  label: 'Lower',  color: '#2962FF', width: 1, type: 'line', dash: [] },
    ],
    fills: [{ upper: 'upper', lower: 'lower', color: 'rgba(41, 98, 255, 0.08)' }],
    compute(bars, params) {
      return C.bollingerBands(C.closes(bars), params.period, params.stdDev);
    },
  },

  vwap: {
    id: 'vwap',
    name: 'Volume Weighted Average Price',
    shortName: 'VWAP',
    mode: 'overlay',
    params: {},
    outputs: [
      { key: 'vwap', label: 'VWAP', color: '#FF6D00', width: 2, type: 'line' },
    ],
    compute(bars) {
      return { vwap: C.vwap(bars) };
    },
  },

  // ═══ Pane Indicators ═══

  rsi: {
    id: 'rsi',
    name: 'Relative Strength Index',
    shortName: 'RSI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'rsi', label: 'RSI', color: '#AB47BC', width: 2, type: 'line' },
    ],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 70, color: 'rgba(239, 83, 80, 0.3)', label: '70', dash: [4, 4] },
        { value: 30, color: 'rgba(38, 166, 154, 0.3)', label: '30', dash: [4, 4] },
        { value: 50, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
      fills: [
        { above: 70, color: 'rgba(239, 83, 80, 0.06)' },
        { below: 30, color: 'rgba(38, 166, 154, 0.06)' },
      ],
    },
    compute(bars, params) {
      return { rsi: C.rsi(C.closes(bars), params.period) };
    },
  },

  macd: {
    id: 'macd',
    name: 'MACD',
    shortName: 'MACD',
    mode: 'pane',
    params: {
      fast:   { default: 12, min: 2, max: 100, step: 1, label: 'Fast' },
      slow:   { default: 26, min: 2, max: 200, step: 1, label: 'Slow' },
      signal: { default: 9,  min: 2, max: 100, step: 1, label: 'Signal' },
    },
    outputs: [
      { key: 'macd',      label: 'MACD',      color: '#2962FF', width: 2, type: 'line' },
      { key: 'signal',    label: 'Signal',    color: '#FF6D00', width: 1, type: 'line' },
      { key: 'histogram', label: 'Histogram', color: '#26A69A', width: 0, type: 'histogram' },
    ],
    paneConfig: {
      bands: [
        { value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return C.macd(C.closes(bars), params.fast, params.slow, params.signal);
    },
  },

  stochastic: {
    id: 'stochastic',
    name: 'Stochastic Oscillator',
    shortName: 'Stoch',
    mode: 'pane',
    params: {
      kPeriod: { default: 14, min: 2, max: 100, step: 1, label: '%K' },
      dPeriod: { default: 3,  min: 2, max: 50,  step: 1, label: '%D' },
    },
    outputs: [
      { key: 'k', label: '%K', color: '#2962FF', width: 2, type: 'line' },
      { key: 'd', label: '%D', color: '#FF6D00', width: 1, type: 'line', dash: [4, 4] },
    ],
    paneConfig: {
      min: 0,
      max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return C.stochastic(bars, params.kPeriod, params.dPeriod);
    },
  },

  atr: {
    id: 'atr',
    name: 'Average True Range',
    shortName: 'ATR',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'atr', label: 'ATR', color: '#26A69A', width: 2, type: 'line' },
    ],
    paneConfig: {},
    compute(bars, params) {
      return { atr: C.atr(bars, params.period) };
    },
  },

  cci: {
    id: 'cci',
    name: 'Commodity Channel Index',
    shortName: 'CCI',
    mode: 'pane',
    params: {
      period: { default: 20, min: 5, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'cci', label: 'CCI', color: '#FF6D00', width: 2, type: 'line' },
    ],
    paneConfig: {
      bands: [
        { value: 100, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -100, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
        { value: 0, color: 'rgba(120, 123, 134, 0.2)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { cci: C.cci(bars, params.period) };
    },
  },

  mfi: {
    id: 'mfi',
    name: 'Money Flow Index',
    shortName: 'MFI',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'mfi', label: 'MFI', color: '#42A5F5', width: 2, type: 'line' },
    ],
    paneConfig: {
      min: 0, max: 100,
      bands: [
        { value: 80, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: 20, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return { mfi: C.mfi(bars, params.period) };
    },
  },

  williamsR: {
    id: 'williamsR',
    name: 'Williams %R',
    shortName: '%R',
    mode: 'pane',
    params: {
      period: { default: 14, min: 2, max: 100, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'williamsR', label: '%R', color: '#EC407A', width: 2, type: 'line' },
    ],
    paneConfig: {
      min: -100, max: 0,
      bands: [
        { value: -20, color: 'rgba(239, 83, 80, 0.3)', dash: [4, 4] },
        { value: -80, color: 'rgba(38, 166, 154, 0.3)', dash: [4, 4] },
      ],
    },
    compute(bars, params) {
      return { williamsR: C.williamsR(bars, params.period) };
    },
  },

  obv: {
    id: 'obv',
    name: 'On Balance Volume',
    shortName: 'OBV',
    mode: 'pane',
    params: {},
    outputs: [
      { key: 'obv', label: 'OBV', color: '#66BB6A', width: 2, type: 'line' },
    ],
    paneConfig: {},
    compute(bars) {
      return { obv: C.obv(bars) };
    },
  },

  roc: {
    id: 'roc',
    name: 'Rate of Change',
    shortName: 'ROC',
    mode: 'pane',
    params: {
      period: { default: 12, min: 1, max: 200, step: 1, label: 'Period' },
    },
    outputs: [
      { key: 'roc', label: 'ROC', color: '#78909C', width: 2, type: 'line' },
    ],
    paneConfig: {
      bands: [
        { value: 0, color: 'rgba(120, 123, 134, 0.3)', dash: [2, 4] },
      ],
    },
    compute(bars, params) {
      return { roc: C.roc(C.closes(bars), params.period) };
    },
  },
};

/** Get an indicator definition by ID */
export function getIndicator(id) {
  return INDICATORS[id] || null;
}

/** Get all overlay indicators */
export function getOverlayIndicators() {
  return Object.values(INDICATORS).filter(i => i.mode === 'overlay');
}

/** Get all pane indicators */
export function getPaneIndicators() {
  return Object.values(INDICATORS).filter(i => i.mode === 'pane');
}

/** Get all indicator definitions as a list */
export function getAllIndicators() {
  return Object.values(INDICATORS);
}

/**
 * Create an active indicator instance from a definition.
 * @param {string} indicatorId
 * @param {Object} [paramOverrides]
 * @param {Object} [styleOverrides]
 * @returns {Object} Active indicator instance
 */
export function createIndicatorInstance(indicatorId, paramOverrides = {}, styleOverrides = {}) {
  const def = INDICATORS[indicatorId];
  if (!def) throw new Error(`Unknown indicator: ${indicatorId}`);

  // Build params from defaults + overrides
  const params = {};
  for (const [key, config] of Object.entries(def.params)) {
    params[key] = paramOverrides[key] !== undefined ? paramOverrides[key] : config.default;
  }

  // Build outputs with style overrides
  const outputs = def.outputs.map(o => ({
    ...o,
    ...styleOverrides[o.key],
  }));

  return {
    id: `${indicatorId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    indicatorId,
    name: def.name,
    shortName: def.shortName,
    mode: def.mode,
    params,
    outputs,
    fills: def.fills,
    paneConfig: def.paneConfig,
    visible: true,
    computed: null, // Filled after compute()

    /** Compute indicator values from bar data */
    compute(bars) {
      this.computed = def.compute(bars, this.params);
      return this.computed;
    },

    /** Get the parameter label string (e.g., "SMA(20)") */
    get label() {
      const paramStr = Object.values(this.params).join(', ');
      return paramStr ? `${def.shortName}(${paramStr})` : def.shortName;
    },
  };
}
