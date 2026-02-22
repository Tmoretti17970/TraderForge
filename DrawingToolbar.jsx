// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — DrawingToolbar
// Vertical sidebar with tool selection, color picker, and actions.
// TradingView-style grouped tools with active highlighting.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';

/** Tool definitions with SVG-safe unicode icons */
const TOOL_GROUPS = [
  {
    label: 'Lines',
    tools: [
      { id: 'trendline',    name: 'Trend Line',      icon: '╱' },
      { id: 'ray',          name: 'Ray',             icon: '⟶' },
      { id: 'extendedline', name: 'Extended Line',   icon: '⟷' },
      { id: 'hray',         name: 'Horizontal Ray',  icon: '→' },
      { id: 'hline',        name: 'Horizontal Line', icon: '―' },
      { id: 'crossline',    name: 'Cross Line',      icon: '┼' },
    ],
  },
  {
    label: 'Fibonacci',
    tools: [
      { id: 'fib', name: 'Fib Retracement', icon: '⊞' },
    ],
  },
  {
    label: 'Shapes',
    tools: [
      { id: 'rect',    name: 'Rectangle', icon: '▭' },
      { id: 'channel', name: 'Channel',   icon: '⋕' },
    ],
  },
];

const PRESET_COLORS = [
  '#2962FF', '#EF5350', '#26A69A', '#FF9800', '#AB47BC',
  '#42A5F5', '#78909C', '#FFEB3B', '#EC407A', '#66BB6A',
];

/**
 * Drawing toolbar component.
 *
 * @param {Object} props
 * @param {string|null} props.activeTool      - Currently active tool ID
 * @param {(toolId: string) => void} props.onToolSelect - Tool activation callback
 * @param {() => void}  props.onCancel        - Cancel current tool
 * @param {() => void}  props.onClearAll      - Clear all drawings
 * @param {() => void}  [props.onDelete]      - Delete selected drawing
 * @param {(color: string) => void} [props.onColorChange] - Color change
 * @param {string}       props.selectedColor  - Current drawing color
 * @param {boolean}      [props.hasSelection] - Is a drawing selected
 * @param {string}       [props.theme='dark']
 */
export default function DrawingToolbar({
  activeTool,
  onToolSelect,
  onCancel,
  onClearAll,
  onDelete,
  onColorChange,
  selectedColor = '#2962FF',
  hasSelection = false,
  theme = 'dark',
}) {
  const [expanded, setExpanded] = useState(null); // Expanded group label
  const [showColors, setShowColors] = useState(false);
  const colorRef = useRef(null);
  const isDark = theme === 'dark';

  const c = {
    bg: isDark ? '#1E222D' : '#F8F9FD',
    border: isDark ? '#363A45' : '#E0E3EB',
    text: isDark ? '#787B86' : '#9E9E9E',
    textActive: isDark ? '#D1D4DC' : '#131722',
    hover: isDark ? '#2A2E39' : '#EEEEEE',
    active: '#2962FF',
    danger: '#EF5350',
  };

  // Close color picker on outside click
  useEffect(() => {
    const handler = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target)) {
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleTool = useCallback((toolId) => {
    if (activeTool === toolId) {
      onCancel();
    } else {
      onToolSelect(toolId);
    }
  }, [activeTool, onToolSelect, onCancel]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: 44,
      background: c.bg,
      borderRight: `1px solid ${c.border}`,
      userSelect: 'none',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>
      {/* Tool groups */}
      {TOOL_GROUPS.map(group => (
        <div key={group.label}>
          {/* Group header */}
          <div
            onClick={() => setExpanded(expanded === group.label ? null : group.label)}
            style={{
              padding: '6px 0',
              textAlign: 'center',
              fontSize: 8,
              color: c.text,
              cursor: 'pointer',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              borderBottom: `1px solid ${c.border}`,
            }}
          >
            {group.label}
          </div>

          {/* Tools */}
          {group.tools.map(tool => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => handleTool(tool.id)}
                title={tool.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: 36,
                  background: isActive ? c.active : 'transparent',
                  color: isActive ? '#fff' : c.text,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 16,
                  fontWeight: isActive ? 'bold' : 'normal',
                  transition: 'all 0.1s',
                  borderLeft: isActive ? `3px solid ${c.active}` : '3px solid transparent',
                }}
              >
                {tool.icon}
              </button>
            );
          })}
        </div>
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Color picker */}
      <div ref={colorRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setShowColors(!showColors)}
          title="Drawing color"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 36,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: selectedColor,
            border: `2px solid ${c.border}`,
          }} />
        </button>

        {showColors && (
          <div style={{
            position: 'absolute',
            left: 48,
            bottom: 0,
            background: c.bg,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            padding: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            zIndex: 1000,
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 4,
            width: 140,
          }}>
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => { onColorChange?.(color); setShowColors(false); }}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: color,
                  border: color === selectedColor ? '2px solid #fff' : '2px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {hasSelection && onDelete && (
        <button
          onClick={onDelete}
          title="Delete selected (Del)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: 36,
            background: 'transparent',
            color: c.danger,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          ✕
        </button>
      )}

      <button
        onClick={onClearAll}
        title="Clear all drawings"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: 36,
          background: 'transparent',
          color: c.text,
          border: 'none',
          cursor: 'pointer',
          fontSize: 11,
          borderTop: `1px solid ${c.border}`,
        }}
      >
        🗑
      </button>
    </div>
  );
}
