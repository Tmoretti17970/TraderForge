// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — compInd.js (Backward Compatibility Shim)
// Indicator computation is now in src/chartEngine/indicators/
// ═══════════════════════════════════════════════════════════════════

import * as C from '../chartEngine/indicators/computations.js';

export function compInd(type, data, params = {}) {
  const closes = data.map(b => b.close);
  switch (type) {
    case 'sma': return C.sma(closes, params.period || 20);
    case 'ema': return C.ema(closes, params.period || 20);
    case 'wma': return C.wma(closes, params.period || 20);
    case 'bb': case 'bollinger': return C.bollingerBands(closes, params.period || 20, params.stdDev || 2);
    case 'rsi': return C.rsi(closes, params.period || 14);
    case 'macd': return C.macd(closes, params.fast || 12, params.slow || 26, params.signal || 9);
    case 'atr': return C.atr(data, params.period || 14);
    case 'vwap': return C.vwap(data);
    case 'stoch': case 'stochastic': return C.stochastic(data, params.kPeriod || 14, params.dPeriod || 3);
    case 'cci': return C.cci(data, params.period || 20);
    case 'obv': return C.obv(data);
    case 'mfi': return C.mfi(data, params.period || 14);
    case 'roc': return C.roc(closes, params.period || 12);
    case 'williamsR': return C.williamsR(data, params.period || 14);
    default: return closes.map(() => NaN);
  }
}
