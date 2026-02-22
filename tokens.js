// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Design Tokens
//
// Single source of truth for spacing, radii, shadows, typography,
// z-index, transitions, and semantic color aliases.
// Colors remain in constants.js (C, F, M) — this file extends
// the design system with dimensional and behavioral tokens.
// ═══════════════════════════════════════════════════════════════════

import { C, F, M } from '../constants.js';

// ─── Spacing Scale (4px base) ─────────────────────────────────
export const space = {
  0: 0,
  1: 4,     // tight
  2: 8,     // compact
  3: 12,    // default gap
  4: 16,    // card padding
  5: 20,
  6: 24,    // section gap
  7: 28,    // section breathing room
  8: 32,    // page padding (desktop)
  9: 36,    // generous section gap
  10: 40,
  12: 48,
  16: 64,
};

// ─── Border Radius ────────────────────────────────────────────
export const radii = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 10,
  xl: 14,    // cards
  pill: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,0.3)',
  md: '0 2px 8px rgba(0,0,0,0.4)',
  lg: '0 4px 16px rgba(0,0,0,0.5)',
  glow: (color) => `0 0 12px ${color}40`,
  // Light theme variants (softer, more diffuse)
  light: {
    sm: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
    md: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
    lg: '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
  },
};

// ─── Brand Gradients ────────────────────────────────────────
export const gradient = {
  brand: `linear-gradient(135deg, ${C.b}, ${C.y})`,
  glow: `radial-gradient(ellipse, ${C.b}15, transparent)`,
  subtle: `linear-gradient(135deg, ${C.sf}, ${C.b}08)`,
  heroPositive: `linear-gradient(135deg, ${C.sf}, ${C.g}06)`,
  heroNegative: `linear-gradient(135deg, ${C.sf}, ${C.r}06)`,
};

// ─── Z-Index Scale ────────────────────────────────────────────
export const zIndex = {
  base: 0,
  sticky: 10,
  dropdown: 50,
  sidebar: 100,
  overlay: 200,
  modal: 300,
  toast: 400,
  tooltip: 500,
};

// ─── Transitions ──────────────────────────────────────────────
export const transition = {
  fast: '0.1s ease',
  base: '0.15s ease',
  slow: '0.25s ease',
  spring: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};

// ─── Typography Presets ───────────────────────────────────────
export const text = {
  // Page titles
  h1: { fontSize: 26, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.2 },
  h2: { fontSize: 18, fontWeight: 650, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.3 },
  h3: { fontSize: 14, fontWeight: 700, fontFamily: F, color: C.t1, margin: 0, lineHeight: 1.4 },

  // Body
  body: { fontSize: 14, fontFamily: F, color: C.t1, lineHeight: 1.5 },
  bodySm: { fontSize: 13, fontFamily: F, color: C.t2, lineHeight: 1.5 },
  bodyXs: { fontSize: 12, fontFamily: F, color: C.t2, lineHeight: 1.4 },

  // Captions & labels
  label: { fontSize: 11, fontWeight: 600, fontFamily: F, color: C.t3, textTransform: 'uppercase', letterSpacing: '0.05em' },
  caption: { fontSize: 11, fontFamily: F, color: C.t3 },
  captionSm: { fontSize: 10, fontFamily: M, color: C.t3 },

  // Data display — hero to small hierarchy
  dataHero: { fontSize: 32, fontFamily: M, fontWeight: 700, color: C.t1 },
  dataLg: { fontSize: 20, fontFamily: M, fontWeight: 700, color: C.t1 },
  dataMd: { fontSize: 14, fontFamily: M, fontWeight: 600, color: C.t1 },
  dataSm: { fontSize: 12, fontFamily: M, fontWeight: 500, color: C.t2 },

  // Mono / data (legacy compat)
  mono: { fontSize: 13, fontFamily: M, color: C.t1 },
  monoSm: { fontSize: 12, fontFamily: M, color: C.t2 },
  monoXs: { fontSize: 11, fontFamily: M, color: C.t2 },
  monoBold: { fontSize: 14, fontFamily: M, fontWeight: 700, color: C.t1 },
};

// ─── Common Layout Patterns ───────────────────────────────────
export const layout = {
  // Flex shortcuts
  row: { display: 'flex', alignItems: 'center' },
  rowBetween: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  col: { display: 'flex', flexDirection: 'column' },
  colCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },

  // Full-page containers
  page: { padding: space[8], maxWidth: 1200 },
  pageMobile: { padding: space[4], maxWidth: 1200 },

  // Scroll containers
  scrollY: { overflowY: 'auto', overflowX: 'hidden' },
  scrollX: { overflowX: 'auto', overflowY: 'hidden' },
};

// ─── Component Style Presets ──────────────────────────────────
export const preset = {
  // Card base
  card: {
    background: C.sf,
    border: `1px solid ${C.bd}`,
    borderRadius: radii.xl,
    padding: space[4],
  },

  // Input base
  input: {
    padding: '9px 12px',
    borderRadius: radii.lg,
    border: `1px solid ${C.bd}`,
    background: C.bg2,
    color: C.t1,
    fontSize: 12,
    fontFamily: F,
    outline: 'none',
    width: '100%',
    transition: `border-color ${transition.base}`,
  },

  // Toolbar button
  toolbarBtn: {
    padding: '4px 8px',
    borderRadius: radii.sm,
    border: 'none',
    background: 'transparent',
    color: C.t2,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: F,
    cursor: 'pointer',
    transition: `background ${transition.fast}, color ${transition.fast}`,
  },

  // Badge
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: radii.pill,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: M,
  },

  // Divider (horizontal)
  divider: {
    width: 1,
    height: 16,
    background: C.bd,
    flexShrink: 0,
  },

  // Section label
  sectionLabel: {
    ...text.label,
    marginBottom: space[2],
  },

  // Metric row (label + value)
  metricRow: {
    ...layout.rowBetween,
    padding: `${space[1]}px 0`,
    borderBottom: `1px solid ${C.bd}20`,
  },

  // Overlay backdrop
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: zIndex.overlay,
  },

  // Modal container
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: C.sf,
    border: `1px solid ${C.bd}`,
    borderRadius: radii.xl,
    zIndex: zIndex.modal,
    maxHeight: '90vh',
    overflow: 'auto',
  },
};

// ─── Responsive Helpers ───────────────────────────────────────

/**
 * Merge responsive overrides based on breakpoint.
 * @param {Object} base - Base styles
 * @param {boolean} condition - Breakpoint condition
 * @param {Object} override - Styles to merge when condition is true
 * @returns {Object}
 */
export function responsive(base, condition, override) {
  return condition ? { ...base, ...override } : base;
}

/**
 * Color utility: return green/red based on positive/negative value.
 * @param {number} value
 * @returns {string} color hex
 */
export function pnlColor(value) {
  return (value || 0) >= 0 ? C.g : C.r;
}

/**
 * Color utility: return color based on severity.
 * @param {number} value
 * @param {number} warn - Warning threshold
 * @param {number} danger - Danger threshold
 * @returns {string}
 */
export function severityColor(value, warn = 5, danger = 30) {
  if (value < warn) return C.g;
  if (value < danger) return C.y;
  return C.r;
}

export default {
  space, radii, shadows, gradient, zIndex, transition,
  text, layout, preset, responsive, pnlColor, severityColor,
};
