// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — VirtualList
//
// Lightweight windowed list renderer for large datasets.
// Renders only visible rows + buffer, using absolute positioning
// within a fixed-height scrollable container.
//
// Designed for JournalPage where:
//   - Collapsed rows have a known fixed height
//   - One row can be expanded (variable height, measured after render)
//   - Scroll must remain smooth at 10K+ items
//
// Zero external dependencies. ~130 lines.
//
// Usage:
//   <VirtualList
//     items={filteredTrades}
//     rowHeight={44}
//     expandedId={expandedId}
//     expandedHeight={260}
//     containerHeight={600}
//     overscan={5}
//     renderRow={(item, index, isExpanded) => <TradeRow ... />}
//   />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

/**
 * @param {Object} props
 * @param {Array} props.items - Full array of items to render
 * @param {number} props.rowHeight - Height of a collapsed row in px
 * @param {string|null} [props.expandedId] - ID of the currently expanded item (item.id)
 * @param {number} [props.expandedHeight=260] - Estimated expanded row height in px
 * @param {number} [props.containerHeight=600] - Visible container height in px
 * @param {number} [props.overscan=5] - Extra rows to render above/below viewport
 * @param {Function} props.renderRow - (item, index, isExpanded) => ReactNode
 * @param {React.ReactNode} [props.header] - Sticky header element (rendered above virtual rows)
 * @param {Object} [props.style] - Additional styles for the outer container
 */
export default function VirtualList({
  items,
  rowHeight,
  expandedId = null,
  expandedHeight = 260,
  containerHeight = 600,
  overscan = 5,
  renderRow,
  header = null,
  style = {},
}) {
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const expandedMeasureRef = useRef(null);
  const [measuredExpandedHeight, setMeasuredExpandedHeight] = useState(null);

  // Find the index of the expanded item (if any)
  const expandedIndex = useMemo(() => {
    if (expandedId == null) return -1;
    return items.findIndex((item) => item.id === expandedId);
  }, [items, expandedId]);

  // Reset measured height when expanded item changes
  useEffect(() => {
    setMeasuredExpandedHeight(null);
  }, [expandedId]);

  // Measure actual expanded row height after render
  useEffect(() => {
    if (expandedIndex >= 0 && expandedMeasureRef.current) {
      const h = expandedMeasureRef.current.getBoundingClientRect().height;
      if (h > 0 && h !== measuredExpandedHeight) {
        setMeasuredExpandedHeight(h);
      }
    }
  });

  // The effective expanded height: use measured if available, otherwise estimate
  const effExpandedH = measuredExpandedHeight || expandedHeight;

  // Total content height
  const totalHeight = useMemo(() => {
    const base = items.length * rowHeight;
    if (expandedIndex >= 0) {
      return base + (effExpandedH - rowHeight); // replace one normal row with expanded height
    }
    return base;
  }, [items.length, rowHeight, expandedIndex, effExpandedH]);

  // Calculate which rows are visible
  const { startIndex, endIndex } = useMemo(() => {
    const count = items.length;
    if (count === 0) return { startIndex: 0, endIndex: 0 };

    // Binary search: find the first row whose bottom edge is past scrollTop
    // Account for expanded row shifting everything below it
    let start = 0;
    let accum = 0;

    // Walk forward to find start (could optimize with binary search, but
    // with overscan of 5 and constant-time per row, this is fine up to ~100K)
    for (let i = 0; i < count; i++) {
      const h = (i === expandedIndex) ? effExpandedH : rowHeight;
      if (accum + h > scrollTop) {
        start = i;
        break;
      }
      accum += h;
      if (i === count - 1) start = count; // scrolled past everything
    }

    // Walk forward to find end
    let visible = accum;
    let end = start;
    for (let i = start; i < count; i++) {
      const h = (i === expandedIndex) ? effExpandedH : rowHeight;
      visible += h;
      end = i + 1;
      if (visible >= scrollTop + containerHeight) break;
    }

    // Apply overscan
    const s = Math.max(0, start - overscan);
    const e = Math.min(count, end + overscan);

    return { startIndex: s, endIndex: e };
  }, [items.length, scrollTop, containerHeight, rowHeight, expandedIndex, effExpandedH, overscan]);

  // Calculate top offset for the first rendered row
  const offsetTop = useMemo(() => {
    let top = 0;
    for (let i = 0; i < startIndex; i++) {
      top += (i === expandedIndex) ? effExpandedH : rowHeight;
    }
    return top;
  }, [startIndex, rowHeight, expandedIndex, effExpandedH]);

  // Handle scroll
  const onScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Slice the visible items
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative',
        ...style,
      }}
    >
      {/* Sticky header (if provided) */}
      {header}

      {/* Spacer div to create the full scrollable height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Rendered rows, positioned absolutely */}
        <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
          {visibleItems.map((item, i) => {
            const actualIndex = startIndex + i;
            const isExpanded = actualIndex === expandedIndex;

            return (
              <div
                key={item.id}
                ref={isExpanded ? expandedMeasureRef : undefined}
                style={{ width: '100%' }}
              >
                {renderRow(item, actualIndex, isExpanded)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { VirtualList };
