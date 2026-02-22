// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — VirtualList Tests
//
// Tests the windowed rendering logic without a DOM (pure math tests).
// Since VirtualList is a React component, we test the core algorithms
// that determine which rows are visible and their positions.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

/**
 * Extract the windowing math from VirtualList for testability.
 * These mirror the useMemo calculations inside the component.
 */

function computeTotalHeight(itemCount, rowHeight, expandedIndex, expandedHeight) {
  const base = itemCount * rowHeight;
  if (expandedIndex >= 0 && expandedIndex < itemCount) {
    return base + (expandedHeight - rowHeight);
  }
  return base;
}

function computeVisibleRange(itemCount, scrollTop, containerHeight, rowHeight, expandedIndex, expandedHeight, overscan) {
  if (itemCount === 0) return { startIndex: 0, endIndex: 0, offsetTop: 0 };

  let start = 0;
  let accum = 0;

  for (let i = 0; i < itemCount; i++) {
    const h = (i === expandedIndex) ? expandedHeight : rowHeight;
    if (accum + h > scrollTop) {
      start = i;
      break;
    }
    accum += h;
    if (i === itemCount - 1) start = itemCount;
  }

  let visible = accum;
  let end = start;
  for (let i = start; i < itemCount; i++) {
    const h = (i === expandedIndex) ? expandedHeight : rowHeight;
    visible += h;
    end = i + 1;
    if (visible >= scrollTop + containerHeight) break;
  }

  const s = Math.max(0, start - overscan);
  const e = Math.min(itemCount, end + overscan);

  let offsetTop = 0;
  for (let i = 0; i < s; i++) {
    offsetTop += (i === expandedIndex) ? expandedHeight : rowHeight;
  }

  return { startIndex: s, endIndex: e, offsetTop };
}

// ─── Total Height ───────────────────────────────────────────────

describe('computeTotalHeight', () => {
  it('calculates simple height for uniform rows', () => {
    expect(computeTotalHeight(100, 44, -1, 0)).toBe(4400);
    expect(computeTotalHeight(10000, 44, -1, 0)).toBe(440000);
  });

  it('adds expanded row height difference', () => {
    // 100 rows × 44px = 4400, plus one expanded: +260-44 = +216
    expect(computeTotalHeight(100, 44, 5, 260)).toBe(4400 + (260 - 44));
  });

  it('handles zero items', () => {
    expect(computeTotalHeight(0, 44, -1, 0)).toBe(0);
  });

  it('handles expanded index out of range', () => {
    expect(computeTotalHeight(100, 44, 200, 260)).toBe(4400); // out of range, no expansion
  });
});

// ─── Visible Range (No Expansion) ───────────────────────────────

describe('computeVisibleRange (no expansion)', () => {
  const ROW_H = 44;
  const CONTAINER_H = 600;
  const OVERSCAN = 5;

  it('shows first ~14 rows at scroll=0', () => {
    const { startIndex, endIndex } = computeVisibleRange(1000, 0, CONTAINER_H, ROW_H, -1, 0, OVERSCAN);
    expect(startIndex).toBe(0);
    // ~600/44 = ~14 visible, +5 overscan = ~19
    expect(endIndex).toBeGreaterThanOrEqual(14);
    expect(endIndex).toBeLessThanOrEqual(25);
  });

  it('shifts window when scrolled', () => {
    // Scroll down 440px = 10 rows
    const { startIndex, endIndex } = computeVisibleRange(1000, 440, CONTAINER_H, ROW_H, -1, 0, OVERSCAN);
    expect(startIndex).toBe(5); // 10 - 5 overscan
    expect(endIndex).toBeGreaterThanOrEqual(24); // 10 + ~14 visible + 5 overscan
  });

  it('clamps at the end of the list', () => {
    // Scroll to near the end: (1000 - 14) * 44 = ~43384
    const { endIndex } = computeVisibleRange(1000, 43384, CONTAINER_H, ROW_H, -1, 0, OVERSCAN);
    expect(endIndex).toBe(1000);
  });

  it('renders only visible + overscan items (not all 10K)', () => {
    const { startIndex, endIndex } = computeVisibleRange(10000, 0, CONTAINER_H, ROW_H, -1, 0, OVERSCAN);
    const renderedCount = endIndex - startIndex;
    // Should render ~14 visible + 5 overscan bottom = ~19, not 10000
    expect(renderedCount).toBeLessThan(30);
    expect(renderedCount).toBeGreaterThan(10);
  });

  it('handles 50K items without blowing up', () => {
    const start = performance.now();
    const { startIndex, endIndex } = computeVisibleRange(50000, 100000, CONTAINER_H, ROW_H, -1, 0, OVERSCAN);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50); // should be <5ms but generous threshold
    expect(endIndex - startIndex).toBeLessThan(30);
  });
});

// ─── Visible Range (With Expansion) ─────────────────────────────

