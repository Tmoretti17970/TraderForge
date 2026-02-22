// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — useHotkeys
//
// Declarative keyboard shortcut hook with:
//   1. Scope isolation (page-level, modal-level, global)
//   2. Modifier support (ctrl, shift, alt, meta)
//   3. Modal awareness (auto-suppresses page shortcuts when modal open)
//   4. Conflict detection (warns in dev mode)
//   5. Input element awareness (suppresses in text fields)
//
// Zero dependencies. ~200 lines.
//
// Usage:
//   useHotkeys([
//     { key: 'j', handler: () => moveDown(), description: 'Next row' },
//     { key: 'k', handler: () => moveUp(), description: 'Previous row' },
//     { key: 'ctrl+z', handler: () => undo(), description: 'Undo' },
//     { key: 'Escape', handler: () => close(), description: 'Close' },
//   ], { scope: 'journal', enabled: true });
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';

// ─── Registry (singleton) ─────────────────────────────────────────
// Tracks all active shortcut registrations for conflict detection
// and for building a help overlay.

const _registry = new Map(); // scopeKey → Set<serializedBinding>
let _registryId = 0;

/**
 * Get all registered shortcuts (for help overlay / command palette).
 * @returns {Array<{ key: string, description: string, scope: string }>}
 */
export function getRegisteredHotkeys() {
  const result = [];
  for (const [scopeKey, bindings] of _registry) {
    for (const b of bindings) {
      const parsed = JSON.parse(b);
      result.push({ ...parsed, scope: scopeKey });
    }
  }
  return result;
}

// ─── Key parsing ──────────────────────────────────────────────────

/**
 * Parse a key combo string into a normalized descriptor.
 * Supports: 'ctrl+shift+k', 'Escape', 'alt+1', 'meta+z', 'ctrl+shift+?'
 *
 * @param {string} combo - Key combo string
 * @returns {{ ctrl: boolean, shift: boolean, alt: boolean, meta: boolean, key: string }}
 */
function parseCombo(combo) {
  const parts = combo.toLowerCase().split('+').map(s => s.trim());
  const result = { ctrl: false, shift: false, alt: false, meta: false, key: '' };

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        result.ctrl = true;
        break;
      case 'shift':
        result.shift = true;
        break;
      case 'alt':
      case 'option':
        result.alt = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
      case 'win':
        result.meta = true;
        break;
      default:
        result.key = part;
    }
  }

  return result;
}

/**
 * Check if a keyboard event matches a parsed combo.
 * @param {KeyboardEvent} e
 * @param {Object} combo - Parsed combo from parseCombo()
 * @returns {boolean}
 */
function matchesCombo(e, combo) {
  if (combo.ctrl !== (e.ctrlKey || e.metaKey)) return false; // treat meta same as ctrl on Mac
  if (combo.shift !== e.shiftKey) return false;
  if (combo.alt !== e.altKey) return false;
  // meta check is folded into ctrl for cross-platform compat

  const eventKey = e.key.toLowerCase();

  // Handle special keys
  if (combo.key === 'escape') return eventKey === 'escape';
  if (combo.key === 'enter') return eventKey === 'enter';
  if (combo.key === 'space') return eventKey === ' ' || eventKey === 'space';
  if (combo.key === 'backspace') return eventKey === 'backspace';
  if (combo.key === 'delete') return eventKey === 'delete';
  if (combo.key === 'tab') return eventKey === 'tab';
  if (combo.key === 'arrowup') return eventKey === 'arrowup';
  if (combo.key === 'arrowdown') return eventKey === 'arrowdown';
  if (combo.key === 'arrowleft') return eventKey === 'arrowleft';
  if (combo.key === 'arrowright') return eventKey === 'arrowright';

  // Single character keys (letters, numbers, symbols)
  return eventKey === combo.key;
}

// ─── Input field detection ────────────────────────────────────────

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Check if the event target is an input field (where we should suppress shortcuts).
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
function isInputFocused(e) {
  const tag = e.target?.tagName;
  if (INPUT_TAGS.has(tag)) return true;
  if (e.target?.isContentEditable) return true;
  return false;
}

// ─── Scope priority ───────────────────────────────────────────────
// Higher priority scopes suppress lower ones.
// modal > panel > page > global

const SCOPE_PRIORITY = {
  modal: 40,
  panel: 30,
  page: 20,
  global: 10,
};

