import { defineConfig } from '@playwright/test';

// The tests load the built extension from build/chrome: run `pnpm build` first.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Each test starts its own browser with the extension loaded; more than a few at once starves them.
  workers: 3,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
