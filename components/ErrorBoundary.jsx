// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Error Boundary (Enhanced)
// Catches render errors, reports to global handler, shows recovery UI.
// Auto-resets when the user navigates to a different page.
// ═══════════════════════════════════════════════════════════════════

import React from 'react';
import { C, F, M } from '../constants.js';
import { Btn } from './UIKit.jsx';
import { reportError, getErrorLog } from '../utils/globalErrorHandler.js';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((prev) => ({
      errorInfo,
      errorCount: prev.errorCount + 1,
    }));

    // Report through central pipeline
    reportError(error, {
      source: 'ErrorBoundary',
      component: errorInfo?.componentStack?.split('\n')[1]?.trim() || 'Unknown',
    });
  }

  // Auto-reset when page prop changes (navigation resets the boundary)
  componentDidUpdate(prevProps) {
    if (this.props.resetKey && prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.handleRetry();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleExportDiagnostics = () => {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      error: {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
      },
      errorLog: getErrorLog(),
      retryCount: this.state.errorCount,
    };

    const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tradeforge-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      const isRepeated = this.state.errorCount > 2;

      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            fontFamily: F,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ fontSize: 13, color: C.t3, marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>
            {isRepeated
              ? 'This error keeps happening. Try reloading the page, or export diagnostics for troubleshooting.'
              : 'An error occurred while rendering this page. Your data is safe.'}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {!isRepeated && (
              <Btn onClick={this.handleRetry}>Try Again</Btn>
            )}
            <Btn variant="ghost" onClick={this.handleReload}>
              Reload Page
            </Btn>
          </div>

          <button className="tf-btn"
            onClick={this.handleExportDiagnostics}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.t3,
              fontSize: 11,
              fontFamily: M,
              cursor: 'pointer',
              textDecoration: 'underline',
              marginBottom: 16,
            }}
          >
            Download diagnostics report
          </button>

          {this.state.error && (
            <details style={{ maxWidth: 500, width: '100%' }}>
              <summary
                style={{
                  fontSize: 11,
                  color: C.t3,
                  cursor: 'pointer',
                  fontFamily: M,
                  marginBottom: 8,
                }}
              >
                Error details ({this.state.errorCount} occurrence{this.state.errorCount !== 1 ? 's' : ''})
              </summary>
              <pre
                style={{
                  fontSize: 10,
                  color: C.r,
                  background: C.sf,
                  border: `1px solid ${C.bd}`,
                  borderRadius: 8,
                  padding: 12,
                  overflow: 'auto',
                  maxHeight: 200,
                  fontFamily: M,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
