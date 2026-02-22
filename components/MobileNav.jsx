// ═══════════════════════════════════════════════════════════════════
// TradeForge — Mobile Navigation (Sprint 2: 5-Tab Bottom Bar)
//
// Clean 5-tab bar: Home | Journal | Charts | Insights | Settings
// No "More" overflow — all destinations directly accessible.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, M } from '../constants.js';
import { useUIStore } from '../state/useUIStore.js';

// Compact inline SVG icons (18x18 for bottom bar)
const icons = {
  dashboard: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="11" width="7" height="10" rx="1" />
    </svg>
  ),
  journal: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  charts: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
    </svg>
  ),
  insights: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M11 8v6" /><path d="M8 11h6" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  settings: (c) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
};

const TABS = [
  { id: 'dashboard', label: 'Home',     icon: 'dashboard' },
  { id: 'journal',   label: 'Journal',  icon: 'journal' },
  { id: 'charts',    label: 'Charts',   icon: 'charts' },
  { id: 'insights',  label: 'Insights', icon: 'insights' },
  { id: 'settings',  label: 'Settings', icon: 'settings' },
];

export default function MobileNav() {
  const page = useUIStore((s) => s.page);
  const setPage = useUIStore((s) => s.setPage);

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 56,
        background: C.bg,
        borderTop: `1px solid ${C.bd}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 999,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {TABS.map((tab) => {
        const active = page === tab.id;
        const iconFn = icons[tab.icon];
        return (
          <button
            key={tab.id}
            onClick={() => setPage(tab.id)}
            className="tf-nav-btn"
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              minHeight: 44,
            }}
          >
            {iconFn(active ? C.b : C.t3)}
            <span style={{
              fontSize: 10,
              fontFamily: M,
              fontWeight: active ? 700 : 500,
              color: active ? C.b : C.t3,
            }}>
              {tab.label}
            </span>
            {active && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '25%',
                right: '25%',
                height: 2,
                borderRadius: 1,
                background: C.b,
              }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
