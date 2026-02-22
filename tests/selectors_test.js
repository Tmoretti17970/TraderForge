// ═══════════════════════════════════════════════════════════════════
// TradeForge — Zustand Selector Tests
// Verifies: no full-store subscriptions, selector patterns,
// shallow equality prevents unnecessary re-renders.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useUIStore } from '../state/useUIStore.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { shallow } from '../utils/shallow.js';

var SRC = path.resolve('src');

// ─── No full-store subscriptions ─────────────────────────────────
describe('Zustand — no full-store subscriptions', function () {
  it('no component calls a store hook without a selector', function () {
    var STORES = [
      'useTradeStore',
      'useUIStore',
      'useChartStore',
      'useSettingsStore',
      'useAnalyticsStore',
      'useSocialStore',
      'useOnboardingStore',
    ];

    var violations = [];

    function walk(dir) {
      var entries = fs.readdirSync(dir, { withFileTypes: true });
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].name === '__tests__' || entries[i].name === 'node_modules') continue;
        var full = path.join(dir, entries[i].name);
        if (entries[i].isDirectory()) {
          walk(full);
        } else if (entries[i].name.endsWith('.jsx') || entries[i].name.endsWith('.js')) {
          var content = fs.readFileSync(full, 'utf-8');
          for (var j = 0; j < STORES.length; j++) {
            var store = STORES[j];
            // Look for store() without selector — but not store.getState()
            var idx = 0;
            var needle = store + '()';
            while (true) {
              var pos = content.indexOf(needle, idx);
              if (pos === -1) break;
              var after = content.substring(pos + needle.length, pos + needle.length + 15);
              if (after.indexOf('.getState') === -1) {
                violations.push(path.relative(SRC, full) + ': ' + store);
              }
              idx = pos + 1;
            }
          }
        }
      }
    }
    walk(SRC);

    expect(violations).toEqual([]);
  });
});

// ─── Store API ───────────────────────────────────────────────────
describe('Zustand — useSettingsStore', function () {
  it('exposes update method', function () {
    var update = useSettingsStore.getState().update;
    expect(typeof update).toBe('function');
  });

  it('update merges fields without destroying others', function () {
    useSettingsStore.getState().update({ accountSize: 50000 });
    var s = useSettingsStore.getState();
    expect(s.accountSize).toBe(50000);
    expect(s.riskPerTrade).toBeDefined();
    expect(s.dailyLossLimit).toBeDefined();
  });

  it('reset restores defaults', function () {
    useSettingsStore.getState().update({ accountSize: 99999 });
    useSettingsStore.getState().reset();
    var s = useSettingsStore.getState();
    expect(s.accountSize).not.toBe(99999);
  });
});

// ─── Shallow selector pattern ────────────────────────────────────
describe('Zustand — shallow selector pattern', function () {
  it('selector returns stable reference when values unchanged', function () {
    var selector = function (s) {
      return { accountSize: s.accountSize, riskPerTrade: s.riskPerTrade };
    };

    var a = selector(useSettingsStore.getState());
    var b = selector(useSettingsStore.getState());

    // Different object references
    expect(a).not.toBe(b);
    // But shallow-equal — would skip re-render
    expect(shallow(a, b)).toBe(true);
  });

  it('selector detects when values change', function () {
    var selector = function (s) {
      return { accountSize: s.accountSize, riskPerTrade: s.riskPerTrade };
    };

    var before = selector(useSettingsStore.getState());
    useSettingsStore.getState().update({ riskPerTrade: 99 });
    var after = selector(useSettingsStore.getState());

    expect(shallow(before, after)).toBe(false);
  });
});

describe('Zustand — useUIStore', function () {
  it('setPage updates page', function () {
    useUIStore.getState().setPage('charts');
    expect(useUIStore.getState().page).toBe('charts');
  });
});

describe('Zustand — useTradeStore', function () {
  it('addTrade and deleteTrade work', function () {
    var trade = {
      id: 'sel_test_1',
      date: '2025-01-15T10:00:00Z',
      symbol: 'ETH',
      side: 'long',
      pnl: 50,
    };

    useTradeStore.getState().addTrade(trade);
    var found = useTradeStore.getState().trades.some(function (t) { return t.id === 'sel_test_1'; });
    expect(found).toBe(true);

    useTradeStore.getState().deleteTrade('sel_test_1');
    var gone = useTradeStore.getState().trades.some(function (t) { return t.id === 'sel_test_1'; });
    expect(gone).toBe(false);
  });
});

// ─── Settings page shallow import verification ───────────────────
describe('Zustand — Settings uses shallow', function () {
  it('SettingsPage imports shallow and uses it', function () {
    var content = fs.readFileSync(path.join(SRC, 'pages/SettingsPage.jsx'), 'utf-8');
    expect(content.indexOf('import { shallow }')).not.toBe(-1);
    expect(content.indexOf(', shallow')).not.toBe(-1);
  });

  it('MobileSettings imports shallow and uses it', function () {
    var content = fs.readFileSync(path.join(SRC, 'components/MobileSettings.jsx'), 'utf-8');
    expect(content.indexOf('import { shallow }')).not.toBe(-1);
    expect(content.indexOf(', shallow')).not.toBe(-1);
  });
});
