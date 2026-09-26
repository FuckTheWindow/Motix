import type { MotixTheme } from './types';
import { validateCustomCss } from './validation';

function hexToHsl(hex: string): string {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? [...normalized].map((part) => part + part).join('') : normalized;
  const values = full.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16) / 255) ?? [0, 0, 0];
  const [r = 0, g = 0, b = 0] = values;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    switch (max) {
      case r: hue = ((g - b) / delta) % 6; break;
      case g: hue = (b - r) / delta + 2; break;
      default: hue = (r - g) / delta + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function hexToRgb(hex: string): string {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? [...normalized].map((part) => part + part).join('') : normalized;
  const value = Number.parseInt(full, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

function isLight(hex: string): boolean {
  const channels = hexToRgb(hex).split(',').map((part) => Number(part.trim()) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

function scopedCustomCss(css: string): string {
  if (!css) return '';
  const validation = validateCustomCss(css);
  if (!validation.valid) return '';
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
  return consumed.length === clean.length ? rules.join('\n') : '';
}

export function generateThemeCss(theme: MotixTheme): string {
  const c = theme.colors;
  const glow = Math.round(theme.glow * 0.14);
  const shadowAlpha = Math.min(0.72, theme.shadow / 150).toFixed(2);
  const hsl = {
    background: hexToHsl(c.background),
    surface: hexToHsl(c.surface),
    card: hexToHsl(c.card),
    text: hexToHsl(c.text),
    primary: hexToHsl(c.primary),
    muted: hexToHsl(c.muted),
    border: hexToHsl(c.border),
  };
  const radius = `${Math.max(0, Math.min(32, theme.radius))}px`;
  const font = theme.style === 'retro' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit';
  const variables = `
    --motix-background: ${c.background};
    --motix-surface: ${c.surface};
    --motix-card: ${c.card};
    --motix-card-hover: ${c.cardHover};
    --motix-primary: ${c.primary};
    --motix-primary-hover: ${c.primaryHover};
    --motix-primary-text: ${isLight(c.primary) ? '#101010' : '#ffffff'};
    --motix-text: ${c.text};
    --motix-muted: ${c.muted};
    --motix-border: ${c.border};
    --motix-radius: ${radius};
    --motix-shadow: 0 8px 30px rgba(0, 0, 0, ${shadowAlpha});
    --motix-glow: ${glow ? `0 0 ${glow}px ${c.primary}55` : 'none'};
    --motix-media-color: ${hexToRgb(c.primary)};
    --motix-media-surface: ${hexToRgb(c.card)};
    --background: ${hsl.background};
    --foreground: ${hsl.text};
    --card: ${hsl.card};
    --card-foreground: ${hsl.text};
    --popover: ${hsl.surface};
    --popover-foreground: ${hsl.text};
    --primary: ${hsl.primary};
    --primary-color: ${c.primary};
    --primary-hover: ${c.primaryHover};
    --primary-foreground: ${hsl.text};
    --secondary: ${hsl.surface};
    --secondary-foreground: ${hsl.text};
    --muted: ${hsl.surface};
    --muted-foreground: ${hsl.muted};
    --accent: ${hsl.surface};
    --accent-foreground: ${hsl.text};
    --border: ${hsl.border};
    --input: ${hsl.border};
    --ring: ${hsl.primary};
    --radius: ${radius};
    --background-dark: ${c.background};
    --text-light: ${c.text};
    --text-muted: ${c.muted};
  `;
  const custom = scopedCustomCss(theme.customCss ?? '');

  return `:root[data-motix-theme] {${variables}}
html[data-motix-theme] {
  color-scheme: ${isLight(c.background) ? 'light' : 'dark'} !important;
  background-color: var(--motix-background) !important;
  color: var(--motix-text) !important;
}
html[data-motix-theme] body,
html[data-motix-theme] #root {
  background-color: var(--motix-background) !important;
  color: var(--motix-text) !important;
  font-family: ${font} !important;
}

/* Shared page shells across Movix home, catalog, search, detail and provider routes. */
html[data-motix-theme] #root .min-h-screen.bg-black,
html[data-motix-theme] #root .relative.overflow-hidden.w-full.min-h-screen.bg-black {
  background-color: var(--motix-background) !important;
  color: var(--motix-text) !important;
}
html[data-motix-theme] #root footer[class~="bg-black"] {
  background-color: var(--motix-surface) !important;
  color: var(--motix-muted) !important;
  border-color: var(--motix-border) !important;
}

/* Current Movix poster cards use inline RGB vars for their accent wash and surface. */
html[data-motix-theme] #root .media-color-card {
  --media-color: var(--motix-media-color) !important;
  --media-color-surface: var(--motix-media-surface) !important;
  background-color: var(--motix-card) !important;
  border-color: var(--motix-border) !important;
  border-radius: var(--motix-radius) !important;
  box-shadow: var(--motix-shadow), var(--motix-glow) !important;
}
html[data-motix-theme] #root .media-color-card:hover {
  background-color: var(--motix-card-hover) !important;
  border-color: var(--motix-primary) !important;
}
html[data-motix-theme] #root .media-card-muted { color: var(--motix-muted) !important; }
html[data-motix-theme] #root .section-title {
  color: var(--motix-primary) !important;
  background-image: none !important;
  -webkit-text-fill-color: var(--motix-primary) !important;
}
html[data-motix-theme] #root .platform-link > div[class~="bg-white"] {
  background-color: var(--motix-card) !important;
  border-radius: var(--motix-radius) !important;
  box-shadow: var(--motix-shadow) !important;
}
html[data-motix-theme] #root .platform-link p[class~="bg-black/60"] {
  background-color: var(--motix-primary) !important;
  color: var(--motix-primary-text) !important;
}

/* Recolor the current Tailwind utility classes used by Movix controls and panels. */
html[data-motix-theme] #root button[class~="bg-red-600"],
html[data-motix-theme] #root button[class~="bg-green-600"],
html[data-motix-theme] #root button[class~="bg-blue-600"],
html[data-motix-theme] #root a[class~="bg-red-600"] {
  background-color: var(--motix-primary) !important;
  border-color: var(--motix-primary) !important;
  color: var(--motix-primary-text) !important;
  border-radius: var(--motix-radius) !important;
  box-shadow: var(--motix-glow) !important;
  font-size: calc(0.875rem + ${Math.round(theme.buttonSize / 25)}px) !important;
}
html[data-motix-theme] #root button[class~="bg-red-700"],
html[data-motix-theme] #root button[class~="bg-green-700"],
html[data-motix-theme] #root button[class~="bg-blue-700"],
html[data-motix-theme] #root a[class~="bg-red-500"] {
  background-color: var(--motix-primary-hover) !important;
}
html[data-motix-theme] #root [class~="bg-white/5"],
html[data-motix-theme] #root [class~="bg-white/10"],
html[data-motix-theme] #root [class~="bg-white/15"],
html[data-motix-theme] #root [class~="bg-white/20"],
html[data-motix-theme] #root [class~="bg-black/60"],
html[data-motix-theme] #root [class~="bg-gray-800"] {
  background-color: var(--motix-surface) !important;
}
html[data-motix-theme] #root [class~="bg-black"]:not(.absolute):not(.fixed):not(.min-h-screen) {
  background-color: var(--motix-surface) !important;
}
html[data-motix-theme] #root [class~="border-white/10"],
html[data-motix-theme] #root [class~="border-gray-800"],
html[data-motix-theme] #root [class~="border-gray-700"] {
  border-color: var(--motix-border) !important;
}
html[data-motix-theme] #root [class~="text-white"],
html[data-motix-theme] #root [class~="text-gray-200"] { color: var(--motix-text) !important; }
html[data-motix-theme] #root [class~="text-gray-300"],
html[data-motix-theme] #root [class~="text-gray-400"],
html[data-motix-theme] #root [class~="text-gray-500"] { color: var(--motix-muted) !important; }
html[data-motix-theme] #root input,
html[data-motix-theme] #root textarea,
html[data-motix-theme] #root select {
  background-color: var(--motix-surface) !important;
  color: var(--motix-text) !important;
  border-color: var(--motix-border) !important;
  border-radius: var(--motix-radius) !important;
}
html[data-motix-theme] #root input::placeholder,
html[data-motix-theme] #root textarea::placeholder { color: var(--motix-muted) !important; }
html[data-motix-theme] #root { font-family: ${font} !important; }
${custom}`;
}
