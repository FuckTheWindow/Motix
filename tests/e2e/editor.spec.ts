import { readFile } from 'node:fs/promises';
import type { FrameLocator, Page } from '@playwright/test';
import { DEFAULT_THEMES } from '../../src/theme/presets';
import { expect, rgb, SITE, test } from './fixtures';

const dracula = DEFAULT_THEMES.find((theme) => theme.id === 'dracula')!;
const ocean = DEFAULT_THEMES.find((theme) => theme.id === 'ocean-blue')!;
const FRAME = '#motix-themes-iframe';

type Editor = Page | FrameLocator;
const pick = (editor: Editor, name: string) => editor.getByRole('radio', { name, exact: true }).check();
const openSection = (editor: Editor, title: string) => editor.getByText(title, { exact: true }).click();
const importFile = (editor: Page, name: string, content: string) =>
  editor.getByLabel('Import a Motix theme file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });

test('a customised preset is saved as a new theme for the current site only', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);

  await pick(editor, dracula.name);
  await editor.getByLabel('Accent', { exact: true }).fill('#ff8800');
  await openSection(editor, 'Shape');
  await editor.getByLabel('Button size').fill('100');
  await editor.getByRole('radio', { name: 'Retro (typewriter)' }).check();
  // The mock preview shows shape and lettering before anything is saved.
  await expect(editor.locator('.mx-preview-play').first()).toHaveCSS('zoom', '1.2');
  await expect(editor.locator('.mx-preview-frame').first()).toHaveCSS('font-family', /monospace/);
  await expect(editor.getByText('Unsaved changes')).toBeVisible();

  await editor.getByLabel('Theme name').fill('Halloween');
  // Saving targets this site by default, like the popup does.
  await expect(editor.getByRole('radio', { name: SITE })).toBeChecked();
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('status')).toHaveText(`Halloween is saved and active on ${SITE}.`);

  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', /^custom-/);
  await expect(site.locator('#cta')).toHaveCSS('background-color', 'rgb(255, 136, 0)');
  await expect(site.locator('#cta')).toHaveCSS('zoom', '1.2');
  await expect(site.locator('#cta')).toHaveCSS('font-family', /monospace/);
  await expect(site.locator('#player-button')).toHaveCSS('zoom', '1');

  // The preset itself is untouched, and the new theme waits under "My themes".
  await expect(editor.getByRole('radio', { name: 'Halloween', exact: true })).toBeChecked();
  await expect(editor.getByRole('radio', { name: dracula.name, exact: true })).toHaveCount(1);

  // Back to Movix as shipped: the Original preset, applied for this site.
  await pick(editor, 'Original');
  await editor.getByRole('button', { name: 'Apply' }).click();
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);
});

test('saving the same theme twice updates it instead of piling up copies', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await pick(editor, dracula.name);
  await editor.getByLabel('Accent', { exact: true }).fill('#ff8800');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByText(`Active on ${SITE}`, { exact: true })).toBeVisible();

  await editor.getByLabel('Accent', { exact: true }).fill('#00aaff');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByText(`Active on ${SITE}`, { exact: true })).toBeVisible();
  await expect(editor.getByRole('radio', { name: `My ${dracula.name}`, exact: true })).toHaveCount(1);
});

test('docked beside the site, every change shows there before it is saved', async ({ openSite }) => {
  const site = await openSite(SITE, '/themes');
  const editor = site.frameLocator(FRAME);

  await pick(editor, ocean.name);
  await expect(site.locator('html')).toHaveAttribute('data-motix-theme', ocean.id);
  await expect(site.locator('body')).toHaveCSS('background-color', rgb(ocean.colors.background));
  await editor.getByLabel('Accent', { exact: true }).fill('#ff8800');
  await expect(site.locator('#cta')).toHaveCSS('background-color', 'rgb(255, 136, 0)');

  // Closing with unsaved work asks first; leaving restores the saved look (here, Movix as shipped).
  await editor.getByRole('button', { name: 'Close the editor' }).click();
  await expect(editor.getByText('Leave without saving?')).toBeVisible();
  await editor.getByRole('button', { name: 'Leave' }).click();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);
});

