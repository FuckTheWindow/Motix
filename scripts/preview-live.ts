// Screenshots the real Movix site with the built extension and a few themes applied, for a
// human to review: the browser tests use a fixture page and cannot judge the real design.
// Usage: pnpm build && pnpm preview:live [theme-id ...]
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import directory from '../src/shared/domains.json' with { type: 'json' };

const SETTLE_MS = 8_000;
const themeIds = process.argv.slice(2).length ? process.argv.slice(2) : ['ocean-blue', 'minimal-light', 'retro-green'];
const extension = resolve('build/chrome');
const output = resolve('test-results/live');
const origin = `https://${directory.primary}`;

await mkdir(output, { recursive: true });
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  viewport: { width: 1366, height: 850 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
try {
  const site = await context.newPage();
  await site.goto(`${origin}/themes`, { waitUntil: 'domcontentloaded' });
  const frameUrl = await site.locator('#motix-themes-iframe').getAttribute('src');
  const extensionOrigin = frameUrl!.slice(0, frameUrl!.indexOf('/themes.html'));
  await site.goto(origin, { waitUntil: 'domcontentloaded' });
  await site.waitForTimeout(SETTLE_MS);

  const popup = await context.newPage();
  await popup.goto(`${extensionOrigin}/popup.html?site=${directory.primary}`);
  for (const themeId of ['original', ...themeIds]) {
    await popup.locator('#quick-theme').selectOption(themeId);
    await site.bringToFront();
    await site.waitForTimeout(1_000);
    await site.screenshot({ path: resolve(output, `${themeId}.png`) });
    await site.mouse.wheel(0, 1_400);
    await site.waitForTimeout(1_500);
    await site.screenshot({ path: resolve(output, `${themeId}-scrolled.png`) });
    await site.mouse.wheel(0, -1_400);
    console.log(`${themeId}: test-results/live/${themeId}.png`);
  }
} finally {
  await context.close();
}
