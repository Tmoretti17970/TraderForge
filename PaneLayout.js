// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — PaneLayout
// Multi-pane vertical layout with resizable dividers.
//
// Structure:
//   ┌──────────────────────┬───────┐
//   │   Main Chart Pane    │ Price │
//   │   (candlesticks)     │ Axis  │
//   ├──────────────────────┤       │
//   │ ═══ divider ═══════  │       │
//   ├──────────────────────┤───────┤
//   │   Volume Pane        │ Vol   │
//   │   (histogram)        │ Axis  │
//   ├──────────────────────┤───────┤
//   │   Indicator Pane(s)  │ Ind   │
//   │   (RSI, MACD, etc)   │ Axis  │
//   ├──────────────────────┴───────┤
//   │         Time Axis            │
//   └──────────────────────────────┘
//
// Each pane has:
//   - Its own dual-canvas (main + top)
//   - Its own price axis
//   - Configurable height ratio
//   - Min height constraint
//
// The time axis is shared across all panes.
// Crosshair X is synchronized across all panes.
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} PaneConfig
 * @property {string}  id           - Unique pane identifier
 * @property {string}  type         - 'main' | 'volume' | 'indicator'
 * @property {number}  heightRatio  - Fraction of total height (0.0 to 1.0)
 * @property {number}  minHeight    - Minimum height in CSS pixels
 * @property {string}  [label]      - Display label (e.g., "RSI(14)")
 * @property {boolean} [closable]   - Can the user close this pane?
 */

/** Default pane configurations */
export const DEFAULT_PANE_CONFIGS = {
  mainOnly: [
    { id: 'main', type: 'main', heightRatio: 1.0, minHeight: 200 },
  ],
  mainAndVolume: [
    { id: 'main', type: 'main', heightRatio: 0.80, minHeight: 200 },
    { id: 'volume', type: 'volume', heightRatio: 0.20, minHeight: 60 },
  ],
  withIndicator: [
    { id: 'main', type: 'main', heightRatio: 0.60, minHeight: 200 },
    { id: 'volume', type: 'volume', heightRatio: 0.15, minHeight: 50 },
    { id: 'indicator_1', type: 'indicator', heightRatio: 0.25, minHeight: 80, closable: true },
  ],
};

/**
 * Create a PaneLayout manager.
 * Manages height distribution and resize interactions for multiple panes.
 *
 * @param {Object} [options]
 * @param {number} [options.dividerHeight=4] - Resize divider height in px
 * @param {string} [options.dividerColor='#363A45']
 * @param {string} [options.dividerHoverColor='#2962FF']
 * @returns {Object} PaneLayout instance
 */
