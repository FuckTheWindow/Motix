// Builds the small, per-theme stylesheet. The heavy lifting lives in generated/adapter.css,
// which rewires every Movix colour to a `--mx-*` custom property; this module only assigns
// those properties and adds the few rules a colour remap cannot express.
import type { MotixTheme } from '../shared/types';
import { hexToRgb, hueRotationTo, isLight, rgbToHsl } from './color';
import tokens from './generated/tokens.json';
import { isNeutralToken, themeTokenValues } from './palette';
import { parseCustomCss, validateCustomCss, type CustomRule } from './validation';

export interface ThemeCssOptions {
  /** Restyle the video player too. Off by default so playback UI keeps Movix's own look. */
  themePlayer?: boolean;
}

const SCOPE = 'html[data-motix-theme]';
// Movix has no single player root: these cover its control overlays, video.js, and the element wrapping a <video>.
const PLAYER_SCOPE = ':is([data-player-controls], .video-js, :has(> video))';
// The home page's "team selection" banner: its artwork is an inline background-image, not an <img>.
const SPOTLIGHT = '.home-section .bg-cover[style*="background-image"]';
// Blocks whose artwork is an inline background-image (the spotlight, the watch placeholder on detail pages);
// full-page backdrops are excluded, they hold no content and get their own treatment.
const INLINE_ARTWORK = '[style*="background-image"][style*="url("]:not(.fixed)';
// Text and scrims laid over artwork (hero banners, poster cards, inline-image blocks) are designed against the image, not the page.
// A black scrim rising from the bottom (`bg-gradient-to-t from-black`) means a caption laid over an image, like image thumbnails.
const CAPTIONED_ARTWORK = ':has(> .absolute.bg-gradient-to-t[class*="from-black"])';
const ARTWORK_SCOPE = `:is(:has(> img.absolute), .carousel-card, ${SPOTLIGHT}, ${INLINE_ARTWORK}, ${CAPTIONED_ARTWORK})`;
// Solid buttons and badges in a fixed, non-brand colour (blue trailer, green download): their white text must stay white.
const COLORED_FILLS = `:is(${['blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'orange', 'amber', 'yellow']
  .flatMap((hue) => [500, 600, 700, 800].flatMap((shade) => [`.bg-${hue}-${shade}`, `.from-${hue}-${shade}`])).join(', ')})`;
const BRAND_BUTTONS = ':is(.bg-red-500, .bg-red-600, .bg-red-700, .hover\\:bg-red-500:hover, .hover\\:bg-red-600:hover, .hover\\:bg-red-700:hover)';
// Movix's corners are designed around this radius; the slider scales them relative to it.
const BASE_RADIUS_PX = 12;
const MAX_RADIUS_PX = 32;
// Anything Movix presents as a button: real buttons, plus links styled as one.
const BUTTONS = ':is(button, [role="button"], a[class~="inline-flex"])';
// The red Movix draws its pointer grid with, and the saturation below which an accent counts as gray.
const GRID_RED = [239, 68, 68] as const;
const MIN_TINT_SATURATION = 0.12;
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
// Movix's white, as text, fill and border tokens.
const WHITE_TOKENS = ['fg-255-255-255', 'bg-255-255-255', 'bd-255-255-255'];

function scopedCustomCss(css: string): string {
  if (!css || !validateCustomCss(css).valid) return '';
  const scope = (rules: CustomRule[]) => rules
    .map(({ selectors, body }) => `${selectors.map((selector) => `[data-motix-theme] ${selector}`).join(', ')} { ${body} }`)
    .join('\n');
  return (parseCustomCss(css) ?? []).map(({ media, rules }) => (media ? `@media ${media} {\n${scope(rules)}\n}` : scope(rules))).join('\n');
}

// Full-page backdrops (detail pages): the film's artwork under an inline black gradient.
const PAGE_BACKDROP = '.fixed.inset-0.pointer-events-none[style*="url("]';
// How much a light theme lifts that backdrop, and the veil laid over it (top and bottom opacity).
const BACKDROP_BRIGHTNESS = 3;
const BACKDROP_VEIL = [0.72, 0.84] as const;
// The header's fixed scrim; Movix keeps the same black-to-transparent fade whatever the scroll position.
const HEADER_SCRIM = 'header > .absolute.inset-0.pointer-events-none.bg-gradient-to-b';

/** Movix fades its header from black to transparent, so the menu sits on whatever scrolls under it. A frosted bar in
    the theme's own colours keeps it readable over posters and banners, on light and dark themes alike. */
function headerCss(c: MotixTheme['colors']): string {
  return `${SCOPE} #root ${HEADER_SCRIM} {
  background: rgb(${hexToRgb(c.background).join(' ')} / 0.82) !important;
  border-bottom: 1px solid rgb(${hexToRgb(c.border).join(' ')} / 0.7) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.4);
  backdrop-filter: blur(14px) saturate(1.4);
}
`;
}

