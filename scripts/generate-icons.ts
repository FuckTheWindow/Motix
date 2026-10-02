// Rasterises public/icons/icon.svg (the Motix brand mark) into the PNG sizes browsers ask for.
// Usage: pnpm generate:icons
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { ICON_SIZES } from './lib/manifest';

const directory = resolve(process.cwd(), 'public/icons');
const svg = await readFile(resolve(directory, 'icon.svg'), 'utf8');

const browser = await chromium.launch({ channel: 'chromium' });
try {
  for (const size of ICON_SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: resolve(directory, `icon-${size}.png`), omitBackground: true });
    await page.close();
    console.log(`icon-${size}.png`);
  }
} finally {
  await browser.close();
}
