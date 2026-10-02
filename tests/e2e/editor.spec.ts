import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { DEFAULT_THEMES } from '../../src/theme/presets';
import { expect, SITE, test } from './fixtures';

const dracula = DEFAULT_THEMES.find((theme) => theme.id === 'dracula')!;

const importFile = (editor: Page, name: string, content: string) =>
  editor.getByLabel('Import a Motix theme file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });

test('a customised preset is saved as a new theme and applied to the open site', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await expect(editor.getByText(`${SITE} · Supported`)).toBeVisible();

  await editor.locator('.motix-preset', { hasText: dracula.name }).click();
  await editor.getByRole('button', { name: '2 · Colors' }).click();
  await editor.getByLabel('Button color', { exact: true }).fill('#ff8800');
  await editor.getByRole('button', { name: 'Next step →' }).click();
  await editor.getByLabel('Button size').fill('100');
  await editor.getByLabel('Lettering').selectOption('retro');
  // The preview shows shape and lettering changes before anything is saved.
  await expect(editor.locator('.motix-preview-card button')).toHaveCSS('zoom', '1.2');
  await expect(editor.locator('.motix-preview-frame')).toHaveCSS('font-family', /monospace/);

  await editor.getByRole('button', { name: '4 · Name' }).click();
  await editor.getByLabel('Theme name').fill('Halloween');
  await editor.getByRole('button', { name: 'Next step →' }).click();
  // Last step: nothing comes next, and the theme applies everywhere unless the user narrows it.
  await expect(editor.getByRole('button', { name: 'Next step →' })).toHaveCount(0);
  await expect(editor.getByLabel('Use this theme')).toHaveValue('global');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('status')).toHaveText('Your theme has been saved and applied!');

  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', /^custom-/);
  await expect(site.locator('#cta')).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  await expect(site.locator('#cta')).toHaveCSS('zoom', '1.2');
  await expect(site.locator('#cta')).toHaveCSS('font-family', /monospace/);
  await expect(site.locator('#player-button')).toHaveCSS('zoom', '1');

  // The preset itself is untouched, and the new theme is offered next to it.
  await editor.getByRole('button', { name: '1 · Style' }).click();
  await expect(editor.locator('.motix-preset', { hasText: 'Halloween' })).toHaveAttribute('aria-pressed', 'true');
  await expect(editor.locator('.motix-preset', { hasText: dracula.name })).toHaveCount(1);

  await editor.getByRole('button', { name: 'Reset to original' }).click();
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);
});

test('the preview reflects the draft and switches between screen sizes', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  // Opened on its own, the editor still offers a way to Movix.
  await expect(editor.getByRole('link', { name: 'Go to Movix →' })).toHaveAttribute('href', `https://${SITE}/`);
  const frame = editor.locator('.motix-preview-frame');
  await editor.locator('.motix-preset', { hasText: dracula.name }).click();
  await expect(frame).toHaveCSS('background-color', 'rgb(40, 42, 54)');

  for (const size of ['Tablet', 'Mobile', 'Desktop']) {
    await editor.getByRole('button', { name: size, exact: true }).click();
    await expect(frame).toHaveAttribute('data-mode', size.toLowerCase());
  }
});

test('an exported theme can be imported again', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await editor.locator('.motix-preset', { hasText: dracula.name }).click();
  const [download] = await Promise.all([editor.waitForEvent('download'), editor.getByRole('button', { name: 'Export theme' }).click()]);
  expect(download.suggestedFilename()).toBe('my-dracula-theme.motix.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { theme: { id: string } };

  // A built-in id cannot be imported over; any other id round-trips.
  await importFile(editor, 'same-id.json', JSON.stringify(exported));
  await expect(editor.getByRole('alert')).toHaveText('A built-in theme already uses that theme ID.');
  await importFile(editor, 'renamed.json', JSON.stringify({ ...exported, theme: { ...exported.theme, id: 'my-dracula', name: 'Round trip' } }));
  await expect(editor.getByRole('status')).toHaveText('Theme imported. Save it to keep it on this device.');
  await editor.getByRole('button', { name: '4 · Name' }).click();
  await expect(editor.getByLabel('Theme name')).toHaveValue('Round trip');
});

test('malformed, oversized and unsafe theme files are rejected', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  const valid = { ...dracula, id: 'unsafe-theme' };

  await importFile(editor, 'broken.json', '{not json');
  await expect(editor.getByRole('alert')).toHaveText('This file is not valid theme JSON.');
  await importFile(editor, 'huge.json', JSON.stringify({ ...valid, padding: 'x'.repeat(130 * 1024) }));
  await expect(editor.getByRole('alert')).toHaveText('Theme files must be 128 KB or smaller.');
  await importFile(editor, 'missing.json', JSON.stringify({ id: 'half-a-theme' }));
  await expect(editor.getByRole('alert')).toHaveText('The theme file has missing or invalid settings.');
  await importFile(editor, 'unsafe.json', JSON.stringify({ ...valid, customCss: '.x { background: url(https://evil.test/x) }' }));
  await expect(editor.getByRole('alert')).toHaveText('The theme file has missing or invalid settings.');
});

test('unsafe extra CSS typed in the editor cannot be saved', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await editor.locator('.motix-preset', { hasText: dracula.name }).click();
  await editor.getByRole('button', { name: 'Advanced options' }).click();

  await editor.getByLabel('Extra visual styles').fill('@import url(https://evil.test/a.css);');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('alert')).toHaveText('Remote resources and executable CSS features are not allowed.');
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);

  await editor.getByLabel('Extra visual styles').fill('#title { letter-spacing: 3px; }');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(site.locator('#title')).toHaveCSS('letter-spacing', '3px');
});

test('the editor fits a narrow phone screen and honours reduced motion', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await editor.setViewportSize({ width: 360, height: 740 });
  expect(await editor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await editor.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await editor.locator('.motix-preset').first().evaluate((preset) => Number.parseFloat(getComputedStyle(preset).transitionDuration));
  expect(duration).toBeLessThan(0.001);
});
