# TradeForge OS — File Manifest

**192 source files · 53,197 lines · Generated from live codebase**

---

## Summary

| Layer | Files | Lines |
|-------|------:|------:|
| `(root)/` | 8 | 1,458 |
| `api/` | 4 | 1,198 |
| `components/` | 64 | 19,671 |
| `components/analytics/` | 6 | 716 |
| `components/chart/` | 6 | 994 |
| `components/journal/` | 7 | 1,821 |
| `data/` | 13 | 4,111 |
| `data/adapters/` | 3 | 301 |
| `engine/` | 28 | 10,503 |
| `pages/` | 6 | 4,289 |
| `pages/public/` | 4 | 1,156 |
| `seo/` | 3 | 498 |
| `services/` | 3 | 557 |
| `state/` | 23 | 3,357 |
| `theme/` | 1 | 263 |
| `utils/` | 13 | 2,304 |
| **Total** | **192** | **53,197** |

---


## `(root)/` (8 files, 1,458 lines)

| File | Lines | Description |
|------|------:|-------------|
| App.jsx | 164 | TradeForge OS v10.1 — Application Root |
| AppBoot.js | 271 | TradeForge OS v10 — App Boot Sequence |
| constants.js | 176 | TradeForge OS v10 — Constants & Theme |
| csv.js | 418 | TradeForge OS v10 — CSV Import/Export |
| entry-server.jsx | 117 | TradeForge OS v10 — SSR Entry Point |
| main.jsx | 16 |  |
| registerSW.js | 62 | TradeForge OS — Service Worker Registration (Sprint 5.7) |
| utils.js | 234 | TradeForge OS v10 — Utility Functions |

## `api/` (4 files, 1,198 lines)

| File | Lines | Description |
|------|------:|-------------|
| billingRoutes.js | 287 | TradeForge OS v10 — Stripe Billing Routes (Sprint 5.6) |
| brokerOAuth.js | 350 | TradeForge OS v10 — Broker OAuth Proxy (Sprint 5.3) |
| middleware.js | 208 | TradeForge OS v10 — API Middleware |
| routes.js | 353 | TradeForge OS v10 — API Routes |

## `components/` (64 files, 19,671 lines)

