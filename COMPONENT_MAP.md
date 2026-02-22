# TradeForge OS — Component Map

**83 components · 23,202 lines · 15 memo boundaries · 30 lazy-loaded**

---

## Component Tree

```
App.jsx
├── ErrorBoundary
├── Sidebar (desktop)
├── MobileNav (mobile)
├── DailyGuardBanner [role="alert"]
├── ToastContainer [role="status", aria-live]
├── CommandPalette (lazy) [role="dialog"]
├── NotificationPanel (lazy) [role="log", aria-live]
├── OnboardingWizard (lazy) [role="dialog"]
├── KeyboardShortcuts [role="dialog"]
│
└── PageRouter
    ├── DashboardPage (eager)
    │   ├── DashboardWidgets
    │   │   ├── EquityCurveChart ★
    │   │   ├── DailyPnlChart ★
    │   │   ├── BreakdownBarChart ★
    │   │   ├── WinRateDonut ★
    │   │   ├── RDistributionChart
    │   │   ├── TimeBarChart
    │   │   ├── TradeHeatmap
    │   │   └── PropFirmWidget
    │   └── WidgetGrid → WidgetBoundary → WidgetCustomizer
    │
    ├── JournalPage (lazy)
    │   ├── JournalFilterBar
    │   ├── JournalTradeRow ★ (VirtualList row)
    │   ├── JournalQuickAdd
    │   ├── JournalEvolution
    │   ├── BulkOperations
    │   ├── ContextPerformanceTab
    │   ├── CSVImportModal [role="dialog"]
    │   ├── TradeFormModal [role="dialog"]
    │   ├── MobileJournal (mobile)
    │   └── NotesPage (lazy)
    │
    ├── ChartsPage (lazy) — 19 lazy children
    │   ├── ChartCanvas → useChartInteractions
    │   │   ├── ChartWrapper
    │   │   └── Tooltip
    │   ├── ChartSettingsBar (lazy)
    │   ├── ChartInsightsPanel (lazy)
    │   ├── ChartPane (lazy)
    │   ├── DrawingToolbar (lazy)
    │   ├── IndicatorPanel ★ (lazy)
    │   ├── ReplayBar (lazy)
    │   ├── QuadChart (lazy)
    │   ├── WorkspaceLayout (lazy) → WorkspaceLoader
    │   │   ├── ComparePanel
    │   │   ├── InsightsPanel
    │   │   ├── WatchlistPanel
    │   │   ├── AlertPanel
    │   │   └── ChartPane
    │   ├── FundamentalsCard (lazy)
    │   ├── ScriptEditor (lazy)
    │   ├── ScriptManager (lazy)
    │   ├── ShareSnapshotModal (lazy) [role="dialog"]
    │   ├── SnapshotPublisher (lazy)
    │   ├── TemplateSelector (lazy)
    │   ├── LiveTicker ★
    │   ├── SymbolSearch
    │   │
    │   │── Mobile-only (lazy)
    │   │   ├── MobileChartSheet
    │   │   ├── MobileDrawingSheet
    │   │   ├── MobileShareSheet
    │   │   ├── SwipeChartNav
    │   │   └── GestureGuide
    │   │
    │   └── Chart overlays (lazy)
    │       ├── TradeEntryBar
    │       ├── PositionSizer
    │       ├── QuickJournalPanel
    │       ├── ChartContextMenu
    │       └── ChartTradeToolbar
    │
    ├── InsightsPage (lazy)
    │   ├── OverviewTab ★
    │   ├── StrategiesTab ★
    │   ├── PsychologyTab ★
    │   ├── TimingTab ★
    │   ├── RiskTab ★
    │   ├── PlaybookDashboard ★ → PlaybookManager
    │   ├── RiskCalculator
    │   ├── TradePlanManager (lazy)
    │   └── MobileAnalytics (mobile)
    │
    └── SettingsPage (lazy)
        ├── MobileSettings (mobile)
        └── Leaderboard

★ = React.memo boundary
```

## Memo Boundaries (15)

These components are wrapped in `React.memo()` to prevent unnecessary re-renders. If any lose their wrapper, `memo.test.js` will fail.

| Component | Why memoized |
|-----------|-------------|
| JournalTradeRow | VirtualList row — renders 100s of times |
| LiveTicker | WebSocket updates every ~1s |
| EquityCurveChart | Canvas repaint is expensive |
| DailyPnlChart | Canvas repaint |
| BreakdownBarChart | Canvas repaint |
| WinRateDonut | Canvas repaint |
| OverviewTab | Large computation display |
| StrategiesTab | Table with per-strategy stats |
| PsychologyTab | Emotion/context analysis |
| TimingTab | Time-based heatmaps |
| RiskTab | Risk metric calculations |
| IndicatorPanel | 7+ buttons, complex state |
| PlaybookDashboard | Playbook stat cards |
| + 2 others | Detected by memo.test.js total count |

## Lazy Loading (30 components)

**From App.jsx (3):** CommandPalette, NotificationPanel, OnboardingWizard

**From PageRouter (4):** JournalPage, ChartsPage, InsightsPage, SettingsPage

**From ChartsPage (19):** ChartSettingsBar, ChartInsightsPanel, DrawingToolbar, IndicatorPanel, ReplayBar, QuadChart, WorkspaceLayout, FundamentalsCard, ScriptEditor, ScriptManager, ShareSnapshotModal, SnapshotPublisher, TemplateSelector, AlertPanel, WatchlistPanel, MobileChartSheet, MobileDrawingSheet, MobileShareSheet, SwipeChartNav, GestureGuide, PositionSizer, QuickJournalPanel, TradeEntryBar

**From JournalPage (1):** NotesPage

**From InsightsPage (1):** TradePlanManager

## ARIA Coverage

| Pattern | Count | Components |
|---------|-------|-----------|
| `role="dialog" aria-modal` | 6 | TradeFormModal, CSVImportModal, ShareSnapshotModal, KeyboardShortcuts, CommandPalette, OnboardingWizard |
| `role="alert"` | 1 | DailyGuardBanner |
| `role="status" aria-live` | 1 | Toast |
| `role="log" aria-live` | 1 | NotificationPanel |
| `aria-label` on inputs | 9 | SymbolSearch, JournalFilterBar, JournalQuickAdd, WatchlistPanel, RiskCalculator, AlertPanel, ChartSettingsBar, ComparePanel, IndicatorPanel |
| `aria-pressed` / `aria-selected` | 4 | Public pages (metric selectors, tabs) |
| `aria-label` on nav | 3 | Sidebar, MobileNav, PublicNav |
| **tf-btn** on buttons | **166** | All 83 components with `<button>` elements |

## Shared Components

| Component | Purpose | Used by |
|-----------|---------|---------|
| UIKit | SkeletonRow, Badge, shared primitives | PageRouter, DashboardPage, JournalPage |
| EmptyState | Zero-data placeholder with CTA | Dashboard, Journal, Charts, Insights |
| ErrorBoundary | Crash boundary with retry | App.jsx (wraps entire app) |
| Toast / ToastContainer | Notification toasts | Global via useNotificationLog |
| Tooltip | Canvas hover tooltip | ChartCanvas |
| WidgetBoundary | Error isolation per widget | WidgetGrid → DashboardWidgets |
