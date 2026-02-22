// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v10 — Enhanced Onboarding Wizard
//
// 5-step modal for new users:
//   0: Welcome — what TradeForge does
//   1: Account & Risk Setup — account size, risk %, loss limit
//   2: Broker Selection — pick broker for auto-CSV import
//   3: Personalize — theme, default chart type
//   4: Ready — feature tour + quick-start links
//
// Shows on first boot when wizardComplete === false.
// Can be re-triggered from Settings.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { C, F, M } from '../constants.js';
import { space, radii, text, transition, preset } from '../theme/tokens.js';
import { useOnboardingStore } from '../state/useOnboardingStore.js';
import { useSettingsStore } from '../state/useSettingsStore.js';
import { useUIStore } from '../state/useUIStore.js';
import { useThemeStore } from '../state/useThemeStore.js';
import { Btn } from './UIKit.jsx';

const STEPS = [
  { title: 'Welcome to TradeForge', icon: '🔥', subtitle: 'Your trading journal starts here' },
  { title: 'Account Setup', icon: '⚙️', subtitle: 'Configure your risk parameters' },
  { title: 'Your Broker', icon: '🏦', subtitle: 'For seamless trade imports' },
  { title: 'Personalize', icon: '🎨', subtitle: 'Make it yours' },
  { title: "You're All Set!", icon: '🚀', subtitle: 'Start tracking your edge' },
];

