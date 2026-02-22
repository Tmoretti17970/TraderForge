// ═══════════════════════════════════════════════════════════════════
// TradeForge — Mobile Settings
//
// Mobile-native settings experience:
//   - Collapsible accordion sections (one open at a time)
//   - 44px touch targets on all inputs/buttons
//   - Full-width cards, 16px edge padding
//   - Safe area handling for notched phones
//   - Sections: Trading · Playbooks · Data · Integrations · Profile · Danger
//
// Usage:
//   <MobileSettings />
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react';
import { C, F, M } from '../constants.js';
import { radii } from '../theme/tokens.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useOnboardingStore } from '../state/useOnboardingStore.js';
import { useSocialStore } from '../state/useSocialStore.js';
import { genDemoData } from '../data/demoData.js';
import { Btn, inputStyle } from './UIKit.jsx';
import PlaybookManager from './PlaybookManager.jsx';
import RiskCalculator from './RiskCalculator.jsx';
import { listPresets } from '../engine/RiskPresets.js';
import { getApiKey, setApiKey, getProviderStatus } from '../data/DataProvider.js';
import { exportCSV, exportJSON, downloadFile, importFile } from '../data/ImportExport.js';
import { configureSupabase, signIn, signUp, signOut, getAuth, getSyncStatus, sync } from '../data/StorageAdapter.js';
import { generateReport, downloadReport } from '../engine/ReportGenerator.js';
import { computeFast } from '../engine/analyticsFast.js';

// ─── Section Definitions ────────────────────────────────────────

const SECTIONS = [
  { id: 'trading', label: 'Trading Setup', icon: '⚙️' },
  { id: 'playbooks', label: 'Playbooks', icon: '📚' },
  { id: 'data', label: 'Data', icon: '📁' },
  { id: 'integrations', label: 'Integrations', icon: '🔌' },
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function MobileSettings() {
  const [openSection, setOpenSection] = useState('trading');

  const toggle = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{
      padding: '16px 16px',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0 }}>
          Settings
        </h1>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>
          Manage your trading setup and preferences
        </div>
      </div>

      {/* Accordion Sections */}
      {SECTIONS.map((section) => (
        <AccordionSection
          key={section.id}
          id={section.id}
          icon={section.icon}
          label={section.label}
          isOpen={openSection === section.id}
          onToggle={() => toggle(section.id)}
          isDanger={section.id === 'danger'}
        >
          {section.id === 'trading' && <TradingContent />}
          {section.id === 'playbooks' && <PlaybooksContent />}
          {section.id === 'data' && <DataContent />}
          {section.id === 'integrations' && <IntegrationsContent />}
          {section.id === 'profile' && <ProfileContent />}
          {section.id === 'danger' && <DangerContent />}
        </AccordionSection>
      ))}
    </div>
  );
}

// ─── Accordion Section ──────────────────────────────────────────

