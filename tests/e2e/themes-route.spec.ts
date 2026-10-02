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
