// ═══════════════════════════════════════════════════════════════════
// TradeForge — Settings Page (Redesign)
//
// Narrative layout with section navigation:
//   1. Trading Setup — Account, risk params, chart defaults
//   2. Playbooks — Strategy management
//   3. Data — Import/export, reports
//   4. Integrations — API keys, cloud sync
//   5. Profile — Community identity
//   6. Danger Zone — Destructive actions
//
// Section nav on left (desktop) or tab strip (mobile).
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, F, M } from '../constants.js';
import { radii } from '../theme/tokens.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useTradeStore } from '../state/useTradeStore.js';
import { useOnboardingStore } from '../state/useOnboardingStore.js';
import { useSocialStore } from '../state/useSocialStore.js';
import { genDemoData } from '../data/demoData.js';
import { Card, Btn, inputStyle } from '../components/UIKit.jsx';
import PlaybookManager from '../components/PlaybookManager.jsx';
import RiskCalculator from '../components/RiskCalculator.jsx';
import { listPresets } from '../engine/RiskPresets.js';
import { getApiKey, setApiKey, getProviderStatus } from '../data/DataProvider.js';
import { exportCSV, exportJSON, downloadFile, importFile } from '../data/ImportExport.js';
import { configureSupabase, signIn, signUp, signOut, getAuth, getSyncStatus, sync } from '../data/StorageAdapter.js';
import { generateReport, downloadReport } from '../engine/ReportGenerator.js';
import { computeFast } from '../engine/analyticsFast.js';
import { useBreakpoints } from '../utils/useMediaQuery.js';
import MobileSettings from '../components/MobileSettings.jsx';

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

export default function SettingsPage() {
  const { isMobile } = useBreakpoints();

  // Mobile gets its own dedicated component
  if (isMobile) return <MobileSettings />;

  return <DesktopSettings />;
}

// ─── Desktop Settings ───────────────────────────────────────────

