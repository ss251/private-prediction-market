import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

const emptyPolyfill = fileURLToPath(new URL('./src/lib/empty-polyfill.ts', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Include WASM files in build
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      // The SDK imports a core-js CJS polyfill that uses require() — crashes in ESM workers
      'core-js/proposals/json-parse-with-source.js': emptyPolyfill,
    },
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (WASM threading)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle WASM packages
    exclude: ['@provablehq/wasm', '@provablehq/sdk'],
  },
  build: {
    target: 'esnext', // Required for top-level await in workers
  },
  worker: {
    format: 'es', // ES modules in workers
  },
})
