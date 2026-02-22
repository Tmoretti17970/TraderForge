# TradeForge OS — Design Overhaul Sprint Backlog

**Document Version:** 1.0  
**Date:** February 20, 2026  
**Prepared by:** Design & Engineering Team  
**Manager:** Tyler  
**Scope:** Full visual rebrand, IA restructure, motion design, progressive UX

---

## Executive Summary

This document defines 6 themed sprints to transform TradeForge OS from a feature-complete trading platform into a polished, brand-distinct product. The overhaul is aggressive: new color system, restructured information architecture (7 pages → 5), narrative-driven dashboard, progressive-disclosure charts page, and a motion design language.

**Core philosophy:** TradeForge's hero experience is the *integrated workflow* — the seamless loop between charting, journaling, and analytics. Every design decision optimizes for that loop feeling effortless.

**Sprint cadence:** Each sprint is scoped for ~1–2 weeks.

---

## Proposed Information Architecture (7 → 5 Pages)

### Current Structure (7 top-level)
```
Dashboard | Journal | Charts | Analytics | Notes | Plans | Community
```

### Proposed Structure (5 top-level)
```
Dashboard | Journal | Charts | Insights | Settings
```

**What changed:**

| Current Page | New Location | Rationale |
|---|---|---|
| Dashboard | **Dashboard** (redesigned) | Hero landing page with narrative flow |
| Journal | **Journal** (enhanced) | Now includes Notes as a tab/panel |
| Charts | **Charts** (progressive) | Core chart + indicators + drawing; everything else on-demand |
| Analytics | **Insights** (merged) | Absorbs Analytics + Plans + Playbooks into one intelligence hub |
| Notes | → Journal (tab) | Notes are trade context — they belong next to trades |
| Plans | → Insights (tab) | Trade plans are part of your strategy/analytics workflow |
| Community | → Settings (section) or profile icon | Social is a secondary feature, not a daily-use destination |

**Impact on navigation:**
- Desktop sidebar: 5 primary icons + settings at bottom = clean, breathable
- Mobile bottom bar: 5 tabs, no "More" overflow menu needed
- Keyboard shortcuts: 1–5 instead of 1–7

---

## New Brand Direction: "Forge"

### Color Philosophy

The current palette uses standard Tailwind blues (`#3b82f6`) that read as generic SaaS. The new direction draws from the "forge" metaphor — molten metal, controlled heat, precision craftsmanship.

### Primary Palette — Dark Theme

| Token | Hex | Role |
|---|---|---|
| `bg` | `#09090b` | True dark — deeper than current, OLED-friendly |
| `bg2` | `#0f1012` | Elevated surface (inputs, recessed areas) |
| `sf` | `#151619` | Card surface |
| `sf2` | `#1a1c21` | Hover/active surface |
| `bd` | `#232630` | Primary border |
| `bd2` | `#2e3240` | Secondary border (hover states) |
| `t1` | `#ececef` | Primary text (warmer than current) |
| `t2` | `#8b8fa2` | Secondary text |
| `t3` | `#4e5266` | Tertiary text / disabled |
| **`accent`** | `#e8642c` | **Brand primary — warm ember orange** |
| `accentH` | `#d4551e` | Accent hover |
| `accentSoft` | `#e8642c18` | Accent background tint |
| `g` | `#2dd4a0` | Profit — mint/teal green (not Christmas green) |
| `r` | `#f25c5c` | Loss — softer coral red |
| `y` | `#f0b64e` | Warning — warm amber |
| `info` | `#5c9cf5` | Info / links — cool blue (secondary role) |

### Why Ember Orange?

1. **Brand distinction:** No major trading tool uses warm orange as primary. TradingView is blue, Thinkorswim is green, TradeStation is red, Tradervue is teal. Orange is unclaimed territory.
2. **Forge metaphor:** Ember, heat, molten metal — it's the brand name made visual.
3. **Psychology:** Orange signals energy and action without the aggression of red. Perfect for a tool about discipline and execution.
4. **Accessibility:** Orange on dark backgrounds has excellent contrast ratios (>7:1 against `#09090b`).
5. **Profit/loss clarity:** By using mint green and coral red for P&L, the orange brand color never collides with financial signals.