| File | Lines | Description |
|------|------:|-------------|
| AlertPanel.jsx | 332 | TradeForge OS v10 — Alert Panel |
| BreakdownBarChart.jsx | 107 | TradeForge OS v10 — Breakdown Bar Chart |
| CSVImportModal.jsx | 426 | TradeForge OS v10 — CSV Import Modal |
| ChartCanvas.jsx | 539 | TradeForge OS v10 — ChartCanvas |
| ChartInsightsPanel.jsx | 290 | TradeForge OS v10.3 — Chart Insights Panel |
| ChartPane.jsx | 356 | TradeForge OS v10 — ChartPane |
| ChartSettingsBar.jsx | 401 | TradeForge OS v10 — Chart Settings Panel |
| ChartWrapper.jsx | 79 | TradeForge OS v10 — Chart.js React Wrapper |
| CommandPalette.jsx | 357 | TradeForge OS v10 — Command Palette (Ctrl+K) |
| ComparePanel.jsx | 462 | TradeForge OS v10 — Compare & Goals Panel (Sprint 4.4 + 4.7) |
| DailyGuardBanner.jsx | 103 | TradeForge OS v10 — Daily Guard Banner |
| DailyPnlChart.jsx | 106 | TradeForge OS v10 — Daily P&L Bar Chart |
| DashboardWidgets.jsx | 627 | TradeForge OS v10.4 — Dashboard Widgets |
| DrawingToolbar.jsx | 452 | TradeForge OS v10 — Drawing Toolbar (TradingView-style) |
| EmptyState.jsx | 491 | TradeForge — Empty State System (Redesign) |
| EquityCurveChart.jsx | 125 | TradeForge OS v10 — Equity Curve Chart |
| ErrorBoundary.jsx | 167 | TradeForge OS v10 — Error Boundary (Enhanced) |
| FundamentalsCard.jsx | 224 | TradeForge OS v10 — Fundamentals Card |
| GestureGuide.jsx | 161 | TradeForge OS v10.2 — Gesture Guide Overlay |
| IndicatorPanel.jsx | 391 | TradeForge OS v10 — Indicator Panel |
| InsightsPanel.jsx | 569 | TradeForge OS v10 — Insights Panel (Sprint 4) |
| KeyboardShortcuts.jsx | 216 | TradeForge OS v10.1 — Keyboard Shortcuts Panel |
| Leaderboard.jsx | 201 | TradeForge OS v10 — Leaderboard |
| LiveTicker.jsx | 153 | TradeForge OS v10 — LiveTicker |
| MobileAnalytics.jsx | 392 | TradeForge OS v10 — Mobile Analytics (Mobile Optimization) |
| MobileChartSheet.jsx | 288 | TradeForge OS v10.2 — Mobile Chart Sheet |
| MobileDrawingSheet.jsx | 237 | TradeForge OS v10.2 — Mobile Drawing Sheet |
| MobileJournal.jsx | 376 | TradeForge OS v10 — Mobile Journal (Mobile Optimization) |
| MobileNav.jsx | 127 | TradeForge — Mobile Navigation (Sprint 2: 5-Tab Bottom Bar) |
| MobileSettings.jsx | 908 | TradeForge — Mobile Settings |
| MobileShareSheet.jsx | 222 | TradeForge OS v10.2 — Mobile Share Sheet |
| NotificationPanel.jsx | 389 | TradeForge OS v10 — Notification Panel |
| OnboardingWizard.jsx | 550 | TradeForge OS v10 — Enhanced Onboarding Wizard |
| PageRouter.jsx | 76 | TradeForge — Page Router (Sprint 2: 5-Page IA) |
| PlaybookDashboard.jsx | 380 | TradeForge OS v10 — Playbook Dashboard |
| PlaybookManager.jsx | 221 | TradeForge OS v10 — Playbook Manager |
| PropFirmWidget.jsx | 399 | TradeForge OS v10 — Prop Firm Widget (Sprint 5) |
| QuadChart.jsx | 269 | TradeForge OS v10 — Quad Chart View |
| RDistributionChart.jsx | 104 | TradeForge OS v10 — R-Multiple Distribution Chart |
| ReplayBar.jsx | 413 | TradeForge OS v10 — Replay Control Bar |
| RiskCalculator.jsx | 269 | TradeForge OS v10 — Risk Calculator |
| ScriptEditor.jsx | 509 | TradeForge OS v10 — Script Editor (Bottom Panel) |
| ScriptManager.jsx | 428 | TradeForge OS v10 — Script Manager Panel |
| ShareSnapshotModal.jsx | 262 | TradeForge OS v10 — Share Snapshot Modal |
| Sidebar.jsx | 300 | TradeForge — Sidebar Navigation (Sprint 2: 5-Page IA) |
| SnapshotPublisher.jsx | 207 | TradeForge OS v10.1 — Snapshot Publisher |
| SwipeChartNav.jsx | 186 | TradeForge OS v10.2 — Swipe Chart Navigation |
| SymbolSearch.jsx | 245 | TradeForge OS v10 — SymbolSearch |
| TemplateSelector.jsx | 282 | TradeForge OS v10 — Template Selector |
| TimeBarChart.jsx | 111 | TradeForge OS v10 — Time Bar Chart |
| Toast.jsx | 181 | TradeForge OS v10 — Toast Notification System |
| Tooltip.jsx | 156 | TradeForge OS v10 — Contextual Tooltip |
| TradeFormModal.jsx | 596 | TradeForge OS v10 — Trade Form Modal |
| TradeHeatmap.jsx | 350 | TradeForge OS v10 — TradeHeatmap |
| TradePlanManager.jsx | 429 | TradeForge OS v10 — Trade Plans |
| UIKit.jsx | 362 | TradeForge OS v10 — UIKit Design System |
| WatchlistPanel.jsx | 199 | TradeForge OS v10 — Watchlist Panel |
| WidgetBoundary.jsx | 90 | TradeForge OS — Widget Error Boundary |
| WidgetCustomizer.jsx | 233 | TradeForge OS v10.4 — Widget Customizer Modal |
| WidgetGrid.jsx | 175 | TradeForge OS v10.4 — Widget Grid System |
| WinRateDonut.jsx | 101 | TradeForge OS v10 — Win Rate Donut Chart |
| WorkspaceLayout.jsx | 689 | TradeForge OS v10 — WorkspaceLayout |
| WorkspaceLoader.jsx | 87 | TradeForge OS v10 — Workspace Loader |
| useChartInteractions.js | 538 | TradeForge OS v10 — Chart Interaction Hook |

