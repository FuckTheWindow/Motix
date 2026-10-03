import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import directory from '../../src/shared/domains.json' with { type: 'json' };

const EXTENSION_PATH = resolve('build/chrome');
const SITE_DIR = resolve('tests/e2e/site');

/** Two real Movix roots, so per-domain behaviour can be told apart from global behaviour. */
export const [SITE, OTHER_SITE] = directory.domains as [string, string];
export const SUBDOMAIN = `player.${SITE}`;
export const UNSUPPORTED_HOSTS = ['example.com', `fake-${SITE}`, `${SITE}.evil.test`];

interface Fixtures {
  context: BrowserContext;
  /** Opens the fixture Movix page on the given host. */
  openSite: (host?: string, path?: string) => Promise<Page>;
  /** Opens one of the extension's own pages, e.g. `popup.html?site=…`. */
  openExtensionPage: (path: string) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  // Extensions only load in a persistent context; an empty path gives each test a fresh profile.
  context: async ({}, use) => { // eslint-disable-line no-empty-pattern -- Playwright requires destructuring here.
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });
    // Every site host is served from the local fixture, so the tests never touch the network.
    const hosts = new Set([SITE, OTHER_SITE, SUBDOMAIN, ...UNSUPPORTED_HOSTS]);
    await context.route((url) => hosts.has(url.hostname), async (route) => {
      const isStylesheet = new URL(route.request().url()).pathname === '/site.css';
      await route.fulfill({
        contentType: isStylesheet ? 'text/css' : 'text/html',
        body: await readFile(resolve(SITE_DIR, isStylesheet ? 'site.css' : 'index.html')),
      });
    });
    await use(context);
    await context.close();
  },

  openSite: async ({ context }, use) => {
    await use(async (host = SITE, path = '/') => {
      const page = await context.newPage();
      await page.goto(`https://${host}${path}`);
      return page;
    });
  },

  openExtensionPage: async ({ context, openSite }, use) => {
    let origin: string | undefined;
    await use(async (path) => {
      if (!origin) {
        // Motix has no background page to ask for its id; the editor frame it embeds on /themes reveals it.
        const probe = await openSite(SITE, '/themes');
        const src = await probe.locator('#motix-themes-iframe').getAttribute('src');
        origin = src!.slice(0, src!.indexOf('/themes.html'));
        await probe.close();
      }
      const page = await context.newPage();
      await page.goto(`${origin}/${path}`);
      return page;
    });
  },
});

export { expect } from '@playwright/test';

export const rgb = (hex: string): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
};
