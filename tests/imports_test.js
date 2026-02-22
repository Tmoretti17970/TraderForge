// ═══════════════════════════════════════════════════════════════════
// TradeForge — Import Health Tests
// Automated sweep: no broken imports, no unused imports, brackets OK.
// ═══════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

var SRC = path.resolve('src');

function getAllFiles(dir) {
  var results = [];
  var entries = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
}

function resolveImport(fromFile, importPath) {
  var dir = path.dirname(fromFile);
  var resolved = path.resolve(dir, importPath);
  var candidates = [
    resolved,
    resolved + '.js',
    resolved + '.jsx',
    path.join(resolved, 'index.js'),
    path.join(resolved, 'index.jsx'),
  ];
  for (var j = 0; j < candidates.length; j++) {
    if (fs.existsSync(candidates[j])) return true;
  }
  return false;
}

// ─── Broken imports ──────────────────────────────────────────────
describe('Import health — no broken imports', function () {
  it('has source files to check', function () {
    var files = getAllFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
  });

  it('all relative imports resolve to existing files', function () {
    var files = getAllFiles(SRC);
    var broken = [];
    var importRe = /from\s+['"](\.[^'"]+)['"]/g;

    for (var i = 0; i < files.length; i++) {
      var content = fs.readFileSync(files[i], 'utf-8');
      var match;
      while ((match = importRe.exec(content)) !== null) {
        if (!resolveImport(files[i], match[1])) {
          broken.push(path.relative(SRC, files[i]) + ': ' + match[1]);
        }
      }
      importRe.lastIndex = 0;
    }

    expect(broken).toEqual([]);
  });
});

// ─── Unused named imports ────────────────────────────────────────
describe('Import health — no unused imports', function () {
  it('no named imports are unused', function () {
    var files = getAllFiles(SRC);
    var unused = [];
    var namedRe = /import\s+\x7b([^\x7d]+)\x7d\s+from\s+['"][^'"]+['"]/g;

    for (var i = 0; i < files.length; i++) {
      var content = fs.readFileSync(files[i], 'utf-8');
      var match;
      while ((match = namedRe.exec(content)) !== null) {
        var names = match[1].split(',');
        for (var j = 0; j < names.length; j++) {
          var raw = names[j].trim();
          if (!raw) continue;
          var parts = raw.split(' as ');
          var name = parts[parts.length - 1].trim();
          if (!name) continue;
          // Escape special regex chars in name
          var escaped = name.replace(/[.*+?^$|\\]/g, '\\$&');
          var uses = content.split(new RegExp('\\b' + escaped + '\\b')).length - 1;
          if (uses <= 1) {
            unused.push(path.relative(SRC, files[i]) + ': ' + name);
          }
        }
      }
      namedRe.lastIndex = 0;
    }

    expect(unused).toEqual([]);
  });
});

// ─── Bracket balance ─────────────────────────────────────────────
describe('Import health — bracket balance', function () {
  it('all JSX files have balanced brackets', function () {
    var files = getAllFiles(SRC).filter(function (f) { return f.endsWith('.jsx'); });
    var broken = [];

    for (var i = 0; i < files.length; i++) {
      var content = fs.readFileSync(files[i], 'utf-8');
      // Strip string contents to avoid false positives from bracket chars in strings
      var stripped = content.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``');
      var pairs = [['(', ')'], ['{', '}'], ['[', ']']];
      for (var j = 0; j < pairs.length; j++) {
        var oc = stripped.split(pairs[j][0]).length - 1;
        var cc = stripped.split(pairs[j][1]).length - 1;
        if (oc !== cc) {
          var rel = path.relative(SRC, files[i]);
          if (rel.indexOf('ScriptEngine') === -1) {
            broken.push(rel + ': ' + pairs[j][0] + ' ' + oc + ' vs ' + cc);
          }
        }
      }
    }

    expect(broken).toEqual([]);
  });
});

// ─── Dead code quarantine ────────────────────────────────────────
describe('Dead code quarantine', function () {
  it('quarantined files are not imported from src/', function () {
    var deadDir = path.resolve('.dead-code');
    if (!fs.existsSync(deadDir)) return;

    var deadNames = [];
    function walkDead(dir) {
      var entries = fs.readdirSync(dir, { withFileTypes: true });
      for (var i = 0; i < entries.length; i++) {
        var full = path.join(dir, entries[i].name);
        if (entries[i].isDirectory()) {
          walkDead(full);
        } else {
          var base = entries[i].name.replace(/\.jsx?$/, '');
          deadNames.push(base);
        }
      }
    }
    walkDead(deadDir);

    var srcFiles = getAllFiles(SRC);
    var violations = [];
    for (var i = 0; i < srcFiles.length; i++) {
      var content = fs.readFileSync(srcFiles[i], 'utf-8');
      for (var j = 0; j < deadNames.length; j++) {
        if (content.indexOf('/' + deadNames[j] + "'") !== -1 ||
            content.indexOf('/' + deadNames[j] + '"') !== -1 ||
            content.indexOf('/' + deadNames[j] + '.') !== -1) {
          // Verify it's actually an import line
          var importCheck = "from.*/" + deadNames[j];
          if (new RegExp(importCheck).test(content)) {
            violations.push(path.relative(SRC, srcFiles[i]) + ' imports ' + deadNames[j]);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

// ─── Theme compliance ────────────────────────────────────────────
describe('Theme compliance — pages', function () {
  it('no hardcoded hex colors in page files', function () {
    var pageDir = path.join(SRC, 'pages');
    var pageFiles = getAllFiles(pageDir);
    var violations = [];
    var hexRe = /['"]#([0-9a-fA-F]{6})['"]/g;

    for (var i = 0; i < pageFiles.length; i++) {
      var content = fs.readFileSync(pageFiles[i], 'utf-8');
      var match;
      while ((match = hexRe.exec(content)) !== null) {
        var color = match[1].toLowerCase();
        if (color === 'ffffff' || color === '000000') continue;
        violations.push(path.relative(SRC, pageFiles[i]) + ': #' + color);
      }
      hexRe.lastIndex = 0;
    }

    expect(violations).toEqual([]);
  });
});
