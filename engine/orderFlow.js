// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Order Flow / Volume Profile
// Extracted from v9.3 monolith (genVP function).
// Generates simulated volume profile data for a given OHLC bar.
// Uses deterministic seeded PRNG for stable rendering.
// ═══════════════════════════════════════════════════════════════════

// WeakMap cache keyed by bar object reference
const VP_CACHE = new WeakMap();

/**
 * Generate volume profile levels for a single OHLC bar.
 * Uses a seeded PRNG derived from the bar's OHLC values for deterministic output.
 *
 * @param {{ open: number, high: number, low: number, close: number }} bar
 * @param {number} [levels=16] — number of price levels
 * @returns {{ levels: VPLevel[], poc: number, totalVol: number } | null}
 */
function genVolumeProfile(bar, levels = 16) {
  if (!bar || typeof bar.high !== 'number') return null;

  // Check cache
  const cached = VP_CACHE.get(bar);
  if (cached && cached.n === levels) return cached;

  const { open, high, low, close } = bar;
  const range = high - low;
  if (range <= 0) return null;

  const step = range / levels;
  const up = close >= open;

  // Seeded PRNG (LCG)
  let seed = Math.abs(open * 1000 + close * 777 + high * 333 + low * 111) | 0;
  const rng = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 10000) / 10000;
  };

  const result = { levels: [], poc: 0, totalVol: 0, n: levels };
  let maxVol = 0;

  for (let i = 0; i < levels; i++) {
    const price = low + step * (i + 0.5);

    // POC tends to be near the close side of the bar
    const pocPrice = up
      ? open * 0.4 + close * 0.6
      : open * 0.6 + close * 0.4;

    const dist = Math.abs(price - pocPrice) / range;

    // Gaussian-like distribution centered on POC
    const base = Math.exp(-dist * dist * 8) * (0.7 + rng() * 0.6);

    // Extra volume at open and close prices
    const vol = base
      + (Math.abs(price - open) < step * 1.2 ? 0.3 : 0)
      + (Math.abs(price - close) < step * 1.2 ? 0.3 : 0);

    // Bid/ask split based on direction
    let askRatio;
    if (up) {
      askRatio = price > close ? 0.55 + rng() * 0.15 : 0.3 + rng() * 0.15;
    } else {
      askRatio = price < close ? 0.55 + rng() * 0.15 : 0.3 + rng() * 0.15;
    }

    const askVol = vol * askRatio;
    const bidVol = vol * (1 - askRatio);

    result.levels.push({
      price,
      bidVol,
      askVol,
      totalVol: vol,
      delta: bidVol - askVol,
    });

    result.totalVol += vol;
    if (vol > maxVol) {
      maxVol = vol;
      result.poc = i;
    }
  }

  // Normalize volumes to 0-1 range
  if (maxVol > 0) {
    result.levels.forEach((l) => {
      l.bidVol /= maxVol;
      l.askVol /= maxVol;
      l.totalVol /= maxVol;
      l.delta = l.bidVol - l.askVol;
    });
  }

  VP_CACHE.set(bar, result);
  return result;
}

/**
 * Clear the VP cache (useful for testing).
 */
function clearVPCache() {
  // WeakMap clears itself when references are GC'd,
  // but this is a no-op for explicit clearing.
  // For testing, create fresh bar objects.
}

export { genVolumeProfile, clearVPCache };
export default genVolumeProfile;
