// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11.0 — Production Server
//
// Modes:
//   Development:  npm run dev        (Vite dev server, HMR)
//   Dev + SSR:    npm run dev:ssr    (This file + Vite middleware)
//   Production:   npm run build && npm run serve
//
// Features:
//   ✓ SSR for public/SEO pages (symbol, snapshot, leaderboard)
//   ✓ SPA fallback for authenticated app routes
//   ✓ Gzip/Brotli compression
//   ✓ Security headers
//   ✓ Static asset caching (1yr for hashed, no-cache for HTML)
//   ✓ Health check endpoint
//   ✓ Graceful shutdown
//   ✓ Request logging
//   ✓ Error handling
// ═══════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '5173', 10);
const HOST = process.env.HOST || '0.0.0.0';

// ─── App Setup ───────────────────────────────────────────────────
const app = express();

// Trust proxy (for Railway, Render, Fly, etc.)
app.set('trust proxy', 1);

// ─── Security Headers ────────────────────────────────────────────
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // CSP — permissive enough for Binance WebSocket + Google Fonts
  if (isProduction) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.binance.com wss://stream.binance.com:9443 https://api.coingecko.com https://query1.finance.yahoo.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; '));
  }

  next();
});

// ─── Compression ─────────────────────────────────────────────────
app.use(compression({
  level: 6,
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// ─── Request Logging ─────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
    // Only log non-asset requests or slow requests
    if (!req.url.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/) || ms > 500) {
      console.log(`${color}${status}\x1b[0m ${req.method} ${req.url} \x1b[90m${ms}ms\x1b[0m`);
    }
  });
  next();
});

// ─── Health Check ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '11.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    timestamp: new Date().toISOString(),
  });
});

// ─── API Routes Placeholder ──────────────────────────────────────
// Mount your API routes here when ready:
// import { apiRouter } from './src/api/routes.js';
// app.use('/api', apiRouter);

// ═══════════════════════════════════════════════════════════════════
// Production Mode
// ═══════════════════════════════════════════════════════════════════
if (isProduction) {
  const distClient = path.join(__dirname, 'dist/client');
  const distServer = path.join(__dirname, 'dist/server');

  // Verify build exists
  if (!fs.existsSync(distClient)) {
    console.error('\x1b[31m✗ Build not found. Run: npm run build\x1b[0m');
    process.exit(1);
  }

  // Read index.html template
  const template = fs.readFileSync(path.join(distClient, 'index.html'), 'utf-8');

  // Load SSR module
  let ssrRender = null;
  const ssrEntry = path.join(distServer, 'entry-server.js');
  if (fs.existsSync(ssrEntry)) {
    try {
      const ssrModule = await import(ssrEntry);
      ssrRender = ssrModule.render;
      console.log('✓ SSR module loaded');
    } catch (err) {
      console.warn('⚠ SSR module failed to load, falling back to SPA mode:', err.message);
    }
  }

  // ─── Static Assets (hashed = immutable cache) ──────────
  app.use('/assets', express.static(path.join(distClient, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: false,
  }));

  // ─── Other Static Files (icons, manifest, sw.js) ───────
  app.use(express.static(distClient, {
    maxAge: '1h',
    index: false, // Don't serve index.html for /
  }));

  // ─── Service Worker (no-cache — must always be fresh) ──
  app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(distClient, 'sw.js'));
  });

  // ─── All Routes → SSR or SPA Fallback ──────────────────
  app.get('*', async (req, res) => {
    try {
      let html = template;

      // Try SSR for public/SEO pages
      if (ssrRender) {
        const ssrResult = await ssrRender(req.originalUrl);

        if (ssrResult.redirect) {
          return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
        }

        if (ssrResult.html) {
          html = html.replace('<!--ssr-outlet-->', ssrResult.html);
        }
        if (ssrResult.head) {
          html = html.replace('<!--ssr-head-->', ssrResult.head);
        }

        res.status(ssrResult.statusCode || 200);
      }

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(html);
    } catch (err) {
      console.error('SSR render error:', err);
      // Fallback: serve SPA shell
      res.status(200)
        .setHeader('Content-Type', 'text/html')
        .send(template);
    }
  });

// ═══════════════════════════════════════════════════════════════════
// Development Mode (with Vite middleware)
// ═══════════════════════════════════════════════════════════════════
} else {
  const { createServer: createViteServer } = await import('vite');

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Use Vite's middleware for HMR, module transforms, etc.
  app.use(vite.middlewares);

  // All routes → SSR with Vite transforms
  app.get('*', async (req, res) => {
    try {
      // Read fresh template (Vite transforms it)
      let template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(req.originalUrl, template);

      // Load SSR module through Vite (gets HMR)
      const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');
      const ssrResult = await render(req.originalUrl);

      if (ssrResult.redirect) {
        return res.redirect(ssrResult.statusCode || 302, ssrResult.redirect);
      }

      let html = template;
      if (ssrResult.html) {
        html = html.replace('<!--ssr-outlet-->', ssrResult.html);
      }
      if (ssrResult.head) {
        html = html.replace('<!--ssr-head-->', ssrResult.head);
      }

      res.status(ssrResult.statusCode || 200)
        .setHeader('Content-Type', 'text/html')
        .send(html);
    } catch (err) {
      vite.ssrFixStacktrace(err);
      console.error('Dev SSR error:', err);
      res.status(500).send(`
        <pre style="color:red;font-family:monospace;padding:2em;white-space:pre-wrap">
          ${err.stack || err.message}
        </pre>
      `);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════
const server = app.listen(PORT, HOST, () => {
  const mode = isProduction ? '\x1b[32mproduction\x1b[0m' : '\x1b[33mdevelopment\x1b[0m';
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║         TradeForge OS v11.0              ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  → Mode:    ${mode}`);
  console.log(`  → Local:   \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`  → Network: \x1b[36mhttp://${HOST}:${PORT}\x1b[0m`);
  console.log('');
  if (!isProduction) {
    console.log('  \x1b[90mHMR enabled. Edit files and see changes instantly.\x1b[0m');
    console.log('');
  }
});

// ─── Graceful Shutdown ───────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n\x1b[33m${signal} received. Shutting down gracefully...\x1b[0m`);
  server.close(() => {
    console.log('\x1b[32m✓ Server closed\x1b[0m');
    process.exit(0);
  });
  // Force kill after 10s
  setTimeout(() => {
    console.error('\x1b[31m✗ Forced shutdown after timeout\x1b[0m');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ─── Unhandled Errors ────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('\x1b[31mUnhandled Promise Rejection:\x1b[0m', err);
});

process.on('uncaughtException', (err) => {
  console.error('\x1b[31mUncaught Exception:\x1b[0m', err);
  process.exit(1);
});