export default function OnboardingWizard() {
  const wizardComplete = useOnboardingStore((s) => s.wizardComplete);
  const wizardStep = useOnboardingStore((s) => s.wizardStep);
  const setWizardStep = useOnboardingStore((s) => s.setWizardStep);
  const completeWizard = useOnboardingStore((s) => s.completeWizard);

  // Slide animation state
  const [animDir, setAnimDir] = useState(0); // -1 = left, 1 = right, 0 = none
  const [animating, setAnimating] = useState(false);
  const contentRef = useRef(null);

  const goNext = useCallback(() => {
    if (wizardStep >= STEPS.length - 1 || animating) return;
    setAnimDir(1);
    setAnimating(true);
    setTimeout(() => {
      setWizardStep(wizardStep + 1);
      setAnimDir(0);
      setAnimating(false);
    }, 200);
  }, [wizardStep, animating, setWizardStep]);

  const goBack = useCallback(() => {
    if (wizardStep <= 0 || animating) return;
    setAnimDir(-1);
    setAnimating(true);
    setTimeout(() => {
      setWizardStep(wizardStep - 1);
      setAnimDir(0);
      setAnimating(false);
    }, 200);
  }, [wizardStep, animating, setWizardStep]);

  if (wizardComplete || wizardStep < 0) return null;

  const slideStyle = animating
    ? { transform: `translateX(${animDir * -30}px)`, opacity: 0, transition: 'all 0.2s ease' }
    : { transform: 'translateX(0)', opacity: 1, transition: 'all 0.2s ease' };

  return (
    <>
      {/* Backdrop */}
      <div className="tf-modal-backdrop" style={{ ...preset.overlay, backdropFilter: 'blur(6px)' }} />

      {/* Modal */}
      <div className="tf-modal-content" style={{
        ...preset.modal,
        width: 500,
        maxWidth: '94vw',
        padding: 0,
        overflow: 'hidden',
      }}>
        {/* Progress dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          padding: `${space[4]}px ${space[6]}px 0`,
        }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === wizardStep ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === wizardStep
                  ? `linear-gradient(90deg, ${C.b}, #f0b64e)`
                  : i < wizardStep ? C.b + '60' : C.bd,
                transition: 'all 0.3s ease',
                cursor: i < wizardStep ? 'pointer' : 'default',
              }}
              onClick={() => i < wizardStep && setWizardStep(i)}
            />
          ))}
        </div>

        {/* Content area */}
        <div ref={contentRef} style={{ padding: `${space[5]}px ${space[6]}px ${space[4]}px`, minHeight: 320 }}>
          <div style={slideStyle}>
            {/* Step icon + title */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[3],
              marginBottom: space[1],
            }}>
              <span style={{ fontSize: 28 }}>{STEPS[wizardStep].icon}</span>
              <div>
                <h2 style={{ ...text.h2, margin: 0 }}>{STEPS[wizardStep].title}</h2>
                <div style={{ ...text.captionSm, marginTop: 2 }}>{STEPS[wizardStep].subtitle}</div>
              </div>
            </div>

            <div style={{ marginTop: space[4] }}>
              {wizardStep === 0 && <StepWelcome />}
              {wizardStep === 1 && <StepAccountSetup />}
              {wizardStep === 2 && <StepBrokerSelect />}
              {wizardStep === 3 && <StepPersonalize />}
              {wizardStep === 4 && <StepComplete />}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${space[3]}px ${space[6]}px ${space[5]}px`,
          borderTop: `1px solid ${C.bd}`,
        }}>
          {wizardStep > 0 ? (
            <button
              onClick={goBack}
              className="tf-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.t3,
                fontSize: 13,
                fontFamily: F,
                cursor: 'pointer',
                padding: '8px 14px',
                borderRadius: radii.sm,
              }}
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={completeWizard}
              className="tf-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: C.t3,
                fontSize: 12,
                fontFamily: F,
                cursor: 'pointer',
                padding: '8px 14px',
              }}
            >
              Skip setup
            </button>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            {wizardStep > 0 && wizardStep < STEPS.length - 1 && (
              <button className="tf-btn"
                onClick={() => { setWizardStep(wizardStep + 1); }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.t3,
                  fontSize: 11,
                  fontFamily: F,
                  cursor: 'pointer',
                  padding: '6px 12px',
                }}
              >
                Skip
              </button>
            )}
            {wizardStep < STEPS.length - 1 ? (
              <Btn onClick={goNext}>Continue →</Btn>
            ) : (
              <Btn onClick={completeWizard}>Start Trading →</Btn>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Step 0: Welcome ─────────────────────────────────────────────

function StepWelcome() {
  return (
    <div>
      <p style={{ ...text.body, marginBottom: space[4] }}>
        TradeForge is your all-in-one trading journal and analytics platform.
        Track every trade, find your edge, and build disciplined habits.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        <FeatureHighlight
          icon="📒"
          title="Journal & Analytics"
          desc="Log trades with emotions, strategies, and notes. Get deep performance insights."
        />
        <FeatureHighlight
          icon="📈"
          title="Interactive Charts"
          desc="Real-time charts with drawing tools, indicators, and trade overlays."
        />
        <FeatureHighlight
          icon="🎯"
          title="Risk Management"
          desc="Position sizing, Kelly criterion, daily loss limits, and rule enforcement."
        />
        <FeatureHighlight
          icon="🧠"
          title="Intelligence Layer"
          desc="Pattern recognition, strategy playbooks, and psychology tracking."
        />
        <FeatureHighlight
          icon="📋"
          title="Playbook System"
          desc="Define strategies, track performance per playbook, and find your edge."
        />
      </div>
    </div>
  );
}

// ─── Step 1: Account Setup ───────────────────────────────────────

function StepAccountSetup() {
  const updateSettings = useSettingsStore((s) => s.update);
  const accountSize = useSettingsStore((s) => s.accountSize);
  const riskPerTrade = useSettingsStore((s) => s.riskPerTrade);
  const dailyLossLimit = useSettingsStore((s) => s.dailyLossLimit);

  return (
    <div>
      <p style={{ ...text.bodySm, marginBottom: space[4] }}>
        Configure your account to get personalized analytics and risk calculations.
        You can change these anytime in Settings.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
        <SettingInput
          label="Account Size ($)"
          value={accountSize || ''}
          placeholder="e.g. 10000"
          onChange={(v) => updateSettings({ accountSize: Number(v) || 0 })}
        />
        <SettingInput
          label="Risk Per Trade (%)"
          value={riskPerTrade || ''}
          placeholder="e.g. 1"
          onChange={(v) => updateSettings({ riskPerTrade: Number(v) || 0 })}
        />
        <SettingInput
          label="Daily Loss Limit ($)"
          value={dailyLossLimit || ''}
          placeholder="e.g. 500"
          onChange={(v) => updateSettings({ dailyLossLimit: Number(v) || 0 })}
        />
      </div>

      <p style={{ ...text.captionSm, marginTop: space[3], fontStyle: 'italic' }}>
        All data stays local in your browser. Nothing is sent to a server.
      </p>
    </div>
  );
}

// ─── Step 2: Broker Selection ────────────────────────────────────

const BROKERS = [
  { id: 'thinkorswim', label: 'TD Ameritrade / thinkorswim', icon: '🟢' },
  { id: 'tradovate', label: 'Tradovate / NinjaTrader', icon: '🔵' },
  { id: 'interactive', label: 'Interactive Brokers', icon: '🔴' },
  { id: 'webull', label: 'Webull', icon: '🟠' },
  { id: 'robinhood', label: 'Robinhood', icon: '🟡' },
  { id: 'tradezero', label: 'TradeZero', icon: '⚪' },
  { id: 'metatrader', label: 'MetaTrader 4/5', icon: '🟣' },
  { id: 'other', label: 'Other / Manual Entry', icon: '📋' },
];

function StepBrokerSelect() {
  const updateSettings = useSettingsStore((s) => s.update);
  const broker = useSettingsStore((s) => s.broker);

  return (
    <div>
      <p style={{ ...text.bodySm, marginBottom: space[4] }}>
        Select your broker so TradeForge can auto-detect your CSV format when importing trades.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: space[2],
      }}>
        {BROKERS.map((b) => (
          <button className="tf-btn"
            key={b.id}
            onClick={() => updateSettings({ broker: b.id })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[2],
              padding: `${space[2]}px ${space[3]}px`,
              background: broker === b.id ? C.b + '15' : C.sf2,
              border: `1.5px solid ${broker === b.id ? C.b : C.bd + '60'}`,
              borderRadius: radii.md,
              color: broker === b.id ? C.b : C.t2,
              fontSize: 12,
              fontFamily: F,
              fontWeight: broker === b.id ? 600 : 400,
              cursor: 'pointer',
              transition: `all ${transition.base}`,
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{b.icon}</span>
            <span style={{ lineHeight: 1.2 }}>{b.label}</span>
          </button>
        ))}
      </div>

      <p style={{ ...text.captionSm, marginTop: space[3] }}>
        Don't see your broker? Choose "Other" — you can still import CSVs manually.
      </p>
    </div>
  );
}

// ─── Step 3: Personalize ─────────────────────────────────────────

function StepPersonalize() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const updateSettings = useSettingsStore((s) => s.update);
  const defaultChartType = useSettingsStore((s) => s.defaultChartType);

  const CHART_TYPES = [
    { id: 'candles', label: 'Candlestick', icon: '🕯️' },
    { id: 'heikinashi', label: 'Heikin-Ashi', icon: '📊' },
    { id: 'line', label: 'Line', icon: '📈' },
    { id: 'area', label: 'Area', icon: '📉' },
  ];

  return (
    <div>
      {/* Theme selector */}
      <div style={{ marginBottom: space[5] }}>
        <div style={{ ...text.label, marginBottom: space[2] }}>Theme</div>
        <div style={{ display: 'flex', gap: space[3] }}>
          <ThemeOption
            label="Dark"
            icon="🌙"
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
            colors={[C.bg, C.sf, C.b]}
          />
          <ThemeOption
            label="Light"
            icon="☀️"
            active={theme === 'light'}
            onClick={() => setTheme('light')}
            colors={[C.bg, C.t1, C.bH]}
          />
        </div>
      </div>

      {/* Chart type selector */}
      <div>
        <div style={{ ...text.label, marginBottom: space[2] }}>Default Chart Type</div>
        <div style={{ display: 'flex', gap: space[2] }}>
          {CHART_TYPES.map((ct) => (
            <button className="tf-btn"
              key={ct.id}
              onClick={() => updateSettings({ defaultChartType: ct.id })}
              style={{
                flex: 1,
                padding: `${space[2]}px ${space[2]}px`,
                background: (defaultChartType || 'candles') === ct.id ? C.b + '15' : C.sf2,
                border: `1.5px solid ${(defaultChartType || 'candles') === ct.id ? C.b : C.bd + '60'}`,
                borderRadius: radii.md,
                color: (defaultChartType || 'candles') === ct.id ? C.b : C.t2,
                fontSize: 11,
                fontFamily: F,
                fontWeight: (defaultChartType || 'candles') === ct.id ? 600 : 400,
                cursor: 'pointer',
                transition: `all ${transition.base}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontSize: 18 }}>{ct.icon}</span>
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <p style={{ ...text.captionSm, marginTop: space[4] }}>
        Press T anytime to toggle theme. Access all settings from the sidebar.
      </p>
    </div>
  );
}

