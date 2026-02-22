# TradeForge OS — Architecture Guide

**192 source files · 53,197 lines · React 18 + Zustand**

TradeForge OS is a browser-based trading journal and analytics platform. It runs entirely client-side with optional WebSocket connections for live market data, persists to IndexedDB via a storage adapter layer, and supports server-side rendering for public pages (leaderboard, profiles, shared snapshots).

---

## System Layers

```
┌─────────────────────────────────────────────────────────┐
│  App Shell                                              │
│  App.jsx → Sidebar / MobileNav → PageRouter             │
│  ErrorBoundary · Toast · DailyGuardBanner               │
│  CommandPalette · NotificationPanel (lazy)               │
├─────────────────────────────────────────────────────────┤
│  Pages (10)                                             │
│  Dashboard · Journal · Charts · Insights · Settings     │
│  + 4 public SSR pages (Leaderboard, Profile, etc.)      │
├─────────────────────────────────────────────────────────┤
│  Components (83)                                        │
│  Chart canvas · Analytics tabs · Journal tables          │
│  Modals · Panels · Sheets · Toolbars                    │
│  30 lazy-loaded from ChartsPage alone                   │
├─────────────────────────────────────────────────────────┤
│  State (23 Zustand stores)                              │
│  Trade · Chart · UI · Settings · Analytics              │
│  Social · Theme · Sync · DailyGuard · Workspace         │
├─────────────────────────────────────────────────────────┤
│  Engine (28 modules)                                    │
│  Calc · chartRenderer · drawingTools · PriceAction      │
│  ScriptEngine · PatternDetector · analyticsFast          │
│  Analytics Web Worker · FrameBudget                     │
├─────────────────────────────────────────────────────────┤
│  Data (16 services)                                     │
│  DataProvider · FetchService · StorageService            │
│  WebSocketService · SocialService · ImportExport         │
│  BinanceAdapter · YahooAdapter · BaseAdapter            │
├─────────────────────────────────────────────────────────┤
│  Persistence                                            │
│  IndexedDB (StorageAdapter) · localStorage (settings)   │
│  CSV/JSON import/export · Demo data generator           │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

**Trade lifecycle:** CSV Import / Manual Entry → `useTradeStore.addTrade()` → StorageService persists → analyticsSingleton invalidates → analytics Web Worker recomputes → `useAnalyticsStore` updates → Dashboard/Journal/Insights re-render via Zustand selectors.

**Chart rendering:** `useChartStore` holds candle data, viewport, drawings → `ChartCanvas.jsx` reads state → `chartRenderer.js` paints to `<canvas>` via `CanvasBuffer` double-buffering → `FrameBudget.js` caps paint calls to 60fps → `drawingTools.js` overlays user drawings.

**Theme propagation:** `useThemeStore` calls `syncThemeColors(theme)` → mutates the `C` object in `constants.js` → all components reading `C.bg`, `C.t1`, etc. pick up new values on next render.

## Routing

PageRouter maps `useUIStore.page` to components. Only DashboardPage is eagerly loaded; the other 4 main pages are `React.lazy` code-split:

| Route | Page | Load |
|-------|------|------|
| `dashboard` | DashboardPage | Eager |
| `journal` | JournalPage | Lazy |
| `charts` | ChartsPage | Lazy |
| `insights` | InsightsPage | Lazy |
| `settings` | SettingsPage | Lazy |

Legacy aliases: `analytics` → Insights, `notes` → Journal, `plans` → Insights, `social` → Settings.

## Performance Architecture

**React.memo boundaries (15 components):** JournalTradeRow, LiveTicker, 4 chart components (EquityCurve, DailyPnl, BreakdownBar, WinRateDonut), 5 analytics tabs (Overview, Strategies, Psychology, Timing, Risk), IndicatorPanel, PlaybookDashboard, and 2 others.

**Zustand selectors + shallow:** All page-level components use `useXxxStore((s) => ({ field1: s.field1 }), shallow)` to prevent full-store re-renders. The `shallow` utility lives in `src/utils/shallow.js`.

**Code splitting:** 30 components lazy-loaded — ChartsPage alone defers 19 panels/sheets/modals until needed. Each lazy boundary wraps in `<Suspense>` with skeleton fallbacks.

**Canvas rendering:** Charts use raw `<canvas>` with `CanvasBuffer` (double-buffering), `FrameBudget` (60fps cap), and `LayoutCache` (memoized axis computations). No DOM-based charting library overhead.

**Web Worker:** Analytics computations run off-main-thread via `analytics.worker.js`, managed by `analyticsSingleton.js` which maintains a single worker instance with request deduplication and caching.

## File Organization

```
src/
├── App.jsx, AppBoot.js, main.jsx       # App shell + bootstrap
├── constants.js                         # Theme tokens (C), fonts (F/M), config
├── components/                          # 83 UI components
│   ├── analytics/                       #   6 analytics tab components
│   ├── chart/                           #   6 chart overlay components
│   └── journal/                         #   7 journal-specific components
├── pages/                               # 10 page components
│   └── public/                          #   4 SSR public pages
├── state/                               # 23 Zustand stores
├── engine/                              # 28 computation modules
├── data/                                # 16 data services + adapters
├── utils/                               # 13 utility modules
├── api/                                 # 4 API route handlers
├── seo/                                 # 3 SSR + sitemap modules
├── services/                            # 3 business logic services
└── theme/                               # 1 theme token file
```

## Key Conventions

**Imports:** All theme colors via `C` from `constants.js`. Font stacks via `F` (sans-serif) and `M` (monospace).

**Accessibility:** `tf-btn` class on all `<button>` elements for `:focus-visible` styling. ARIA roles on modals (`role="dialog"`), alerts (`role="alert"`), live regions (`aria-live="polite"`), and labeled inputs.

**Stores:** Zustand with `devtools` middleware. Never subscribe to full store — always use a selector. `getState()` for event handlers (no selector needed outside React).

**Testing:** Vitest with 723 test cases across 26 files. Coverage thresholds: 80% statements, 70% branches, 80% functions/lines. Engine and state layers have explicit coverage requirements.
