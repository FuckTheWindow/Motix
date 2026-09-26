import type { MotixTheme } from './types';
import { DEFAULT_THEMES } from '../data/themes';

export const MAX_THEME_BYTES = 128 * 1024;
export const MAX_CUSTOM_CSS = 16 * 1024;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const STYLE_FIELDS = ['background', 'surface', 'card', 'cardHover', 'primary', 'primaryHover', 'text', 'muted', 'border'] as const;

export function validateCustomCss(css: string): { valid: boolean; error?: string } {
  if (css.length > MAX_CUSTOM_CSS) return { valid: false, error: 'Custom styles must be 16 KB or smaller.' };
  if (/<\/?\s*(?:script|style|iframe|object|embed)\b/i.test(css)) return { valid: false, error: 'HTML and script tags are not allowed.' };
  if (/javascript\s*:/i.test(css)) return { valid: false, error: 'javascript: URLs are not allowed.' };
  if (/@import\b|url\s*\(|expression\s*\(|-moz-binding|behavior\s*:|javascript\s*:/i.test(css)) return { valid: false, error: 'Remote resources and executable CSS features are not allowed.' };
  if (/[{}]/.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) {
    let depth = 0;
    for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth < 0) return { valid: false, error: 'The curly braces do not match.' };
    }
    if (depth !== 0) return { valid: false, error: 'The curly braces do not match.' };
  }
  if (/\beval\s*\(|\bnew\s+Function\b/i.test(css)) return { valid: false, error: 'JavaScript is not allowed in custom styles.' };
  return { valid: true };
}

export function validateTheme(value: unknown): value is MotixTheme {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const theme = value as Partial<MotixTheme>;
  if (typeof theme.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(theme.id)) return false;
  if (typeof theme.name !== 'string' || theme.name.length < 1 || theme.name.length > 48) return false;
  if (typeof theme.description !== 'string' || theme.description.length > 160) return false;
  if (!['retro', 'cyberpunk', 'cinema', 'nature', 'ocean', 'arcade', 'minimal', 'terminal'].includes(theme.atmosphere ?? '')) return false;
  if (!['classic', 'modern', 'retro', 'futuristic', 'minimal'].includes(theme.style ?? '')) return false;
  if (!theme.colors || typeof theme.colors !== 'object') return false;
  if (!STYLE_FIELDS.every((field) => typeof theme.colors?.[field] === 'string' && HEX.test(theme.colors[field]))) return false;
  if (![theme.radius, theme.shadow, theme.glow, theme.contrast, theme.buttonSize].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100)) return false;
  if (theme.customCss !== undefined && (typeof theme.customCss !== 'string' || !validateCustomCss(theme.customCss).valid)) return false;
  return true;
}

export function parseThemeImport(text: string): MotixTheme {
  if (new TextEncoder().encode(text).byteLength > MAX_THEME_BYTES) throw new Error('Theme files must be 128 KB or smaller.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid theme JSON.');
  }
  if (parsed && typeof parsed === 'object' && 'theme' in parsed) parsed = (parsed as { theme: unknown }).theme;
  if (!validateTheme(parsed)) throw new Error('The theme file has missing or invalid settings.');
  if (DEFAULT_THEMES.some((theme) => theme.id === parsed.id)) throw new Error('A built-in theme already uses that theme ID.');
  return { ...parsed, isCustom: true };
}
