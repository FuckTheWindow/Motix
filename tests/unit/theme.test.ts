import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToRgb, hslToRgb, hueRotate, hueRotationTo, rgbToHsl } from '../../src/theme/color';
import tokens from '../../src/theme/generated/tokens.json' with { type: 'json' };
import { themeTokenValues } from '../../src/theme/palette';
import { DEFAULT_THEMES } from '../../src/theme/presets';
import { generateThemeCss } from '../../src/theme/theme-css';
import { MAX_THEME_BYTES, parseThemeImport, validateCustomCss, validateTheme } from '../../src/theme/validation';

const retroGreen = DEFAULT_THEMES.find((theme) => theme.id === 'retro-green')!;
const light = DEFAULT_THEMES.find((theme) => theme.id === 'minimal-light')!;

test('every preset is a valid theme with a unique id', () => {
  assert.equal(DEFAULT_THEMES[0]!.id, 'original');
  assert.equal(new Set(DEFAULT_THEMES.map((theme) => theme.id)).size, DEFAULT_THEMES.length);
  for (const theme of DEFAULT_THEMES) assert.equal(validateTheme(theme), true, theme.id);
});

test('colour conversions round-trip', () => {
  assert.deepEqual(hexToRgb('#fff'), [255, 255, 255]);
  for (const hex of ['#dc2626', '#4ade80', '#18202b', '#000000']) {
    assert.deepEqual(hslToRgb(rgbToHsl(hexToRgb(hex))), hexToRgb(hex), hex);
  }
});