function DesktopSettings() {
  const [activeSection, setActiveSection] = useState('trading');
  const sectionRefs = useRef({});

  const scrollToSection = (id) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{
      display: 'flex',
      gap: 32,
      padding: 32,
      maxWidth: 960,
      minHeight: '100vh',
    }}>
      {/* ─── Section Nav (desktop sidebar) ──── */}
      <nav style={{
        width: 180,
        flexShrink: 0,
        position: 'sticky',
        top: 32,
        alignSelf: 'flex-start',
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.t3,
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          marginBottom: 12,
        }}>
          Settings
        </div>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className="tf-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              borderRadius: radii.md,
              border: 'none',
              background: activeSection === s.id ? C.b + '12' : 'transparent',
              color: activeSection === s.id ? C.b : C.t2,
              fontSize: 13,
              fontWeight: activeSection === s.id ? 600 : 400,
              fontFamily: F,
              cursor: 'pointer',
              textAlign: 'left',
              marginBottom: 2,
            }}
          >
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {/* ─── Main Content ──── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div ref={(el) => (sectionRefs.current.trading = el)}>
          <TradingSetupSection />
        </div>

        <div ref={(el) => (sectionRefs.current.playbooks = el)}>
          <PlaybooksSection />
        </div>

        <div ref={(el) => (sectionRefs.current.data = el)}>
          <DataSection />
        </div>

        <div ref={(el) => (sectionRefs.current.integrations = el)}>
          <IntegrationsSection />
        </div>

        <div ref={(el) => (sectionRefs.current.profile = el)}>
          <ProfileSection />
        </div>

        <div ref={(el) => (sectionRefs.current.danger = el)}>
          <DangerZoneSection />
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ─────────────────────────────────────────────

function SectionHeader({ icon, title, description }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <h2 style={{
          fontSize: 16,
          fontWeight: 700,
          color: C.t1,
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      {description && (
        <p style={{ fontSize: 13, color: C.t3, margin: 0, paddingLeft: 28 }}>
          {description}
        </p>
      )}
    </div>
  );
}

// ─── Setting Row Helper (enhanced) ──────────────────────────────

function SettingRow({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 12,
        fontWeight: 600,
        color: C.t2,
        marginBottom: 6,
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: C.t3, marginTop: 4, fontFamily: M }}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 10px',
      borderRadius: 12,
      background: ok ? C.g + '12' : C.bd + '30',
      border: `1px solid ${ok ? C.g + '40' : C.bd}`,
      fontSize: 10,
      fontFamily: M,
      fontWeight: 600,
      color: ok ? C.g : C.t3,
    }}>
      {ok ? '●' : '○'} {label}
    </span>
  );
}

// ─── Alert Banner ───────────────────────────────────────────────

function AlertBanner({ ok, message }) {
  if (!message) return null;
  return (
    <div style={{
      marginTop: 10,
      padding: '8px 12px',
      borderRadius: radii.sm,
      background: ok ? C.g + '12' : C.r + '12',
      borderLeft: `3px solid ${ok ? C.g : C.r}`,
      fontSize: 12,
      fontFamily: M,
      color: ok ? C.g : C.r,
    }}>
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: TRADING SETUP
// ═══════════════════════════════════════════════════════════════════

function TradingSetupSection() {
  // Zustand v5: use individual selectors (atomic picks) instead of
  // object-returning selectors. The v4 pattern `useStore(s => ({...}), shallow)`
  // no longer works — v5's create() hook ignores the 2nd argument.
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
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="⚙️"
        title="Trading Setup"
        description="Account parameters, risk rules, and chart defaults"
      />

      {/* Account & Risk */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 16 }}>
          Account & Risk
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Account Size ($)">
            <input
              type="number"
              value={accountSize || ''}
              onChange={(e) => update({ accountSize: Number(e.target.value) || 0 })}
              placeholder="e.g. 25000"
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Risk Per Trade (%)">
            <input
              type="number"
              value={riskPerTrade || ''}
              onChange={(e) => update({ riskPerTrade: Number(e.target.value) || 0 })}
              placeholder="e.g. 1"
              step="0.1"
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Daily Loss Limit ($)">
            <input
              type="number"
              value={dailyLossLimit || ''}
              onChange={(e) => update({ dailyLossLimit: Number(e.target.value) || 0 })}
              placeholder="e.g. 500"
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Risk-Free Rate (%)">
            <input
              type="number"
              value={riskFreeRate != null ? riskFreeRate * 100 : ''}
              onChange={(e) => update({ riskFreeRate: (Number(e.target.value) || 0) / 100 })}
              placeholder="e.g. 5.0"
              step="0.1"
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Max Daily Trades">
            <input
              type="number"
              value={maxDailyTrades || ''}
              onChange={(e) => update({ maxDailyTrades: Number(e.target.value) || 0 })}
              placeholder="0 = unlimited"
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Kelly Fraction">
            <select
              value={kellyFraction || 0.5}
              onChange={(e) => update({ kellyFraction: Number(e.target.value) })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value={0.25}>Quarter-Kelly (0.25×)</option>
              <option value={0.5}>Half-Kelly (0.5×)</option>
              <option value={0.75}>Three-Quarter Kelly (0.75×)</option>
              <option value={1.0}>Full Kelly (1.0×)</option>
            </select>
          </SettingRow>
        </div>

        {/* Risk Presets */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.t3, marginBottom: 10 }}>
            Quick Presets
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {listPresets().map(preset => (
              <button
                key={preset.id}
                onClick={() => update({ ...preset.params, activeRiskPreset: preset.id })}
                className="tf-btn"
                style={{
                  padding: '7px 12px',
                  borderRadius: radii.md,
                  border: `1px solid ${activeRiskPreset === preset.id ? C.b : C.bd}`,
                  background: activeRiskPreset === preset.id ? C.b + '15' : 'transparent',
                  color: activeRiskPreset === preset.id ? C.b : C.t2,
                  fontSize: 12,
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
      </Card>

      {/* Chart Defaults */}
      <Card style={{ marginBottom: 16, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 16 }}>
          Chart Defaults
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Default Symbol">
            <input
              value={defaultSymbol || ''}
              onChange={(e) => update({ defaultSymbol: e.target.value.toUpperCase() })}
              placeholder="e.g. BTC"
              style={{ ...inputStyle, textTransform: 'uppercase' }}
            />
          </SettingRow>

          <SettingRow label="Default Timeframe">
            <select
              value={defaultTf || '3m'}
              onChange={(e) => update({ defaultTf: e.target.value })}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="1d">1 Day</option>
              <option value="5d">5 Days</option>
              <option value="1m">1 Month</option>
              <option value="3m">3 Months</option>
              <option value="6m">6 Months</option>
              <option value="1y">1 Year</option>
            </select>
          </SettingRow>
        </div>
      </Card>

      {/* Position Sizer */}
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 12 }}>
          Position Sizer
        </div>
        <RiskCalculator />
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2: PLAYBOOKS
// ═══════════════════════════════════════════════════════════════════

function PlaybooksSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="📚"
        title="Playbooks"
        description="Define and manage your trading strategies"
      />
      <Card style={{ padding: 20 }}>
        <PlaybookManager />
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3: DATA
// ═══════════════════════════════════════════════════════════════════

function DataSection() {
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
      message: `Detected: ${result.brokerLabel || result.broker}. Found ${result.count} trades${result.skipped ? ` (${result.skipped} skipped)` : ''}.`,
      trades: result.trades,
      broker: result.broker,
    });
  };

  const confirmImport = () => {
    if (!importResult?.trades?.length) return;
    const existing = trades;
    const merged = [...existing, ...importResult.trades];
    setTrades(merged);
    setImportResult({
      ok: true,
      message: `✅ Imported ${importResult.trades.length} trades. Total: ${merged.length}.`,
      trades: null,
    });
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="📁"
        title="Data"
        description="Import trades, export backups, and generate reports"
      />

      <Card style={{ padding: 20 }}>
        {/* Trade count summary */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: C.sf2,
          borderRadius: radii.md,
          marginBottom: 20,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: C.b + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>
            📊
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: M, color: C.t1 }}>
              {trades.length}
            </div>
            <div style={{ fontSize: 11, color: C.t3 }}>
              trade{trades.length !== 1 ? 's' : ''} stored locally
            </div>
          </div>
        </div>

        {/* Export */}
        <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 10 }}>
          Export
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <Btn onClick={handleExportCSV} style={{ fontSize: 12, padding: '8px 14px' }}>
            📥 Export CSV
          </Btn>
          <Btn onClick={handleExportJSON} style={{ fontSize: 12, padding: '8px 14px' }}>
            📥 Export JSON
          </Btn>
          <Btn onClick={handleExportReport} style={{ fontSize: 12, padding: '8px 14px' }}>
            📊 Performance Report
          </Btn>
        </div>

        {/* Import */}
        <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.t2, marginBottom: 4 }}>
            Import
          </div>
          <div style={{ fontSize: 11, color: C.t3, marginBottom: 10, fontFamily: M }}>
            Supports Tradovate, NinjaTrader, ThinkorSwim, TradeStation, IBKR, or generic CSV/JSON
          </div>

          <SettingRow label="Choose file">
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleImport}
              disabled={importing}
              className="tf-input"
              style={{
                fontSize: 12, fontFamily: F, color: C.t2,
                padding: '8px 0',
              }}
            />
          </SettingRow>

          {importing && (
            <div style={{ fontSize: 12, color: C.b, fontFamily: M, marginBottom: 8 }}>
              Parsing file...
            </div>
          )}

          {importResult && (
            <AlertBanner ok={importResult.ok} message={importResult.message} />
          )}

          {importResult?.trades?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Btn onClick={confirmImport} style={{ fontSize: 12, padding: '8px 14px' }}>
                ✅ Confirm Import ({importResult.trades.length} trades)
              </Btn>
            </div>
          )}
        </div>
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4: INTEGRATIONS
// ═══════════════════════════════════════════════════════════════════

