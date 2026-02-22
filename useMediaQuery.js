// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — useMediaQuery Hook
//
// Reactive media query listener. Returns boolean matching state.
// Updates on window resize / orientation change.
//
// Usage:
//   const isMobile = useMediaQuery('(max-width: 480px)');
//   const isTablet = useMediaQuery('(max-width: 768px)');
//
// Pre-built breakpoints exported for convenience:
//   const { isMobile, isTablet, isDesktop } = useBreakpoints();
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

/**
 * Subscribe to a CSS media query and return its match state.
 * @param {string} query - CSS media query string
 * @returns {boolean}
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);

    // Modern API
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    // Legacy Safari fallback
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [query]);

  return matches;
}

/**
 * Pre-built breakpoint hook matching TradeForge layout tiers.
 *
 * Breakpoints:
 *   ≤480px  = mobile  (phone portrait)
 *   ≤768px  = tablet  (phone landscape / small tablet)
 *   ≤1024px = compact (tablet / small laptop)
 *   >1024px = desktop
 *
 * @returns {{ isMobile: boolean, isTablet: boolean, isCompact: boolean, isDesktop: boolean }}
 */
export function useBreakpoints() {
  const isMobile = useMediaQuery('(max-width: 480px)');
  const isTablet = useMediaQuery('(max-width: 768px)');
  const isCompact = useMediaQuery('(max-width: 1024px)');

  return {
    isMobile,
    isTablet,
    isCompact,
    isDesktop: !isCompact,
  };
}

export default useMediaQuery;
