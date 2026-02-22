// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — FrameBudget
//
// Monitors canvas render timing and provides:
//   1. Frame budget enforcement (target 16.6ms for 60fps)
//   2. Level-of-detail (LOD) degradation when over budget
//   3. Per-indicator computation cache (incremental updates)
//   4. Rolling frame time average for smooth LOD transitions
//
// Zero dependencies. ~180 lines.
//
// Usage:
//   const fb = new FrameBudget({ targetFps: 60 });
//   fb.beginFrame();
//   // ... render ...
//   fb.endFrame();
//   const lod = fb.getLOD(); // { volume, indicators, drawings, antiAlias }
// ═══════════════════════════════════════════════════════════════════

// ─── LOD Levels ─────────────────────────────────────────────────
// Each level specifies what to render. Lower LOD = fewer features.
//
// Level 3 (full):  Everything rendered — volume, all indicators, drawings, anti-aliased
// Level 2 (trim):  Skip volume, limit indicators to 3, keep drawings
// Level 1 (lean):  Skip volume, 1 indicator max, skip drawings
// Level 0 (bare):  Candles + axes only, no anti-alias

const LOD_LEVELS = [
  { level: 0, volume: false, maxIndicators: 0, drawings: false, antiAlias: false }, // bare
  { level: 1, volume: false, maxIndicators: 1, drawings: false, antiAlias: true },  // lean
  { level: 2, volume: false, maxIndicators: 3, drawings: true,  antiAlias: true },  // trim
  { level: 3, volume: true,  maxIndicators: 99, drawings: true, antiAlias: true },  // full
];

// Frame time thresholds for LOD transitions (ms)
const LOD_UP_THRESHOLD = 12;    // Upgrade LOD when avg frame < 12ms (headroom)
const LOD_DOWN_THRESHOLD = 20;  // Degrade LOD when avg frame > 20ms (over budget)
const LOD_HYSTERESIS = 8;       // Frames to sustain before LOD change (prevents flicker)

