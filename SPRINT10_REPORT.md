# Sprint 10: Trader Workflow — Delivery Report
## TradeForge OS v10.6 → v10.7

**Sprint Theme:** Chart becomes a cockpit  
**Tasks Delivered:** 10/10  
**New Files:** 8 | **Modified Files:** 2  
**Codebase:** 259 source files → 66,649 total lines (+1,451 net)

---

## Task Manifest

| # | Task | Status | Location |
|---|------|--------|----------|
| C10.1 | **Chart Trade Store** — Pending trade state, risk params, position sizing, trade mode FSM | ✅ | useChartTradeStore.js (173L) |
| C10.2 | **R:R Renderer** — Canvas-drawn entry/SL/TP levels with risk/reward zone shading | ✅ | chartTradeRenderer.js (222L) |
| C10.3 | **Position Sizer** — Floating overlay: account size, risk %, computed shares, R:R badge | ✅ | PositionSizer.jsx (232L) |
| C10.4 | **Context Menu** — Right-click chart → Long/Short entry, set SL/TP, add alert, copy price | ✅ | ChartContextMenu.jsx (127L) |
| C10.5 | **Quick Journal** — Floating panel to log trade from chart with pre-filled levels | ✅ | QuickJournalPanel.jsx (242L) |
| C10.6 | **Trade Entry Bar** — Toolbar strip showing step indicators, side toggle, level readouts | ✅ | TradeEntryBar.jsx (176L) |
| C10.7 | **Trade Toolbar** — Long/Short buttons, position sizer toggle, quick journal toggle | ✅ | ChartTradeToolbar.jsx (86L) |
| C10.8 | **Trade Handler Hook** — Connects chart clicks to entry/SL/TP placement + context menu | ✅ | useChartTradeHandler.js (125L) |
| C10.9 | **Trade Annotations** — Enhanced P&L, R-multiple, duration labels on chart overlays | ✅ | chartTradeRenderer.js |
| C10.10 | **ChartsPage Integration** — Full wiring: toolbar, entry bar, overlays, context menu, shortcuts | ✅ | ChartsPage.jsx (1035L) |

---

## Architecture

### C10.1 — Chart Trade Store (173 lines)
Zustand persist store managing the trade entry finite state machine:

**State:**
- `tradeMode` (boolean) — Whether trade entry tool is active
- `tradeStep` FSM: `idle → entry → sl → tp → ready`
- `tradeSide`: `'long' | 'short'`
- `pendingEntry/SL/TP`: `{ price, barIdx }` or null
- `accountSize`, `riskPercent`, `riskAmount`, `riskMode` (persisted)
- `showPositionSizer`, `showQuickJournal`, `contextMenu`

**Actions:** `enterTradeMode(side)`, `exitTradeMode()`, `setEntry()`, `setSL()`, `setTP()`, `updateLevel()`, `setAccountSize()`, `setRiskPercent()`, `setRiskAmount()`

**Pure helpers:**
- `calcRiskReward(entry, sl, tp, side)` → `{ riskPerShare, rewardPerShare, rr, slValid, tpValid }`
- `calcPositionSize(riskAmount, entry, sl)` → `{ shares, actualRisk, notional, riskPerShare }`

### C10.2 — R:R Canvas Renderer (222 lines)
`drawRiskReward(ctx, pending, side, layout, chartW, chartH, posSize)`:
- **Risk zone** (entry→SL): Red translucent shading with dashed border
- **Reward zone** (entry→TP): Green translucent shading with dashed border
- **Entry line**: Solid blue with pill label showing price
- **SL line**: Solid red with pill label
- **TP line**: Solid green with pill label
- **R:R badge**: Top-right rounded badge (green ≥2R, yellow ≥1R, red <1R)
- **Position info**: Share count + risk amount below R:R badge
- **Side indicator**: Top-left pill showing LONG/SHORT with color

`drawTradeAnnotation(ctx, trade, x, y, isHighlighted)`:
- P&L pill on highlighted trade (`+$150.00 (2.5R)`)
- Duration label below (e.g. "45m", "3h", "2d")

### C10.3 — Position Sizer (232 lines)
Floating panel (absolute positioned top-right of chart):
- **Account size**: Editable number input (step $1,000)
- **Risk mode**: Toggle between % and $ fixed
- **Risk %**: 0.1-10% with step 0.25%
- **Fixed risk $**: Manual dollar amount
- **Level display**: Read-only entry/SL/TP from chart clicks
- **Computed results**: Position size (shares), notional value, risk per share, actual risk
- **R:R ratio**: Large colored display (green/yellow/red)
- **Validation**: Warnings when SL/TP on wrong side of entry

### C10.4 — Context Menu (127 lines)
Right-click anywhere on chart:

**Normal mode:**
- 📈 Long Entry @ $price
- 📉 Short Entry @ $price
- 🔔 Add Alert @ $price
- 📝 Quick Journal
- 📋 Copy Price

**Trade mode (adapts to current step):**
- 📍 Set Entry @ $price (when step = entry)
- 🛑 Set Stop Loss @ $price (when step = sl)
- 🎯 Set Target @ $price (when step = tp)
- ✕ Exit Trade Mode

