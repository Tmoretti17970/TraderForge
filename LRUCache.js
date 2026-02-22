// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — LRU Cache
// Time-aware Least Recently Used cache for OHLCV bar data.
//
// Features:
//   - Size-limited (evicts least recently used entries)
//   - TTL expiration (intraday data expires faster than daily)
//   - Key format: "symbol:resolution:from:to"
//   - Zero dependencies
// ═══════════════════════════════════════════════════════════════════

/**
 * Create an LRU cache with optional TTL support.
 *
 * @param {Object} [options]
 * @param {number} [options.maxSize=100]     - Maximum entries
 * @param {number} [options.defaultTTL=300000] - Default TTL in ms (5 minutes)
 * @returns {Object} Cache instance
 */
export function createLRUCache(options = {}) {
  const { maxSize = 100, defaultTTL = 300_000 } = options;

  /** @type {Map<string, { value: any, expiresAt: number }>} */
  const cache = new Map();

  return {
    /**
     * Get a cached value. Returns null if expired or missing.
     * Moves entry to most-recently-used position.
     *
     * @param {string} key
     * @returns {any|null}
     */
    get(key) {
      const entry = cache.get(key);
      if (!entry) return null;

      // Check TTL
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }

      // Move to end (most recently used) — Map preserves insertion order
      cache.delete(key);
      cache.set(key, entry);

      return entry.value;
    },

    /**
     * Set a cached value with optional custom TTL.
     *
     * @param {string} key
     * @param {any}    value
     * @param {number} [ttl] - TTL in ms (defaults to defaultTTL)
     */
    set(key, value, ttl) {
      // Delete existing entry to reset position
      cache.delete(key);

      // Evict oldest if at capacity
      if (cache.size >= maxSize) {
        const oldest = cache.keys().next().value;
        cache.delete(oldest);
      }

      cache.set(key, {
        value,
        expiresAt: Date.now() + (ttl || defaultTTL),
      });
    },

    /**
     * Check if a key exists and is not expired.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
      const entry = cache.get(key);
      if (!entry) return false;
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return false;
      }
      return true;
    },

    /**
     * Delete a specific entry.
     * @param {string} key
     */
    delete(key) {
      cache.delete(key);
    },

    /**
     * Clear all entries matching a prefix.
     * Useful for clearing all cache for a symbol.
     * @param {string} prefix
     */
    clearPrefix(prefix) {
      for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
      }
    },

    /** Clear entire cache */
    clear() {
      cache.clear();
    },

    /** Current number of entries */
    get size() { return cache.size; },

    /** Get cache stats for debugging */
    stats() {
      let expired = 0;
      const now = Date.now();
      for (const [, entry] of cache) {
        if (now > entry.expiresAt) expired++;
      }
      return { total: cache.size, expired, active: cache.size - expired };
    },
  };
}

// ═══ TTL Presets ═══
export const CACHE_TTL = {
  TICK:    10_000,      // 10 seconds for 1m data
  INTRADAY: 60_000,    // 1 minute for 5m-1h
  HOURLY: 300_000,     // 5 minutes for 4h
  DAILY:  3_600_000,   // 1 hour for 1D+
  STATIC: 86_400_000,  // 24 hours for symbol info
};

/**
 * Get appropriate cache TTL for a resolution.
 * @param {string} resolution
 * @returns {number} TTL in milliseconds
 */
export function getTTLForResolution(resolution) {
  switch (resolution) {
    case '1m': return CACHE_TTL.TICK;
    case '3m':
    case '5m':
    case '15m':
    case '30m': return CACHE_TTL.INTRADAY;
    case '1h':
    case '2h':
    case '4h': return CACHE_TTL.HOURLY;
    default: return CACHE_TTL.DAILY;
  }
}

/**
 * Generate a cache key for bar data.
 * @param {string} symbol
 * @param {string} resolution
 * @param {number} from
 * @param {number} to
 * @returns {string}
 */
export function barCacheKey(symbol, resolution, from, to) {
  return `bars:${symbol}:${resolution}:${from}:${to}`;
}
