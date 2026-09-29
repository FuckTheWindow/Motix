import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_MOVIX_DOMAINS, isSupportedMovixDomain, validatedDirectoryDomains } from '../src/shared/domains';
import { DEFAULT_THEMES } from '../src/data/themes';
import { generateThemeCss } from '../src/shared/theme-css';
import { MAX_THEME_BYTES, parseThemeImport, validateCustomCss, validateTheme } from '../src/shared/validation';
import { defaultSettings, resolveActiveTheme, settingsNeedMigration } from '../src/shared/storage';
import { isThemesPath } from '../src/content/route-detector';

test('supports approved Movix domains and precise subdomains only', () => {
  assert.equal(isSupportedMovixDomain('movix.college'), true);
  assert.equal(isSupportedMovixDomain('player.movix.college'), true);
  assert.equal(isSupportedMovixDomain('fake-movix.college'), false);
  assert.equal(isSupportedMovixDomain('movix.college.evil.test'), false);
  assert.equal(isSupportedMovixDomain('movix.online'), false);
  assert.equal(isSupportedMovixDomain('not a host'), false);
});

test('directory parsing keeps only validated, pre-approved Movix hosts', () => {
  assert.deepEqual(validatedDirectoryDomains(['https://movix.college/watch', 'https://fake-movix.online', 'javascript:alert(1)', 'movix.cash']), ['movix.college', 'movix.cash']);
  assert.equal(BUILT_IN_MOVIX_DOMAINS.includes('movix.online' as never), false);
});

test('default theme set includes every requested preset', () => {
  assert.equal(DEFAULT_THEMES.length, 16);
  assert.ok(DEFAULT_THEMES.some((theme) => theme.id === 'retro-green'));
  assert.ok(DEFAULT_THEMES.some((theme) => theme.id === 'terminal'));

  const animeThemes = DEFAULT_THEMES.filter((theme) => ['one-punch-man', 'onimai', 'dragon-ball-z', 'demon-slayer'].includes(theme.id));
  assert.equal(animeThemes.length, 4);
  assert.equal(DEFAULT_THEMES.find((theme) => theme.id === 'onimai')?.colors.primary, '#f472b6');
  assert.equal(DEFAULT_THEMES.find((theme) => theme.id === 'dragon-ball-z')?.colors.primary, '#f97316');
});

test('settings default is enabled and starts from Original', () => {
  const settings = defaultSettings();
  assert.equal(settings.globalThemeId, 'original');
  assert.equal(settings.motixEnabled, true);
  assert.deepEqual(settings.domainThemes, {});
});

test('active theme resolver selects normalized per-domain theme before global theme', () => {
  const settings = { ...defaultSettings(), globalThemeId: 'retro-green', domainThemes: { 'movix.college': 'ocean-blue' } };
  assert.equal(resolveActiveTheme(settings, 'MOVIX.COLLEGE').id, 'ocean-blue');
  assert.equal(resolveActiveTheme(settings, 'other.movix.college').id, 'retro-green');
});

test('storage migration comparison ignores object key order but detects actual setting changes', () => {
  const normalized = { ...defaultSettings(), globalThemeId: 'retro-green', domainThemes: { 'movix.college': 'ocean-blue' } };
  const sameSettings = { ...normalized, domainThemes: { 'movix.college': 'ocean-blue' } };
  const changedSettings = { ...normalized, globalThemeId: 'original' };
  assert.equal(settingsNeedMigration(sameSettings, normalized), false);
  assert.equal(settingsNeedMigration(changedSettings, normalized), true);
});

test('theme schema and import accept a valid custom theme', () => {
  const theme = { ...DEFAULT_THEMES[1]!, id: 'my-theme', name: 'My Theme', isCustom: true };
  assert.equal(validateTheme(theme), true);
  assert.deepEqual(parseThemeImport(JSON.stringify({ schemaVersion: 1, theme })).id, 'my-theme');
});

test('theme import rejects invalid and oversized data', () => {
  assert.throws(() => parseThemeImport('{broken'), /valid theme JSON/);
  assert.throws(() => parseThemeImport('x'.repeat(MAX_THEME_BYTES + 1)), /128 KB/);
  assert.throws(() => parseThemeImport(JSON.stringify({ id: 'bad', colors: {} })), /invalid settings/);
});

test('custom CSS blocks scripts, urls, imports, and unbalanced rules', () => {
  assert.equal(validateCustomCss('.carousel-card { border: 1px solid #fff; }').valid, true);
  assert.equal(validateCustomCss('@import url(https://example.test/a.css);').valid, false);
  assert.equal(validateCustomCss('.x { background: url(https://example.test/a); }').valid, false);
  assert.equal(validateCustomCss('<script>alert(1)</script>').valid, false);
  assert.equal(validateCustomCss('.x { color: red;').valid, false);
});

test('theme CSS targets verified Movix page shells and current media-card color variables', () => {
  const css = generateThemeCss(DEFAULT_THEMES[1]!);
  assert.match(css, /--motix-primary: #4ade80/);
  assert.match(css, /--primary:/);
  assert.match(css, /--primary-color: #4ade80/);
  assert.match(css, /--motix-media-color: 74, 222, 128/);
  assert.match(css, /--motix-media-surface: 16, 39, 25/);
  assert.match(css, /\.media-color-card/);
  assert.match(css, /--media-color: var\(--motix-media-color\) !important/);
  assert.match(css, /\.media-card-muted/);
  assert.match(css, /\.section-title/);
  assert.ok(css.includes('.platform-link > div[class~="bg-white"]'));
  assert.ok(css.includes('.platform-link p[class~="bg-black/60"]'));
  assert.ok(css.includes('header span[class~="text-red-600"]'));
  assert.match(css, /#root \.min-h-screen\.bg-black/);
  assert.match(css, /\[class~="bg-gray-800"\]/);
  assert.match(css, /#root input/);
  assert.match(css, /--motix-primary-text: #101010/);
  assert.match(css, /\[class~="bg-white\/10"\]/);
  assert.match(css, /\[class~="bg-black"\]:not\(\.absolute\):not\(\.fixed\):not\(\.min-h-screen\)/);
  assert.doesNotMatch(css, /\.btn-toggle/);
  assert.doesNotMatch(css, /\.media-card\s*\{/);
  assert.doesNotMatch(css, /\.bg-zinc-950/);
  const withUnsafeCss = { ...DEFAULT_THEMES[1]!, customCss: 'body { display: none; }' };
  assert.doesNotMatch(generateThemeCss(withUnsafeCss), /display:\s*none/);
  const withCustomCss = { ...DEFAULT_THEMES[1]!, customCss: '.carousel-card { border-width: 2px; }' };
  assert.match(generateThemeCss(withCustomCss), /\[data-motix-theme\] \.carousel-card \{ border-width: 2px; \}/);
});

test('/themes route detection works with or without trailing slash', () => {
  assert.equal(isThemesPath('/themes'), true);
  assert.equal(isThemesPath('/themes/'), true);
  assert.equal(isThemesPath('/movies'), false);
});
