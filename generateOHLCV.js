// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — OHLCV Demo Data Generator
// Produces realistic-looking candle data with:
//   - Random walk with drift
//   - Momentum + mean reversion
//   - Volatility clustering (GARCH-like)
//   - Volume spikes on big moves
//   - Support/resistance memory
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate N bars of realistic OHLCV data.
 * @param {string} symbol - Symbol name (affects base price)
 * @param {number} bars - Number of bars to generate
 * @param {string} tf - Timeframe id from TFS
 * @returns {Array<{time: number, date: string, open: number, high: number, low: number, close: number, volume: number}>}
 */
export function generateOHLCV(symbol = 'BTC', bars = 200, tf = '3m') {
  // Seed-like deterministic sequence per symbol
  let s = hashCode(symbol + tf);
  const rand = () => { s = (s * 16807 + 11) % 2147483647; return (s & 0x7fffffff) / 0x7fffffff; };
  const randn = () => {
    // Box-Muller for normal distribution
    const u1 = rand();
    const u2 = rand();
    return Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
  };

  // Base price by symbol type
  const basePrice = getBasePrice(symbol);
  const tickSize = basePrice > 1000 ? 0.01 : basePrice > 100 ? 0.01 : 0.0001;

  // Interval in ms
  const intervalMs = getIntervalMs(tf);

  // Start time: bars * interval ago from now
  const now = Date.now();
  const startTime = now - bars * intervalMs;

  // Generate
  let price = basePrice * (0.9 + rand() * 0.2); // ±10% from base
  let volatility = 0.015; // 1.5% daily vol baseline
  let momentum = 0;
  const baseVol = 1000 + rand() * 9000;

  const data = [];

  for (let i = 0; i < bars; i++) {
    const time = startTime + i * intervalMs;
    const date = new Date(time).toISOString();

    // GARCH-like volatility clustering
    volatility = volatility * 0.94 + 0.015 * 0.04 + Math.abs(randn()) * 0.005;
    volatility = Math.max(0.003, Math.min(0.06, volatility));

    // Momentum with decay
    momentum = momentum * 0.92 + randn() * 0.3;

    // Mean reversion toward base
    const reversion = (basePrice - price) / basePrice * 0.02;

    // Price change
    const change = (randn() * volatility + momentum * 0.001 + reversion) * price;
    const newPrice = price + change;

    // Generate OHLC from the move
    const open = round(price, tickSize);
    const close = round(newPrice, tickSize);
    const spread = Math.abs(close - open);
    const wickUp = spread * (0.2 + rand() * 1.5);
    const wickDown = spread * (0.2 + rand() * 1.5);

    const high = round(Math.max(open, close) + wickUp, tickSize);
    const low = round(Math.min(open, close) - wickDown, tickSize);

    // Volume: higher on big moves
    const volMultiplier = 1 + Math.abs(change / price) * 30 + (rand() > 0.95 ? 3 : 0);
    const volume = Math.round(baseVol * volMultiplier * (0.5 + rand()));

    data.push({ time, date, open, high, low: Math.max(low, tickSize), close, volume });

    price = newPrice;
    if (price < tickSize * 10) price = tickSize * 10; // floor
  }

  return data;
}

// ─── Helpers ────────────────────────────────────────────────────

function hashCode(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7fffffff;
  }
  return hash || 1;
}

function round(val, tick) {
  return Math.round(val / tick) * tick;
}

function getBasePrice(symbol) {
  const s = symbol.toUpperCase();
  if (s === 'BTC') return 67000;
  if (s === 'ETH') return 3400;
  if (s === 'SOL') return 145;
  if (s === 'ES') return 5200;
  if (s === 'NQ') return 18400;
  if (s === 'CL') return 78;
  if (s === 'GC') return 2340;
  if (s === 'AAPL') return 185;
  if (s === 'MSFT') return 415;
  if (s === 'SPY') return 520;
  if (s === 'TSLA') return 175;
  if (s === 'NVDA') return 880;
  if (s === 'AMZN') return 180;
  if (s === 'GOOGL') return 155;
  return 100 + hashCode(s) % 900;
}

function getIntervalMs(tf) {
  switch (tf) {
    case '1d': return 5 * 60 * 1000;      // 5min candles
    case '5d': return 15 * 60 * 1000;     // 15min candles
    case '1m': return 60 * 60 * 1000;     // 1h candles
    case '3m': return 24 * 60 * 60 * 1000; // daily
    case '6m': return 24 * 60 * 60 * 1000; // daily
    case '1y': return 7 * 24 * 60 * 60 * 1000; // weekly
    default: return 24 * 60 * 60 * 1000;
  }
}

export default generateOHLCV;