export function createPaneLayout(options = {}) {
  const {
    dividerHeight = 4,
    dividerColor = '#363A45',
    dividerHoverColor = '#2962FF',
  } = options;

  /** @type {PaneConfig[]} */
  let panes = [];

  /** @type {number} Total available height in CSS pixels */
  let totalHeight = 0;

  /** @type {((panes: PaneConfig[]) => void)|null} */
  let onLayoutChange = null;

  /**
   * Calculate pixel heights from ratios.
   * Accounts for divider heights between panes.
   *
   * @returns {Array<{id: string, y: number, height: number}>}
   */
  function calculateHeights() {
    if (panes.length === 0 || totalHeight <= 0) return [];

    const dividerCount = panes.length - 1;
    const availableHeight = totalHeight - dividerCount * dividerHeight;

    // First pass: calculate proportional heights
    const heights = panes.map(p => ({
      id: p.id,
      rawHeight: availableHeight * p.heightRatio,
      minHeight: p.minHeight,
    }));

    // Second pass: enforce minimums and redistribute
    let overflow = 0;
    let flexCount = 0;

    for (const h of heights) {
      if (h.rawHeight < h.minHeight) {
        overflow += h.minHeight - h.rawHeight;
        h.rawHeight = h.minHeight;
      } else {
        flexCount++;
      }
    }

    // Distribute overflow by shrinking flexible panes
    if (overflow > 0 && flexCount > 0) {
      const perPane = overflow / flexCount;
      for (const h of heights) {
        if (h.rawHeight > h.minHeight) {
          h.rawHeight = Math.max(h.minHeight, h.rawHeight - perPane);
        }
      }
    }

    // Calculate Y positions
    let y = 0;
    const result = [];
    for (let i = 0; i < heights.length; i++) {
      result.push({
        id: heights[i].id,
        y: Math.round(y),
        height: Math.round(heights[i].rawHeight),
      });
      y += heights[i].rawHeight + dividerHeight;
    }

    return result;
  }

  /**
   * Handle divider drag to resize panes.
   *
   * @param {number} dividerIndex - Index of the divider (between pane[i] and pane[i+1])
   * @param {number} deltaY       - Mouse movement in CSS pixels
   */
  function resizePanes(dividerIndex, deltaY) {
    if (dividerIndex < 0 || dividerIndex >= panes.length - 1) return;

    const topPane = panes[dividerIndex];
    const bottomPane = panes[dividerIndex + 1];

    const dividerCount = panes.length - 1;
    const availableHeight = totalHeight - dividerCount * dividerHeight;

    // Convert delta to ratio change
    const deltaRatio = deltaY / availableHeight;

    // Calculate new ratios
    let newTopRatio = topPane.heightRatio + deltaRatio;
    let newBottomRatio = bottomPane.heightRatio - deltaRatio;

    // Enforce minimums
    const topMinRatio = topPane.minHeight / availableHeight;
    const bottomMinRatio = bottomPane.minHeight / availableHeight;

    if (newTopRatio < topMinRatio) {
      newBottomRatio += newTopRatio - topMinRatio;
      newTopRatio = topMinRatio;
    }
    if (newBottomRatio < bottomMinRatio) {
      newTopRatio += newBottomRatio - bottomMinRatio;
      newBottomRatio = bottomMinRatio;
    }

    topPane.heightRatio = Math.max(topMinRatio, newTopRatio);
    bottomPane.heightRatio = Math.max(bottomMinRatio, newBottomRatio);

    if (onLayoutChange) onLayoutChange(panes);
  }

  return {
    /**
     * Set the pane configuration.
     * @param {PaneConfig[]} configs
     */
    setPanes(configs) {
      panes = configs.map(c => ({ ...c }));
      // Normalize ratios to sum to 1.0
      const sum = panes.reduce((s, p) => s + p.heightRatio, 0);
      if (sum > 0) {
        for (const p of panes) p.heightRatio /= sum;
      }
      if (onLayoutChange) onLayoutChange(panes);
    },

    /**
     * Add a new pane at the bottom.
     * Redistributes height from main pane.
     *
     * @param {PaneConfig} config
     */
    addPane(config) {
      // Take height from main pane
      const mainPane = panes.find(p => p.type === 'main');
      if (mainPane && mainPane.heightRatio > config.heightRatio + 0.2) {
        mainPane.heightRatio -= config.heightRatio;
      } else {
        // Distribute proportionally
        const factor = 1 - config.heightRatio;
        for (const p of panes) p.heightRatio *= factor;
      }

      panes.push({ ...config });

      // Renormalize
      const sum = panes.reduce((s, p) => s + p.heightRatio, 0);
      for (const p of panes) p.heightRatio /= sum;

      if (onLayoutChange) onLayoutChange(panes);
    },

    /**
     * Remove a pane by ID. Redistributes its height to main pane.
     * @param {string} paneId
     */
    removePane(paneId) {
      const idx = panes.findIndex(p => p.id === paneId);
      if (idx === -1) return;

      const removed = panes.splice(idx, 1)[0];

      // Give height back to main pane
      const mainPane = panes.find(p => p.type === 'main');
      if (mainPane) {
        mainPane.heightRatio += removed.heightRatio;
      }

      // Renormalize
      const sum = panes.reduce((s, p) => s + p.heightRatio, 0);
      if (sum > 0) {
        for (const p of panes) p.heightRatio /= sum;
      }

      if (onLayoutChange) onLayoutChange(panes);
    },

    /** Set total available height */
    setHeight(height) {
      totalHeight = height;
    },

    /** Get computed pixel positions */
    getLayout: calculateHeights,

    /** Resize divider */
    resize: resizePanes,

    /** Get pane configs */
    get panes() { return panes; },

    /** Get divider height */
    get dividerHeight() { return dividerHeight; },

    /** Get divider colors */
    get dividerColor() { return dividerColor; },
    get dividerHoverColor() { return dividerHoverColor; },

    /** Register layout change callback */
    onLayoutChange(callback) {
      onLayoutChange = callback;
    },
  };
}