function ThemeOption({ label, icon, active, onClick, colors }) {
  return (
    <button className="tf-btn"
      onClick={onClick}
      style={{
        flex: 1,
        padding: space[3],
        background: active ? C.b + '10' : 'transparent',
        border: `2px solid ${active ? C.b : C.bd}`,
        borderRadius: radii.lg,
        cursor: 'pointer',
        transition: `all ${transition.base}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: space[2],
      }}
    >
      {/* Mini theme preview */}
      <div style={{
        width: '100%',
        height: 48,
        borderRadius: radii.sm,
        background: colors[0],
        border: `1px solid ${colors[2]}30`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        overflow: 'hidden',
      }}>
        <div style={{ width: 20, height: 32, borderRadius: 3, background: colors[1], opacity: 0.7 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 6px' }}>
          <div style={{ height: 3, width: '80%', borderRadius: 2, background: colors[2], opacity: 0.5 }} />
          <div style={{ height: 3, width: '60%', borderRadius: 2, background: colors[2], opacity: 0.3 }} />
          <div style={{ height: 3, width: '70%', borderRadius: 2, background: colors[2], opacity: 0.2 }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, fontFamily: F, color: active ? C.b : C.t2 }}>
          {label}
        </span>
      </div>
    </button>
  );
}

// ─── Step 4: Complete ────────────────────────────────────────────

function StepComplete() {
  const setPage = useUIStore((s) => s.setPage);
  const completeWizard = useOnboardingStore((s) => s.completeWizard);
  const [showingTip, setShowingTip] = useState(null);

  const quickActions = [
    {
      id: 'import',
      icon: '📊',
      title: 'Import from TradingView',
      desc: 'Export your TradingView trades as CSV, then import them here. All standard TradingView export formats are auto-detected.',
      cta: 'Import CSV',
      action: () => { completeWizard(); setPage('journal'); },
      highlight: true,
    },
    {
      id: 'log',
      icon: '📒',
      title: 'Log Your First Trade',
      desc: 'Start fresh — manually log a trade in under 30 seconds. The more you log, the sharper your insights.',
      cta: 'Open Journal',
      action: () => { completeWizard(); setPage('journal'); },
    },
    {
      id: 'chart',
      icon: '📈',
      title: 'Explore Charts',
      desc: 'Real-time crypto charts with drawing tools, indicators, and pattern detection. Press D for drawings, I for indicators.',
      cta: 'Open Charts',
      action: () => { completeWizard(); setPage('charts'); },
    },
  ];

  return (
    <div>
      <p style={{ ...text.body, marginBottom: space[3] }}>
        You're all set! Pick your first action:
      </p>

      {/* TradingView import — prominent CTA */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: space[2], marginBottom: space[4],
      }}>
        {quickActions.map((qa) => (
          <button
            key={qa.id}
            onClick={qa.action}
            onMouseEnter={() => setShowingTip(qa.id)}
            onMouseLeave={() => setShowingTip(null)}
            style={{
              display: 'flex', gap: space[3], padding: space[3],
              background: qa.highlight ? `${C.b}15` : C.sf2,
              borderRadius: radii.md,
              border: qa.highlight ? `1.5px solid ${C.b}60` : `1px solid ${C.bd}40`,
              cursor: 'pointer', textAlign: 'left',
              transition: transition.fast,
              transform: showingTip === qa.id ? 'translateY(-1px)' : 'none',
              boxShadow: showingTip === qa.id ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            <span style={{ fontSize: 22, flexShrink: 0 }}>{qa.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ ...text.h3, fontSize: 12, marginBottom: 2, color: qa.highlight ? C.b : C.t1 }}>
                {qa.title}
                {qa.highlight && (
                  <span style={{
                    marginLeft: 8, fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', borderRadius: radii.sm,
                    background: C.b, color: '#fff', verticalAlign: 'middle',
                  }}>RECOMMENDED</span>
                )}
              </div>
              <div style={text.bodyXs}>{qa.desc}</div>
            </div>
            <span style={{
              alignSelf: 'center', fontSize: 11, fontWeight: 700, fontFamily: F,
              color: C.b, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {qa.cta} →
            </span>
          </button>
        ))}
      </div>

      {/* Keyboard shortcuts teaser */}
      <div style={{
        padding: space[3], background: C.sf2, borderRadius: radii.md,
        border: `1px solid ${C.bd}40`,
      }}>
        <div style={{ ...text.h3, fontSize: 11, marginBottom: space[2] }}>⌨️ Quick Keys</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${space[1]}px ${space[4]}px` }}>
          {[
            ['⌘K / Ctrl+K', 'Command palette'],
            ['N', 'New trade'],
            ['D', 'Drawing tools'],
            ['I', 'Indicators panel'],
            ['1–5', 'Switch pages'],
            ['⌘Z', 'Undo last action'],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <kbd style={{
                fontSize: 9, fontFamily: M, padding: '1px 5px', borderRadius: 3,
                background: C.sf3, border: `1px solid ${C.bd}`, color: C.t2,
                whiteSpace: 'nowrap',
              }}>{key}</kbd>
              <span style={{ ...text.bodyXs, color: C.t2 }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared Sub-components ───────────────────────────────────────

function FeatureHighlight({ icon, title, desc }) {
  return (
    <div style={{
      display: 'flex',
      gap: space[3],
      padding: space[3],
      background: C.sf2,
      borderRadius: radii.md,
      border: `1px solid ${C.bd}40`,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ ...text.h3, fontSize: 12, marginBottom: 2 }}>{title}</div>
        <div style={text.bodyXs}>{desc}</div>
      </div>
    </div>
  );
}

function SettingInput({ label, value, placeholder, onChange }) {
  return (
    <div>
      <label style={{ ...text.label, display: 'block', marginBottom: space[1] }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...preset.input, fontFamily: M }}
      />
    </div>
  );
}
