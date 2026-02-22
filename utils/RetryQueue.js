// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — RetryQueue
// Exponential backoff retry for async operations.
// Used by StorageService for failed writes and FetchService for 429s.
//
// Usage:
//   const q = new RetryQueue({ maxRetries: 3, baseDelay: 200 });
//   const result = await q.exec(() => StorageService.trades.put(trade));
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_OPTS = {
  maxRetries: 3,
  baseDelay: 200,     // ms — first retry after 200ms
  maxDelay: 10_000,   // ms — cap at 10s
  factor: 2,          // exponential factor
  jitter: true,       // add randomness to prevent thundering herd
};

class RetryQueue {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.maxRetries=3]
   * @param {number} [opts.baseDelay=200]
   * @param {number} [opts.maxDelay=10000]
   * @param {number} [opts.factor=2]
   * @param {boolean} [opts.jitter=true]
   * @param {Function} [opts.onRetry] — (attempt, error, delayMs) => void
   * @param {Function} [opts.shouldRetry] — (error) => boolean (default: always retry)
   */
  constructor(opts = {}) {
    this._opts = { ...DEFAULT_OPTS, ...opts };
    this._pending = [];
  }

  /**
   * Execute an async function with retry.
   * Returns the successful result or throws after all retries exhausted.
   *
   * @param {Function} fn — async () => result
   * @returns {Promise<any>}
   */
  async exec(fn) {
    const { maxRetries, baseDelay, maxDelay, factor, jitter, onRetry, shouldRetry } = this._opts;

    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (err) {
        lastError = err;

        // Check if we should retry this specific error
        if (shouldRetry && !shouldRetry(err)) {
          throw err;
        }

        if (attempt >= maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        let delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);

        // Add jitter (±25%)
        if (jitter) {
          const jitterRange = delay * 0.25;
          delay = delay - jitterRange + Math.random() * jitterRange * 2;
        }

        delay = Math.round(delay);

        if (onRetry) {
          onRetry(attempt + 1, lastError, delay);
        }

        await _sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Execute with retry, but return { ok, data?, error? } instead of throwing.
   * Matches StorageService return shape.
   *
   * @param {Function} fn — async () => result
   * @returns {Promise<{ ok: boolean, data?: any, error?: string }>}
   */
  async execSafe(fn) {
    try {
      const data = await this.exec(fn);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }

  /**
   * Queue an operation for deferred retry.
   * Returns immediately. Failed operations accumulate and
   * can be flushed with drain().
   *
   * @param {string} id — unique operation ID (for deduplication)
   * @param {Function} fn — async () => result
   */
  enqueue(id, fn) {
    // Deduplicate: replace existing entry with same id
    this._pending = this._pending.filter((p) => p.id !== id);
    this._pending.push({ id, fn, enqueuedAt: Date.now() });
  }

  /**
   * Process all pending operations. Returns summary.
   * @returns {Promise<{ succeeded: number, failed: number, errors: string[] }>}
   */
  async drain() {
    const items = [...this._pending];
    this._pending = [];

    let succeeded = 0;
    const errors = [];

    for (const item of items) {
      try {
        await this.exec(item.fn);
        succeeded++;
      } catch (err) {
        errors.push(`${item.id}: ${err.message}`);
      }
    }

    return {
      succeeded,
      failed: errors.length,
      errors,
    };
  }

  /** Number of pending operations in the queue */
  get pendingCount() {
    return this._pending.length;
  }

  /** Clear all pending operations */
  clear() {
    this._pending = [];
  }
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Compute the delay for a given retry attempt (useful for testing / display).
 * @param {number} attempt — 0-based attempt number
 * @param {Object} [opts] — same as RetryQueue constructor opts
 * @returns {number} delay in ms (without jitter)
 */
function computeDelay(attempt, opts = {}) {
  const { baseDelay = 200, maxDelay = 10000, factor = 2 } = opts;
  return Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);
}

export { RetryQueue, computeDelay };
export default RetryQueue;