function IntegrationsSection() {
  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="🔌"
        title="Integrations"
        description="API keys, data sources, and cloud sync"
      />
      <ApiKeySettings />
      <div style={{ marginTop: 16 }}>
        <CloudSyncSection />
      </div>
    </section>
  );
}

// ─── API Key Settings ───────────────────────────────────────────

function ApiKeySettings() {
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
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
        Market Data Providers
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>
        Add API keys to unlock premium data sources. Crypto data works without keys.
      </div>

      {/* Provider Status */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {Object.entries(providers).map(([id, p]) => (
          <StatusBadge key={id} ok={p.hasKey || !p.needsKey} label={p.name} />
        ))}
      </div>

      {/* Polygon.io */}
      <SettingRow label="Polygon.io API Key" hint="Free tier: 5 req/min, delayed equities · polygon.io/dashboard/signup">
        <input
          type="password"
          value={polygonKey}
          onChange={(e) => setPolygonKey(e.target.value)}
          placeholder="Enter Polygon.io API key..."
          style={inputStyle}
        />
      </SettingRow>

      {/* Alpha Vantage */}
      <SettingRow label="Alpha Vantage API Key" hint="Free tier: 25 req/day · alphavantage.co/support/#api-key">
        <input
          type="password"
          value={avKey}
          onChange={(e) => setAvKey(e.target.value)}
          placeholder="Enter Alpha Vantage API key..."
          style={inputStyle}
        />
      </SettingRow>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Btn onClick={handleSave} style={{ fontSize: 12, padding: '8px 16px' }}>
          Save API Keys
        </Btn>
        {saved && <span style={{ fontSize: 12, color: C.g, fontWeight: 600 }}>✓ Saved</span>}
      </div>
    </Card>
  );
}

