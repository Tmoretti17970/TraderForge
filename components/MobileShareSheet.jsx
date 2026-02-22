// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10.2 — Mobile Share Sheet
// Sprint 6 C6.5: Native-style share sheet for chart snapshots.
//
// Triggered from mobile chart screenshot button.
// Options: Share (Web Share API), Copy, Save, Post to Feed.
// Falls back to download if Web Share API unavailable.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { C, F, M } from '../constants.js';
import toast from './Toast.jsx';
import { createAnnotatedSnapshot } from '../utils/chartExport.js';

/**
 * @param {boolean} isOpen
 * @param {Function} onClose
 * @param {HTMLCanvasElement} canvas
 * @param {Object} chartInfo - { symbol, tf, chartType }
 */
export default function MobileShareSheet({ isOpen, onClose, canvas, chartInfo = {} }) {
  const [imageData, setImageData] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);

  // Capture on open
  useEffect(() => {
    if (!isOpen || !canvas) return;
    try {
      const annotations = {
        symbol: chartInfo.symbol || '',
        timeframe: chartInfo.tf || '',
        timestamp: new Date().toLocaleString(),
      };
      const data = createAnnotatedSnapshot(canvas, annotations);
      setImageData(data);

      // Also create blob for Web Share API
      canvas.toBlob((blob) => {
        if (blob) setImageBlob(blob);
      }, 'image/png');
    } catch (err) {
      toast.error('Failed to capture chart');
      onClose();
    }
  }, [isOpen, canvas, chartInfo, onClose]);

  // ─── Share via Web Share API ──────────────────────────────
  const handleNativeShare = useCallback(async () => {
    if (!imageBlob) return;

    try {
      const file = new File([imageBlob], `${chartInfo.symbol || 'chart'}.png`, { type: 'image/png' });
      await navigator.share({
        title: `${chartInfo.symbol || 'Chart'} Analysis`,
        text: `${chartInfo.symbol} ${(chartInfo.tf || '').toUpperCase()} — TradeForge`,
        files: [file],
      });
      toast.success('Shared!');
      onClose();
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Fallback to download
        handleDownload();
      }
    }
  }, [imageBlob, chartInfo, onClose]);

  // ─── Copy to Clipboard ────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!imageBlob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': imageBlob }),
      ]);
      toast.success('Copied to clipboard');
      onClose();
    } catch {
      toast.error('Clipboard not available');
    }
  }, [imageBlob, onClose]);

  // ─── Download ─────────────────────────────────────────────
  const handleDownload = useCallback(() => {
    if (!imageData) return;
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `${chartInfo.symbol || 'chart'}-${ts}.png`;
    link.href = imageData;
    link.click();
    toast.success('Saved to device');
    onClose();
  }, [imageData, chartInfo, onClose]);

  // ─── Post to Social Feed ──────────────────────────────────
  const handlePostToFeed = useCallback(async () => {
    if (!imageData) return;
    try {
      const { publishSnapshot } = await import('../data/SocialService.js');
      await publishSnapshot({
        image: imageData,
        caption: `${chartInfo.symbol || 'Chart'} ${(chartInfo.tf || '').toUpperCase()} Analysis`,
        tags: [chartInfo.symbol?.toLowerCase()].filter(Boolean),
        symbol: chartInfo.symbol,
        timeframe: chartInfo.tf,
        chartType: chartInfo.chartType,
        createdAt: new Date().toISOString(),
      });
      toast.success('Posted to feed!');
      onClose();
    } catch {
      toast.error('Post failed');
    }
  }, [imageData, chartInfo, onClose]);

  if (!isOpen) return null;

  const canShare = typeof navigator?.share === 'function' && typeof navigator?.canShare === 'function';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0, zIndex: 10000,
        background: C.sf,
        borderRadius: '16px 16px 0 0',
        paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        animation: 'slideUp 0.25s ease-out',
      }}>
        {/* Handle */}
        <div style={{
          display: 'flex', justifyContent: 'center', padding: '8px 0 4px',
        }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.t3 + '40' }} />
        </div>

        {/* Preview */}
        {imageData && (
          <div style={{
            margin: '4px 16px 12px',
            borderRadius: 8, overflow: 'hidden',
            border: `1px solid ${C.bd}`,
          }}>
            <img src={imageData} alt="Chart" style={{ width: '100%', display: 'block' }} />
          </div>
        )}

        {/* Action buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: canShare ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
          gap: 8,
          padding: '0 16px 16px',
        }}>
          {canShare && (
            <ShareAction icon="📤" label="Share" onClick={handleNativeShare} />
          )}
          <ShareAction icon="📋" label="Copy" onClick={handleCopy} />
          <ShareAction icon="💾" label="Save" onClick={handleDownload} />
          <ShareAction icon="🚀" label="Post" onClick={handlePostToFeed} />
        </div>

        {/* Cancel */}
        <div style={{ padding: '0 16px 8px' }}>
          <button className="tf-btn"
            onClick={onClose}
            style={{
              width: '100%', padding: '12px 0',
              borderRadius: 10, border: `1px solid ${C.bd}`,
              background: C.bg, color: C.t2,
              fontSize: 14, fontWeight: 600, fontFamily: F,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
        `}</style>
      </div>
    </>
  );
}

function ShareAction({ icon, label, onClick }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '14px 8px',
        borderRadius: 12,
        border: `1px solid ${C.bd}`,
        background: C.bg,
        color: C.t1,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, fontFamily: M }}>{label}</span>
    </button>
  );
}

export { MobileShareSheet };