function AccordionSection({ id, icon, label, isOpen, onToggle, isDanger, children }) {
  return (
    <div
      style={{
        marginBottom: 8,
        borderRadius: 14,
        border: `1px solid ${isDanger && isOpen ? C.r + '30' : C.bd}`,
        background: isDanger && isOpen ? C.r + '04' : C.sf,
        overflow: 'hidden',
      }}
      role="region"
      aria-label={label}
    >
      {/* Header (always visible) */}
      <button
        onClick={onToggle}
        className="tf-btn"
        aria-expanded={isOpen}
        aria-controls={`section-${id}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          padding: '16px 16px',
          minHeight: 52,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          flex: 1,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: F,
          color: isDanger ? C.r : C.t1,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 14,
          color: C.t3,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>
          ▼
        </span>
      </button>

      {/* Content (collapsible) */}
      {isOpen && (
        <div
          id={`section-${id}`}
          className="tf-fade-scale"
          style={{ padding: '0 16px 16px' }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Setting Row ─────────────────────────────────────────

function MobileRow({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: C.t2,
        marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Input Style ─────────────────────────────────────────

const mobileInput = {
  ...inputStyle,
  minHeight: 44,
  fontSize: 14,
  padding: '10px 14px',
  borderRadius: radii.md,
  width: '100%',
  boxSizing: 'border-box',
};

// ─── Mobile Button ──────────────────────────────────────────────

function MobileBtn({ children, onClick, variant, disabled, style }) {
  return (
    <Btn
      onClick={onClick}
      variant={variant}
      disabled={disabled}
      style={{
        fontSize: 14,
        padding: '12px 18px',
        minHeight: 44,
        ...style,
      }}
    >
      {children}
    </Btn>
  );
}

// ─── Status Pill ────────────────────────────────────────────────

function StatusPill({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      borderRadius: 12,
      background: ok ? C.g + '12' : C.bd + '30',
      border: `1px solid ${ok ? C.g + '40' : C.bd}`,
      fontSize: 11,
      fontFamily: M,
      fontWeight: 600,
      color: ok ? C.g : C.t3,
    }}>
      {ok ? '●' : '○'} {label}
    </span>
  );
}

// ─── Alert Banner ───────────────────────────────────────────────

function MobileAlert({ ok, message }) {
  if (!message) return null;
  return (
    <div style={{
      marginTop: 10,
      padding: '10px 14px',
      borderRadius: radii.md,
      background: ok ? C.g + '12' : C.r + '12',
      borderLeft: `3px solid ${ok ? C.g : C.r}`,
      fontSize: 13,
      fontFamily: M,
      color: ok ? C.g : C.r,
    }}>
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION CONTENTS
// ═══════════════════════════════════════════════════════════════════

// ─── Trading Setup ──────────────────────────────────────────────

function TradingContent() {
  // Zustand v5: individual selectors instead of object + shallow
  const accountSize = useSettingsStore((s) => s.accountSize);
  const riskPerTrade = useSettingsStore((s) => s.riskPerTrade);
  const dailyLossLimit = useSettingsStore((s) => s.dailyLossLimit);
  const riskFreeRate = useSettingsStore((s) => s.riskFreeRate);
  const maxDailyTrades = useSettingsStore((s) => s.maxDailyTrades);
  const kellyFraction = useSettingsStore((s) => s.kellyFraction);
  const activeRiskPreset = useSettingsStore((s) => s.activeRiskPreset);
  const defaultSymbol = useSettingsStore((s) => s.defaultSymbol);
  const defaultTf = useSettingsStore((s) => s.defaultTf);
  const update = useSettingsStore((s) => s.update);

  return (
    <div>
      {/* Account & Risk */}
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>
        Account & Risk
      </div>

      <MobileRow label="Account Size ($)">
        <input
          type="number"
          value={accountSize || ''}
          onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })}
          placeholder="e.g. 25000"
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Risk Per Trade (%)">
        <input
          type="number"
          value={riskPerTrade || ''}
          onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
          placeholder="e.g. 1"
          step="0.1"
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Daily Loss Limit ($)">
        <input
          type="number"
          value={dailyLossLimit || ''}
          onChange={(e) => update({ dailyLossLimit: Number(e.target.value) || 0 })}
          placeholder="e.g. 500"
          style={mobileInput}
        />
      </MobileRow>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <MobileRow label="Risk-Free Rate (%)">
          <input
            type="number"
            value={riskFreeRate != null ? riskFreeRate * 100 : ''}
            onChange={(e) => update({ riskFreeRate: (Number(e.target.value) || 0) / 100 })}
            placeholder="5.0"
            step="0.1"
            style={mobileInput}
          />
        </MobileRow>

        <MobileRow label="Max Daily Trades">
          <input
            type="number"
            value={maxDailyTrades || ''}
            onChange={(e) => update({ maxDailyTrades: Number(e.target.value) || 0 })}
            placeholder="0 = ∞"
            style={mobileInput}
          />
        </MobileRow>
      </div>

      <MobileRow label="Kelly Fraction">
        <select
          value={kellyFraction || 0.5}
          onChange={(e) => update({ kellyFraction: Number(e.target.value) })}
          style={{ ...mobileInput, cursor: 'pointer' }}
        >
          <option value={0.25}>Quarter-Kelly (0.25×)</option>
          <option value={0.5}>Half-Kelly (0.5×)</option>
          <option value={0.75}>Three-Quarter Kelly (0.75×)</option>
          <option value={1.0}>Full Kelly (1.0×)</option>
        </select>
      </MobileRow>

      {/* Quick Presets */}
      <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t3, marginBottom: 10 }}>
          Quick Presets
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {listPresets().map(preset => (
            <button
              key={preset.id}
              onClick={() => update({ ...preset.params, activeRiskPreset: preset.id })}
              className="tf-btn"
              style={{
                padding: '8px 14px',
                minHeight: 36,
                borderRadius: radii.md,
                border: `1px solid ${activeRiskPreset === preset.id ? C.b : C.bd}`,
                background: activeRiskPreset === preset.id ? C.b + '15' : 'transparent',
                color: activeRiskPreset === preset.id ? C.b : C.t2,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: F,
                cursor: 'pointer',
              }}
            >
              {preset.icon} {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Defaults */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>
          Chart Defaults
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <MobileRow label="Symbol">
            <input
              value={defaultSymbol || ''}
              onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })}
              placeholder="BTC"
              style={{ ...mobileInput, textTransform: 'uppercase' }}
            />
          </MobileRow>

          <MobileRow label="Timeframe">
            <select
              value={defaultTf || '3m'}
              onChange={(e) => update({ defaultTf: e.target.value })}
              style={{ ...mobileInput, cursor: 'pointer' }}
            >
              <option value="1d">1 Day</option>
              <option value="5d">5 Days</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </MobileRow>
        </div>
      </div>

      {/* Position Sizer */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>
          Position Sizer
        </div>
        <RiskCalculator />
      </div>
    </div>
  );
}

// ─── Playbooks ──────────────────────────────────────────────────

function PlaybooksContent() {
  return <PlaybookManager />;
}

// ─── Data ───────────────────────────────────────────────────────

function DataContent() {
  const trades = useTradeStore((s) => s.trades);
  const setTrades = useTradeStore((s) => s.setTrades);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const handleExportCSV = () => {
    const csv = exportCSV(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `tradeforge-export-${date}.csv`, 'text/csv');
  };

  const handleExportJSON = () => {
    const json = exportJSON(trades);
    const date = new Date().toISOString().slice(0, 10);
    downloadFile(json, `tradeforge-export-${date}.json`, 'application/json');
  };

  const handleExportReport = () => {
    const analytics = computeFast(trades);
    const md = generateReport(trades, analytics, { title: 'TradeForge Performance Report' });
    downloadReport(md);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const result = await importFile(file);
    setImporting(false);
    if (!result.ok) {
      setImportResult({ ok: false, message: result.error });
      return;
    }
    setImportResult({
      ok: true,
      message: `${result.brokerLabel || result.broker}: ${result.count} trades${result.skipped ? ` (${result.skipped} skipped)` : ''}`,
      trades: result.trades,
    });
  };

  const confirmImport = () => {
    if (!importResult?.trades?.length) return;
    const merged = [...trades, ...importResult.trades];
    setTrades(merged);
    setImportResult({
      ok: true,
      message: `✅ Imported ${importResult.trades.length} trades. Total: ${merged.length}.`,
      trades: null,
    });
  };

  return (
    <div>
      {/* Trade count badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: C.sf2,
        borderRadius: radii.md,
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 22 }}>📊</span>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: M, color: C.t1 }}>
            {trades.length}
          </div>
          <div style={{ fontSize: 12, color: C.t3 }}>
            trade{trades.length !== 1 ? 's' : ''} stored
          </div>
        </div>
      </div>

      {/* Export */}
      <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 8 }}>Export</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <MobileBtn onClick={handleExportCSV}>📥 Export CSV</MobileBtn>
        <MobileBtn onClick={handleExportJSON}>📥 Export JSON</MobileBtn>
        <MobileBtn onClick={handleExportReport}>📊 Performance Report</MobileBtn>
      </div>

      {/* Import */}
      <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Import</div>
        <div style={{ fontSize: 11, color: C.t3, marginBottom: 10 }}>
          Tradovate, NinjaTrader, ThinkorSwim, IBKR, or CSV/JSON
        </div>

        <MobileRow label="Choose file">
          <input
            type="file"
            accept=".csv,.json,.txt"
            onChange={handleImport}
            disabled={importing}
            style={{ fontSize: 14, fontFamily: F, color: C.t2, padding: '10px 0', minHeight: 44 }}
          />
        </MobileRow>

        {importing && (
          <div style={{ fontSize: 13, color: C.b, fontFamily: M, marginBottom: 8 }}>
            Parsing...
          </div>
        )}

        <MobileAlert ok={importResult?.ok} message={importResult?.message} />

        {importResult?.trades?.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <MobileBtn onClick={confirmImport}>
              ✅ Confirm ({importResult.trades.length} trades)
            </MobileBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Integrations ───────────────────────────────────────────────

function IntegrationsContent() {
  return (
    <div>
      <MobileApiKeys />
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
        <MobileCloudSync />
      </div>
    </div>
  );
}

function MobileApiKeys() {
  const providers = getProviderStatus();
  const [polygonKey, setPolygonKey] = useState(getApiKey('polygon'));
  const [avKey, setAvKey] = useState(getApiKey('alphavantage'));
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setApiKey('polygon', polygonKey.trim());
    setApiKey('alphavantage', avKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
        Market Data
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
        API keys unlock premium data. Crypto works without keys.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {Object.entries(providers).map(([id, p]) => (
          <StatusPill key={id} ok={p.hasKey || !p.needsKey} label={p.name} />
        ))}
      </div>

      <MobileRow label="Polygon.io" hint="polygon.io/dashboard/signup">
        <input
          type="password"
          value={polygonKey}
          onChange={(e) => setPolygonKey(e.target.value)}
          placeholder="API key..."
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Alpha Vantage" hint="alphavantage.co/support/#api-key">
        <input
          type="password"
          value={avKey}
          onChange={(e) => setAvKey(e.target.value)}
          placeholder="API key..."
          style={mobileInput}
        />
      </MobileRow>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <MobileBtn onClick={handleSave}>Save Keys</MobileBtn>
        {saved && <span style={{ fontSize: 13, color: C.g, fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </div>
  );
}

function MobileCloudSync() {
  const auth = getAuth();
  const syncStatus = getSyncStatus();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [supaUrl, setSupaUrl] = useState(auth.supabaseUrl || '');
  const [supaKey, setSupaKey] = useState(auth.supabaseKey || '');
  const [authMsg, setAuthMsg] = useState(null);
  const [syncMsg, setSyncMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleConfigure = () => {
    configureSupabase(supaUrl.trim(), supaKey.trim());
    setAuthMsg({ ok: true, text: 'Configured.' });
  };

  const handleSignIn = async () => {
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    setAuthMsg({ ok: result.ok, text: result.ok ? `Signed in as ${result.user?.email}` : result.error });
  };

  const handleSignUp = async () => {
    setBusy(true);
    const result = await signUp(email, password);
    setBusy(false);
    setAuthMsg({ ok: result.ok, text: result.ok ? result.message : result.error });
  };

  const handleSignOut = () => {
    signOut();
    setAuthMsg({ ok: true, text: 'Signed out.' });
  };

  const handleSync = async () => {
    setBusy(true);
    const result = await sync();
    setBusy(false);
    setSyncMsg({
      ok: result.ok,
      text: result.ok ? `${result.pushed} pushed, ${result.pulled} pulled` : result.errors.join(', '),
    });
  };

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
        ☁️ Cloud Sync
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 12 }}>
        Optional. Connect Supabase to sync across devices.
      </div>

      {!auth.isAuthenticated ? (
        <>
          <MobileRow label="Supabase URL">
            <input type="text" value={supaUrl} onChange={(e) => setSupaUrl(e.target.value)}
              placeholder="https://your-project.supabase.co" style={mobileInput} />
          </MobileRow>
          <MobileRow label="Anon Key">
            <input type="password" value={supaKey} onChange={(e) => setSupaKey(e.target.value)}
              placeholder="eyJhbGciOi..." style={mobileInput} />
          </MobileRow>
          <MobileBtn onClick={handleConfigure} style={{ marginBottom: 16 }}>Configure</MobileBtn>

          <div style={{ paddingTop: 12, borderTop: `1px solid ${C.bd}` }}>
            <MobileRow label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" style={mobileInput} />
            </MobileRow>
            <MobileRow label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" style={mobileInput} />
            </MobileRow>
            <div style={{ display: 'flex', gap: 8 }}>
              <MobileBtn onClick={handleSignIn} disabled={busy}>
                {busy ? '...' : 'Sign In'}
              </MobileBtn>
              <MobileBtn onClick={handleSignUp} variant="ghost" disabled={busy}>
                Sign Up
              </MobileBtn>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            padding: '12px 14px', background: C.sf2, borderRadius: radii.md,
            marginBottom: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: syncStatus.isCloudEnabled ? C.g : C.t3,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>
                {auth.user?.email || 'Authenticated'}
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                {syncStatus.pending > 0 ? `${syncStatus.pending} pending` : 'Synced'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <MobileBtn onClick={handleSync} disabled={busy}>
              {busy ? 'Syncing...' : '🔄 Sync'}
            </MobileBtn>
            <MobileBtn variant="ghost" onClick={handleSignOut}>
              Sign Out
            </MobileBtn>
          </div>
        </>
      )}

      <MobileAlert ok={authMsg?.ok} message={authMsg?.text} />
      <MobileAlert ok={syncMsg?.ok} message={syncMsg?.text} />
    </div>
  );
}

// ─── Profile ────────────────────────────────────────────────────

const AVATAR_OPTIONS = [
  '🔥', '🐂', '🐻', '🦈', '🦅', '🐺', '🦁', '🐲',
  '🦊', '🎯', '💎', '⚡', '🌊', '🏔️', '🎲', '🧠',
];

function ProfileContent() {
  const myProfile = useSocialStore((s) => s.myProfile);
  const loadMyProfile = useSocialStore((s) => s.loadMyProfile);
  const updateMyProfile = useSocialStore((s) => s.updateMyProfile);
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => { loadMyProfile(); }, [loadMyProfile]);

  useEffect(() => {
    if (myProfile) {
      setProfileForm({
        username: myProfile.username || '',
        displayName: myProfile.displayName || '',
        bio: myProfile.bio || '',
        avatar: myProfile.avatar || '🔥',
      });
    }
  }, [myProfile]);

  const saveProfile = useCallback(() => {
    updateMyProfile(profileForm);
  }, [profileForm, updateMyProfile]);

  return (
    <div>
      {/* Avatar picker — grid for easy touch */}
      <MobileRow label="Avatar">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: 6,
        }}>
          {AVATAR_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setProfileForm((f) => ({ ...f, avatar: emoji }))}
              className="tf-btn"
              aria-label={`Avatar ${emoji}`}
              style={{
                width: '100%',
                aspectRatio: '1',
                minHeight: 40,
                borderRadius: '50%',
                border: `2px solid ${profileForm.avatar === emoji ? C.b : C.bd}`,
                background: profileForm.avatar === emoji ? C.b + '15' : 'transparent',
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </MobileRow>

      <MobileRow label="Display Name">
        <input
          value={profileForm.displayName || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
          placeholder="Your display name"
          maxLength={30}
          style={mobileInput}
        />
      </MobileRow>

      <MobileRow label="Username">
        <input
          value={profileForm.username || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
          placeholder="your_username"
          maxLength={20}
          style={{ ...mobileInput, fontFamily: M }}
        />
      </MobileRow>

      <MobileRow label="Bio">
        <textarea
          value={profileForm.bio || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
          placeholder="Trading style, experience..."
          maxLength={150}
          rows={3}
          style={{ ...mobileInput, resize: 'vertical', minHeight: 80 }}
        />
        <div style={{ fontSize: 11, color: C.t3, textAlign: 'right', marginTop: 2, fontFamily: M }}>
          {(profileForm.bio || '').length}/150
        </div>
      </MobileRow>

      <MobileBtn onClick={saveProfile}>Save Profile</MobileBtn>
    </div>
  );
}

// ─── Danger Zone ────────────────────────────────────────────────

function DangerContent() {
  const tradeCount = useTradeStore((s) => s.trades.length);

  const handleReset = () => {
    if (window.confirm('Reset all data to demo trades? This cannot be undone.')) {
      const demo = genDemoData();
      useTradeStore.getState().reset(demo.trades, demo.playbooks);
      useSettingsStore.getState().reset();
    }
  };

  return (
    <div>
      {/* Reset to Demo */}
      <div style={{
        padding: '16px 0',
        borderBottom: `1px solid ${C.bd}`,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 4 }}>
          Reset to Demo Data
        </div>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>
          Replace all {tradeCount} trades with demo data. This cannot be undone.
        </div>
        <MobileBtn variant="danger" onClick={handleReset}>
          Reset Data
        </MobileBtn>
      </div>

      {/* Replay Onboarding */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, marginBottom: 4 }}>
          Replay Onboarding
        </div>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 12 }}>
          Re-run the setup wizard and reset dismissed tips.
        </div>
        <MobileBtn
          variant="ghost"
          onClick={() => {
            useOnboardingStore.getState().resetWizard();
            useOnboardingStore.getState().resetTips();
          }}
        >
          Replay Setup
        </MobileBtn>
      </div>
    </div>
  );
}
