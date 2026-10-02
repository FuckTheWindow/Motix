// Maps each colour Movix hard-codes (one adapter token per colour and usage) onto a theme.
// Neutrals follow the theme's surface/text ramp, Movix red follows the accent, and
// everything else (status greens, warning yellows, brand blues…) is left untouched.
import type { ThemeColors } from '../shared/types';
import { hexToRgb, hslToRgb, mix, rgbToHsl, type Rgb } from './color';

type Kind = 'bg' | 'fg' | 'bd' | 'sh';
type Ramp = ReadonlyArray<readonly [lightness: number, color: Rgb]>;

// Tailwind's grays and slates stay under this channel spread; saturated colours do not.
const NEUTRAL_MAX_SPREAD = 45;
const ACCENT_MAX_HUE_DISTANCE = 6;
const ACCENT_MIN_SATURATION = 0.45;
// red-600 and red-700: the base and hover shades of Movix's brand red.
const BRAND_BASE: Rgb = [220, 38, 38];
const BRAND_HOVER: Rgb = [185, 28, 28];
const BRAND_BASE_LIGHTNESS = rgbToHsl(BRAND_BASE)[2];

// Movix is built on Tailwind's gray scale, so its steps are the anchors of every ramp:
// gray-900 is a surface, gray-800 a card, gray-700 a hover state or border, gray-400 muted text.
const lightnessOf = (color: Rgb) => rgbToHsl(color)[2];
const GRAY = {
  g900: lightnessOf([17, 24, 39]),
  g800: lightnessOf([31, 41, 55]),
  g700: lightnessOf([55, 65, 81]),
  g500: lightnessOf([107, 114, 128]),
  g400: lightnessOf([156, 163, 175]),
};
// Anything this dark (#0a0a0f and below) is the page background itself.
const NEAR_BLACK = 0.05;

interface Ramps { bg: Ramp; fg: Ramp; bd: Ramp }

function ramps(colors: ThemeColors): Ramps {
  const background = hexToRgb(colors.background);
  const muted = hexToRgb(colors.muted);
  const text = hexToRgb(colors.text);
  const cardHover = hexToRgb(colors.cardHover);
  const border = hexToRgb(colors.border);
  return {
    bg: [[NEAR_BLACK, background], [GRAY.g900, hexToRgb(colors.surface)], [GRAY.g800, hexToRgb(colors.card)], [GRAY.g700, cardHover], [GRAY.g500, mix(cardHover, muted, 0.5)], [GRAY.g400, muted], [1, text]],
    fg: [[0, background], [GRAY.g700, mix(background, muted, 0.5)], [GRAY.g400, muted], [1, text]],
    bd: [[0, background], [GRAY.g900, mix(background, border, 0.5)], [GRAY.g700, border], [GRAY.g400, muted], [1, text]],
  };
}

function sample(ramp: Ramp, lightness: number): Rgb {
  const first = ramp[0]!;
  if (lightness <= first[0]) return first[1];
  for (let index = 1; index < ramp.length; index += 1) {
    const [stop, color] = ramp[index]!;
    const [previousStop, previousColor] = ramp[index - 1]!;
    if (lightness <= stop) return mix(previousColor, color, (lightness - previousStop) / (stop - previousStop));
  }
  return ramp[ramp.length - 1]![1];
}

function isNeutral([r, g, b]: Rgb): boolean {
  return Math.max(r, g, b) - Math.min(r, g, b) < NEUTRAL_MAX_SPREAD;
}

function isBrandRed(color: Rgb): boolean {
  const [hue, saturation] = rgbToHsl(color);
  return Math.min(hue, 360 - hue) <= ACCENT_MAX_HUE_DISTANCE && saturation >= ACCENT_MIN_SATURATION;
}

function accentShade(source: Rgb, colors: ThemeColors): Rgb {
  const same = (other: Rgb) => source.every((channel, index) => channel === other[index]);
  if (same(BRAND_BASE)) return hexToRgb(colors.primary);
  if (same(BRAND_HOVER)) return hexToRgb(colors.primaryHover);
  const [hue, saturation, lightness] = rgbToHsl(hexToRgb(colors.primary));
  const shifted = lightness + (rgbToHsl(source)[2] - BRAND_BASE_LIGHTNESS);
  return hslToRgb([hue, saturation, Math.min(0.96, Math.max(0.04, shifted))]);
}

function parseToken(token: string): { kind: Kind; color: Rgb } | undefined {
  const match = /^(bg|fg|bd|sh)-(\d+)-(\d+)-(\d+)$/.exec(token);
  if (!match) return undefined;
  return { kind: match[1] as Kind, color: [Number(match[2]), Number(match[3]), Number(match[4])] };
}

/** Whether a token is one of Movix's neutrals (surfaces, text, borders) rather than its brand red. */
export function isNeutralToken(token: string): boolean {
  const parsed = parseToken(token);
  return parsed !== undefined && isNeutral(parsed.color);
}

/** Returns the themed colour for each adapter token, omitting tokens that keep Movix's own colour. */
export function themeTokenValues(colors: ThemeColors, tokens: readonly string[]): Record<string, Rgb> {
  const themeRamps = ramps(colors);
  const values: Record<string, Rgb> = {};
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) continue;
    const { kind, color } = parsed;
    if (isNeutral(color)) {
      // Shadows stay dark on every theme: a tinted shadow reads as a glow.
      if (kind !== 'sh') values[token] = sample(themeRamps[kind], rgbToHsl(color)[2]);
    } else if (isBrandRed(color)) {
      values[token] = accentShade(color, colors);
    }
  }
  return values;
}
