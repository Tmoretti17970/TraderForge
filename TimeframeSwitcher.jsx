// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — TimeframeSwitcher
// TradingView-style timeframe button bar.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';

const TIMEFRAME_GROUPS = [
  { label: 'Minutes', items: [
    { value: '1m',  display: '1m' },
    { value: '3m',  display: '3m' },
    { value: '5m',  display: '5m' },
    { value: '15m', display: '15m' },
    { value: '30m', display: '30m' },
  ]},
  { label: 'Hours', items: [
    { value: '1h',  display: '1H' },
    { value: '2h',  display: '2H' },
    { value: '4h',  display: '4H' },
    { value: '6h',  display: '6H' },
    { value: '12h', display: '12H' },
  ]},
  { label: 'Days+', items: [
    { value: '1D',  display: '1D' },
    { value: '3D',  display: '3D' },
    { value: '1W',  display: '1W' },
    { value: '1M',  display: '1M' },
  ]},
];

// Quick-access presets (shown in the compact bar)
const QUICK_TIMEFRAMES = [
  { value: '1m',  display: '1m' },
  { value: '5m',  display: '5m' },
  { value: '15m', display: '15m' },
  { value: '1h',  display: '1H' },
  { value: '4h',  display: '4H' },
  { value: '1D',  display: '1D' },
  { value: '1W',  display: '1W' },
];

/**
 * Timeframe switcher component.
 *
 * @param {Object} props
 * @param {string}   props.current   - Current timeframe
 * @param {(tf: string) => void} props.onChange - Timeframe change callback
 * @param {string}   [props.theme='dark']
 * @param {boolean}  [props.compact=true] - Show quick bar vs full dropdown
 */
export default function TimeframeSwitcher({ current, onChange, theme = 'dark', compact = true }) {
  const [showAll, setShowAll] = useState(false);
  const isDark = theme === 'dark';

  const colors = {
    bg: isDark ? '#1E222D' : '#FFFFFF',
    border: isDark ? '#363A45' : '#E0E0E0',
    text: isDark ? '#787B86' : '#9E9E9E',
    textActive: isDark ? '#D1D4DC' : '#131722',
    activeBg: '#2962FF',
    activeText: '#FFFFFF',
    hover: isDark ? '#2A2E39' : '#F5F5F5',
    groupLabel: isDark ? '#4E5266' : '#BDBDBD',
  };

  const handleSelect = useCallback((tf) => {
    onChange(tf);
    setShowAll(false);
  }, [onChange]);

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {QUICK_TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            onClick={() => handleSelect(tf.value)}
            style={{
              background: current === tf.value ? colors.activeBg : 'transparent',
              color: current === tf.value ? colors.activeText : colors.text,
              border: 'none',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: current === tf.value ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.15s',
              minWidth: 28,
            }}
          >
            {tf.display}
          </button>
        ))}

        {/* "More" button for full dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'transparent',
              color: colors.text,
              border: 'none',
              borderRadius: 4,
              padding: '4px 6px',
              fontSize: 11,
              cursor: 'pointer',
            }}
            title="More timeframes"
          >
            ···
          </button>

          {showAll && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              zIndex: 1000,
              padding: 8,
              minWidth: 160,
            }}>
              {TIMEFRAME_GROUPS.map(group => (
                <div key={group.label}>
                  <div style={{
                    padding: '4px 8px',
                    fontSize: 10,
                    color: colors.groupLabel,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}>
                    {group.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 4 }}>
                    {group.items.map(tf => (
                      <button
                        key={tf.value}
                        onClick={() => handleSelect(tf.value)}
                        style={{
                          background: current === tf.value ? colors.activeBg : 'transparent',
                          color: current === tf.value ? colors.activeText : colors.text,
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 10px',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontWeight: current === tf.value ? 'bold' : 'normal',
                        }}
                      >
                        {tf.display}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full mode: show all timeframes inline
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {TIMEFRAME_GROUPS.flatMap(g => g.items).map(tf => (
        <button
          key={tf.value}
          onClick={() => handleSelect(tf.value)}
          style={{
            background: current === tf.value ? colors.activeBg : 'transparent',
            color: current === tf.value ? colors.activeText : colors.text,
            border: 'none',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: current === tf.value ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          {tf.display}
        </button>
      ))}
    </div>
  );
}