describe('computeVisibleRange (with expanded row)', () => {
  const ROW_H = 44;
  const EXP_H = 260;
  const CONTAINER_H = 600;
  const OVERSCAN = 5;

  it('includes expanded row in visible range', () => {
    // Expanded row at index 3 (near top)
    const { startIndex, endIndex } = computeVisibleRange(1000, 0, CONTAINER_H, ROW_H, 3, EXP_H, OVERSCAN);
    expect(startIndex).toBe(0);
    // Expanded row takes more space, so fewer rows fit in viewport
    expect(endIndex).toBeLessThanOrEqual(25);
  });

  it('expanded row below viewport does not affect start range', () => {
    // Expanded row at index 500, scrolled to top
    const { startIndex, endIndex } = computeVisibleRange(1000, 0, CONTAINER_H, ROW_H, 500, EXP_H, OVERSCAN);
    expect(startIndex).toBe(0);
    // Should see normal number of rows since expanded is offscreen
    const renderedCount = endIndex - startIndex;
    expect(renderedCount).toBeGreaterThan(10);
  });

  it('scrolling past expanded row shifts correctly', () => {
    // Expanded at index 10. Everything below it is shifted by (260-44)=216px.
    // Scroll to 1000px → should see rows around index 22 (accounting for expanded)
    const { startIndex } = computeVisibleRange(1000, 1000, CONTAINER_H, ROW_H, 10, EXP_H, OVERSCAN);
    // Row 10 takes 260px instead of 44px, rows 0-9 take 440px, row 10 takes 260px = 700px
    // At scroll 1000, we're 300px past the expanded row, so ~7 rows past it = index ~17
    expect(startIndex).toBeGreaterThanOrEqual(10); // somewhere past the expanded row
  });
});

// ─── Offset Calculation ─────────────────────────────────────────

describe('offset calculation', () => {
  it('offset is 0 when starting from index 0', () => {
    const { offsetTop } = computeVisibleRange(1000, 0, 600, 44, -1, 0, 5);
    expect(offsetTop).toBe(0);
  });

  it('offset accounts for skipped rows', () => {
    // Scroll down so startIndex is 10 (with overscan 5, visible starts at ~15)
    const { startIndex, offsetTop } = computeVisibleRange(1000, 880, 600, 44, -1, 0, 5);
    // startIndex should be around 15, offset = 15 * 44 = 660
    expect(offsetTop).toBe(startIndex * 44);
  });

  it('offset accounts for expanded row above start', () => {
    // Expanded at index 2, scroll to see rows 10+
    const { startIndex, offsetTop } = computeVisibleRange(1000, 880, 600, 44, 2, 260, 5);
    // Rows 0,1 = 88px, row 2 = 260px, rows 3+ = 44px each
    let expected = 0;
    for (let i = 0; i < startIndex; i++) {
      expected += (i === 2) ? 260 : 44;
    }
    expect(offsetTop).toBe(expected);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles 0 items', () => {
    const { startIndex, endIndex } = computeVisibleRange(0, 0, 600, 44, -1, 0, 5);
    expect(startIndex).toBe(0);
    expect(endIndex).toBe(0);
  });

  it('handles 1 item', () => {
    const { startIndex, endIndex } = computeVisibleRange(1, 0, 600, 44, -1, 0, 5);
    expect(startIndex).toBe(0);
    expect(endIndex).toBe(1);
  });

  it('handles fewer items than container can show', () => {
    // 5 items × 44px = 220px, container is 600px
    const { startIndex, endIndex } = computeVisibleRange(5, 0, 600, 44, -1, 0, 5);
    expect(startIndex).toBe(0);
    expect(endIndex).toBe(5); // all items visible
  });

  it('handles very large overscan', () => {
    // Overscan larger than item count
    const { startIndex, endIndex } = computeVisibleRange(10, 0, 600, 44, -1, 0, 100);
    expect(startIndex).toBe(0);
    expect(endIndex).toBe(10);
  });

  it('expanded row at last index', () => {
    const total = computeTotalHeight(100, 44, 99, 260);
    expect(total).toBe(100 * 44 + (260 - 44));

    const { endIndex } = computeVisibleRange(100, total - 600, 600, 44, 99, 260, 5);
    expect(endIndex).toBe(100);
  });

  it('expanded row at first index', () => {
    const { startIndex } = computeVisibleRange(100, 0, 600, 44, 0, 260, 5);
    expect(startIndex).toBe(0);
  });
});

// ─── Performance Benchmark ──────────────────────────────────────

describe('performance', () => {
  it('computes visible range for 10K items in <5ms', () => {
    const times = [];
    for (let trial = 0; trial < 10; trial++) {
      const scrollTop = Math.random() * 10000 * 44;
      const expandedIdx = Math.floor(Math.random() * 10000);
      const start = performance.now();
      computeVisibleRange(10000, scrollTop, 600, 44, expandedIdx, 260, 5);
      times.push(performance.now() - start);
    }
    const avg = times.reduce((a, b) => a + b) / times.length;
    expect(avg).toBeLessThan(5); // avg should be <1ms on modern hardware
  });

  it('computes visible range for 50K items in <10ms', () => {
    const start = performance.now();
    computeVisibleRange(50000, 25000 * 44, 600, 44, 25000, 260, 5);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10);
  });
});