class FrameBudget {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.targetFps=60] - Target frames per second
   * @param {number} [opts.windowSize=30] - Rolling average window (frames)
   */
  constructor(opts = {}) {
    this._targetMs = 1000 / (opts.targetFps || 60); // 16.67ms default
    this._windowSize = opts.windowSize || 30;

    // Rolling frame time buffer (circular)
    this._times = new Float64Array(this._windowSize);
    this._timeIdx = 0;
    this._timeFilled = 0;

    // LOD state
    this._lod = 3; // start at full quality
    this._lodHold = 0; // hysteresis counter

    // Frame timing
    this._frameStart = 0;
    this._lastFrameMs = 0;

    // Per-phase timing (current frame)
    this._phases = {};
    this._phaseStart = 0;

    // Per-phase rolling averages (last N frames)
    this._phaseHistory = {}; // phaseName → Float64Array (circular)
    this._phaseHistIdx = 0;
    this._phaseHistFilled = 0;

    // Stats
    this._totalFrames = 0;
    this._droppedFrames = 0; // frames over budget
  }

  /**
   * Call at the start of each render frame.
   */
  beginFrame() {
    this._frameStart = performance.now();
    this._phases = {};
  }

  /**
   * Start timing a named render phase.
   * @param {string} name - Phase name (e.g. 'grid', 'candles', 'indicators')
   */
  beginPhase(name) {
    this._phaseStart = performance.now();
  }

  /**
   * End timing the current phase and record its duration.
   * @param {string} name - Phase name (must match beginPhase)
   */
  endPhase(name) {
    const elapsed = performance.now() - this._phaseStart;
    this._phases[name] = (this._phases[name] || 0) + elapsed;
  }

  /**
   * Call at the end of each render frame.
   * Updates rolling average and adjusts LOD.
   * @returns {number} Frame time in ms
   */
  endFrame() {
    const elapsed = performance.now() - this._frameStart;
    this._lastFrameMs = elapsed;
    this._totalFrames++;

    if (elapsed > this._targetMs) {
      this._droppedFrames++;
    }

    // Push to rolling buffer
    this._times[this._timeIdx] = elapsed;
    this._timeIdx = (this._timeIdx + 1) % this._windowSize;
    if (this._timeFilled < this._windowSize) this._timeFilled++;

    // Push per-phase timings to rolling history
    for (const [name, ms] of Object.entries(this._phases)) {
      if (!this._phaseHistory[name]) {
        this._phaseHistory[name] = new Float64Array(this._windowSize);
      }
      this._phaseHistory[name][this._phaseHistIdx] = ms;
    }
    // Zero out phases not present this frame (e.g. LOD skipped volume)
    for (const name in this._phaseHistory) {
      if (!(name in this._phases)) {
        this._phaseHistory[name][this._phaseHistIdx] = 0;
      }
    }
    this._phaseHistIdx = (this._phaseHistIdx + 1) % this._windowSize;
    if (this._phaseHistFilled < this._windowSize) this._phaseHistFilled++;

    // Adjust LOD based on rolling average
    this._adjustLOD();

    return elapsed;
  }

  /**
   * Get current level-of-detail settings.
   * @returns {{ level: number, volume: boolean, maxIndicators: number, drawings: boolean, antiAlias: boolean }}
   */
  getLOD() {
    return LOD_LEVELS[this._lod];
  }

  /**
   * Get current LOD level (0–3).
   * @returns {number}
   */
  get level() {
    return this._lod;
  }

  /**
   * Force a specific LOD level (0–3). Resets hysteresis.
   * @param {number} lvl
   */
  setLevel(lvl) {
    this._lod = Math.max(0, Math.min(3, lvl));
    this._lodHold = 0;
  }

  /**
   * Reset to full quality. Called when data changes (new viewport deserves full render).
   */
  reset() {
    this._lod = 3;
    this._lodHold = 0;
    this._timeFilled = 0;
    this._timeIdx = 0;
    this._totalFrames = 0;
    this._droppedFrames = 0;
    this._phases = {};
    this._phaseHistory = {};
    this._phaseHistIdx = 0;
    this._phaseHistFilled = 0;
  }

  /**
   * Get rolling average frame time in ms.
   * @returns {number}
   */
  get avgFrameMs() {
    if (this._timeFilled === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this._timeFilled; i++) sum += this._times[i];
    return sum / this._timeFilled;
  }

  /**
   * Get last frame time in ms.
   * @returns {number}
   */
  get lastFrameMs() {
    return this._lastFrameMs;
  }

  /**
   * Get performance stats.
   * @returns {{ avgMs: number, lastMs: number, lod: number, totalFrames: number, droppedFrames: number, dropRate: number, phases: Object }}
   */
  getStats() {
    return {
      avgMs: Math.round(this.avgFrameMs * 100) / 100,
      lastMs: Math.round(this._lastFrameMs * 100) / 100,
      lod: this._lod,
      totalFrames: this._totalFrames,
      droppedFrames: this._droppedFrames,
      dropRate: this._totalFrames > 0
        ? Math.round((this._droppedFrames / this._totalFrames) * 100)
        : 0,
      phases: this.getPhaseStats(),
    };
  }

  /**
   * Get per-phase timing breakdown.
   * Returns average ms per phase over the rolling window.
   * @returns {Object} { phaseName: avgMs, ... }
   */
  getPhaseStats() {
    if (this._phaseHistFilled === 0) return {};
    const result = {};
    for (const [name, buf] of Object.entries(this._phaseHistory)) {
      let sum = 0;
      for (let i = 0; i < this._phaseHistFilled; i++) sum += buf[i];
      result[name] = Math.round((sum / this._phaseHistFilled) * 100) / 100;
    }
    return result;
  }

  /**
   * Get the last frame's phase breakdown (not averaged).
   * Useful for single-frame diagnostics.
   * @returns {Object} { phaseName: ms, ... }
   */
  get lastPhases() {
    const result = {};
    for (const [name, ms] of Object.entries(this._phases)) {
      result[name] = Math.round(ms * 100) / 100;
    }
    return result;
  }

  // ─── Internal ──────────────────────────────────────────────

  _adjustLOD() {
    // Need enough samples for a meaningful average
    if (this._timeFilled < 5) return;

    const avg = this.avgFrameMs;

    if (avg > LOD_DOWN_THRESHOLD && this._lod > 0) {
      // Frames are slow — consider degrading
      this._lodHold++;
      if (this._lodHold >= LOD_HYSTERESIS) {
        this._lod--;
        this._lodHold = 0;
      }
    } else if (avg < LOD_UP_THRESHOLD && this._lod < 3) {
      // Frames are fast — consider upgrading
      this._lodHold++;
      if (this._lodHold >= LOD_HYSTERESIS) {
        this._lod++;
        this._lodHold = 0;
      }
    } else {
      // In the acceptable range — reset hysteresis
      this._lodHold = 0;
    }
  }
}

