# TradeForge OS — Theme Guide

**Dual-theme system · 22 color tokens · Dark/Light swap via `syncThemeColors()`**

---

## How Theming Works

All colors flow through a single mutable object `C` exported from `constants.js`. On theme change, `syncThemeColors()` swaps all values in-place, and React re-renders pick up the new colors.

```
useThemeStore.setTheme('light')
  → syncThemeColors('light')
    → Object.assign(C, LIGHT_COLORS)
      → All components reading C.bg, C.t1, etc. see new values
```

**Import pattern:**

```jsx
import { C, F, M } from '../constants.js';

// C = color tokens (mutable, theme-aware)
// F = sans-serif font stack (Inter)
// M = monospace font stack (JetBrains Mono)
```

---

## Color Tokens (C)

### Dark Theme (DARK_COLORS)

| Token | Hex | Usage |
|-------|-----|-------|
| `C.bg` | `#09090b` | Page background, deepest layer |
| `C.bg2` | `#0f1012` | Secondary background, slightly lighter |
| `C.sf` | `#151619` | Surface / card background |
| `C.sf2` | `#1a1c21` | Surface variant, hover states |
| `C.bd` | `#232630` | Primary border |
| `C.bd2` | `#2e3240` | Secondary border, dividers |
| `C.t1` | `#ececef` | Primary text |
| `C.t2` | `#8b8fa2` | Secondary text, labels |
| `C.t3` | `#4e5266` | Tertiary text, placeholders |
| `C.b` | `#e8642c` | Brand orange (primary CTA) |
| `C.bH` | `#d4551e` | Brand hover state |
| `C.g` | `#2dd4a0` | Green / bullish / success |
| `C.r` | `#f25c5c` | Red / bearish / error |
| `C.y` | `#f0b64e` | Yellow / amber / warning |
| `C.p` | `#c084fc` | Purple / accent |
| `C.cyan` | `#22d3ee` | Cyan accent |
| `C.orange` | `#e8642c` | Orange (same as brand) |
| `C.pink` | `#f472b6` | Pink accent |
| `C.lime` | `#a3e635` | Lime green accent |
| `C.info` | `#5c9cf5` | Blue / informational |
| `C.bullish` | `#2dd4a0` | Alias for C.g |
| `C.bearish` | `#f25c5c` | Alias for C.r |
| `C.rS` | `#f25c5c20` | Red with 12% opacity (risk shading) |

### Light Theme (LIGHT_COLORS)

| Token | Dark → Light |
|-------|-------------|
| `C.bg` | `#09090b` → `#f8f8fa` |
| `C.sf` | `#151619` → `#ffffff` |
| `C.t1` | `#ececef` → `#111318` |
| `C.t2` | `#8b8fa2` → `#4a5068` |
| `C.b` | `#e8642c` → `#d4551e` |
| `C.g` | `#2dd4a0` → `#12a87e` |
| `C.r` | `#f25c5c` → `#dc3545` |
| `C.info` | `#5c9cf5` → `#2563eb` |

---

## Usage Patterns

### Basic color application

```jsx
style={{ background: C.sf, color: C.t1, border: `1px solid ${C.bd}` }}
```

### Opacity suffixes

Append hex opacity directly to token:

```jsx
background: C.info + '18'        // 9% opacity blue
border: `1px solid ${C.bd}40`    // 25% opacity border
background: C.r + '20'           // 12% opacity red
```

Common opacity values: `10` (6%), `15` (8%), `18` (9%), `20` (12%), `30` (19%), `40` (25%), `60` (38%), `80` (50%).

### Gradients

```jsx
background: `linear-gradient(135deg, ${C.info}20, ${C.p}20)`
backgroundImage: `linear-gradient(${C.bd}15 1px, transparent 1px)`
```

### Conditional colors (P&L)

```jsx
color: pnl >= 0 ? C.g : C.r
background: side === 'long' ? C.bullish + '15' : C.bearish + '15'
```

### Interactive states

```jsx
background: isActive ? C.b + '15' : C.sf2
border: `1.5px solid ${isActive ? C.b : C.bd + '60'}`
color: isActive ? C.b : C.t2
```

---

## Design Tokens (theme/tokens.js)

Beyond colors, the design system includes dimensional and behavioral tokens:

### Spacing (4px base)

```
space[1]=4  space[2]=8  space[3]=12  space[4]=16
space[6]=24  space[8]=32  space[12]=48  space[16]=64
```

### Border Radius

```
radii.sm=4  radii.md=8  radii.lg=10  radii.xl=14  radii.pill=9999
```

### Shadows

```
shadows.sm   — subtle card elevation
shadows.md   — dropdown/popover
shadows.lg   — modal overlay
shadows.glow — brand-colored glow effect
```

### Z-Index Scale

```
z.dropdown=100  z.sticky=200  z.overlay=300
z.modal=400     z.toast=500   z.tooltip=600
```

### Transitions

```
transition.fast='120ms ease'   — micro-interactions
transition.normal='200ms ease' — state changes
transition.slow='350ms ease'   — page transitions
```

---

## Remaining Hardcoded Colors

After the color audit, 9 intentional hardcoded colors remain in components:

| Location | Colors | Reason |
|----------|--------|--------|
| IndicatorPanel.jsx | 5 palette colors (`#6c5ce7`, `#fd79a8`, `#00cec9`, `#e17055`, `#d63031`) | Indicator color array — no C equivalent, used for visual distinction |
| MobileDashboard.jsx | 2 gradient tints (`#0f3a2c`, `#3a1515`) | P&L background gradient — intentionally non-theme colors |
| NotificationPanel.jsx | 2 fallbacks (`C.p \|\| '#a78bfa'`) | Defensive fallback in case C.p is undefined |

**Pages: 0 hardcoded colors.** All 10 pages (6 main + 4 public) use C tokens exclusively.

---

## Adding New Colors

1. Add to both `DARK_COLORS` and `LIGHT_COLORS` in `constants.js`
2. The `C` object picks them up automatically via `syncThemeColors()`
3. Import `C` in your component: `import { C } from '../constants.js'`
4. Use as `C.yourToken` — never hardcode hex values in components

## tf-btn and Focus Styles

All `<button>` elements include `className="tf-btn"` which enables `:focus-visible` keyboard styling. The CSS rule lives in `index.css`:

```css
.tf-btn:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
```
