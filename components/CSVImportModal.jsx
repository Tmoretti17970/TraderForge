// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — CSV Import Modal
// Upload → Parse → Preview → Confirm → Import
// Uses csv.js importCSV() for parsing
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback } from 'react';
import { C, F, M } from '../constants.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { ModalOverlay, Btn } from '../components/UIKit.jsx';
import { importCSV } from '../csv.js';
import { fmtD } from '../utils.js';
import { reconcile } from '../engine/reconcile.js';
import { brokerBadge } from '../engine/BrokerProfiles.js';
import { safeSum } from '../engine/Money.js';
import toast from '../components/Toast.jsx';

export default function CSVImportModal({ isOpen, onClose }) {
  const addTrades = useTradeStore((s) => s.addTrades);
  const existingTrades = useTradeStore((s) => s.trades);

  const [stage, setStage] = useState('upload'); // 'upload' | 'preview' | 'done'
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [recon, setRecon] = useState(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // ─── Reset on close ───────────────────────────────────────
  const handleClose = () => {
    setStage('upload');
    setResult(null);
    setRecon(null);
    setReconOpen(false);
    setFileName('');
    onClose();
  };

  // ─── Parse file ───────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = importCSV(text, existingTrades);
      setResult(parsed);

      // Run reconciliation on parsed trades
      if (parsed.trades.length > 0) {
        const reconResult = reconcile(parsed.trades);
        setRecon(reconResult);
        // Auto-expand panel if there are errors or warnings
        if (reconResult.summary.errors > 0 || reconResult.summary.warnings > 0) {
          setReconOpen(true);
        }
      } else {
        setRecon(null);
      }

      setStage('preview');
    };
    reader.readAsText(file);
  }, [existingTrades]);

  // ─── Drag & Drop ──────────────────────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      processFile(file);
    }
  };

  // ─── Import confirmed trades ──────────────────────────────
  const handleImport = () => {
    if (result && result.trades.length > 0) {
      addTrades(result.trades);
      toast.success(`Imported ${result.trades.length} trades (${fmtD(totalPnl)})`);
    }
    setStage('done');
  };

  const totalPnl = result ? safeSum(result.trades.map(t => t.pnl)) : 0;
  const importCount = result ? result.trades.length : 0;

  return (
    <ModalOverlay isOpen={isOpen} onClose={handleClose} width={640}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: F, color: C.t1, margin: 0 }}>
            Import CSV
          </h2>
          <button className="tf-btn"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: C.t3, fontSize: 18, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* ─── Stage: Upload ───────────────────────────── */}
        {stage === 'upload' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? C.b : C.bd}`,
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? C.b + '08' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => processFile(e.target.files[0])}
            />
            <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 4 }}>
              Drop CSV file here or click to browse
            </div>
            <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
              Supports .csv, .tsv, .txt · Auto-detects delimiters and headers
            </div>
          </div>
        )}

        {/* ─── Stage: Preview ──────────────────────────── */}
        {stage === 'preview' && result && (
          <div>
            {/* File info bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                background: C.sf,
                borderRadius: 8,
                marginBottom: 12,
                fontSize: 11,
              }}
            >
              <span style={{ color: C.t2, fontFamily: M }}>{fileName}</span>
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ color: C.g }}>{result.valid} valid</span>
                {result.warnings > 0 && <span style={{ color: C.y }}>{result.warnings} warnings</span>}
                {result.errors > 0 && <span style={{ color: C.r }}>{result.errors} errors</span>}
                {result.duplicates > 0 && <span style={{ color: C.t3 }}>{result.duplicates} dupes</span>}
                <span style={{ color: totalPnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(totalPnl)}</span>
              </div>
            </div>

            {/* Broker detection badge */}
            {result.broker && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  background: result.broker.broker ? (C.b + '10') : C.sf,
                  border: `1px solid ${result.broker.broker ? C.b + '30' : C.bd}`,
                  borderRadius: 6,
                  marginBottom: 12,
                  fontSize: 11,
                  color: C.t2,
                }}
              >
                {(() => {
                  const badge = brokerBadge(result.broker);
                  return (
                    <>
                      <span style={{ fontSize: 14 }}>{badge.icon}</span>
                      <span style={{ fontWeight: 700, color: C.t1 }}>{badge.label}</span>
                      <span style={{ fontSize: 10, color: C.t3 }}>{badge.detail}</span>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Preview table */}
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                border: `1px solid ${C.bd}`,
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 65px 55px 1fr 80px 70px',
                  padding: '8px 10px',
                  background: C.bg2,
                  borderBottom: `1px solid ${C.bd}`,
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.t3,
                  textTransform: 'uppercase',
                  fontFamily: M,
                  position: 'sticky',
                  top: 0,
                }}
              >
                <div>#</div>
                <div>Symbol</div>
                <div>Side</div>
                <div>Strategy</div>
                <div style={{ textAlign: 'right' }}>P&L</div>
                <div>Date</div>
              </div>

              {/* Rows */}
              {result.trades.map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '28px 65px 55px 1fr 80px 70px',
                    padding: '6px 10px',
                    borderBottom: `1px solid ${C.bd}50`,
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: C.t3, fontFamily: M, fontSize: 9 }}>{i + 1}</div>
                  <div style={{ fontWeight: 700, color: C.t1 }}>{t.symbol || '—'}</div>
                  <div style={{ color: t.side === 'long' ? C.g : C.r, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
                    {t.side || '—'}
                  </div>
                  <div style={{ color: C.t2, fontSize: 10 }}>{t.playbook || '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: M, fontWeight: 700, color: (t.pnl || 0) >= 0 ? C.g : C.r }}>
                    {fmtD(t.pnl)}
                  </div>
                  <div style={{ fontSize: 9, color: C.t3, fontFamily: M }}>
                    {t.date ? new Date(t.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}
                  </div>
                </div>
              ))}

              {result.trades.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: C.t3, fontSize: 12 }}>
                  No valid trades found in this file.
                </div>
              )}
            </div>

            {/* Row-level issues (from csv.js) */}
            {result.issues.length > 0 && (
              <div style={{ maxHeight: 100, overflowY: 'auto', marginBottom: 12 }}>
                {result.issues.slice(0, 10).map((issue, i) => (
                  <div key={i} style={{ fontSize: 10, color: C.y, fontFamily: M, padding: '2px 0' }}>
                    ⚠ {issue}
                  </div>
                ))}
                {result.issues.length > 10 && (
                  <div style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                    ...and {result.issues.length - 10} more
                  </div>
                )}
              </div>
            )}

            {/* ─── Reconciliation Panel ──────────────────── */}
            {recon && recon.summary.total > 0 && (
              <div style={{ marginBottom: 12 }}>
                {/* Header bar — clickable to expand/collapse */}
                <div
                  onClick={() => setReconOpen(!reconOpen)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: recon.summary.errors > 0 ? C.r + '15' : recon.summary.warnings > 0 ? C.y + '15' : C.b + '10',
                    border: `1px solid ${recon.summary.errors > 0 ? C.r + '40' : recon.summary.warnings > 0 ? C.y + '40' : C.b + '25'}`,
                    borderRadius: reconOpen ? '8px 8px 0 0' : 8,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'border-radius 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>
                      {recon.summary.errors > 0 ? '🔴' : recon.summary.warnings > 0 ? '🟡' : '🔵'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.t1, fontFamily: F }}>
                      Data Quality: Grade {recon.summary.grade}
                    </span>
                    <span style={{ fontSize: 10, color: C.t3, fontFamily: M }}>
                      {recon.summary.completeness}% complete
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {recon.summary.errors > 0 && (
                      <span style={{ fontSize: 10, color: C.r, fontWeight: 700, fontFamily: M }}>
                        {recon.summary.errors} error{recon.summary.errors !== 1 ? 's' : ''}
                      </span>
                    )}
                    {recon.summary.warnings > 0 && (
                      <span style={{ fontSize: 10, color: C.y, fontWeight: 700, fontFamily: M }}>
                        {recon.summary.warnings} warning{recon.summary.warnings !== 1 ? 's' : ''}
                      </span>
                    )}
                    {recon.summary.infos > 0 && (
                      <span style={{ fontSize: 10, color: C.b, fontFamily: M }}>
                        {recon.summary.infos} info
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: C.t3, transition: 'transform 0.15s', transform: reconOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Issue list — collapsible */}
                {reconOpen && (
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: 'auto',
                      border: `1px solid ${C.bd}`,
                      borderTop: 'none',
                      borderRadius: '0 0 8px 8px',
                      background: C.sf,
                    }}
                  >
                    {recon.issues.map((issue, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          padding: '6px 12px',
                          borderBottom: i < recon.issues.length - 1 ? `1px solid ${C.bd}50` : 'none',
                          alignItems: 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: 10, flexShrink: 0, marginTop: 1 }}>
                          {issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵'}
                        </span>
                        <div>
                          <div style={{ fontSize: 10, color: C.t1, fontFamily: M, lineHeight: 1.4 }}>
                            {issue.message}
                          </div>
                          <div style={{ fontSize: 9, color: C.t3, fontFamily: M, marginTop: 1 }}>
                            {issue.code.replace(/_/g, ' ').toLowerCase()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reconciliation: clean badge (no issues) */}
            {recon && recon.summary.total === 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: C.g + '12',
                  border: `1px solid ${C.g}30`,
                  borderRadius: 8,
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 14 }}>✅</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.g, fontFamily: F }}>
                  Data quality check passed — no issues detected
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => { setStage('upload'); setResult(null); setRecon(null); setReconOpen(false); }}>
                Back
              </Btn>
              <Btn onClick={handleImport} disabled={importCount === 0}>
                Import {importCount} Trade{importCount !== 1 ? 's' : ''}
              </Btn>
            </div>
          </div>
        )}

        {/* ─── Stage: Done ─────────────────────────────── */}
        {stage === 'done' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
              Imported {importCount} trade{importCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 20, fontFamily: M }}>
              Total P&L: <span style={{ color: totalPnl >= 0 ? C.g : C.r, fontWeight: 700 }}>{fmtD(totalPnl)}</span>
              {result && result.duplicates > 0 && <span> · {result.duplicates} duplicates skipped</span>}
              {result && result.errors > 0 && <span> · {result.errors} errors skipped</span>}
              {recon && <span> · Data quality: Grade {recon.summary.grade}</span>}
            </div>
            <Btn onClick={handleClose}>Done</Btn>
          </div>
        )}
    </ModalOverlay>
  );
}

export { CSVImportModal };
