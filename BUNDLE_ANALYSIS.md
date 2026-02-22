# TradeForge Bundle Analysis & Optimization Plan
## Sprint 11 — Performance Phase 3

**Target:** < 200KB gzipped initial bundle  
**Analysis Date:** Sprint 11  
**Codebase:** 64,478 total source lines across 336 files

---

## Dependency Size Analysis

| Package | Est. Size (min+gz) | Usage | Optimization |
|---------|-------------------|-------|-------------|
| **react + react-dom** | ~42KB | Core framework | Not reducible |
| **chart.js/auto** | ~68KB | Dashboard charts only (EquityCurve, DailyPnl, TimeBar, RDistribution) | **Lazy-load ChartWrapper** |
| **flexlayout-react** | ~45KB | WorkspaceLayout only | Already lazy-loaded ✅ |
| **dexie** | ~18KB | IndexedDB (core storage) | Required |
| **zustand** | ~2KB | State management | Minimal |
| **express + compression** | Server-only | Not in client bundle | N/A |

**Total estimated client bundle:** ~175KB gzipped (without optimizations)  
**After optimizations:** ~107KB gzipped initial load

---

## Optimization 1: Lazy-Load chart.js (HIGHEST IMPACT)

**Savings:** ~68KB removed from initial bundle  
**Risk:** Low — dashboard charts show loading skeleton while chunk loads

`chart.js/auto` is the single largest dependency and is only used by 4 dashboard widget components via `ChartWrapper.jsx`. All 4 are already wrapped in `<WidgetBoundary>` which shows a skeleton on error/loading.

### Implementation

```jsx
// ChartWrapper.jsx — convert to lazy factory
// BEFORE:
import Chart from 'chart.js/auto';

// AFTER — lazy singleton:
let _Chart = null;
async function getChart() {
  if (!_Chart) {
    const mod = await import('chart.js/auto');
    _Chart = mod.default || mod.Chart;
    // Apply global defaults after load
    _Chart.defaults.color = C.t3;
    _Chart.defaults.borderColor = C.bd;
    _Chart.defaults.font.family = "'JetBrains Mono', monospace";
    _Chart.defaults.font.size = 10;
    _Chart.defaults.responsive = true;
    _Chart.defaults.maintainAspectRatio = false;
  }
  return _Chart;
}
```

The ChartWrapper `useEffect` that creates the Chart instance becomes async:

```jsx
useEffect(() => {
  let cancelled = false;
  getChart().then((Chart) => {
    if (cancelled || !canvasRef.current) return;
    chartRef.current = new Chart(canvasRef.current, config);
  });
  return () => { cancelled = true; chartRef.current?.destroy(); };
}, [config]);
```

**Files to modify:** `ChartWrapper.jsx` (1 file)

---

## Optimization 2: Tree-Shake Unused Imports

### Dead code candidates (verified unused):

| File | Lines | Issue |
|------|-------|-------|
| `CanvasBuffer.js` | 24 | Backward-compat shim — no active importers |
| `chartRenderer.js` | ~1600 | Old pre-engine renderer — replaced by chartEngine/ |
| `socialMockData.js` | Listed as mock data — only used by SocialService dev mode |
| `scriptLibrary.js` | 590 | Bundled PineTS scripts — could lazy-load per script |

### Action: Move deprecated files to _deprecated/

```bash
mkdir -p src/_deprecated
mv src/engine/CanvasBuffer.js src/_deprecated/
mv src/engine/chartRenderer.js src/_deprecated/
```

**Savings:** ~1,624 lines removed from module graph

---

## Optimization 3: Vite Build Configuration

### Current: `vite_config.js`
Add manual chunk splitting for heavy dependencies:

```js
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'chart-vendor': ['chart.js'],
          'workspace': ['flexlayout-react'],
          'storage': ['dexie'],
        },
      },
    },
    chunkSizeWarningLimit: 200,
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.log in production
        drop_debugger: true,
      },
    },
  },
});
```

**Impact:** Creates separate chunks that load on-demand, reducing initial parse time

---

## Optimization 4: Image/Asset Optimization

| Asset | Current | Optimized |
|-------|---------|-----------|
| `icon-192.png` | ~5KB | Use SVG favicon inline (saves HTTP request) |
| `icon-512.png` | ~15KB | Keep for PWA install |
| Font loading | Google Fonts CDN | Add `font-display: swap` + preconnect |

### Font preload in index.html:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

---

## Performance Architecture (Already Optimized) ✅

The chart engine already has production-grade performance infrastructure:

| Feature | Status | Detail |
|---------|--------|--------|
| Dual-canvas architecture | ✅ | Main canvas (data change) + top canvas (crosshair) |
| Dirty-flag batching | ✅ | Only redraws when flags set, via rAF |
| FrameBudget LOD | ✅ | 4-level LOD degradation (full → bare candles) |
| IndicatorCache | ✅ | Incremental computation — only recomputes changed indicators |
| 2-pass candle rendering | ✅ | Batches bull/bear to minimize fillStyle switches (4 total) |
| Analytics Web Worker | ✅ | computeFast() runs off main thread |
| React.lazy page loading | ✅ | Journal, Charts, Insights, Settings lazy-loaded |
| Dashboard widget memoization | ✅ | Sprint 11 — all 7 widgets React.memo'd |
| Widget-level error boundaries | ✅ | WidgetBoundary isolates failures |

### 10K Candle Performance Target

With the current architecture, 10K candles + 5 indicators should render within budget:

- **Candle draw:** ~2ms (10K fillRect calls, batched by color)  
- **5 indicators:** ~3ms (cached, only recomputes on data change)  
- **Grid + axes:** ~0.5ms  
- **Crosshair (top canvas):** ~0.2ms per mouse move  
- **Total main render:** ~5.5ms (well within 16.6ms budget)

The FrameBudget system automatically degrades to LOD 0 (candles only) if frames exceed 20ms, ensuring 60fps is maintained even on lower-end hardware.

---

## Priority Execution Order

1. **Lazy-load chart.js** → 68KB savings (1 file change, 30 minutes)
2. **Vite manual chunks** → Parallel loading (config change, 15 minutes)
3. **Remove dead code** → Smaller module graph (file moves, 10 minutes)
4. **Font preload** → Faster perceived load (HTML change, 5 minutes)

**Total estimated savings:** ~68KB gzipped from initial bundle  
**Time investment:** ~1 hour
