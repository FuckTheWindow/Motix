// Builds the small, per-theme stylesheet. The heavy lifting lives in generated/adapter.css,
// which rewires every Movix colour to a `--mx-*` custom property; this module only assigns
// those properties and adds the few rules a colour remap cannot express.
import type { MotixTheme } from '../shared/types';
import { hexToRgb, isLight } from './color';
import tokens from './generated/tokens.json';
import { isNeutralToken, themeTokenValues } from './palette';
import { validateCustomCss } from './validation';

export interface ThemeCssOptions {
  /** Restyle the video player too. Off by default so playback UI keeps Movix's own look. */
  themePlayer?: boolean;
}

const SCOPE = 'html[data-motix-theme]';
// Movix has no single player root: these cover its control overlays, video.js, and the element wrapping a <video>.
const PLAYER_SCOPE = ':is([data-player-controls], .video-js, :has(> video))';
// Text and scrims laid over artwork (hero banners, poster cards) are designed against the image, not the page.
const ARTWORK_SCOPE = ':is(:has(> img.absolute), .carousel-card)';
const BRAND_BUTTONS = ':is(.bg-red-500, .bg-red-600, .bg-red-700, .hover\\:bg-red-500:hover, .hover\\:bg-red-600:hover, .hover\\:bg-red-700:hover)';
// Movix's corners are designed around this radius; the slider scales them relative to it.
const BASE_RADIUS_PX = 12;
const MAX_RADIUS_PX = 32;
const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';

function scopedCustomCss(css: string): string {
  if (!css || !validateCustomCss(css).valid) return '';
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (!clean) return '';
  let consumed = '';
  const rules: string[] = [];
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rulePattern.exec(clean))) {
    const selectors = match[1]!.trim().split(',').map((selector) => selector.trim());
    if (selectors.some((selector) => !selector || /(^|\s)(?:html|body|:root)(?:$|[\s.#:[>+~])/i.test(selector) || /[\\@]/.test(selector))) return '';
    consumed += match[0];
    rules.push(`${selectors.map((selector) => `[data-motix-theme] ${selector}`).join(', ')} { ${match[2]!.trim()} }`);
  }
  // Anything left over between rules means the input was not plain `selector { declarations }` CSS.
  return consumed.length === clean.length ? rules.join('\n') : '';
}

export function generateThemeCss(theme: MotixTheme, options: ThemeCssOptions = {}): string {
  const c = theme.colors;
  const tokenValues = themeTokenValues(c, tokens);
  const tokenNames = Object.keys(tokenValues);
  const radius = Math.max(0, Math.min(MAX_RADIUS_PX, theme.radius));
  const glow = Math.round(theme.glow * 0.14);
  const shadowAlpha = Math.min(0.72, theme.shadow / 150).toFixed(2);
  const buttonOffset = Math.round((theme.buttonSize - 50) / 25);

  const variables = [
    ...tokenNames.map((token) => `--mx-${token}: ${tokenValues[token]!.join(',')};`),
    `--mx-radius-scale: ${(radius / BASE_RADIUS_PX).toFixed(3)};`,
    `--motix-background: ${c.background};`,
    `--motix-surface: ${c.surface};`,
    `--motix-card: ${c.card};`,
    `--motix-card-hover: ${c.cardHover};`,
    `--motix-primary: ${c.primary};`,
    `--motix-primary-hover: ${c.primaryHover};`,
    `--motix-on-primary: ${isLight(hexToRgb(c.primary)) ? '#101010' : '#ffffff'};`,
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
  ${reset([...tokenNames, 'radius-scale'])}
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
${theme.style === 'retro' ? `${SCOPE} body { font-family: ${MONOSPACE} !important; }\n` : ''}
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

/* Text on the accent colour must stay readable whatever accent the user picks. */
${SCOPE}:root ${BRAND_BUTTONS} {
  color: var(--motix-on-primary) !important;
}
${SCOPE} #root :is(button, a)${BRAND_BUTTONS} {
  box-shadow: var(--motix-glow) !important;${buttonOffset ? `\n  font-size: calc(0.875rem + ${buttonOffset}px) !important;` : ''}
}
${playerReset}
${scopedCustomCss(theme.customCss ?? '')}`;
}
