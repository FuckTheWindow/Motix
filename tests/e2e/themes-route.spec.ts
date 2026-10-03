import { expect, SITE, test, UNSUPPORTED_HOSTS } from './fixtures';

const FRAME = '#motix-themes-iframe';

test('/themes shows the editor in place of the site and hands the page back on close', async ({ openSite }) => {
  const site = await openSite(SITE, '/themes');
  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#root')).toBeHidden();

  const editor = site.frameLocator(FRAME);
  await expect(editor.getByRole('heading', { name: 'Customize your Movix experience' })).toBeVisible();
  await expect(editor.getByText(`${SITE} · Supported`)).toBeVisible();

  await editor.getByRole('button', { name: '← Back to Movix' }).click();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site.locator('#root')).toBeVisible();
  // The site's own router saw the navigation.
  await expect(site.locator('#route')).toHaveText('/');
  expect(new URL(site.url()).pathname).toBe('/');
});

test('"Customize theme" opens the editor in the site and "Back to Movix" returns to the same page', async ({ openSite, openExtensionPage }) => {
  const site = await openSite(SITE, '/movie/7');
  const popup = await openExtensionPage(`popup.html?site=${SITE}`);
  // The popup acts on the active tab, as it would when opened from the toolbar.
  await site.bringToFront();
  await popup.getByRole('button', { name: 'Customize theme' }).click();

  // The editor opens over the page without reloading it.
  await site.evaluate(() => { (window as Window & { stillLoaded?: boolean }).stillLoaded = true; });
  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#root')).toBeHidden();
  expect(new URL(site.url()).pathname).toBe('/themes');

  await site.frameLocator(FRAME).getByRole('button', { name: '← Back to Movix' }).click();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site.locator('#root')).toBeVisible();
  await expect(site).toHaveURL(`https://${SITE}/movie/7`);
  expect(await site.evaluate(() => (window as Window & { stillLoaded?: boolean }).stillLoaded)).toBe(true);
});

test('closing the editor returns to the page it was opened from', async ({ openSite }) => {
  const site = await openSite(SITE, `/themes?return=${encodeURIComponent('/movie/42?tab=cast')}`);
  await site.frameLocator(FRAME).getByRole('button', { name: '← Back to Movix' }).click();
  await expect(site.locator('#route')).toHaveText('/movie/42');
  expect(site.url()).toBe(`https://${SITE}/movie/42?tab=cast`);

  // A return address pointing off the site is ignored.
  const other = await openSite(SITE, `/themes?return=${encodeURIComponent('//evil.test/x')}`);
  await other.frameLocator(FRAME).getByRole('button', { name: '← Back to Movix' }).click();
  await expect(other.locator('#route')).toHaveText('/');
});

test('the editor follows in-app navigation to and from /themes', async ({ openSite }) => {
  const site = await openSite();
  await expect(site.locator(FRAME)).toHaveCount(0);

  await site.locator('#spa-themes').click();
  await expect(site.locator(FRAME)).toBeVisible();
  await expect(site.locator('#root')).toBeHidden();

  await site.goBack();
  await expect(site.locator(FRAME)).toHaveCount(0);
  await expect(site.locator('#root')).toBeVisible();
});

test('/themes is left alone on hosts Motix does not support', async ({ openSite }) => {
  const page = await openSite(UNSUPPORTED_HOSTS[0], '/themes');
  await expect(page.locator('#route')).toHaveText('/themes');
  await expect(page.locator(FRAME)).toHaveCount(0);
});
