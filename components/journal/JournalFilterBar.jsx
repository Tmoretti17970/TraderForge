// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Journal Filter Bar
// Search, side filter, date range, asset class, summary stats
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../../constants.js';
import { fmtD } from '../../utils.js';

export default function JournalFilterBar({
  filter, setFilter,
  sideFilter, setSideFilter,
  dateRange, setDateRange,
  customDateFrom, setCustomDateFrom,
  customDateTo, setCustomDateTo,
  assetClassFilter, setAssetClassFilter,
  summary,
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <input aria-label="Filter trades"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search symbol, strategy, tags..."
          style={{
            flex: 1, minWidth: 160,
            padding: '8px 12px',
            borderRadius: 6,
            border: `1px solid ${C.bd}`,
            background: C.sf,
            color: C.t1,
            fontSize: 12,
            fontFamily: F,
            outline: 'none',
          }}
        />

        {/* Side Filter */}
        {['all', 'long', 'short'].map((s) => (
          <button className="tf-btn"
            key={s}
            onClick={() => setSideFilter(s)}
            style={{
              padding: '7px 12px',
              borderRadius: 4,
              border: `1px solid ${sideFilter === s ? C.b : C.bd}`,
              background: sideFilter === s ? C.b + '20' : 'transparent',
              color: sideFilter === s ? C.b : C.t3,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {s}
          </button>
        ))}

        {/* Date Range Filter */}
        <select aria-label="Filter by side"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: 4,
            border: `1px solid ${dateRange !== 'all' ? C.b : C.bd}`,
            background: dateRange !== 'all' ? C.b + '20' : C.sf,
            color: dateRange !== 'all' ? C.b : C.t3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="custom">Custom Range</option>
        </select>

        {/* Asset Class Filter */}
        <select
          value={assetClassFilter}
          onChange={(e) => setAssetClassFilter(e.target.value)}
          style={{
            padding: '7px 10px',
            borderRadius: 4,
            border: `1px solid ${assetClassFilter !== 'all' ? C.p : C.bd}`,
            background: assetClassFilter !== 'all' ? '#a855f720' : C.sf,
            color: assetClassFilter !== 'all' ? C.p : C.t3,
            fontSize: 11,
            fontWeight: 600,
            fontFamily: F,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="all">All Assets</option>
          <option value="crypto">Crypto</option>
          <option value="equities">Equities</option>
          <option value="futures">Futures</option>
          <option value="options">Options</option>
          <option value="forex">Forex</option>
        </select>

        {/* Summary */}
        <div style={{ fontSize: 11, fontFamily: M, color: C.t3, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          <span style={{ color: summary.pnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(summary.pnl)}</span>
          {' · '}
          <span style={{ color: C.g }}>{summary.wins}W</span>
          {' '}
          <span style={{ color: C.r }}>{summary.losses}L</span>
        </div>
      </div>

      {/* Custom date range inputs */}
      {dateRange === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.t3 }}>From</span>
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => setCustomDateFrom(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 4,
              border: `1px solid ${C.bd}`, background: C.sf,
              color: C.t1, fontSize: 11, fontFamily: M, outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: C.t3 }}>To</span>
          <input
            type="date"
            value={customDateTo}
            onChange={(e) => setCustomDateTo(e.target.value)}
            style={{
              padding: '6px 10px', borderRadius: 4,
              border: `1px solid ${C.bd}`, background: C.sf,
              color: C.t1, fontSize: 11, fontFamily: M, outline: 'none',
            }}
          />
          {(customDateFrom || customDateTo) && (
            <button className="tf-btn"
              onClick={() => { setCustomDateFrom(''); setCustomDateTo(''); }}
              style={{ padding: '4px 8px', borderRadius: 3, border: 'none', background: C.r + '20', color: C.r, fontSize: 10, cursor: 'pointer' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </>
  );
}
