// ═══════════════════════════════════════════════════════════════════
// TradeForge OS — ESLint Flat Config
// Requires: eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks
//           eslint-config-prettier globals
// ═══════════════════════════════════════════════════════════════════

import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // ─── Base JS recommended rules ───────────────────────────
  js.configs.recommended,

  // ─── Global ignores ──────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.mjs',
      'server.js',
    ],
  },

  // ─── Main source rules ──────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2024,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // ── React ─────────────────────────────────────────
      'react/jsx-uses-react': 'off',        // Not needed with React 17+ JSX transform
      'react/react-in-jsx-scope': 'off',    // Not needed with React 17+ JSX transform
      'react/prop-types': 'off',            // Using JSDoc, not PropTypes
      'react/display-name': 'off',          // Allow anonymous components for now
      'react/jsx-key': 'warn',              // Missing key in iterators
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'warn',
      'react/no-danger-with-children': 'error',
      'react/no-deprecated': 'warn',
      'react/no-direct-mutation-state': 'error',
      'react/no-unescaped-entities': 'off', // Too noisy for inline text
      'react/self-closing-comp': 'warn',

      // ── React Hooks ───────────────────────────────────
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ── General JS ────────────────────────────────────
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-console': ['warn', {
        allow: ['warn', 'error', 'info'],
      }],
      'no-debugger': 'warn',
      'no-duplicate-case': 'error',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-extra-boolean-cast': 'warn',
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-template-curly-in-string': 'warn',
      'no-unreachable': 'warn',
      'no-unsafe-optional-chaining': 'error',

      // ── Best Practices ────────────────────────────────
      'eqeqeq': ['warn', 'smart'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-self-compare': 'warn',
      'no-throw-literal': 'warn',
      'no-unused-expressions': ['warn', {
        allowShortCircuit: true,
        allowTernary: true,
        allowTaggedTemplates: true,
      }],
      'prefer-const': ['warn', { destructuring: 'all' }],
      'no-var': 'error',
      'prefer-template': 'off', // Too aggressive for C.b + '18' patterns
      'no-restricted-globals': ['error', 'event', 'fdescribe'],

      // ── Style (deferred to Prettier) ──────────────────
      // All formatting rules disabled — Prettier handles these
    },
  },

  // ─── Test files ──────────────────────────────────────────
  {
    files: ['src/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        test: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // ─── Prettier compat (must be last) ─────────────────────
  prettier,
];
