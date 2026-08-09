/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
      '/ws': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        ws: true,
      },
    },
    // Docker bind mounts on Windows/macOS don't emit native filesystem
    // events reliably; polling ensures HMR picks up edits from the host.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    // Playwright specs (frontend/e2e/) are a separate test runner — keep
    // them out of vitest's collection or it errors trying to load them.
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
