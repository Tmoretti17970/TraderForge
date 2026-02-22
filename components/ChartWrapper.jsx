// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11 — Chart.js React Wrapper (Lazy-Loaded)
// Handles Chart.js lifecycle: create → update → destroy
// Dark-themed defaults, responsive, retina-aware
//
// OPTIMIZATION: chart.js/auto (~68KB gzipped) is now lazy-loaded
// on first render instead of imported at module level. This removes
// it from the initial bundle — it only loads when a dashboard chart
// widget is first mounted.
// ═══════════════════════════════════════════════════════════════════

import React, { useRef, useEffect, useState } from 'react';
import { C, M } from '../constants.js';

// ─── Lazy Chart.js singleton ─────────────────────────────────────
// Loads chart.js/auto on first use, applies global theme defaults
// once, then caches the constructor for all subsequent widgets.

let _Chart = null;
let _chartPromise = null;

function getChart() {
  if (_Chart) return Promise.resolve(_Chart);
  if (_chartPromise) return _chartPromise;

  _chartPromise = import('chart.js/auto').then((mod) => {
    _Chart = mod.default || mod.Chart;

    // Apply global defaults (runs once)
    _Chart.defaults.color = C.t3;
    _Chart.defaults.borderColor = C.bd;
    _Chart.defaults.font.family = `'${M}', monospace`;
    _Chart.defaults.font.size = 10;
    _Chart.defaults.responsive = true;
    _Chart.defaults.maintainAspectRatio = false;
    _Chart.defaults.animation.duration = 300;
    _Chart.defaults.plugins.legend.display = false;
    _Chart.defaults.plugins.tooltip.backgroundColor = C.sf2;
    _Chart.defaults.plugins.tooltip.borderColor = C.bd;
    _Chart.defaults.plugins.tooltip.borderWidth = 1;
    _Chart.defaults.plugins.tooltip.titleColor = C.t1;
    _Chart.defaults.plugins.tooltip.bodyColor = C.t2;
    _Chart.defaults.plugins.tooltip.cornerRadius = 6;
    _Chart.defaults.plugins.tooltip.padding = 8;
    _Chart.defaults.plugins.tooltip.displayColors = false;

    return _Chart;
  });

  return _chartPromise;
}

/**
 * ChartWrapper — mounts a Chart.js instance on a canvas.
 * Chart.js is lazy-loaded on first mount (~68KB saved from initial bundle).
 *
 * @param {object} config - Chart.js config ({ type, data, options })
 * @param {number} height - Container height in px (default 240)
 * @param {object} style - Additional container styles
 */
export default function ChartWrapper({ config, height = 240, style = {} }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [loading, setLoading] = useState(!_Chart);

  useEffect(() => {
    if (!canvasRef.current || !config) return;

    let cancelled = false;

    getChart().then((Chart) => {
      if (cancelled || !canvasRef.current) return;

      // Destroy previous instance
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }

      const ctx = canvasRef.current.getContext('2d');
      chartRef.current = new Chart(ctx, {
        ...config,
        options: {
          ...config.options,
          responsive: true,
          maintainAspectRatio: false,
        },
      });

      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [config]);

  return (
    <div style={{ position: 'relative', height, width: '100%', ...style }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.t3, fontSize: 11, fontFamily: M,
        }}>
          Loading chart…
        </div>
      )}
      <canvas ref={canvasRef} style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.2s' }} />
    </div>
  );
}

// Re-export for consumers that need the Chart constructor directly
export { getChart, ChartWrapper };
