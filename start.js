#!/usr/bin/env node

// ═══════════════════════════════════════════════════════════════════
// TradeForge OS v11.1 — Quick Launch Script
//
// Usage:
//   node start.js              → Production mode (port 3000)
//   node start.js --dev        → Development mode with HMR (port 5173)
//   node start.js --port 8080  → Custom port
//
// Prerequisites:
//   1. Node.js >= 18
//   2. npm install
//   3. npm run build  (for production mode)
// ═══════════════════════════════════════════════════════════════════

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const isDev = args.includes('--dev') || args.includes('-d');
const portArg = args.find((a, i) => args[i - 1] === '--port');
const PORT = portArg || (isDev ? '5173' : '3000');

// ─── ASCII Banner ────────────────────────────────────────────
console.log('');
console.log('  \x1b[38;5;208m╔══════════════════════════════════════════╗\x1b[0m');
console.log('  \x1b[38;5;208m║\x1b[0m  🔥 TradeForge OS v11.1                  \x1b[38;5;208m║\x1b[0m');
console.log('  \x1b[38;5;208m║\x1b[0m  Professional Trading Journal & Analytics \x1b[38;5;208m║\x1b[0m');
console.log('  \x1b[38;5;208m╚══════════════════════════════════════════╝\x1b[0m');
console.log('');

// ─── Check Node.js version ───────────────────────────────────
const nodeVersion = parseInt(process.version.slice(1));
if (nodeVersion < 18) {
  console.error('\x1b[31m✗ Node.js 18+ required. Current:', process.version, '\x1b[0m');
  process.exit(1);
}

// ─── Check dependencies ─────────────────────────────────────
if (!fs.existsSync(path.join(__dirname, 'node_modules'))) {
  console.log('\x1b[33m⏳ Installing dependencies...\x1b[0m');
  try {
    execSync('npm install', { cwd: __dirname, stdio: 'inherit' });
    console.log('\x1b[32m✓ Dependencies installed\x1b[0m\n');
  } catch (err) {
    console.error('\x1b[31m✗ npm install failed\x1b[0m');
    process.exit(1);
  }
}

if (isDev) {
  // ─── Development Mode ──────────────────────────────────────
  console.log(`\x1b[33m→ Development mode\x1b[0m`);
  console.log(`\x1b[36m→ http://localhost:${PORT}\x1b[0m`);
  console.log('\x1b[90m  HMR enabled — edits reflect instantly\x1b[0m');
  console.log('');

  const child = spawn('npx', ['vite', '--port', PORT, '--open'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
    shell: true,
  });

  child.on('error', (err) => {
    console.error('\x1b[31m✗ Failed to start Vite:\x1b[0m', err.message);
  });

} else {
  // ─── Production Mode ───────────────────────────────────────
  const distDir = path.join(__dirname, 'dist', 'client');

  if (!fs.existsSync(distDir)) {
    console.log('\x1b[33m⏳ Building for production...\x1b[0m');
    try {
      execSync('npm run build', { cwd: __dirname, stdio: 'inherit' });
      console.log('\x1b[32m✓ Build complete\x1b[0m\n');
    } catch (err) {
      console.error('\x1b[31m✗ Build failed. Check errors above.\x1b[0m');
      process.exit(1);
    }
  }

  console.log(`\x1b[32m→ Production mode\x1b[0m`);
  console.log(`\x1b[36m→ http://localhost:${PORT}\x1b[0m`);
  console.log('');

  const child = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production', PORT },
  });

  child.on('error', (err) => {
    console.error('\x1b[31m✗ Failed to start server:\x1b[0m', err.message);
  });
}