test('a custom theme can be deleted, and the deletion undone', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await pick(editor, dracula.name);
  await editor.getByLabel('Accent', { exact: true }).fill('#ff8800');
  await editor.getByLabel('Theme name').fill('Pumpkin');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('radio', { name: 'Pumpkin', exact: true })).toBeChecked();

  // Deleting takes a second click, then can still be undone.
  await editor.getByRole('button', { name: 'Delete' }).click();
  await editor.getByRole('button', { name: 'Delete for good?' }).click();
  await expect(editor.getByRole('radio', { name: 'Pumpkin', exact: true })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Undo' }).click();
  await expect(editor.getByRole('radio', { name: 'Pumpkin', exact: true })).toBeChecked();
});

test('the mock preview follows the draft and switches between screen sizes', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  // Opened on its own, the editor still offers a way to Movix.
  await expect(editor.getByRole('link', { name: 'Go to Movix' })).toHaveAttribute('href', `https://${SITE}/`);
  const frame = editor.locator('.mx-preview-frame');
  await pick(editor, dracula.name);
  await expect(frame).toHaveCSS('background-color', 'rgb(40, 42, 54)');

  for (const size of ['Mobile', 'Desktop']) {
    await editor.getByRole('radio', { name: size, exact: true }).check();
    await expect(frame).toHaveAttribute('data-mode', size.toLowerCase());
  }
});

test('an exported theme can be imported again', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await pick(editor, dracula.name);
  await openSection(editor, 'Advanced');
  const [download] = await Promise.all([editor.waitForEvent('download'), editor.getByRole('button', { name: 'Export this theme' }).click()]);
  expect(download.suggestedFilename()).toBe('my-dracula.motix.json');
  const exported = JSON.parse(await readFile(await download.path(), 'utf8')) as { theme: { id: string } };

  // A built-in id cannot be imported over; any other id round-trips.
  await importFile(editor, 'same-id.json', JSON.stringify(exported));
  await expect(editor.getByRole('alert')).toHaveText('A built-in theme already uses that theme ID.');
  await importFile(editor, 'renamed.json', JSON.stringify({ ...exported, theme: { ...exported.theme, id: 'my-dracula', name: 'Round trip' } }));
  await expect(editor.getByRole('status')).toHaveText('Theme imported. Save it to keep it on this device.');
  await expect(editor.getByLabel('Theme name')).toHaveValue('Round trip');
});

test('malformed, oversized and unsafe theme files are rejected', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await openSection(editor, 'Advanced');
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

test('unsafe custom CSS is flagged on the field and cannot be saved', async ({ openSite, openExtensionPage }) => {
  const site = await openSite();
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await pick(editor, dracula.name);
  await openSection(editor, 'Advanced');

  const field = editor.getByLabel('Custom CSS');
  await field.fill('@import url(https://evil.test/a.css);');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(editor.getByRole('alert')).toHaveText('Remote resources and executable CSS features are not allowed.');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toBeFocused();
  await expect(site.locator('#motix-theme-styles')).toHaveCount(0);

  await field.fill('#title { letter-spacing: 3px; }');
  await editor.getByRole('button', { name: 'Save theme' }).click();
  await expect(site.locator('#title')).toHaveCSS('letter-spacing', '3px');
});

test('opening a section scrolls just enough to show what it holds', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage(`themes.html?site=${SITE}`);
  await editor.setViewportSize({ width: 1280, height: 640 });
  await editor.locator('.mx-editor-main').evaluate((main) => { main.scrollTop = 0; });
  const css = editor.getByLabel('Custom CSS');
  await expect(css).not.toBeInViewport();

  await openSection(editor, 'Advanced');
  await expect(css).toBeInViewport();
});

test('the editor fits a narrow phone screen and honours reduced motion', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await editor.setViewportSize({ width: 360, height: 740 });
  expect(await editor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await editor.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await editor.locator('.mx-screen').first().evaluate((screen) => Number.parseFloat(getComputedStyle(screen).transitionDuration));
  expect(duration).toBeLessThan(0.001);
});
