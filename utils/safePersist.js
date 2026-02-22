// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — Safe Persist Middleware
// Wraps Zustand's persist middleware with protection against:
//  - Corrupted persisted state (invalid JSON)
//  - Schema mismatches (missing/renamed keys after updates)
//  - Storage failures (quota exceeded, private mode)
//  - Deserialization crashes
//
// Usage:
//   import { safePersist } from '../utils/safePersist.js';
//
//   const useMyStore = create(
//     safePersist(
//       (set) => ({ count: 0, inc: () => set(s => ({ count: s.count + 1 })) }),
//       {
//         name: 'my-store',
//         version: 1,
//         defaults: { count: 0 },  // fallback values if state is corrupted
//       }
//     )
//   );
// ═══════════════════════════════════════════════════════════════════

import { persist } from 'zustand/middleware';
import { reportError } from './globalErrorHandler.js';

const TAG = '[SafePersist]';

/**
 * Enhanced persist middleware with corruption protection.
 *
 * @param {Function} storeCreator - Zustand store creator function
 * @param {Object} opts
 * @param {string} opts.name - Storage key name
 * @param {number} [opts.version=0] - Schema version for migrations
 * @param {Object} [opts.defaults={}] - Default state values (used as fallback)
 * @param {Function} [opts.migrate] - Migration function(persistedState, version) => newState
 * @param {Function} [opts.partialize] - Function to select which keys to persist
 * @param {Object} [opts.storage] - Custom storage engine
 * @returns {Function} Enhanced middleware
 */
export function safePersist(storeCreator, opts = {}) {
  const {
    name,
    version = 0,
    defaults = {},
    migrate,
    partialize,
    storage: customStorage,
  } = opts;

  return persist(storeCreator, {
    name,
    version,

    // Partialize: only persist selected keys
    ...(partialize ? { partialize } : {}),

    // Custom storage with error protection
    storage: customStorage || {
      getItem: (storageKey) => {
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw === null) return null;

          const parsed = JSON.parse(raw);

          // Validate basic structure
          if (!parsed || typeof parsed !== 'object') {
            console.warn(`${TAG} Invalid state structure for "${name}", resetting.`);
            localStorage.removeItem(storageKey);
            return null;
          }

          return parsed;
        } catch (err) {
          console.warn(`${TAG} Failed to read "${name}" from storage:`, err.message);
          reportError(err, { source: `safePersist:read:${name}`, silent: true });

          // Remove corrupted data
          try {
            localStorage.removeItem(storageKey);
          } catch {}

          return null;
        }
      },

      setItem: (storageKey, value) => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (err) {
          if (err.name === 'QuotaExceededError' || err.code === 22) {
            console.warn(`${TAG} Storage quota exceeded for "${name}". Data will not persist.`);
          } else {
            console.warn(`${TAG} Failed to write "${name}":`, err.message);
          }
          reportError(err, { source: `safePersist:write:${name}`, silent: true });
        }
      },

      removeItem: (storageKey) => {
        try {
          localStorage.removeItem(storageKey);
        } catch (err) {
          console.warn(`${TAG} Failed to remove "${name}":`, err.message);
        }
      },
    },

    // Merge with defaults to handle schema changes
    merge: (persistedState, currentState) => {
      try {
        if (!persistedState || typeof persistedState !== 'object') {
          return { ...currentState, ...defaults };
        }

        // Deep merge: currentState (with defaults) is the base,
        // persisted state overrides only keys that exist and are valid
        const merged = { ...currentState };

        for (const key of Object.keys(persistedState)) {
          const persisted = persistedState[key];
          // Skip functions (store actions should never be persisted)
          if (typeof persisted === 'function') continue;
          // Skip undefined/null if we have a default
          if (persisted == null && defaults[key] != null) continue;
          merged[key] = persisted;
        }

        return merged;
      } catch (err) {
        console.warn(`${TAG} Merge failed for "${name}", using defaults.`);
        reportError(err, { source: `safePersist:merge:${name}`, silent: true });
        return { ...currentState, ...defaults };
      }
    },

    // Migration with error protection
    ...(migrate
      ? {
          migrate: (persisted, persistedVersion) => {
            try {
              return migrate(persisted, persistedVersion);
            } catch (err) {
              console.warn(`${TAG} Migration failed for "${name}" (v${persistedVersion} → v${version}):`, err.message);
              reportError(err, { source: `safePersist:migrate:${name}`, silent: true });
              // Return defaults on migration failure
              return { ...defaults, ...persisted };
            }
          },
        }
      : {}),
  });
}

export default safePersist;