// ─── Indicator Cache ────────────────────────────────────────────
//
// Caches per-indicator computation results. Only recomputes indicators
// whose config (type + params) changed. The closes array is shared
// across all indicators to avoid redundant extraction.

class IndicatorCache {
  constructor() {
    this._cache = new Map(); // key → { config: string, result: Object }
    this._lastDataLen = -1;
  }

  /**
   * Build a cache key from indicator config.
   * @param {Object} ind
   * @returns {string}
   */
  static key(ind) {
    return `${ind.type}|${JSON.stringify(ind.params || {})}|${ind.color || ''}`;
  }

  /**
   * Compute indicators incrementally. Returns full array of results.
   * Only indicators whose config changed (or data length changed) are recomputed.
   *
   * @param {Array} indicators - Indicator config array
   * @param {Array} data - OHLCV data
   * @param {Function} computeFn - (ind, data, closes) => result
   * @returns {Array} Indicator results (same shape as computeIndicators output)
   */
  compute(indicators, data, computeFn) {
    if (!data?.length || !indicators?.length) {
      this._cache.clear();
      this._lastDataLen = -1;
      return [];
    }

    const dataChanged = data.length !== this._lastDataLen;
    this._lastDataLen = data.length;

    // Build closes array once (shared across all indicators)
    let closes = null; // lazy — only computed if needed

    // Track which keys are still active (for cleanup)
    const activeKeys = new Set();

    const results = indicators.map((ind) => {
      const k = IndicatorCache.key(ind);
      activeKeys.add(k);

      const cached = this._cache.get(k);

      // Cache hit: config unchanged AND data length unchanged
      if (cached && !dataChanged && cached.config === k) {
        return { ...ind, result: cached.result };
      }

      // Cache miss: compute
      if (!closes) closes = data.map((d) => d.close);
      const result = computeFn(ind, data, closes);

      this._cache.set(k, { config: k, result });
      return { ...ind, result };
    });

    // Evict stale entries (indicators removed by user)
    for (const [k] of this._cache) {
      if (!activeKeys.has(k)) this._cache.delete(k);
    }

    return results;
  }

  /**
   * Invalidate all cached results. Next compute() will recalculate everything.
   */
  invalidate() {
    this._lastDataLen = -1;
  }

  /**
   * Clear all cached data.
   */
  clear() {
    this._cache.clear();
    this._lastDataLen = -1;
  }

  /**
   * Number of cached indicators.
   * @returns {number}
   */
  get size() {
    return this._cache.size;
  }
}

// ─── Export ─────────────────────────────────────────────────────

export { FrameBudget, IndicatorCache, LOD_LEVELS };
export default FrameBudget;