## `components/analytics/` (6 files, 716 lines)

| File | Lines | Description |
|------|------:|-------------|
| AnalyticsPrimitives.jsx | 220 | TradeForge OS v10 — Analytics Shared Primitives |
| OverviewTab.jsx | 106 | TradeForge OS v10 — Analytics Overview Tab |
| PsychologyTab.jsx | 79 | TradeForge OS v10 — Analytics Psychology Tab |
| RiskTab.jsx | 67 | TradeForge OS v10 — Analytics Risk Tab |
| StrategiesTab.jsx | 143 | TradeForge OS v10 — Analytics Strategies Tab |
| TimingTab.jsx | 101 | TradeForge OS v10 — Analytics Timing Tab |

## `components/chart/` (6 files, 994 lines)

| File | Lines | Description |
|------|------:|-------------|
| ChartContextMenu.jsx | 128 | TradeForge OS v10.6 — Chart Context Menu |
| ChartTradeToolbar.jsx | 87 | TradeForge OS v10.6 — Chart Trade Toolbar |
| PositionSizer.jsx | 233 | TradeForge OS v10.6 — Position Sizer Panel |
| QuickJournalPanel.jsx | 243 | TradeForge OS v10.6 — Quick Journal Panel |
| TradeEntryBar.jsx | 177 | TradeForge OS v10.6 — Trade Entry Bar |
| useChartTradeHandler.js | 126 | TradeForge OS v10.6 — Chart Trade Handler Hook |

## `components/journal/` (7 files, 1,821 lines)

| File | Lines | Description |
|------|------:|-------------|
| BulkOperations.jsx | 212 | TradeForge OS v10.5 — Bulk Operations Engine |
| ContextPerformanceTab.jsx | 268 | TradeForge OS v10.5 — Context Performance Tab |
| JournalEvolution.jsx | 627 | TradeForge OS v10.5 — Journal Evolution Components |
| JournalFilterBar.jsx | 160 | TradeForge OS v10 — Journal Filter Bar |
| JournalQuickAdd.jsx | 131 | TradeForge OS v10 — Journal Quick-Add Row (J1.1) |
| JournalTradeRow.jsx | 284 | TradeForge OS v10.5 — Journal Trade Row (Sprint 9 update) |
| TradeReplay.js | 139 | TradeForge OS v10.5 — Trade Replay Launcher |

## `data/` (13 files, 4,111 lines)

