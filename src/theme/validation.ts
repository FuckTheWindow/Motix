import type { MotixTheme } from '../shared/types';
import { DEFAULT_THEMES } from './presets';

export const MAX_THEME_BYTES = 128 * 1024;
export const MAX_CUSTOM_CSS = 16 * 1024;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const STYLE_FIELDS = ['background', 'surface', 'card', 'cardHover', 'primary', 'primaryHover', 'text', 'muted', 'border'] as const;

// Every CSS function that can fetch a resource, not just url(): image-set() and friends take plain strings.
const REMOTE_OR_EXECUTABLE = /@import\b|\burl\s*\(|(?:-webkit-)?image-set\s*\(|\bcross-fade\s*\(|\bimage\s*\(|\bsrc\s*\(|expression\s*\(|-moz-binding|behavior\s*:|javascript\s*:/i;
const DOCUMENT_ROOT_SELECTOR = /(^|\s)(?:html|body|:root)(?:$|[\s.#:[>+~])/i;
const RULE = /([^{}]+)\{([^{}]*)\}/g;
// What a media query is made of: `(min-width: 1024px) and (hover: hover)`, `screen, print`…
const MEDIA_CONDITION = /^[a-z0-9\s(),:.-]+$/i;

export interface CustomRule { selectors: string[]; body: string }
/** Rules that apply everywhere (`media` absent) or only under one `@media` condition. */
export interface CustomBlock { media?: string; rules: CustomRule[] }

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Plain rule-after-rule CSS, or undefined if anything else sits between the rules. */
function parseFlatRules(css: string): CustomRule[] | undefined {
  const rules: CustomRule[] = [];
  let consumed = 0;
  for (const match of css.matchAll(RULE)) {
    if (css.slice(consumed, match.index).trim()) return undefined;
    rules.push({ selectors: match[1]!.trim().split(',').map((selector) => selector.trim()), body: match[2]!.trim() });
    consumed = match.index + match[0].length;
  }
  return css.slice(consumed).trim() ? undefined : rules;
}

/**
 * Splits custom CSS into plain rules and one-level `@media` blocks. Undefined for anything else: other at-rules,
 * deeper nesting, or text that is not a rule.
 */
export function parseCustomCss(css: string): CustomBlock[] | undefined {
  const clean = stripComments(css);
  const blocks: CustomBlock[] = [];
  const addFlat = (chunk: string): boolean => {
    if (!chunk.trim()) return true;
    const rules = parseFlatRules(chunk);
    if (rules) blocks.push({ rules });
    return Boolean(rules);
  };
  let cursor = 0;
  for (let at = clean.indexOf('@'); at !== -1; at = clean.indexOf('@', cursor)) {
    if (!addFlat(clean.slice(cursor, at))) return undefined;
    const open = clean.indexOf('{', at);
    const media = open === -1 ? undefined : /^@media\s+([\s\S]+)$/i.exec(clean.slice(at, open).trim())?.[1]?.trim();
    if (!media || !MEDIA_CONDITION.test(media)) return undefined;
    let depth = 0;
    let close = -1;
    for (let index = open; index < clean.length; index++) {
      if (clean[index] === '{') depth++;
      else if (clean[index] === '}' && --depth === 0) { close = index; break; }
    }
    const rules = close === -1 ? undefined : parseFlatRules(clean.slice(open + 1, close));
    if (!rules?.length) return undefined;
    blocks.push({ media: media.replace(/\s+/g, ' '), rules });
    cursor = close + 1;
  }
  return addFlat(clean.slice(cursor)) ? blocks : undefined;
}

/**
 * The one gate for custom CSS: what passes here is exactly what reaches the page, so the editor never accepts
 * something that is then silently dropped.
 */
export function validateCustomCss(css: string): { valid: boolean; error?: string } {
  if (css.length > MAX_CUSTOM_CSS) return { valid: false, error: 'Custom styles must be 16 KB or smaller.' };
  if (/<\/?\s*(?:script|style|iframe|object|embed)\b/i.test(css)) return { valid: false, error: 'HTML and script tags are not allowed.' };
  if (/javascript\s*:/i.test(css)) return { valid: false, error: 'javascript: URLs are not allowed.' };
  // Escapes could spell a blocked function in disguise (u\72 l is url): none are needed, so none are allowed.
  if (css.includes('\\')) return { valid: false, error: 'Backslashes are not allowed: target classes such as md:px-12 with [class~="md:px-12"].' };
  if (REMOTE_OR_EXECUTABLE.test(css)) return { valid: false, error: 'Remote resources and executable CSS features are not allowed.' };
  if (/[{}]/.test(stripComments(css))) {
    let depth = 0;
    for (const char of stripComments(css)) {
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth < 0) return { valid: false, error: 'The curly braces do not match.' };
    }
    if (depth !== 0) return { valid: false, error: 'The curly braces do not match.' };
  }
  if (/\beval\s*\(|\bnew\s+Function\b/i.test(css)) return { valid: false, error: 'JavaScript is not allowed in custom styles.' };
  if (/@(?!media\b)/i.test(stripComments(css))) return { valid: false, error: 'Only @media is supported among at-rules (no @font-face, @keyframes or @supports).' };
  const blocks = parseCustomCss(css);
  if (!blocks) return { valid: false, error: 'Only plain selector { … } rules and one level of @media are supported.' };
  if (blocks.some(({ rules }) => rules.some(({ selectors }) => selectors.some((selector) => !selector || DOCUMENT_ROOT_SELECTOR.test(selector))))) {
    return { valid: false, error: 'Selectors cannot target html, body or :root: start from #root instead.' };
  }
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
