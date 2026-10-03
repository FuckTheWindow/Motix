export type Rgb = readonly [number, number, number];
export type Hsl = readonly [hue: number, saturation: number, lightness: number];

export function hexToRgb(hex: string): Rgb {
  const digits = hex.replace('#', '');
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function rgbToHsl([red, green, blue]: Rgb): Hsl {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation, lightness];
}

export function hslToRgb([hue, saturation, lightness]: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = lightness - chroma / 2;
  const [r, g, b] = sector < 1 ? [chroma, second, 0]
    : sector < 2 ? [second, chroma, 0]
    : sector < 3 ? [0, chroma, second]
    : sector < 4 ? [0, second, chroma]
    : sector < 5 ? [second, 0, chroma]
    : [chroma, 0, second];
  return [Math.round((r + offset) * 255), Math.round((g + offset) * 255), Math.round((b + offset) * 255)];
}

export function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [0, 1, 2].map((index) => Math.round(from[index]! + (to[index]! - from[index]!) * amount)) as unknown as Rgb;
}

/** What CSS `filter: hue-rotate()` does to a colour (it is a matrix, not a true HSL rotation). */
export function hueRotate([r, g, b]: Rgb, degrees: number): Rgb {
  const angle = (degrees * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const clamp = (value: number) => Math.round(Math.min(255, Math.max(0, value)));
  return [
    clamp(r * (0.213 + c * 0.787 - s * 0.213) + g * (0.715 - c * 0.715 - s * 0.715) + b * (0.072 - c * 0.072 + s * 0.928)),
    clamp(r * (0.213 - c * 0.213 + s * 0.143) + g * (0.715 + c * 0.285 + s * 0.14) + b * (0.072 - c * 0.072 - s * 0.283)),
    clamp(r * (0.213 - c * 0.213 - s * 0.787) + g * (0.715 - c * 0.715 + s * 0.715) + b * (0.072 + c * 0.928 + s * 0.072)),
  ];
}

/** The `hue-rotate()` angle that brings `source` closest to the hue of `target`. */
export function hueRotationTo(source: Rgb, target: Rgb): number {
  const targetHue = rgbToHsl(target)[0];
  let best = 0;
  let bestDistance = Infinity;
  for (let degrees = 0; degrees < 360; degrees += 1) {
    const distance = Math.abs(rgbToHsl(hueRotate(source, degrees))[0] - targetHue);
    const wrapped = Math.min(distance, 360 - distance);
    if (wrapped < bestDistance) {
      best = degrees;
      bestDistance = wrapped;
    }
  }
  return best;
}

// WCAG relative luminance, used to pick readable text on a coloured surface.
export function isLight(color: Rgb): boolean {
  const [r = 0, g = 0, b = 0] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}
