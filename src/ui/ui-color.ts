import { hexToRgb, mix, type Rgb } from '../theme/color';

const toHex = (rgb: Rgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;

function luminance([red, green, blue]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** WCAG contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(hexToRgb(a)), luminance(hexToRgb(b))].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Near-black or white, whichever reads better on the given fill. */
export function textOn(fill: string): string {
  return contrastRatio(fill, '#ffffff') >= contrastRatio(fill, '#141218') ? '#ffffff' : '#141218';
}

// The editor's own background; an accent used for rings and indicators must stand 3:1 against it.
export const UI_BACKGROUND = '#15131c';
const MIN_UI_CONTRAST = 3;

/**
 * The theme's accent, lifted toward white just enough to stay visible on the editor background
 * (a navy or near-black accent would otherwise vanish as a focus ring or selection mark).
 */
export function uiAccent(accent: string): string {
  if (contrastRatio(accent, UI_BACKGROUND) >= MIN_UI_CONTRAST) return accent;
  const base = hexToRgb(accent);
  for (let step = 1; step <= 20; step++) {
    const lifted = toHex(mix(base, [255, 255, 255], step / 20));
    if (contrastRatio(lifted, UI_BACKGROUND) >= MIN_UI_CONTRAST) return lifted;
  }
  return '#ffffff';
}

/** Expands #abc to #aabbcc and lowercases; returns undefined for anything that is not a 3- or 6-digit hex colour. */
export function normalizeHex(value: string): string | undefined {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return undefined;
  const digits = match[1]!.length === 3 ? [...match[1]!].map((digit) => digit + digit).join('') : match[1]!;
  return `#${digits.toLowerCase()}`;
}