/** Movix is designed dark: these surfaces are dark by construction and need a light treatment. */
function lightThemeCss(c: MotixTheme['colors'], neutralTextTokens: string[]): string {
  const background = hexToRgb(c.background).join(' ');
  return `/* Light theme: white text on fixed-colour fills keeps its original value instead of turning dark. Most of these
   buttons inherit their colour from a themed container, hence the base colour; explicit colour classes still win
   through the adapter's !important rules. */
${SCOPE} #root ${COLORED_FILLS} {
  color: rgb(255 255 255);
  ${neutralTextTokens.map((name) => `--mx-${name}: initial;`).join(' ')}
}
/* Light theme: detail-page backdrops sit under an inline 70-90% black gradient no token reaches. Brightening the
   backdrop cancels most of it so the artwork shows, then a veil of the page colour (a sibling layer, so the filter
   leaves it alone) keeps the page light: fixed above the backdrop (z-0), below the content (z-10). */
${SCOPE} #root ${PAGE_BACKDROP} {
  filter: brightness(${BACKDROP_BRIGHTNESS}) saturate(1.1);
}
${SCOPE} #root :has(> ${PAGE_BACKDROP})::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(rgb(${background} / ${BACKDROP_VEIL[0]}), rgb(${background} / ${BACKDROP_VEIL[1]}));
}
/* A brand-coloured fill picks white or dark text from its own full-strength colour (below), which is right for an
   enabled button. Movix fades the current page number to 30% opacity instead of recolouring it, built for its own
   near-black page: opacity dims the text as much as the fill, so on a light page both the pale-blue background and
   the fading dark text lose contrast together. A pre-blended background at full opacity keeps the same pale tint
   without taking the text down with it. */
${SCOPE} #root ${BRAND_BUTTONS}:disabled {
  opacity: 1 !important;
  background-color: rgb(${hexToRgb(c.primary).join(' ')} / 0.3) !important;
  color: var(--motix-text) !important;
}
`;
}

export function generateThemeCss(theme: MotixTheme, options: ThemeCssOptions = {}): string {
  const c = theme.colors;
  const tokenValues = themeTokenValues(c, tokens);
  const tokenNames = Object.keys(tokenValues);
  const radius = Math.max(0, Math.min(MAX_RADIUS_PX, theme.radius));
  const glow = Math.round(theme.glow * 0.14);
  const shadowAlpha = Math.min(0.72, theme.shadow / 150).toFixed(2);
  // The slider's midpoint leaves buttons untouched; its ends shrink or grow them by 20%.
  const buttonScale = 0.8 + Math.max(0, Math.min(100, theme.buttonSize)) / 250;
  const primary = hexToRgb(c.primary);
  const onPrimary = isLight(primary) ? [16, 16, 16] : [255, 255, 255];
  // Canvas pixels are out of CSS's reach, but a filter can turn their red into the accent's hue.
  const gridFilter = rgbToHsl(primary)[1] < MIN_TINT_SATURATION ? 'grayscale(1)' : `hue-rotate(${hueRotationTo(GRID_RED, primary)}deg)`;

  const variables = [
    ...tokenNames.map((token) => `--mx-${token}: ${tokenValues[token]!.join(',')};`),
    `--mx-radius-scale: ${(radius / BASE_RADIUS_PX).toFixed(3)};`,
    `--mx-button-scale: ${buttonScale.toFixed(3)};`,
    `--motix-background: ${c.background};`,
    `--motix-surface: ${c.surface};`,
    `--motix-card: ${c.card};`,
    `--motix-card-hover: ${c.cardHover};`,
    `--motix-primary: ${c.primary};`,
    `--motix-primary-hover: ${c.primaryHover};`,
    `--motix-on-primary: ${isLight(primary) ? '#101010' : '#ffffff'};`,
    `--motix-text: ${c.text};`,
    `--motix-muted: ${c.muted};`,
    `--motix-border: ${c.border};`,
    `--motix-radius: ${radius}px;`,
    `--motix-shadow: 0 8px 30px rgba(0, 0, 0, ${shadowAlpha});`,
    `--motix-glow: ${glow ? `0 0 ${glow}px ${c.primary}55` : '0 0 #0000'};`,
  ];

  // Setting a token to `initial` makes the adapter fall back to Movix's original colour.
  const reset = (names: string[]) => names.map((name) => `--mx-${name}: initial;`).join(' ');
  const playerReset = options.themePlayer ? '' : `
/* The player keeps Movix's own look. */
${SCOPE} ${PLAYER_SCOPE} {
  ${reset([...tokenNames, 'radius-scale', 'button-scale'])}
}`;

  return `${SCOPE} {
  ${variables.join('\n  ')}
  color-scheme: ${isLight(hexToRgb(c.background)) ? 'light' : 'dark'} !important;
}
${SCOPE},
${SCOPE} body,
${SCOPE} #root {
  background-color: var(--motix-background) !important;
  color: var(--motix-text) !important;
}
${theme.style === 'retro' ? `${SCOPE} body,\n${SCOPE} #root :is(.font-sans, button, input, select, textarea) {\n  font-family: ${MONOSPACE} !important;\n}\n` : ''}
/* \`zoom\` scales a button's text, padding and icon together, whatever classes built it. */
${SCOPE} #root ${BUTTONS} {
  zoom: var(--mx-button-scale, 1);
}

