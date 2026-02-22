// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — LayoutCache
//
// Memoizes _computeLayout() results to avoid recalculating on every
// frame during panning. The layout only changes when viewport bounds,
// data length, chart type, or candle mode changes.
//
// Key structure: `${startIdx}_${endIdx}_${dataLen}_${chartType}_${candleMode}`
//
// Usage:
//   const cache = new LayoutCache({ maxEntries: 8 });
//   const layout = cache.getOrCompute(key, () => expensiveLayout());
//   cache.invalidate(); // on data/config change
// ═══════════════════════════════════════════════════════════════════

class LayoutCache {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxEntries=8] — max cached layouts (LRU eviction)
   */
  constructor(opts = {}) {
    this._max = opts.maxEntries ?? 8;
    this._cache = new Map();
    this._hits = 0;
    this._misses = 0;
  }

  /**
   * Build a cache key from layout parameters.
   *
   * @param {number} startIdx — viewport start index
   * @param {number} endIdx — viewport end index
   * @param {number} dataLen — total data length
   * @param {string} chartType — 'candles' | 'line' | etc.
   * @param {string} candleMode — 'standard' | 'heikinashi'
   * @param {number} [width] — canvas width (optional, for resize detection)
   * @param {number} [height] — canvas height
   * @returns {string}
   */
  static buildKey(startIdx, endIdx, dataLen, chartType, candleMode, width = 0, height = 0) {
    return `${startIdx}_${endIdx}_${dataLen}_${chartType}_${candleMode}_${width}_${height}`;
  }

  /**
   * Get a cached layout or compute and cache it.
   *
   * @param {string} key — from buildKey()
   * @param {Function} computeFn — () => layoutObject (only called on miss)
   * @returns {any} the layout object
   */
  getOrCompute(key, computeFn) {
    if (this._cache.has(key)) {
      this._hits++;
      // Move to end (most recently used)
      const val = this._cache.get(key);
      this._cache.delete(key);
      this._cache.set(key, val);
      return val;
    }

    this._misses++;
    const layout = computeFn();

    // LRU eviction
    if (this._cache.size >= this._max) {
      const oldest = this._cache.keys().next().value;
      this._cache.delete(oldest);
    }

    this._cache.set(key, layout);
    return layout;
  }

  /**
   * Check if a key is cached without computing.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Clear all cached layouts.
   * Call when data changes, indicators are added/removed, etc.
   */
  invalidate() {
    this._cache.clear();
  }

  /**
   * Remove a specific key.
   * @param {string} key
   */
  remove(key) {
    this._cache.delete(key);
  }

  /** @returns {{ size: number, maxEntries: number, hits: number, misses: number, hitRate: number }} */
  get stats() {
    const total = this._hits + this._misses;
    return {
      size: this._cache.size,
      maxEntries: this._max,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? Math.round((this._hits / total) * 100) : 0,
    };
  }

  /** Reset hit/miss counters */
  resetStats() {
    this._hits = 0;
    this._misses = 0;
  }
}

export { LayoutCache };
export default LayoutCache;
