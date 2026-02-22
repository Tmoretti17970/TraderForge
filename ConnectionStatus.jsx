// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — ConnectionStatus
// Visual indicator for data feed connection state.
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {Object} props
 * @param {string}  props.status     - 'idle'|'loading'|'ready'|'error'|'loading_more'
 * @param {string}  props.feedStatus - 'connected'|'connecting'|'disconnected'|'error'
 * @param {string}  [props.error]    - Error message
 * @param {string}  [props.theme='dark']
 */
export default function ConnectionStatus({ status, feedStatus, error, theme = 'dark' }) {
  const isDark = theme === 'dark';

  const statusConfig = {
    connected:    { color: '#26A69A', label: 'Live', dot: true },
    connecting:   { color: '#FF9800', label: 'Connecting...', dot: true, pulse: true },
    disconnected: { color: '#787B86', label: 'Offline', dot: true },
    error:        { color: '#EF5350', label: 'Error', dot: true },
  };

  const wsConfig = statusConfig[feedStatus] || statusConfig.disconnected;
  const isLoading = status === 'loading' || status === 'loading_more';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 11,
      color: isDark ? '#787B86' : '#9E9E9E',
    }}>
      {/* Loading spinner */}
      {isLoading && (
        <div style={{
          width: 12,
          height: 12,
          border: `2px solid ${isDark ? '#363A45' : '#E0E0E0'}`,
          borderTopColor: '#2962FF',
          borderRadius: '50%',
          animation: 'tf-spin 0.8s linear infinite',
        }} />
      )}

      {/* WebSocket status dot */}
      {!isLoading && (
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: wsConfig.color,
          animation: wsConfig.pulse ? 'tf-pulse 1.5s ease-in-out infinite' : 'none',
        }} />
      )}

      <span>{isLoading ? (status === 'loading_more' ? 'Loading history...' : 'Loading...') : wsConfig.label}</span>

      {/* Error tooltip */}
      {error && (
        <span style={{ color: '#EF5350', fontSize: 10 }} title={error}>⚠</span>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes tf-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes tf-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