test('labels over an accent pill (active tabs) use the readable on-accent colour', () => {
  assert.match(generateThemeCss(light), /:is\(button, a\):has\(> \.absolute:is\(\.bg-red-500, \.bg-red-600[^{]*\{\s*color: var\(--motix-on-primary\) !important;/);
});

test('on the accent, Movix white (labels, counters, their pills) becomes the on-accent colour', () => {
  const css = generateThemeCss(light);
  const rule = css.slice(css.indexOf('/* On the accent, Movix'));
  assert.match(rule, /--mx-fg-255-255-255: 255,255,255;/);
  assert.match(rule, /--mx-bg-255-255-255: 255,255,255;/);
  const lightAccent = { ...light, colors: { ...light.colors, primary: '#fde047' } };
  assert.match(generateThemeCss(lightAccent), /--mx-fg-255-255-255: 16,16,16;/);
});

test('the pointer grid is rotated from Movix red to the accent hue', () => {
  const red = [239, 68, 68] as const;
  for (const theme of DEFAULT_THEMES) {
    const accent = hexToRgb(theme.colors.primary);
    const rotated = rgbToHsl(hueRotate(red, hueRotationTo(red, accent)))[0];
    const distance = Math.abs(rotated - rgbToHsl(accent)[0]);
    assert.ok(Math.min(distance, 360 - distance) <= 3, `${theme.id}: ${rotated} vs ${rgbToHsl(accent)[0]}`);
  }
  assert.equal(hueRotationTo(red, red), 0);
  const css = generateThemeCss(retroGreen);
  assert.match(css, /canvas\.absolute\.inset-0\.z-0\.pointer-events-none \{\s+filter: hue-rotate\(\d+deg\) !important;/);
  assert.match(css, /\.square-bg-halo \{\s+background: radial-gradient\(circle, rgba\(74, 222, 128, 0\.15\)/);
  const gray = generateThemeCss({ ...retroGreen, colors: { ...retroGreen.colors, primary: '#808080' } });
  assert.match(gray, /filter: grayscale\(1\) !important/);
});

test('Movix brand red follows the accent, shade for shade', () => {
  const values = themeTokenValues(retroGreen.colors, ['bg-220-38-38', 'bg-185-28-28', 'fg-248-113-113', 'sh-239-68-68']);
  assert.deepEqual(values['bg-220-38-38'], hexToRgb(retroGreen.colors.primary));
  assert.deepEqual(values['bg-185-28-28'], hexToRgb(retroGreen.colors.primaryHover));
  const [hue] = rgbToHsl(hexToRgb(retroGreen.colors.primary));
  // red-400 is lighter than the brand base, so its themed shade is a lighter accent of the same hue.
  const lighter = rgbToHsl(values['fg-248-113-113']!);
  assert.ok(Math.abs(lighter[0] - hue) < 2);
  assert.ok(lighter[2] > rgbToHsl(hexToRgb(retroGreen.colors.primary))[2]);
  assert.ok(values['sh-239-68-68'], 'accent-coloured shadows are themed too');
});

test('neutrals follow the theme ramp and invert on a light theme', () => {
  const values = themeTokenValues(light.colors, ['bg-0-0-0', 'fg-255-255-255', 'bg-255-255-255', 'fg-0-0-0', 'bg-31-41-55', 'bd-55-65-81']);
  assert.deepEqual(values['bg-0-0-0'], hexToRgb(light.colors.background));
  assert.deepEqual(values['fg-255-255-255'], hexToRgb(light.colors.text));
  assert.deepEqual(values['bg-255-255-255'], hexToRgb(light.colors.text), 'white surfaces become the inverse surface');
  assert.deepEqual(values['fg-0-0-0'], hexToRgb(light.colors.background), 'so text on them flips as well');
  assert.deepEqual(values['bg-31-41-55'], hexToRgb(light.colors.card), 'gray-800 is the card surface');
  assert.deepEqual(values['bd-55-65-81'], hexToRgb(light.colors.border), 'gray-700 is the border colour');
});

test('the gray scale lands exactly on the theme surfaces for every preset', () => {
  for (const theme of DEFAULT_THEMES) {
    const values = themeTokenValues(theme.colors, ['bg-17-24-39', 'bg-31-41-55', 'bg-55-65-81', 'bd-55-65-81', 'fg-156-163-175']);
    assert.deepEqual(values['bg-17-24-39'], hexToRgb(theme.colors.surface), theme.id);
    assert.deepEqual(values['bg-31-41-55'], hexToRgb(theme.colors.card), theme.id);
    assert.deepEqual(values['bg-55-65-81'], hexToRgb(theme.colors.cardHover), theme.id);
    assert.deepEqual(values['bd-55-65-81'], hexToRgb(theme.colors.border), theme.id);
    assert.deepEqual(values['fg-156-163-175'], hexToRgb(theme.colors.muted), theme.id);
  }
});

test('status colours and neutral shadows keep Movix own values', () => {
  const values = themeTokenValues(retroGreen.colors, ['fg-74-222-128', 'bg-234-179-8', 'bg-59-130-246', 'sh-0-0-0', 'not-a-token']);
  assert.deepEqual(values, {});
});

test('the real adapter tokens are all understood', () => {
  assert.ok(tokens.length > 100);
  for (const token of tokens) assert.match(token, /^(bg|fg|bd|sh)-\d+-\d+-\d+$/);
  const mapped = Object.keys(themeTokenValues(retroGreen.colors, tokens));
  assert.ok(mapped.length > 50, `only ${mapped.length} tokens mapped`);
  assert.ok(mapped.includes('bg-220-38-38') && mapped.includes('fg-255-255-255'));
});

test('theme CSS assigns tokens, scales radius and keeps accent text readable', () => {
  const css = generateThemeCss(retroGreen);
  assert.match(css, /--mx-bg-220-38-38: 74,222,128;/);
  assert.match(css, /--mx-radius-scale: 0\.500;/);
  assert.match(css, /--motix-on-primary: #101010/);
  assert.match(css, /color-scheme: dark !important/);
  assert.match(css, /font-family: ui-monospace/);
  assert.match(css, /--mx-button-scale: 0\.992;/);
  assert.match(generateThemeCss({ ...retroGreen, buttonSize: 100 }), /--mx-button-scale: 1\.200;/);
  assert.match(generateThemeCss({ ...retroGreen, buttonSize: 0 }), /--mx-button-scale: 0\.800;/);
  assert.match(css, /\.media-color-card \{\s+--media-color: 74, 222, 128 !important/);
  assert.match(generateThemeCss(light), /color-scheme: light !important/);
  assert.doesNotMatch(generateThemeCss(light), /font-family/);
});

test('the player keeps its own colours unless the user opts in', () => {
  assert.match(generateThemeCss(retroGreen), /\[data-player-controls\][^{]*\{\s+[^}]*--mx-bg-220-38-38: initial;/);
  assert.doesNotMatch(generateThemeCss(retroGreen, { themePlayer: true }), /data-player-controls/);
});

test('over artwork, neutrals fall back to the original colours but the accent stays themed', () => {
  const artwork = /:has\(> img\.absolute\)[^{]*\{([^}]*)\}/.exec(generateThemeCss(light))?.[1] ?? '';
  assert.match(artwork, /--mx-fg-255-255-255: initial;/);
  assert.match(artwork, /--mx-bg-0-0-0: initial;/);
  assert.doesNotMatch(artwork, /--mx-bg-220-38-38/);
});

test('custom CSS is scoped, and dropped when it targets the page shell', () => {
  const scoped = generateThemeCss({ ...retroGreen, customCss: '.a { border-width: 2px; }\n.b, .c { margin: 0; }' });
  assert.ok(scoped.includes('[data-motix-theme] .a { border-width: 2px; }'));
  assert.ok(scoped.includes('[data-motix-theme] .b, [data-motix-theme] .c { margin: 0; }'));
  assert.doesNotMatch(generateThemeCss({ ...retroGreen, customCss: 'body { display: none; }' }), /display:\s*none/);
  assert.doesNotMatch(generateThemeCss({ ...retroGreen, customCss: '@media print { .a { display: none; } }' }), /display:\s*none/);
});

test('custom CSS blocks scripts, urls, imports, and unbalanced rules', () => {
  assert.equal(validateCustomCss('.carousel-card { border: 1px solid #fff; }').valid, true);
  assert.equal(validateCustomCss('@import url(https://example.test/a.css);').valid, false);
  assert.equal(validateCustomCss('.x { background: url(https://example.test/a); }').valid, false);
  assert.equal(validateCustomCss('<script>alert(1)</script>').valid, false);
  assert.equal(validateCustomCss('.x { color: red;').valid, false);
  assert.equal(validateCustomCss(`.x { color: red; } /* ${'x'.repeat(17_000)} */`).valid, false);
});

test('theme import accepts a valid custom theme and rejects bad input', () => {
  const theme = { ...retroGreen, id: 'my-theme', name: 'My Theme', isCustom: true };
  assert.equal(parseThemeImport(JSON.stringify({ schemaVersion: 1, theme })).id, 'my-theme');
  assert.equal(parseThemeImport(JSON.stringify(theme)).isCustom, true);
  assert.throws(() => parseThemeImport('{broken'), /valid theme JSON/);
  assert.throws(() => parseThemeImport('x'.repeat(MAX_THEME_BYTES + 1)), /128 KB/);
  assert.throws(() => parseThemeImport(JSON.stringify({ id: 'bad', colors: {} })), /invalid settings/);
  assert.throws(() => parseThemeImport(JSON.stringify(retroGreen)), /built-in theme/);
  assert.throws(() => parseThemeImport(JSON.stringify({ ...theme, customCss: '@import "x";' })), /invalid settings/);
});

test('the spotlight banner anchors its content to the bottom over a scrim, with readable chips', () => {
  const css = generateThemeCss(retroGreen);
  const spotlight = '.home-section .bg-cover[style*="background-image"]';
  assert.ok(css.includes(`${spotlight} > .flex-col.h-full {\n  justify-content: flex-end !important;`));
  assert.match(css, /bg-cover\[style\*="background-image"\]::after \{[^}]*linear-gradient\(to top, rgb\(0 0 0/);
  assert.ok(css.includes(`${spotlight} > .absolute.inset-0.pointer-events-none {\n  background: none !important;`), 'Movix\'s own scrims are replaced by ours');
  assert.match(css, /\.flex-wrap > span\.rounded-full \{[^}]*backdrop-filter: blur\(8px\)/);
  // Its artwork counts as artwork, so light themes keep its scrims dark.
  assert.ok(generateThemeCss(light).includes(`.carousel-card, ${spotlight},`));
});

test('light themes veil dark detail-page backdrops; every theme turns the header into a frosted bar', () => {
  const lightCss = generateThemeCss(light);
  assert.match(lightCss, /\.fixed\.inset-0\.pointer-events-none\[style\*="url\("\] \{\s*filter: brightness\(3\)/);
  assert.ok(lightCss.includes(':has(> .fixed.inset-0.pointer-events-none[style*="url("])::after'), 'the veil is a sibling layer, untouched by the filter');
  assert.match(lightCss, /linear-gradient\(rgb\(242 244 247 \/ 0\.72\), rgb\(242 244 247 \/ 0\.84\)\)/);
  assert.match(lightCss, /header > \.absolute\.inset-0\.pointer-events-none\.bg-gradient-to-b \{[^}]*backdrop-filter: blur\(14px\)/);
  assert.match(lightCss, /\.bg-blue-600, [^{]*\.bg-green-600[^{]*\{\s*color: rgb\(255 255 255\);[^}]*--mx-fg-255-255-255: initial;/, 'white text stays white on coloured buttons');
  assert.ok(lightCss.includes('[style*="background-image"][style*="url("]:not(.fixed),'), 'inline-image blocks count as artwork');
  assert.ok(lightCss.includes(':has(> .absolute.bg-gradient-to-t[class*="from-black"]))'), 'captioned thumbnails count as artwork');
  assert.ok(lightCss.includes('.from-emerald-600'), 'gradient buttons keep white text');
  const darkCss = generateThemeCss(retroGreen);
  assert.doesNotMatch(darkCss, /brightness\(3\)/);
  assert.match(darkCss, /header > \.absolute\.inset-0\.pointer-events-none\.bg-gradient-to-b \{\s*background: rgb\(7 16 11 \/ 0\.82\)/, 'dark themes get it too, in their own background colour');
});