// ─── Cloud Sync Section ─────────────────────────────────────────

function CloudSyncSection() {
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
    setAuthMsg({ ok: true, text: 'Supabase configured.' });
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
    setAuthMsg({ ok: true, text: 'Signed out. Local-only mode.' });
  };

  const handleSync = async () => {
    setBusy(true);
    const result = await sync();
    setBusy(false);
    setSyncMsg({
      ok: result.ok,
      text: result.ok
        ? `Synced: ${result.pushed} pushed, ${result.pulled} pulled.`
        : `Sync errors: ${result.errors.join(', ')}`,
    });
  };

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>
        ☁️ Cloud Sync
      </div>
      <div style={{ fontSize: 11, color: C.t3, marginBottom: 14 }}>
        Connect your own Supabase project to sync trades across devices. Everything works locally without this.
      </div>

      {!auth.isAuthenticated ? (
        <>
          {/* Supabase Config */}
          <SettingRow label="Supabase Project URL">
            <input
              type="text"
              value={supaUrl}
              onChange={(e) => setSupaUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              style={inputStyle}
            />
          </SettingRow>
          <SettingRow label="Supabase Anon Key">
            <input
              type="password"
              value={supaKey}
              onChange={(e) => setSupaKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              style={inputStyle}
            />
          </SettingRow>
          <Btn onClick={handleConfigure} style={{ fontSize: 12, padding: '7px 14px', marginBottom: 16 }}>
            Configure
          </Btn>

          {/* Auth */}
          <div style={{ paddingTop: 16, borderTop: `1px solid ${C.bd}` }}>
            <SettingRow label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
            </SettingRow>
            <SettingRow label="Password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
            </SettingRow>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={handleSignIn} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>
                {busy ? '...' : 'Sign In'}
              </Btn>
              <Btn variant="ghost" onClick={handleSignUp} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>
                Sign Up
              </Btn>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Authenticated status */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '12px 16px', background: C.sf2, borderRadius: radii.md,
            marginBottom: 16,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: syncStatus.isCloudEnabled ? C.g : C.t3,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
                {auth.user?.email || 'Authenticated'}
              </div>
              <div style={{ fontSize: 11, color: C.t3, fontFamily: M }}>
                {syncStatus.pending > 0 ? `${syncStatus.pending} pending writes` : 'All synced'}
                {syncStatus.lastSync && ` · Last sync: ${new Date(syncStatus.lastSync).toLocaleTimeString()}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={handleSync} disabled={busy} style={{ fontSize: 12, padding: '8px 14px' }}>
              {busy ? 'Syncing...' : '🔄 Sync Now'}
            </Btn>
            <Btn variant="ghost" onClick={handleSignOut} style={{ fontSize: 12, padding: '8px 14px' }}>
              Sign Out
            </Btn>
          </div>
        </>
      )}

      <AlertBanner ok={authMsg?.ok} message={authMsg?.text} />
      <AlertBanner ok={syncMsg?.ok} message={syncMsg?.text} />
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 5: PROFILE
// ═══════════════════════════════════════════════════════════════════

const AVATAR_OPTIONS = [
  '🔥', '🐂', '🐻', '🦈', '🦅', '🐺', '🦁', '🐲',
  '🦊', '🎯', '💎', '⚡', '🌊', '🏔️', '🎲', '🧠',
];

function ProfileSection() {
  const myProfile = useSocialStore((s) => s.myProfile);
  const loadMyProfile = useSocialStore((s) => s.loadMyProfile);
  const updateMyProfile = useSocialStore((s) => s.updateMyProfile);
  const [profileForm, setProfileForm] = useState({});

  useEffect(() => {
    loadMyProfile();
  }, [loadMyProfile]);

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
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="👤"
        title="Profile"
        description="Your community identity"
      />

      <Card style={{ padding: 20 }}>
        {/* Avatar picker */}
        <SettingRow label="Avatar">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AVATAR_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setProfileForm((f) => ({ ...f, avatar: emoji }))}
                className="tf-btn"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: `2px solid ${profileForm.avatar === emoji ? C.b : C.bd}`,
                  background: profileForm.avatar === emoji ? C.b + '15' : 'transparent',
                  fontSize: 16,
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
        </SettingRow>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <SettingRow label="Display Name">
            <input
              value={profileForm.displayName || ''}
              onChange={(e) => setProfileForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Your display name"
              maxLength={30}
              style={inputStyle}
            />
          </SettingRow>

          <SettingRow label="Username">
            <input
              value={profileForm.username || ''}
              onChange={(e) => setProfileForm((f) => ({ ...f, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
              placeholder="your_username"
              maxLength={20}
              style={{ ...inputStyle, fontFamily: M }}
            />
          </SettingRow>
        </div>

        <SettingRow label="Bio">
          <textarea
            value={profileForm.bio || ''}
            onChange={(e) => setProfileForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Trading style, experience, interests..."
            maxLength={150}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
          <div style={{ fontSize: 10, color: C.t3, textAlign: 'right', marginTop: 2, fontFamily: M }}>
            {(profileForm.bio || '').length}/150
          </div>
        </SettingRow>

        <Btn onClick={saveProfile} style={{ fontSize: 12, padding: '8px 16px' }}>
          Save Profile
        </Btn>
      </Card>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6: DANGER ZONE
// ═══════════════════════════════════════════════════════════════════

function DangerZoneSection() {
  const tradeCount = useTradeStore((s) => s.trades.length);

  const handleReset = () => {
    if (window.confirm('Reset all data to demo trades? This cannot be undone.')) {
      const demo = genDemoData();
      useTradeStore.getState().reset(demo.trades, demo.playbooks);
      useSettingsStore.getState().reset();
    }
  };

  return (
    <section style={{ marginBottom: 40 }}>
      <SectionHeader
        icon="⚠️"
        title="Danger Zone"
        description="Irreversible actions — proceed with caution"
      />

      <Card style={{
        padding: 20,
        border: `1px solid ${C.r}30`,
        background: C.r + '04',
      }}>
        {/* Reset to Demo */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 16,
          marginBottom: 16,
          borderBottom: `1px solid ${C.bd}`,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
              Reset to Demo Data
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              Replace all {tradeCount} trades with demo data. Cannot be undone.
            </div>
          </div>
          <Btn
            variant="danger"
            onClick={handleReset}
            style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}
          >
            Reset Data
          </Btn>
        </div>

        {/* Replay Onboarding */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>
              Replay Onboarding
            </div>
            <div style={{ fontSize: 12, color: C.t3, marginTop: 2 }}>
              Re-run the setup wizard and reset all dismissed tips.
            </div>
          </div>
          <Btn
            variant="ghost"
            onClick={() => {
              useOnboardingStore.getState().resetWizard();
              useOnboardingStore.getState().resetTips();
            }}
            style={{ fontSize: 12, padding: '8px 14px', flexShrink: 0 }}
          >
            Replay Setup
          </Btn>
        </div>
      </Card>
    </section>
  );
}