Features: Price header with date, divider separators, hover highlights, auto-position to stay in viewport, closes on outside click or Escape.

### C10.5 — Quick Journal Panel (242 lines)
Floating panel (absolute bottom-left of chart):
- Pre-fills symbol from current chart
- Reads entry/SL/TP levels from chart trade store
- Side toggle (long/short) with color coding
- Level badges showing entry, SL, TP read-only
- Qty + P&L inputs (P&L auto-calculates from levels + qty)
- Strategy input
- Emotion chips (confident, neutral, fearful, greedy, fomo, revenge)
- Tags (comma-separated)
- Notes textarea
- "Log Trade" button → adds to trade store, exits trade mode, shows toast

### C10.6 — Trade Entry Bar (176 lines)
Toolbar strip below main toolbar, visible during trade mode:
- **Side toggle**: Long/Short buttons with directional icons
- **Step indicators**: 4-step progress (Entry → Stop Loss → Target → Ready) with current/done states
- **Level readouts**: E: $price, SL: $price, TP: $price chips with colors
- **R:R display**: Large colored R value when levels set
- **Position info**: Share count + risk amount
- **Instruction text**: Context-aware ("Click chart to set entry price", etc.)
- **Skip TP button**: Skip target step when not needed
- **Cancel button**: Exit trade mode

### C10.7 — Trade Toolbar (86 lines)
Buttons added to main chart toolbar:
- 📈 Long — Enters long trade mode
- 📉 Short — Enters short trade mode
- 📐 — Toggles position sizer overlay
- 📝 — Toggles quick journal panel
- Dividers between groups

### C10.8 — Trade Handler Hook (125 lines)
`useChartTradeHandler()` returns:
- `handleChartClick(price, barIdx)` — Routes clicks through trade FSM (entry→SL→TP)
- `handleContextMenu(e, price, barIdx, date)` — Opens context menu at cursor
- `contextMenuHandlers` — Object of all context menu action callbacks

Integrates with: useChartTradeStore, useAlertStore, useChartStore, Toast

### C10.9 — Trade Annotations
Enhanced canvas rendering for completed trade overlays:
- P&L pill label with R-multiple when highlighted
- Duration calculation and display (minutes → hours → days)
- Color-coded: green for wins, red for losses

### C10.10 — ChartsPage Integration (968→1035 lines)
- **Imports**: 8 new Sprint 10 modules
- **State**: All chart trade store selectors + handler hook
- **handleDrawingClick**: Trade mode intercept — clicks go to trade handler before drawing tools
- **Toolbar**: ChartTradeToolbar rendered after intelligence buttons
- **Trade Entry Bar**: Rendered above replay bar when trade mode active
- **Overlays**: PositionSizer, QuickJournalPanel, ChartContextMenu in chart container
- **Context menu**: `onContextMenu` handler on chart wrapper div with price estimation from Y position
- **Keyboard shortcuts**: Updated documentation (right-click, Esc exits trade mode)

---

## User Flows

### One-Click Trade Entry
1. Click **📈 Long** or **📉 Short** in toolbar (or right-click → Long/Short Entry)
2. Trade Entry Bar appears with step indicator: **1. Entry**
3. Click chart to set entry price → step advances to **2. Stop Loss**
4. Click chart to set SL → step advances to **3. Target**
5. Click chart to set TP (or click **Skip TP**) → step shows **Ready**
6. R:R zones appear on chart with shaded risk/reward areas
7. Click **📝** to open Quick Journal → pre-filled with symbol + levels → **Log Trade**

### Right-Click Workflow
1. Right-click anywhere on chart → context menu with price
2. Choose **📈 Long Entry @ $150.25** → enters trade mode with entry set
3. Click chart to set SL, then TP
4. Right-click menu adapts to show current step options

### Position Sizing
1. Click **📐** in toolbar → Position Sizer panel opens
2. Set account size ($25,000 default), risk % (1% default)
3. Set entry + SL on chart → computed: shares, actual risk, notional
4. R:R badge updates live on chart canvas

---

## Data Flow

```
User clicks 📈 Long → enterTradeMode('long')
  → tradeMode=true, tradeStep='entry'
  → TradeEntryBar renders

User clicks chart → handleDrawingClick
  → tradeMode check → handleTradeClick(price, barIdx)
  → setEntry() → tradeStep='sl'
  → Toast: "Entry set @ $150.25"

User clicks chart again → setSL() → tradeStep='tp'
User clicks chart again → setTP() → tradeStep='ready'

Canvas render pipeline:
  drawRiskReward(ctx, {entry, sl, tp}, side, layout, ...)
  → Red risk zone, green reward zone
  → Entry/SL/TP lines with price labels
  → R:R badge: "2.5R"

PositionSizer reads: calcPositionSize(riskAmount, entry, sl)
  → { shares: 166, actualRisk: $249.00, notional: $24,941.50 }

User clicks 📝 → QuickJournalPanel opens
  → Pre-filled: symbol, entry, SL, TP, side
  → User enters qty, emotion, notes
  → Log Trade → addTrade() → exitTradeMode() → toast
```