| File | Lines | Description |
|------|------:|-------------|
| DataManager.js | 170 | TradeForge OS v10 — Data Manager (Arch Improvement #8) |
| DataProvider.js | 401 | TradeForge OS v10 — DataProvider (Sprint 6) |
| FetchService.js | 295 | TradeForge OS v10 — FetchService |
| FundamentalService.js | 149 | TradeForge OS v10 — Fundamental Data Service |
| ImportExport.js | 686 | TradeForge OS v10 — Import / Export Engine (Sprint 7) |
| SocialService.js | 207 | TradeForge OS v10 — Social Service |
| StorageAdapter.js | 451 | TradeForge OS v10 — StorageAdapter (Sprint 7) |
| StorageService.js | 530 | TradeForge OS v10 — StorageService (MiniDB / IndexedDB) |
| SymbolRegistry.js | 223 | TradeForge OS v10 — Symbol Registry (Arch Improvement #7) |
| WebSocketService.js | 366 | TradeForge OS v10 — WebSocketService (Binance Spot) |
| demoData.js | 231 | TradeForge OS v10 — Demo Data Generator |
| socialMockData.js | 270 | TradeForge OS v10 — Social Mock Data |
| useWebSocket.js | 132 | TradeForge OS v10 — useWebSocket Hook |

## `data/adapters/` (3 files, 301 lines)

| File | Lines | Description |
|------|------:|-------------|
| BaseAdapter.js | 71 | TradeForge OS v10 — Base Data Adapter (Arch Improvement #8) |
| BinanceAdapter.js | 130 | TradeForge OS v10 — Binance Adapter |
| YahooAdapter.js | 100 | TradeForge OS v10 — Yahoo Finance Adapter |

## `engine/` (28 files, 10,503 lines)

| File | Lines | Description |
|------|------:|-------------|
| AnalyticsBridge.js | 191 | TradeForge OS v10 — AnalyticsBridge |
| AnalyticsExport.js | 261 | TradeForge OS v10 — Analytics Export (Sprint 4.5) |
| BrokerProfiles.js | 359 | TradeForge OS v10 — Broker CSV Profiles |
| Calc.js | 652 | TradeForge OS v10 — Indicator Calculation Engine |
| CanvasBuffer.js | 228 | TradeForge OS v10 — CanvasBuffer (Offscreen Double-Buffering) |
| DailyDebrief.js | 231 | TradeForge OS v10 — Daily Debrief Generator (Sprint 4.2) |
| FrameBudget.js | 380 | TradeForge OS v10 — FrameBudget |
| LayoutCache.js | 120 | TradeForge OS v10 — LayoutCache |
| Money.js | 303 | TradeForge OS v10 — Financial Math Precision Module |
| PatternDetector.js | 535 | TradeForge OS v10 — Behavioral Pattern Detector (Sprint 4.1) |
| PerformanceCompare.js | 248 | TradeForge OS v10 — Performance Compare Engine (Sprint 4.4 + 4.6) |
| PriceActionEngine.js | 565 | TradeForge OS v10.3 — Price Action Intelligence Engine |
| ReportGenerator.js | 167 | TradeForge OS v10 — Analytics Report Generator (Sprint 8) |
| RiskPresets.js | 267 | TradeForge OS v10 — Risk Presets |
| ScriptEngine.js | 318 | TradeForge OS v10 — Script Engine |
| SubPaneManager.js | 273 | TradeForge OS v10 — SubPaneManager (Sprint 8) |
| TradeSchema.js | 243 | TradeForge OS v10 — Trade Schema (Sprint 7) |
| analytics.worker.js | 43 | TradeForge OS v10 — Analytics Web Worker |
| analyticsFast.js | 712 | TradeForge OS v10 — Single-Pass Analytics Engine (Phase 4) |
| analyticsSingleton.js | 209 | TradeForge OS v10 — Analytics Singleton |
| chartRenderer.js | 1614 | TradeForge OS v10 — Chart Renderer |
| compInd.js | 28 |  |
| drawingTools.js | 1190 | TradeForge OS v10 — Drawing Tools Renderer (TradingView-style) |
| generateOHLCV.js | 135 | TradeForge OS v10 — OHLCV Demo Data Generator |
| orderFlow.js | 112 | TradeForge OS v10 — Order Flow / Volume Profile |
| reconcile.js | 428 | TradeForge OS v10 — Trade Reconciliation Engine |
| scriptLibrary.js | 591 | TradeForge OS v10 — Built-in Script Library |
| useScriptRunner.js | 100 | TradeForge OS v10 — Script Runner Hook |

## `pages/` (6 files, 4,289 lines)

| File | Lines | Description |
|------|------:|-------------|
| ChartsPage.jsx | 1104 | TradeForge — Charts Page (Sprint 4: Progressive Disclosure) |
| DashboardPage.jsx | 641 | TradeForge — Dashboard Page (Sprint 3: Narrative Redesign) |
| InsightsPage.jsx | 268 | TradeForge — Insights Page (Redesign) |
| JournalPage.jsx | 784 | TradeForge — Journal Page (Redesign) |
| NotesPage.jsx | 467 | TradeForge — Notes Page (Redesign) |
| SettingsPage.jsx | 1025 | TradeForge — Settings Page (Redesign) |

## `pages/public/` (4 files, 1,156 lines)

| File | Lines | Description |
|------|------:|-------------|
| PublicLeaderboardPage.jsx | 263 | TradeForge OS v10 — Public Leaderboard Page |
| PublicProfilePage.jsx | 287 | TradeForge OS v10 — Public Profile Page (Sprint 8) |
| PublicSnapshotPage.jsx | 327 | TradeForge OS v10 — Public Snapshot Page |
| PublicSymbolPage.jsx | 279 | TradeForge OS v10 — Public Symbol Page |

## `seo/` (3 files, 498 lines)

| File | Lines | Description |
|------|------:|-------------|
| meta.js | 256 | TradeForge OS v10 — SEO Meta System |
| routes.js | 169 | TradeForge OS v10 — Public Route Definitions |
| sitemap.js | 73 | TradeForge OS v10 — Sitemap Generator |

## `services/` (3 files, 557 lines)

| File | Lines | Description |
|------|------:|-------------|
| AuthService.js | 192 | TradeForge OS v10 — Auth Service (Sprint 5.1) |
| BrokerSync.js | 291 | TradeForge OS v10 — Broker Sync Service (Sprint 5.4) |
| SyncUtils.js | 74 | TradeForge OS v10 — Sync Utilities (Sprint 5.2) |

## `state/` (23 files, 3,357 lines)

| File | Lines | Description |
|------|------:|-------------|
| useAlertStore.js | 253 | TradeForge OS v10 — Alert Store |
| useAnalyticsStore.js | 49 | TradeForge OS v10 — Analytics Result Store (Zustand) |
| useAuthStore.js | 140 | TradeForge OS v10 — Auth Store (Sprint 5.1) |
| useChartStore.js | 152 | TradeForge OS v10 — Chart Store (Zustand) |
| useChartTradeStore.js | 174 | TradeForge OS v10.6 — Chart Trade Store |
| useChecklistStore.js | 126 | TradeForge OS v10 — Pre-Trade Checklist Store (Sprint 4.3) |
| useDailyGuardStore.js | 196 | TradeForge OS v10 — Daily Loss Guard |
| useDashboardStore.js | 67 | TradeForge OS v10.4 — Dashboard Layout Store |
| useGoalStore.js | 179 | TradeForge OS v10 — Goal Tracking Store (Sprint 4.7) |
| useNotificationLog.js | 100 | TradeForge OS v10 — NotificationLog |
| useOnboardingStore.js | 48 | TradeForge OS v10 — Onboarding Store (Zustand) |
| usePropFirmStore.js | 390 | TradeForge OS v10 — Prop Firm Store (Sprint 5) |
| useScriptStore.js | 156 | TradeForge OS v10 — Script Store (Zustand) |
| useSettingsStore.js | 22 | TradeForge OS v10 — Settings Store (Zustand) |
| useSocialStore.js | 167 | TradeForge OS v10 — Social Store (Zustand) |
| useSyncStore.js | 219 | TradeForge OS v10 — Sync Service (Sprint 5.2) |
| useTemplateStore.js | 172 | TradeForge OS v10 — Chart Template Store |
| useThemeStore.js | 58 | TradeForge OS v10 — Theme Store |
| useTradeStore.js | 84 | TradeForge OS v10 — Trade Store (Zustand) |
| useTradeTemplateStore.js | 78 | TradeForge OS v10.5 — Trade Entry Templates |
| useUIStore.js | 42 | TradeForge OS v10 — UI Store (Zustand) |
| useWatchlistStore.js | 198 | TradeForge OS v10 — Watchlist Store |
| useWorkspaceStore.js | 287 | TradeForge OS v10 — Workspace Manager |

## `theme/` (1 files, 263 lines)

| File | Lines | Description |
|------|------:|-------------|
| tokens.js | 263 | TradeForge OS v10 — Design Tokens |

## `utils/` (13 files, 2,304 lines)

| File | Lines | Description |
|------|------:|-------------|
| CrosshairBus.js | 101 | TradeForge OS v10.1 — CrosshairBus |
| RetryQueue.js | 170 | TradeForge OS v10 — RetryQueue |
| UndoStack.js | 297 | TradeForge OS v10 — UndoStack |
| VirtualList.jsx | 185 | TradeForge OS v10 — VirtualList |
| chartExport.js | 317 | TradeForge OS v10 — Chart Export & Sharing |
| globalErrorHandler.js | 238 | TradeForge OS — Global Error Handler |
| groupTradesBy.js | 168 | TradeForge OS v10 — groupTradesBy |
| navigateToTrade.js | 234 | TradeForge OS v10 — navigateToTrade |
| safeJSON.js | 66 | TradeForge OS — SafeJSON |
| safePersist.js | 158 | TradeForge OS — Safe Persist Middleware |
| shallow.js | 17 | TradeForge — Shallow equality for Zustand selectors |
| useHotkeys.js | 282 | TradeForge OS v10 — useHotkeys |
| useMediaQuery.js | 71 | TradeForge OS v10 — useMediaQuery Hook |