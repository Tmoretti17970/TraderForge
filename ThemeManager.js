// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Theme System
// Dark and light themes matching TradingView's color palette.
// Runtime switching via CSS variables + direct canvas color refs.
//
// Usage:
//   const theme = createThemeManager('dark');
//   theme.apply(containerElement);
//   theme.setTheme('light');
// ═══════════════════════════════════════════════════════════════════

/**
 * @typedef {Object} ChartTheme
 * @property {string} name
 * @property {string} background
 * @property {string} foreground
 * @property {string} axisBackground
 * @property {string} axisBorder
 * @property {string} textPrimary
 * @property {string} textSecondary
 * @property {string} textDisabled
 * @property {string} gridColor
 * @property {string} crosshairColor
 * @property {string} candleUp
 * @property {string} candleDown
 * @property {string} candleUpWick
 * @property {string} candleDownWick
 * @property {string} volumeUp
 * @property {string} volumeDown
 * @property {string} lineColor
 * @property {string} areaTopColor
 * @property {string} areaBottomColor
 * @property {string} currentPriceLine
 * @property {string} dividerColor
 * @property {string} dividerHover
 * @property {string} toolbarBg
 * @property {string} toolbarBorder
 * @property {string} buttonHover
 * @property {string} buttonActive
 * @property {string} accentColor
 * @property {string} dangerColor
 * @property {string} warningColor
 * @property {string} successColor
 * @property {string} tooltipBg
 * @property {string} tooltipText
 * @property {string} scrollbarTrack
 * @property {string} scrollbarThumb
 */

/** TradingView Dark Theme (default) */
export const DARK_THEME = {
  name: 'dark',

  // Canvas colors
  background: '#131722',
  foreground: '#D1D4DC',
  axisBackground: '#1E222D',
  axisBorder: 'rgba(54, 58, 69, 0.6)',
  textPrimary: '#D1D4DC',
  textSecondary: '#787B86',
  textDisabled: '#4E5266',

  // Grid & Crosshair
  gridColor: 'rgba(54, 58, 69, 0.3)',
  crosshairColor: 'rgba(149, 152, 161, 0.5)',

  // Candles
  candleUp: '#26A69A',
  candleDown: '#EF5350',
  candleUpWick: '#26A69A',
  candleDownWick: '#EF5350',

  // Volume
  volumeUp: 'rgba(38, 166, 154, 0.3)',
  volumeDown: 'rgba(239, 83, 80, 0.3)',

  // Line/Area chart
  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.28)',
  areaBottomColor: 'rgba(41, 98, 255, 0.02)',

  // Current price
  currentPriceLine: '#787B86',

  // Layout
  dividerColor: '#363A45',
  dividerHover: '#2962FF',

  // UI components
  toolbarBg: '#131722',
  toolbarBorder: '#1E222D',
  buttonHover: '#2A2E39',
  buttonActive: '#2962FF',
  accentColor: '#2962FF',
  dangerColor: '#EF5350',
  warningColor: '#FF9800',
  successColor: '#26A69A',

  // Tooltips
  tooltipBg: '#363A45',
  tooltipText: '#D1D4DC',

  // Scrollbar
  scrollbarTrack: '#1E222D',
  scrollbarThumb: '#363A45',
};

/** TradingView Light Theme */
export const LIGHT_THEME = {
  name: 'light',

  background: '#FFFFFF',
  foreground: '#131722',
  axisBackground: '#F8F9FD',
  axisBorder: 'rgba(0, 0, 0, 0.08)',
  textPrimary: '#131722',
  textSecondary: '#787B86',
  textDisabled: '#B2B5BE',

  gridColor: 'rgba(0, 0, 0, 0.06)',
  crosshairColor: 'rgba(0, 0, 0, 0.25)',

  candleUp: '#26A69A',
  candleDown: '#EF5350',
  candleUpWick: '#26A69A',
  candleDownWick: '#EF5350',

  volumeUp: 'rgba(38, 166, 154, 0.2)',
  volumeDown: 'rgba(239, 83, 80, 0.2)',

  lineColor: '#2962FF',
  areaTopColor: 'rgba(41, 98, 255, 0.2)',
  areaBottomColor: 'rgba(41, 98, 255, 0.01)',

  currentPriceLine: '#9E9E9E',

  dividerColor: '#E0E3EB',
  dividerHover: '#2962FF',

  toolbarBg: '#FFFFFF',
  toolbarBorder: '#E0E3EB',
  buttonHover: '#F0F3FA',
  buttonActive: '#2962FF',
  accentColor: '#2962FF',
  dangerColor: '#EF5350',
  warningColor: '#FF9800',
  successColor: '#26A69A',

  tooltipBg: '#FFFFFF',
  tooltipText: '#131722',

  scrollbarTrack: '#F0F3FA',
  scrollbarThumb: '#D1D4DC',
};

/** Theme registry */
const THEMES = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};

/**
 * Create a theme manager for runtime theme switching.
 *
 * @param {string} [initialTheme='dark']
 * @returns {Object} ThemeManager
 */
export function createThemeManager(initialTheme = 'dark') {
  let currentTheme = THEMES[initialTheme] || DARK_THEME;

  /** @type {Set<(theme: ChartTheme) => void>} */
  const listeners = new Set();

  return {
    /** Current theme object */
    get theme() { return currentTheme; },

    /** Current theme name */
    get name() { return currentTheme.name; },

    /** Is dark theme */
    get isDark() { return currentTheme.name === 'dark'; },

    /**
     * Switch theme.
     * @param {string} themeName - 'dark' | 'light'
     */
    setTheme(themeName) {
      const newTheme = THEMES[themeName];
      if (!newTheme || newTheme === currentTheme) return;

      currentTheme = newTheme;

      // Persist
      try { localStorage.setItem('tf_theme', themeName); } catch {}

      // Notify listeners
      for (const listener of listeners) {
        listener(currentTheme);
      }
    },

    /** Toggle between dark and light */
    toggle() {
      this.setTheme(currentTheme.name === 'dark' ? 'light' : 'dark');
    },

    /**
     * Apply theme CSS variables to a container element.
     * @param {HTMLElement} el
     */
    apply(el) {
      for (const [key, value] of Object.entries(currentTheme)) {
        if (key === 'name') continue;
        el.style.setProperty(`--tf-${camelToKebab(key)}`, value);
      }
    },

    /**
     * Register a theme change listener.
     * @param {(theme: ChartTheme) => void} callback
     * @returns {() => void} Unsubscribe function
     */
    onChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },

    /**
     * Get a specific color from the current theme.
     * @param {string} key - Theme key (e.g., 'candleUp')
     * @returns {string}
     */
    color(key) {
      return currentTheme[key] || '#FF00FF'; // Magenta = missing color
    },

    /**
     * Register a custom theme.
     * @param {string} name
     * @param {ChartTheme} theme
     */
    registerTheme(name, theme) {
      THEMES[name] = { ...theme, name };
    },

    /**
     * Load saved theme from localStorage.
     */
    loadSaved() {
      try {
        const saved = localStorage.getItem('tf_theme');
        if (saved && THEMES[saved]) {
          this.setTheme(saved);
        }
      } catch {}
    },
  };
}

/** Convert camelCase to kebab-case */
function camelToKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

// Alias for ChartEngineWidget compatibility
export function getTheme(name) { return createThemeManager(name); }
