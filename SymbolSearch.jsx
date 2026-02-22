// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — SymbolSearch
// Dropdown search for symbols with fuzzy matching, recent history,
// keyboard navigation, and real-time Binance symbol lookup.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

const RECENT_KEY = 'tf_recent_symbols';
const MAX_RECENT = 10;

/**
 * Get recent symbols from localStorage.
 * @returns {string[]}
 */
function getRecentSymbols() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

/**
 * Add a symbol to recent history.
 * @param {string} symbol
 */
function addRecentSymbol(symbol) {
  const recent = getRecentSymbols().filter(s => s !== symbol);
  recent.unshift(symbol);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/**
 * Symbol search component.
 *
 * @param {Object} props
 * @param {string}   props.currentSymbol  - Currently active symbol
 * @param {(query: string) => Promise<Array>} props.onSearch - Search function
 * @param {(symbol: string) => void} props.onSelect - Symbol selection callback
 * @param {string}   [props.theme='dark'] - 'dark' | 'light'
 */
export default function SymbolSearch({ currentSymbol, onSearch, onSelect, theme = 'dark' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#1E222D' : '#FFFFFF',
    surface: isDark ? '#2A2E39' : '#F5F5F5',
    border: isDark ? '#363A45' : '#E0E0E0',
    text: isDark ? '#D1D4DC' : '#131722',
    textDim: isDark ? '#787B86' : '#9E9E9E',
    hover: isDark ? '#363A45' : '#EEEEEE',
    accent: '#2962FF',
  };

  // ── Search with debounce ──
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await onSearch(query);
        setResults(hits || []);
        setSelectedIdx(0);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, onSearch]);

  // ── Click outside to close ──
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Focus input on open ──
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e) => {
    const items = results.length > 0 ? results : getRecentSymbols().map(s => ({ name: s }));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, items.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[selectedIdx]) {
          selectSymbol(items[selectedIdx].name);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  }, [results, selectedIdx]);

  function selectSymbol(symbol) {
    addRecentSymbol(symbol);
    onSelect(symbol);
    setIsOpen(false);
    setQuery('');
  }

  // ── Display items: search results or recent ──
  const displayItems = results.length > 0 ? results : (
    query.trim() === '' ? getRecentSymbols().map(s => ({ name: s, description: '', _recent: true })) : []
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.text,
          fontSize: 14,
          fontWeight: 'bold',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        title="Search symbols (Ctrl+K)"
      >
        {currentSymbol || 'Symbol'}
        <span style={{ fontSize: 10, color: colors.textDim }}>▼</span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          width: 320,
          maxHeight: 400,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Search input */}
          <div style={{ padding: 8, borderBottom: `1px solid ${colors.border}` }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search symbol..."
              style={{
                width: '100%',
                padding: '8px 12px',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 4,
                color: colors.text,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Results */}
          <div style={{ overflowY: 'auto', maxHeight: 340 }}>
            {loading && (
              <div style={{ padding: '12px 16px', color: colors.textDim, fontSize: 12 }}>
                Searching...
              </div>
            )}

            {!loading && displayItems.length === 0 && query.trim() && (
              <div style={{ padding: '12px 16px', color: colors.textDim, fontSize: 12 }}>
                No results found
              </div>
            )}

            {!loading && displayItems.length > 0 && (
              <>
                {displayItems[0]?._recent && (
                  <div style={{ padding: '6px 16px', color: colors.textDim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Recent
                  </div>
                )}
                {displayItems.map((item, idx) => (
                  <div
                    key={item.name + idx}
                    onClick={() => selectSymbol(item.name)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      padding: '8px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: idx === selectedIdx ? colors.hover : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div>
                      <span style={{ color: colors.text, fontSize: 13, fontWeight: item.name === currentSymbol ? 'bold' : 'normal' }}>
                        {item.name}
                      </span>
                      {item.description && (
                        <span style={{ color: colors.textDim, fontSize: 11, marginLeft: 8 }}>
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.exchange && (
                      <span style={{ color: colors.textDim, fontSize: 10 }}>
                        {item.exchange}
                      </span>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