### Gradient Language

The "TF" logo gradient evolves from blue-purple to a brand-defining ember gradient:

```
Primary gradient: linear-gradient(135deg, #e8642c, #f0b64e)
                  (ember orange → warm amber)

Subtle glow:     radial-gradient(ellipse, #e8642c15, transparent)
                  (used behind hero stats, active states)
```

### Light Theme Adaptation

| Token | Dark | Light |
|---|---|---|
| `bg` | `#09090b` | `#f8f8fa` |
| `sf` | `#151619` | `#ffffff` |
| `accent` | `#e8642c` | `#d4551e` (slightly darker for contrast on white) |
| `g` | `#2dd4a0` | `#12a87e` (darker for readability) |
| `r` | `#f25c5c` | `#dc3545` |
| Shadows | `rgba(0,0,0,0.3–0.5)` | `rgba(0,0,0,0.04–0.12)` (much lighter) |
| Borders | Visible, structural | Lighter or removed (white bg provides contrast) |

### Typography Refresh

| Token | Current | Proposed |
|---|---|---|
| Font | Outfit | **Inter** (industry standard for data-dense UIs, better number rendering) |
| Mono | JetBrains Mono | **JetBrains Mono** (keep — it's excellent) |
| h1 | 22px / 800 | **26px / 700** (larger, slightly lighter weight) |
| h2 | 16px / 700 | **18px / 650** |
| body | 13px | **14px** (readability floor raised) |
| body-sm | 12px | **13px** |
| label | 10px / 700 uppercase | **11px / 600 uppercase** (accessible minimum) |
| caption | 10px | **11px** |
| data-hero | N/A (was same as body) | **32px / 700 mono** (new: for hero dashboard numbers) |
| data-lg | N/A | **20px / 700 mono** (widget headline numbers) |
| data-md | 13px mono | **14px / 600 mono** |
| data-sm | 11px mono | **12px / 500 mono** |

**Key change:** Introducing `data-hero` and `data-lg` presets creates the visual hierarchy currently missing from the dashboard. The "one number that matters" (Today's P&L) can now be visually 3x the size of supporting metrics.

---

## Sprint 1: Design Foundation & Brand System

**Theme:** Lay the foundation everything else builds on.  
**Duration:** ~1.5 weeks  
**Dependency:** None — this is the root.

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 1.1 | **New color tokens** | Replace `DARK_COLORS` and `LIGHT_COLORS` in `constants.js` with the new Forge palette. Update `C` object, CSS custom properties in `global.css`, and light theme overrides. | M | #2 Color palette |
| 1.2 | **Typography scale update** | Update `F` constant from Outfit to Inter. Update all `text.*` presets in `tokens.js` with new sizes. Add `data-hero`, `data-lg`, `data-md`, `data-sm` presets. Update `index.html` Google Fonts import. | M | #3 Typography |
| 1.3 | **Spacing scale expansion** | Update `space` tokens: add `space[7]: 28` and `space[9]: 36`. Update `layout.page` padding from 24 to 32. Update `layout.pageMobile` from 12 to 16. | S | #7 Breathing room |
| 1.4 | **Shadow system for light theme** | Add `shadows.light` variants with lower opacity (`0.04–0.12`). Create `shadow()` helper that returns appropriate shadow based on active theme. | S | #10 Light theme |
| 1.5 | **Brand gradient tokens** | Add `gradient.brand`, `gradient.glow`, `gradient.subtle` to tokens. Update loading screen and sidebar logo to use new gradient. | S | #2 Brand identity |
| 1.6 | **UIKit component audit** | Update `Card`, `Btn`, `StatCard`, `Badge`, `ToolbarBtn` to use new tokens. Ensure all components reference token values, not hardcoded colors. | M | Foundation |
| 1.7 | **CSS transition layer** | Create a thin CSS module (`components.css`) with `:hover`, `:active`, `:focus-visible` rules for buttons, cards, and inputs — replacing inline `onMouseEnter/Leave` patterns. Start with Sidebar `NavButton` and UIKit `Btn`. | M | #8 Inline styles |

**Acceptance criteria:** App renders with new palette, fonts, and spacing. No visual regressions. Light theme has distinct shadow/border treatment.

**Questions for Tyler before starting:**
- Do you want to keep both Outfit and Inter available during transition, or hard-cut to Inter?
- Any attachment to the current `#3b82f6` blue for interactive elements, or fully committed to ember orange?

---

## Sprint 2: Information Architecture & Navigation

**Theme:** Restructure the app's skeleton.  
**Duration:** ~1 week  
**Dependency:** Sprint 1 (needs new tokens/colors for nav redesign)

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 2.1 | **Merge Notes into Journal** | Add a "Notes" tab to `JournalPage.jsx`. When active, renders the existing `NotesPage` content as a panel beside the trade list (desktop) or as a tab (mobile). Remove Notes from `PageRouter` as a top-level page. | L | #4 Navigation |
| 2.2 | **Create Insights page** | New `InsightsPage.jsx` that combines Analytics tabs + PlaybookDashboard + TradePlanManager under a unified tab bar: Overview, Strategies, Psychology, Timing, Risk, Playbooks, Plans. | L | #4 Navigation |
| 2.3 | **Move Community to Settings** | Relocate Community/Social as a section within Settings, or as an icon-triggered panel (profile avatar in sidebar bottom). Remove from primary nav. | M | #4 Navigation |
| 2.4 | **Sidebar redesign** | 5 primary icons + settings at bottom. Increase sidebar width from 56px to 60px. Add subtle section divider between main nav and bottom actions. Remove ⌘K text hint (it's in the command palette itself). Animate active indicator with spring transition. | M | #4 Navigation |
| 2.5 | **Mobile nav: 5-tab bar** | Replace 4+More pattern with 5 direct tabs: Dashboard, Journal, Charts, Insights, Settings. No overflow menu. Adjust icon sizes and labels. | M | #4 Mobile nav |
| 2.6 | **Update PageRouter** | Reflect new page structure. Update keyboard shortcuts (1–5). Update command palette page navigation entries. | S | #4 Navigation |
| 2.7 | **Page transition animation** | Add a subtle `fadeIn` (opacity 0→1, translateY 4px→0, 150ms ease) when switching pages in `PageRouter`. Use `key={page}` on a motion wrapper. | S | #9 Missing: transitions |

**Acceptance criteria:** App has 5 top-level pages. Mobile nav has no "More" button. Notes accessible from Journal. Plans accessible from Insights. Page transitions feel smooth.

---

## Sprint 3: Dashboard Narrative Redesign

**Theme:** Make the dashboard tell a story.  
**Duration:** ~1.5 weeks  
**Dependency:** Sprint 1 (tokens), Sprint 2 (IA)

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 3.1 | **Hero stat module** | New component: full-width hero area at top of dashboard showing Today's P&L in `data-hero` size (32px), with today's trade count and win rate as supporting metrics. Background uses subtle `gradient.glow` behind the number. Color: green/red based on P&L value. This is the "one number" a trader sees first. | M | #1 Visual hierarchy |
| 3.2 | **Narrative section ordering** | Replace free-form widget grid as the DEFAULT with a fixed narrative layout (users can still customize): Section 1 → Hero stat (today), Section 2 → Equity curve + streak (trend), Section 3 → Calendar heatmap + insights (patterns), Section 4 → Risk metrics + alerts (watchouts), Section 5 → Recent trades (activity). Widget customizer remains available as "Custom Layout" preset. | L | #5 Dashboard narrative |
| 3.3 | **Section headers with context** | Each dashboard section gets a contextual header: "Today's Session" / "Your Trend (30d)" / "Patterns & Habits" / "Risk Check" / "Recent Activity". Headers use `text.h2` with a subtle left accent border in brand color. | S | #1 Hierarchy |
| 3.4 | **Stat card hierarchy** | Redesign `StatCard` with 3 tiers: `hero` (large number, brand glow bg), `primary` (medium number, card bg), `secondary` (small number, inline). Dashboard uses hero for Today's P&L, primary for Total P&L / Profit Factor / Sharpe, secondary for everything else. | M | #1 Visual hierarchy |
| 3.5 | **Widget skeleton per-widget** | Each widget shows its own skeleton loader independently, not a single page-level skeleton. Use `WidgetBoundary` to wrap each widget with individual loading/error states. | S | #9 Missing: per-widget loading |
| 3.6 | **Metric tooltips** | Add `(i)` icon next to Profit Factor, Sharpe Ratio, Kelly Criterion, Sortino, Max DD, Risk of Ruin. Hovering shows a plain-English explanation: "Profit Factor: Your gross profits divided by gross losses. Above 1.5 is strong." | M | #9 Missing: contextual help |
| 3.7 | **Relative timestamps** | Add `timeAgo()` utility. Recent trades show "2h ago" / "yesterday" / "Mon" instead of raw dates. Full date on hover via title attribute. | S | #9 Missing: relative time |

**Acceptance criteria:** Dashboard tells a top-to-bottom story. Today's P&L dominates visually. New traders can understand every metric via tooltips. Loading states are per-widget.

---

## Sprint 4: Charts Page — Progressive Disclosure

**Theme:** Tame the 57-import beast.  
**Duration:** ~1.5 weeks  
**Dependency:** Sprint 1 (tokens)

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 4.1 | **Charts page audit & lazy-split** | Categorize all 57 imports into 3 tiers: Tier 1 (always loaded): ChartCanvas, SymbolSearch, DrawingToolbar, IndicatorPanel, ChartSettingsBar. Tier 2 (lazy, triggered by user action): ReplayBar, ScriptEditor, ScriptManager, QuadChart, WorkspaceLayout, AlertPanel, FundamentalsCard, ShareSnapshotModal, SnapshotPublisher, WatchlistPanel, ChartInsightsPanel. Tier 3 (lazy, mobile-only): Mobile* components, SwipeChartNav, GestureGuide. Wrap Tier 2 and 3 in `React.lazy`. | L | #6 Charts overload |
| 4.2 | **Toolbar consolidation** | Current chart has ChartSettingsBar + DrawingToolbar + ChartTradeToolbar + TradeEntryBar as separate components. Consolidate into a single unified toolbar with icon groups: [Chart Type | Timeframe | Indicators | Drawing Tools | (divider) | Trade Mode | Share | More]. "More" expands to: Replay, Scripts, Quad View, Fundamentals, Alerts. | L | #6 Charts overload |
| 4.3 | **Panel slide-in system** | Create a `SlidePanel` component that slides in from the right (desktop) or bottom (mobile) for secondary tools: Watchlist, Indicators, Scripts, Alerts, Insights. Only one panel open at a time. Panel has a header with close button and remembers last-open state. | M | #6 Progressive disclosure |
| 4.4 | **Chart-first layout** | Chart canvas gets maximum viewport space by default. Toolbar is a thin strip (36px) above the chart. Side panels overlay or push (user preference) rather than sharing the initial viewport. | M | #6 Charts overload |
| 4.5 | **Warm cache on chart mount** | Pre-warm the data cache for the user's watchlist symbols and common timeframes when the Charts page mounts, so switching symbols feels instant. | S | Performance |
| 4.6 | **Chart loading skeleton** | While OHLCV data fetches, show a chart-shaped skeleton (axis lines + shimmer area) instead of a spinner or empty canvas. | S | #9 Missing: loading |

**Acceptance criteria:** Charts page initial bundle is 40%+ smaller. Only core chart + indicators + drawing tools render on first load. All secondary tools accessible via toolbar → slide-in panel. Chart canvas dominates the viewport.

---

## Sprint 5: Motion Design & Interaction Polish

**Theme:** Make everything feel alive and responsive.  
**Duration:** ~1 week  
**Dependency:** Sprints 1–4 (needs new components in place)

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 5.1 | **Transition tokens expansion** | Add to `tokens.js`: `transition.micro: '0.08s ease'` (hover feedback), `transition.enter: '0.2s cubic-bezier(0.16, 1, 0.3, 1)'` (elements appearing), `transition.exit: '0.15s ease-in'` (elements disappearing), `transition.spring: '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'` (playful bounce). | S | #9 Motion design |
| 5.2 | **Card hover elevation** | Cards lift subtly on hover: `transform: translateY(-1px)` + shadow increase. Only on desktop (not touch). Use CSS class, not inline JS. | S | #8 Inline styles |
| 5.3 | **Number count-up animation** | Hero stat and key dashboard numbers animate from 0 to their value on initial render using a `useCountUp` hook (~300ms, ease-out). Triggered once on mount, not on every re-render. | M | #1 Hierarchy + polish |
| 5.4 | **Toast redesign** | Current toasts are basic. Redesign with: slide-in from top-right, accent left border color (green=success, red=error, orange=warning), auto-dismiss with progress bar, and an "Undo" action button for destructive operations (delete trade). | M | #9 Missing: undo visibility |
| 5.5 | **Modal enter/exit animation** | All modals (`ModalOverlay`, `CSVImportModal`, `TradeFormModal`, `OnboardingWizard`): backdrop fades in (150ms), content scales from 0.97→1.0 + fades in (200ms, spring curve). Exit: reverse at 150ms. | M | Polish |
| 5.6 | **Sidebar active transition** | Active indicator bar animates position when switching pages (slides vertically to the new position) instead of instant-switching. Use CSS `transition: top 0.25s spring`. | S | #4 Nav polish |
| 5.7 | **Skeleton shimmer standardization** | Ensure all skeleton loaders use the same shimmer speed, direction, and gradient. Create a single `Shimmer` CSS class used everywhere. Remove the inline `<style>` tag from `SkeletonCard`. | S | Consistency |

**Acceptance criteria:** The app feels responsive and alive. Hover states, page transitions, modals, and toasts all have intentional motion. No janky inline JS hover handlers remain on core components.

---

## Sprint 6: Mobile Excellence & Final Polish

**Theme:** Mobile is a first-class citizen, not a compromise.  
**Duration:** ~1.5 weeks  
**Dependency:** All previous sprints

### Tasks

| # | Task | Description | Effort | Review Finding |
|---|---|---|---|---|
| 6.1 | **Mobile dashboard: swipe sections** | Dashboard sections (Hero → Trend → Patterns → Risk → Activity) become horizontally swipeable cards on mobile with dot pagination indicators, similar to iOS widget stacks. | L | Mobile experience |
| 6.2 | **Mobile bottom sheet system** | Replace the popup "More" menu (now eliminated) with a reusable `BottomSheet` component for mobile interactions: trade entry, filters, chart settings. Snaps to 3 heights: peek (30%), half (50%), full (90%). Drag handle at top. Backdrop blur. | L | Mobile experience |
| 6.3 | **Mobile journal: card view** | On mobile, journal trades render as swipeable cards (not a table/list). Swipe right to edit, swipe left to delete with haptic-style visual feedback. Each card shows: symbol, side, P&L, date, emotion emoji. | M | Mobile experience |
| 6.4 | **Mobile chart: gesture refinement** | Ensure pinch-to-zoom, two-finger pan, and single-tap crosshair all work without conflicts. Add a subtle gesture hint overlay on first chart visit. | M | Mobile experience |
| 6.5 | **Safe area refinement** | Audit all fixed-position elements (bottom nav, toasts, modals, bottom sheets) for proper `env(safe-area-inset-*)` handling on notched phones. | S | Mobile |
| 6.6 | **Responsive typography** | Body text bumps to 15px on mobile (easier reading on small screens). Data values scale down proportionally. Test all pages at 320px, 375px, 414px widths. | S | #3 Typography |
| 6.7 | **Empty state improvements** | Add preview mockups to empty states: Dashboard empty shows a blurred screenshot of what a filled dashboard looks like. Journal empty shows a sample trade card. Creates aspiration and clarity. | M | #9 Missing: empty state progression |
| 6.8 | **Performance audit** | Profile the full app with React DevTools. Identify and fix unnecessary re-renders, especially on Dashboard (widget grid) and Charts (canvas redraws). Target: 60fps scroll on all pages, <100ms page switch. | M | Performance |
| 6.9 | **Accessibility pass** | Audit all interactive elements for: focus-visible rings (already partially done), aria-labels, color contrast (WCAG AA minimum), keyboard navigation through all core flows, screen reader announcements for toasts and modals. | M | Accessibility |

**Acceptance criteria:** Mobile experience feels native-app quality. No "More" overflow. Bottom sheets for all mobile interactions. Gesture chart works cleanly. Performance meets targets.

---

## Sprint Priority Matrix

| Sprint | Impact | Effort | Risk | Notes |
|---|---|---|---|---|
| **S1: Foundation** | 🔴 Critical | Medium | Low | Everything depends on this. Do first. |
| **S2: IA & Nav** | 🔴 Critical | Large | Medium | Structural change — may surface edge cases in state management. |
| **S3: Dashboard** | 🟡 High | Medium | Low | High-visibility, immediate user impact. |
| **S4: Charts** | 🟡 High | Large | Medium | Most complex page. Lazy-loading refactor needs careful testing. |
| **S5: Motion** | 🟢 Medium | Small | Low | Pure polish. Low risk, high perceived quality improvement. |
| **S6: Mobile** | 🟡 High | Large | Medium | Many moving parts. Test on real devices. |

---

## Recommended Execution Order

```
Sprint 1 (Foundation) ────→ Sprint 2 (IA/Nav) ────→ Sprint 3 (Dashboard)
                                                  ↘
                                                    Sprint 4 (Charts)
                                                  ↗
                                        Sprint 5 (Motion) → Sprint 6 (Mobile)
```

Sprints 3 and 4 can run in parallel if you want to stagger them. Sprint 5 should happen after 3 and 4 are stable. Sprint 6 is the capstone.

---

## What This Does NOT Cover (Future Backlog)

These items surfaced during the review but are out of scope for the 6-sprint overhaul:

- **CSS-in-JS migration:** Moving fully from inline styles to CSS modules or styled-components. Sprint 1.7 starts this but a full migration is a separate effort.
- **State management audit:** The Zustand store architecture is solid but some stores (like `useChartStore`) are carrying too much state. This is an engineering concern, not a design one.
- **Backend/API integration:** Social features, cloud sync, real-time data — all backend-dependent.
- **Onboarding redesign:** The wizard works but could benefit from an interactive tutorial. Deferred.
- **Advanced theming:** User-customizable accent colors, custom themes. After the rebrand stabilizes.
- **Internationalization:** No i18n framework exists. Future consideration.

---

## Open Questions for Tyler

1. **Font licensing:** Inter is open source (SIL OFL). Confirm you're OK with the Google Fonts CDN approach or do you want to self-host?
2. **Community page:** I proposed moving it to Settings. Are you OK with this being a secondary feature, or does it need to stay more prominent (e.g., a profile icon in the sidebar bottom that opens a panel)?
3. **Custom layout vs. narrative default:** Sprint 3 proposes the narrative layout as the DEFAULT with "Custom Layout" as an option. Should we preserve the current widget-grid-first experience as a toggle, or fully commit to narrative-first?
4. **Mobile priority:** Sprint 6 is last in sequence. If mobile is urgent, we could move the bottom sheet system (6.2) into Sprint 2 alongside the nav restructure. Your call.
5. **Brand name in UI:** Currently "TradeForge OS" appears in the loading screen. Should we keep "OS" in the branding or simplify to just "TradeForge"?

---

*Ready to begin Sprint 1 on your go. All tasks are structured so we can pick them off one at a time or batch them. You're the manager — tell me where to start.*
