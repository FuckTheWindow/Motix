import { expect, SITE, test, UNSUPPORTED_HOSTS } from './fixtures';

const FRAME = '#motix-themes-iframe';

test('/themes opens the editor beside the site, which goes back to the home page', async ({ openSite }) => {
  const site = await openSite(SITE, '/themes');
  await expect(site.locator(FRAME)).toBeVisible();
  // The site stays on screen next to the editor, so changes can be judged on the real thing.
  await expect(site.locator('#root')).toBeVisible();
  await expect(site.locator('#route')).toHaveText('/');
  expect(new URL(site.url()).pathname).toBe('/');

  const editor = site.frameLocator(FRAME);
  await expect(editor.getByRole('heading', { name: 'Themes', level: 1 })).toBeVisible();
  await expect(editor.getByText(SITE, { exact: true }).first()).toBeVisible();

  await editor.getByRole('button', { name: 'Close the editor' }).click();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site.locator('#root')).toBeVisible();
});

test('"Customize theme" opens the editor beside the current page without reloading it', async ({ openSite, openExtensionPage }) => {
  const site = await openSite(SITE, '/movie/7');
  const popup = await openExtensionPage(`popup.html?site=${SITE}`);
  // The popup acts on the active tab, as it would when opened from the toolbar.
  await site.bringToFront();
  await site.evaluate(() => { (window as Window & { stillLoaded?: boolean }).stillLoaded = true; });
  await popup.getByRole('button', { name: 'Customize theme' }).click();

  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#root')).toBeVisible();
  await expect(site).toHaveURL(`https://${SITE}/movie/7`);

  await site.frameLocator(FRAME).getByRole('button', { name: 'Close the editor' }).click();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site).toHaveURL(`https://${SITE}/movie/7`);
  expect(await site.evaluate(() => (window as Window & { stillLoaded?: boolean }).stillLoaded)).toBe(true);
});

test('/themes sends the site back to the page it was opened from, never off the site', async ({ openSite }) => {
  const site = await openSite(SITE, `/themes?return=${encodeURIComponent('/movie/42?tab=cast')}`);
  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#route')).toHaveText('/movie/42');
  expect(site.url()).toBe(`https://${SITE}/movie/42?tab=cast`);

  // A return address pointing off the site is ignored.
  const other = await openSite(SITE, `/themes?return=${encodeURIComponent('//evil.test/x')}`);
  await expect(other.locator(FRAME)).toBeVisible();
  await expect(other.locator('#route')).toHaveText('/');
});

test('in-app navigation to /themes opens the editor and keeps the page', async ({ openSite }) => {
  const site = await openSite();
  await expect(site.locator(FRAME)).toHaveCount(0);

  await site.locator('#spa-themes').click();
  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#root')).toBeVisible();
  // The site's own router is told about the return to the page.
  await expect(site.locator('#route')).toHaveText('/');
});

test('/themes is left alone on hosts Motix does not support', async ({ openSite }) => {
  const page = await openSite(UNSUPPORTED_HOSTS[0], '/themes');
  await expect(page.locator('#route')).toHaveText('/themes');
  await expect(page.locator(FRAME)).toHaveCount(0);
});
