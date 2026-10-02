import type { Page } from '@playwright/test';
import { DEFAULT_THEMES } from '../../src/theme/presets';
import { expect, OTHER_SITE, rgb, SITE, SUBDOMAIN, test, UNSUPPORTED_HOSTS } from './fixtures';

const MOVIX_RED = 'rgb(220, 38, 38)';
const ocean = DEFAULT_THEMES.find((theme) => theme.id === 'ocean-blue')!;
const light = DEFAULT_THEMES.find((theme) => theme.id === 'minimal-light')!;

const themeAttribute = (page: Page) => page.locator('html').getAttribute('data-motix-theme');

async function pickTheme(popup: Page, themeId: string): Promise<void> {
  await popup.locator('#quick-theme').selectOption(themeId);
  await expect(popup.getByRole('status')).toHaveText('Theme changed!');
}

test('a supported site keeps its original look until a theme is chosen', async ({ openSite }) => {
  const site = await openSite();
  expect(await themeAttribute(site)).toBeNull();
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);
  await expect(site.locator('#cta')).toHaveCSS('background-color', MOVIX_RED);
});

test('a preset restyles the whole page, not just a few known classes', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  await pickTheme(await openExtensionPage(`popup.html?site=${SITE}`), ocean.id);

  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
  await expect(site.locator('body')).toHaveCSS('background-color', rgb(ocean.colors.background));
  await expect(site.locator('#title')).toHaveCSS('color', rgb(ocean.colors.text));
  await expect(site.locator('#logo')).toHaveCSS('color', rgb(ocean.colors.primary));
  await expect(site.locator('#panel')).toHaveCSS('background-color', rgb(ocean.colors.card));
  await expect(site.locator('#panel')).toHaveCSS('border-top-color', rgb(ocean.colors.border));
  await expect(site.locator('#panel')).toHaveCSS('color', rgb(ocean.colors.muted));
  await expect(site.locator('#cta')).toHaveCSS('background-color', rgb(ocean.colors.primary));
  await expect(site.locator('#cta')).toHaveCSS('color', 'rgb(255, 255, 255)');

  await site.locator('#cta').hover();
  await expect(site.locator('#cta')).toHaveCSS('background-color', rgb(ocean.colors.primaryHover));

  // Status colours are not part of the theme, and poster cards swap their per-poster tint for the accent.
  await expect(site.locator('#status')).toHaveCSS('color', 'rgb(74, 222, 128)');
  expect(await site.locator('#card').evaluate((card) => getComputedStyle(card).getPropertyValue('--media-color').trim())).toBe('56, 189, 248');

  // Corners scale with the theme radius: 0.5rem × 16/12.
  const radius = await site.locator('#cta').evaluate((button) => Number.parseFloat(getComputedStyle(button).borderTopLeftRadius));
  expect(radius).toBeCloseTo(10.66, 1);
});

test('a light theme flips dark surfaces and light text', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  await pickTheme(await openExtensionPage(`popup.html?site=${SITE}`), light.id);
  await expect(site.locator('body')).toHaveCSS('background-color', rgb(light.colors.background));
  await expect(site.locator('#title')).toHaveCSS('color', rgb(light.colors.text));
  await expect(site.locator('html')).toHaveCSS('color-scheme', 'light');

  // Text laid over artwork stays light on its dark image, while the accent is still themed there.
  await expect(site.locator('#hero-text')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(site.locator('#hero-cta')).toHaveCSS('background-color', rgb(light.colors.primary));
});

test('the video player keeps Movix colours unless the user opts in', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  await pickTheme(await openExtensionPage(`popup.html?site=${SITE}`), ocean.id);
  await expect(site.locator('#cta')).toHaveCSS('background-color', rgb(ocean.colors.primary));
  await expect(site.locator('#player-button')).toHaveCSS('background-color', MOVIX_RED);
  await expect(site.locator('#player-button')).toHaveCSS('border-top-left-radius', '8px');

  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await editor.getByRole('button', { name: 'Advanced options' }).click();
  await editor.getByLabel('Theme the video player too').check();
  await expect(site.locator('#player-button')).toHaveCSS('background-color', rgb(ocean.colors.primary));
});

test('subdomains of a Movix root are supported', async ({ openSite, openExtensionPage }) => {
  const site = await openSite(SUBDOMAIN);
  const popup = await openExtensionPage(`popup.html?site=${SUBDOMAIN}`);
  await expect(popup.getByText('Motix is ready')).toBeVisible();
  await pickTheme(popup, ocean.id);
  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
});

test('unrelated and lookalike hosts are never touched', async ({ openSite, openExtensionPage }) => {
  // Make a theme active everywhere it legitimately can be, then check it leaks nowhere else.
  const editor = await openExtensionPage('themes.html');
  await editor.locator('.motix-preset', { hasText: ocean.name }).click();
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('status')).toContainText('saved');
  const supported = await openSite();
  await expect(supported.locator('#cta')).toHaveCSS('background-color', rgb(ocean.colors.primary));

  for (const host of UNSUPPORTED_HOSTS) {
    const page = await openSite(host);
    await expect(page.locator('#route')).toHaveText('/');
    expect(await themeAttribute(page), host).toBeNull();
    await expect(page.locator('#motix-theme-styles'), host).toHaveCount(0);
    await expect(page.locator('#cta'), host).toHaveCSS('background-color', MOVIX_RED);

    const popup = await openExtensionPage(`popup.html?site=${host}`);
    await expect(popup.getByText('This site is not supported')).toBeVisible();
    await expect(popup.getByRole('switch')).toBeDisabled();
    await page.close();
    await popup.close();
  }
});

test('the switch removes and restores the theme without a reload', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  const popup = await openExtensionPage(`popup.html?site=${SITE}`);
  await pickTheme(popup, ocean.id);
  await expect(site.locator('#motix-theme-styles')).toHaveCount(1);

  // Keyboard only: the switch is a real button.
  await popup.getByRole('switch').focus();
  await popup.keyboard.press('Space');
  await expect(popup.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);
  expect(await themeAttribute(site)).toBeNull();
  await expect(site.locator('#cta')).toHaveCSS('background-color', MOVIX_RED);

  await popup.keyboard.press('Space');
  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
});

test('themes are per domain and stay in sync across open tabs', async ({ openSite, openExtensionPage }) => {
  const [first, second, other] = [await openSite(), await openSite(), await openSite(OTHER_SITE)];
  await pickTheme(await openExtensionPage(`popup.html?site=${SITE}`), ocean.id);
  await pickTheme(await openExtensionPage(`popup.html?site=${OTHER_SITE}`), light.id);

  for (const tab of [first, second]) await expect(tab.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
  await expect(other.locator('html')).toHaveAttribute('data-motix-theme', light.id);

  // The choice survives a reload and is applied before the page finishes loading.
  await first.reload();
  await expect(first.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
});
