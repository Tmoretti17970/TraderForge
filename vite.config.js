import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist/client',
    sourcemap: true,
    target: 'es2020',
    chunkSizeWarningLimit: 200, // Warn if any chunk > 200KB

    rollupOptions: {
      output: {
        // ─── Manual chunk splitting ───────────────────────────
        // Separates heavy dependencies into their own chunks
        // so they load on-demand and cache independently.
        manualChunks: {
          // chart.js (~68KB gz) — only needed by dashboard chart widgets
          // Now lazy-loaded via dynamic import() in ChartWrapper.jsx
          'chart-vendor': ['chart.js'],

          // flexlayout-react (~45KB gz) — only needed by WorkspaceLayout
          // Already lazy-loaded via React.lazy in ChartsPage.jsx
          'workspace-vendor': ['flexlayout-react'],

          // dexie (~18KB gz) — IndexedDB wrapper, used by StorageService
          'storage-vendor': ['dexie'],
        },
      },
    },

    // Production minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Strip console.log/warn in production
        drop_debugger: true,  // Strip debugger statements
        pure_funcs: ['console.info', 'console.debug'], // Additional dead-code elimination
      },
      format: {
        comments: false, // Strip all comments
      },
    },
  },

  // SSR build: vite build --ssr src/entry-server.jsx --outDir dist/server
  ssr: {
    noExternal: [],
  },

  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/engine/**',
        'src/utils.js',
        'src/csv.js',
        'src/state/**',
        'src/data/**',
        'src/constants.js',
        'src/chartEngine/**',
      ],
      exclude: ['src/__tests__/**'],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
    sequence: { shuffle: false },
  },
});
