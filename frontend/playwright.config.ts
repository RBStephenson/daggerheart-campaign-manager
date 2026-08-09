import { defineConfig } from '@playwright/test';

// Targets the isolated E2E Docker stack (docker-compose.e2e.yml at the repo
// root), never the live dev stack — see that file for why. Start the stack
// yourself before running this suite; it does not manage the stack's
// lifecycle.
export default defineConfig({
  testDir: './e2e',
  // Specs share one persistent DB for the run (docker-compose.e2e.yml isn't
  // reset between files), so run fully serial and number spec files
  // (NN-name.spec.ts) to make the required run order explicit rather than
  // accidental — Playwright runs files in alphabetical order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'on-first-retry',
  },
});
