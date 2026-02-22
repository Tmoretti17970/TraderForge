# TradeForge OS v11.1 — Setup & Launch Guide

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)

Verify:
```bash
node --version   # Should show v18+ or v20+
npm --version    # Should show 9+
```

---

## Quick Start (3 commands)

```bash
cd test1
npm install
npm run dev
```

Opens at **http://localhost:5173** with hot module replacement.

---

## All Launch Options

### Development (with HMR)
```bash
npm run dev                  # Vite dev server at :5173
npm run launch:dev           # Same, via start.js
node start.js --dev          # Same, explicit
```

### Production
```bash
npm run build                # Build optimized bundle
npm run serve                # Start production server at :5173
npm run launch               # Auto-builds + starts at :3000
node start.js                # Same
node start.js --port 8080    # Custom port
```

### Testing
```bash
npm test                     # Run all tests once
npm run test:watch           # Watch mode
npm run test:coverage        # Coverage report
npm run test:ui              # Vitest browser UI
```

### Code Quality
```bash
npm run lint                 # ESLint check
npm run lint:fix             # Auto-fix lint issues
npm run format               # Prettier format
npm run check                # lint + format + test
```

### Docker
```bash
npm run docker:build         # Build Docker image
npm run docker:run           # Run container at :3000
```

---

## Project Structure

```
test1/
├── start.js                 # One-command launcher
├── server.js                # Express production server (SSR + static)
├── package.json             # Dependencies & scripts
├── vite.config.js           # Vite build config (Sprint 11 optimized)
├── index.html               # App shell (Sprint 11 PWA fix)
│
├── src/
│   ├── App.jsx              # Root component
│   ├── main.jsx             # Client entry
│   ├── entry-server.jsx     # SSR entry
│   ├── constants.js         # Theme tokens, colors, fonts
│   │
│   ├── components/          # 64 UI components
│   │   ├── analytics/       # 6 analytics tab components
│   │   ├── chart/           # 6 chart-trade components
│   │   └── journal/         # 7 journal components
│   │
│   ├── pages/               # 6 main pages + 4 public SSR pages
│   │   └── public/
│   │
│   ├── state/               # 23 Zustand stores
│   ├── engine/              # 28 computation modules
│   ├── data/                # 16 data services
│   │   └── adapters/        # Binance, Yahoo adapters
│   ├── chartEngine/         # Custom chart rendering engine
│   │   ├── renderers/       # Candlestick, grid, volume
│   │   ├── data/            # LRU cache, data feeds
│   │   ├── indicators/      # SMA, EMA, RSI, MACD, etc.
│   │   ├── drawings/        # Drawing tools engine
│   │   └── ui/              # Chart UI components
│   ├── utils/               # 13 utility modules
│   ├── services/            # Auth, Broker sync
│   ├── api/                 # Express API routes
│   ├── seo/                 # SSR meta + sitemap
│   └── theme/               # Design tokens
│
├── tests/                   # 35 test files (~8,000 lines)
├── public/                  # Static assets (icons, manifest, SW)
└── docs/                    # Bundle analysis, architecture
```

---

## Environment Variables

Create `.env` from the example:
```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5173` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | `development` or `production` |

---

## Deployment

### Vercel (Recommended — Free tier)
```bash
npx vercel
```

### Fly.io
```bash
fly launch
fly deploy
```

### Railway / Render
Connect your Git repo — auto-detects Node.js and runs `npm run build && npm run serve`.

### Docker
```bash
docker build -t tradeforge .
docker run -p 3000:3000 tradeforge
```

---

## Sprint 11 Changes (Applied)

All Sprint 11 optimizations are pre-applied in this build:

- ✅ Zustand v5 compatibility fix (SettingsPage, MobileSettings)
- ✅ Lazy import retry with backoff (PageRouter)
- ✅ Card forwardRef fix (UIKit)
- ✅ WebSocket auto-reconnect with exponential backoff
- ✅ localStorage error handling (SyncUtils)
- ✅ Dashboard widget React.memo (all 7 widgets)
- ✅ PWA manifest icons (192×192, 512×512)
- ✅ chart.js lazy-loaded (68KB off initial bundle)
- ✅ Vite chunk splitting (chart.js, flexlayout, dexie)
- ✅ Enhanced onboarding wizard (TradingView import CTA)
- ✅ 35 test files with ~200 test cases
- ✅ 10K/50K candle performance benchmarks