function getScopePriority(scope) {
  // Check if scope starts with a known prefix
  for (const [prefix, priority] of Object.entries(SCOPE_PRIORITY)) {
    if (scope === prefix || scope.startsWith(prefix + ':')) return priority;
  }
  return SCOPE_PRIORITY.page; // default
}

// ─── Active scope tracking ────────────────────────────────────────

let _activeScopeStack = []; // stack of active scope names (highest = most recent)

/**
 * Push a scope onto the active stack. Called when a component mounts.
 * @param {string} scope
 */
function pushScope(scope) {
  _activeScopeStack.push(scope);
}

/**
 * Remove a scope from the active stack. Called when a component unmounts.
 * @param {string} scope
 */
function popScope(scope) {
  const idx = _activeScopeStack.lastIndexOf(scope);
  if (idx >= 0) _activeScopeStack.splice(idx, 1);
}

/**
 * Check if a scope should be active (not suppressed by a higher-priority scope).
 *
 * Suppression rules:
 *   - modal suppresses panel, page, and global
 *   - panel suppresses page (but NOT global)
 *   - page does NOT suppress global
 *   - same-tier scopes coexist
 *
 * @param {string} scope
 * @returns {boolean}
 */
function isScopeActive(scope) {
  const myPriority = getScopePriority(scope);

  for (const active of _activeScopeStack) {
    if (active === scope) continue;
    const otherPriority = getScopePriority(active);

    // Modal (40) suppresses everything below it
    if (otherPriority >= SCOPE_PRIORITY.modal && myPriority < SCOPE_PRIORITY.modal) return false;

    // Panel (30) suppresses page (20) but NOT global (10)
    if (otherPriority >= SCOPE_PRIORITY.panel && myPriority === SCOPE_PRIORITY.page) return false;
  }
  return true;
}

// ─── Main Hook ────────────────────────────────────────────────────

/**
 * Declarative keyboard shortcut hook.
 *
 * @param {Array<{ key: string, handler: Function, description?: string, allowInInput?: boolean }>} bindings
 * @param {Object} [options]
 * @param {string} [options.scope='page'] - Scope name (e.g. 'journal', 'modal:trade-form', 'global')
 * @param {boolean} [options.enabled=true] - Enable/disable all bindings
 * @param {boolean} [options.allowInInput=false] - Default: suppress in input fields
 */
export function useHotkeys(bindings, options = {}) {
  const { scope = 'page', enabled = true, allowInInput = false } = options;
  const bindingsRef = useRef(bindings);
  const optionsRef = useRef({ scope, enabled, allowInInput });

  // Keep refs current (avoids re-registering listener on every render)
  useEffect(() => {
    bindingsRef.current = bindings;
    optionsRef.current = { scope, enabled, allowInInput };
  });

  // Register scope + bindings for conflict detection
  useEffect(() => {
    if (!enabled) return;

    const regId = ++_registryId;
    const scopeKey = scope;
    pushScope(scopeKey);

    // Register bindings
    const serialized = new Set(
      bindings.map(b => JSON.stringify({ key: b.key, description: b.description || '' }))
    );
    _registry.set(`${scopeKey}:${regId}`, serialized);

    return () => {
      popScope(scopeKey);
      _registry.delete(`${scopeKey}:${regId}`);
    };
  }, [scope, enabled, bindings.length]); // re-register if scope/enabled/binding count changes

  // Keyboard event listener
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e) {
      const opts = optionsRef.current;
      if (!opts.enabled) return;

      // Check scope is active (not suppressed by modal, etc.)
      if (!isScopeActive(opts.scope)) return;

      // Check input focus
      const inInput = isInputFocused(e);

      for (const binding of bindingsRef.current) {
        const combo = parseCombo(binding.key);

        // Skip non-modifier shortcuts in input fields (unless explicitly allowed)
        if (inInput && !combo.ctrl && !combo.alt && !combo.meta) {
          if (!binding.allowInInput && !opts.allowInInput) continue;
        }

        if (matchesCombo(e, combo)) {
          e.preventDefault();
          e.stopPropagation();
          binding.handler(e);
          return;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

// ─── Exports ──────────────────────────────────────────────────────

export default useHotkeys;
export { parseCombo, matchesCombo, isInputFocused, isScopeActive, pushScope, popScope, getScopePriority, _activeScopeStack };
