// ═══════════════════════════════════════════════════════════════════
// TradeForge — React.memo Boundary Tests
// Verifies all performance-critical components are wrapped in memo.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve('src');

function isMemoized(relPath) {
  var c = fs.readFileSync(path.join(SRC, relPath), 'utf-8');
  return c.indexOf('export default React.memo') !== -1;
}

// ─── Tier 1: Hot path ────────────────────────────────────────────
describe('React.memo — Tier 1: Hot path', function () {
  it('JournalTradeRow is memoized', function () {
    expect(isMemoized('components/journal/JournalTradeRow.jsx')).toBe(true);
  });

  it('LiveTicker is memoized', function () {
    expect(isMemoized('components/LiveTicker.jsx')).toBe(true);
  });
});

// ─── Tier 2: Chart components ────────────────────────────────────
describe('React.memo — Tier 2: Charts', function () {
  it('EquityCurveChart is memoized', function () {
    expect(isMemoized('components/EquityCurveChart.jsx')).toBe(true);
  });
  it('DailyPnlChart is memoized', function () {
    expect(isMemoized('components/DailyPnlChart.jsx')).toBe(true);
  });
  it('BreakdownBarChart is memoized', function () {
    expect(isMemoized('components/BreakdownBarChart.jsx')).toBe(true);
  });
  it('WinRateDonut is memoized', function () {
    expect(isMemoized('components/WinRateDonut.jsx')).toBe(true);
  });
});

// ─── Tier 3: Analytics tabs ──────────────────────────────────────
describe('React.memo — Tier 3: Analytics tabs', function () {
  it('OverviewTab is memoized', function () {
    expect(isMemoized('components/analytics/OverviewTab.jsx')).toBe(true);
  });
  it('StrategiesTab is memoized', function () {
    expect(isMemoized('components/analytics/StrategiesTab.jsx')).toBe(true);
  });
  it('PsychologyTab is memoized', function () {
    expect(isMemoized('components/analytics/PsychologyTab.jsx')).toBe(true);
  });
  it('TimingTab is memoized', function () {
    expect(isMemoized('components/analytics/TimingTab.jsx')).toBe(true);
  });
  it('RiskTab is memoized', function () {
    expect(isMemoized('components/analytics/RiskTab.jsx')).toBe(true);
  });
});

// ─── Heavy components ────────────────────────────────────────────
describe('React.memo — Heavy components', function () {
  it('IndicatorPanel is memoized', function () {
    expect(isMemoized('components/IndicatorPanel.jsx')).toBe(true);
  });
  it('PlaybookDashboard is memoized', function () {
    expect(isMemoized('components/PlaybookDashboard.jsx')).toBe(true);
  });
});

// ─── Total count ─────────────────────────────────────────────────
describe('React.memo — Total count', function () {
  it('at least 13 components are memoized', function () {
    var count = 0;
    function walk(dir) {
      var entries = fs.readdirSync(dir, { withFileTypes: true });
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var full = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== '__tests__') {
          walk(full);
        } else if (entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) {
          var text = fs.readFileSync(full, 'utf-8');
          if (text.indexOf('export default React.memo') !== -1) {
            count++;
          }
        }
      }
    }
    walk(SRC);
    expect(count).toBeGreaterThanOrEqual(13);
  });
});
