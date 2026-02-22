// ═══════════════════════════════════════════════════════════════════
// TradeForge — Shallow equality for Zustand selectors
// Usage: useStore(selector, shallow)
// Prevents re-renders when selector returns new object with same values.
// ═══════════════════════════════════════════════════════════════════

export function shallow(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}