/* Poster cards take their tint from inline per-poster variables, which no colour remap can reach. */
${SCOPE} #root .media-color-card {
  --media-color: ${hexToRgb(c.primary).join(', ')} !important;
  --media-color-surface: ${hexToRgb(c.card).join(', ')} !important;
  box-shadow: var(--motix-shadow), var(--motix-glow) !important;
}

/* Over artwork, neutrals keep their original values so light text stays on its dark scrim; the accent still applies. */
${SCOPE} ${ARTWORK_SCOPE} {
  ${reset(tokenNames.filter(isNeutralToken))}
}

/* Spotlight banner: content anchored to the bottom over a scrim, so it stays off the artwork's busy middle. */
${SCOPE} #root ${SPOTLIGHT} > .flex-col.h-full {
  justify-content: flex-end !important;
}
/* Movix stacks two scrims (dark-transparent-dark, top to bottom and left to right) built for centred text;
   with the text at the bottom, a single bottom-up gradient is enough. */
${SCOPE} #root ${SPOTLIGHT} > .absolute.inset-0.pointer-events-none {
  background: none !important;
}
${SCOPE} #root ${SPOTLIGHT}::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  background: linear-gradient(to top, rgb(0 0 0 / 0.88) 0%, rgb(0 0 0 / 0.6) 35%, rgb(0 0 0 / 0) 70%);
}
/* Its chips sit straight on the artwork; dark glass keeps them readable on any image. */
${SCOPE} #root ${SPOTLIGHT} .flex-wrap > span.rounded-full {
  background-color: rgb(0 0 0 / 0.45) !important;
  border-color: rgb(255 255 255 / 0.18) !important;
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}
${SCOPE} #root ${SPOTLIGHT} .flex-wrap > span.rounded-full:not([class*="text-yellow"]) {
  color: rgb(255 255 255 / 0.95) !important;
}
${SCOPE} #root ${SPOTLIGHT} .flex-wrap > span.rounded-full[class*="text-yellow"] {
  border-color: rgb(234 179 8 / 0.45) !important;
}

${headerCss(c)}${isLight(hexToRgb(c.background)) ? lightThemeCss(c, tokenNames.filter((name) => name.startsWith('fg-') && isNeutralToken(name))) : ''}
/* Section titles are styled by <style> blocks Movix injects at runtime, which the adapter never sees. */
${SCOPE} #root .section-title {
  background-image: none !important;
  color: var(--motix-text) !important;
  -webkit-text-fill-color: var(--motix-text) !important;
}
${SCOPE} #root .section-title:hover {
  color: var(--motix-primary) !important;
  -webkit-text-fill-color: var(--motix-primary) !important;
}
${SCOPE} #root .section-title::after {
  background: var(--motix-primary) !important;
}

/* The grid that lights up under the pointer is painted in red on a canvas, and its halo is an inline gradient. */
${SCOPE} #root canvas.absolute.inset-0.z-0.pointer-events-none {
  filter: ${gridFilter} !important;
}
${SCOPE} #root .square-bg-halo {
  background: radial-gradient(circle, rgba(${primary.join(', ')}, 0.15) 0%, transparent 70%) !important;
}

/* Text on the accent colour must stay readable whatever accent the user picks. */
${SCOPE}:root ${BRAND_BUTTONS} {
  color: var(--motix-on-primary) !important;
}
${SCOPE} #root :is(button, a)${BRAND_BUTTONS} {
  box-shadow: var(--motix-glow) !important;
}
/* Active tabs draw their accent pill as a child covering the button (inset-0); an accent underline does not count. */
${SCOPE} #root :is(button, a):has(> .absolute.inset-0${BRAND_BUTTONS}) {
  color: var(--motix-on-primary) !important;
}
/* On the accent, Movix's white (inner labels, counters and their translucent pills) means "readable on the accent". */
${SCOPE} #root :is(${BRAND_BUTTONS}, :is(button, a):has(> .absolute.inset-0${BRAND_BUTTONS})) {
  ${WHITE_TOKENS.filter((name) => name in tokenValues).map((name) => `--mx-${name}: ${onPrimary.join(',')};`).join(' ')}
}
${playerReset}
${scopedCustomCss(theme.customCss ?? '')}`;
}
