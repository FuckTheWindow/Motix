test('the editor fits a narrow phone screen and honours reduced motion', async ({ openExtensionPage }) => {
  const editor = await openExtensionPage('themes.html');
  await editor.setViewportSize({ width: 360, height: 740 });
  expect(await editor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await editor.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => editor.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  await expect.poll(() => editor.locator('.mx-screen').first().evaluate((screen) => {
    const duration = getComputedStyle(screen).transitionDuration;
    return duration.split(',').every((value) => Number.parseFloat(value) <= 0.00001);
  })).toBe(true);
});
