// Turns Movix's shipped stylesheet into the Motix adapter: every hard-coded colour
// becomes a CSS custom property that falls back to the original value, so the
// adapter is a no-op until a theme defines those properties.
import postcss, { type AtRule, type Rule } from 'postcss';

export type TokenKind = 'bg' | 'fg' | 'bd' | 'sh';

export interface AdapterResult {
  css: string;
  tokens: string[];
}

const SCOPE = 'html[data-motix-theme]';

// Third-party player skins keep their own look; Motix never restyles playback UI.
const SKIPPED_SELECTOR = /\.vjs-|\.video-js|\.shaka-|\.plyr|:host/;

const FOREGROUND = /^(?:color|fill|stroke|caret-color|text-decoration(?:-color)?|-webkit-text-fill-color|-webkit-text-stroke(?:-color)?)$/;
const BORDER = /^(?:border(?:-(?:top|right|bottom|left|inline|block|inline-start|inline-end|block-start|block-end))?(?:-color)?|outline(?:-color)?|column-rule(?:-color)?|--tw-ring-color|--tw-ring-offset-color)$/;
const SHADOW = /^(?:box-shadow|text-shadow|filter|--tw-shadow|--tw-shadow-colored|--tw-shadow-color|--tw-drop-shadow)$/;
const BACKGROUND = /^(?:background(?:-color|-image)?|accent-color|scrollbar-color|--tw-gradient-from|--tw-gradient-to|--tw-gradient-stops)$/;
const RADIUS = /^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/;

const COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])|rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*((?:[^()]|\([^()]*\))*?))?\s*\)|(?<![\w-])(?:white|black)(?![\w-])/gi;
const RADIUS_PART = /^(\d*\.?\d+)(px|rem|em)$/;
const PILL_RADIUS_PX = 500;

function kindOf(property: string): TokenKind | undefined {
  if (FOREGROUND.test(property)) return 'fg';
  if (BORDER.test(property)) return 'bd';
  if (SHADOW.test(property)) return 'sh';
  if (BACKGROUND.test(property)) return 'bg';
  return undefined;
}

function parseHex(hex: string): [number, number, number, number | undefined] {
  const digits = hex.slice(1);
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join('') : digits;
  const channel = (index: number) => Number.parseInt(full.slice(index * 2, index * 2 + 2), 16);
  return [channel(0), channel(1), channel(2), full.length === 8 ? Math.round((channel(3) / 255) * 1000) / 1000 : undefined];
}

export function rewriteColors(value: string, kind: TokenKind, tokens: Set<string>): string | undefined {
  if (/url\(/i.test(value)) return undefined;
  let changed = false;
  const rewritten = value.replace(COLOR, (match, r?: string, g?: string, b?: string, alpha?: string) => {
    let channels: [number, number, number];
    let opacity: string | undefined;
    if (match.startsWith('#')) {
      const [red, green, blue, hexAlpha] = parseHex(match);
      channels = [red, green, blue];
      opacity = hexAlpha === undefined ? undefined : String(hexAlpha);
    } else if (r !== undefined) {
      channels = [Number(r), Number(g), Number(b)];
      opacity = alpha?.trim() || undefined;
    } else {
      channels = match.toLowerCase() === 'white' ? [255, 255, 255] : [0, 0, 0];
    }
    if (channels.some((channel) => channel > 255)) return match;
    const token = `${kind}-${channels.join('-')}`;
    tokens.add(token);
    changed = true;
    return `rgba(var(--mx-${token}, ${channels.join(',')}),${opacity ?? '1'})`;
  });
  return changed ? rewritten : undefined;
}

export function rewriteRadius(value: string): string | undefined {
  const parts = value.trim().split(/\s+/);
  let changed = false;
  const rewritten = parts.map((part) => {
    if (part === '0') return part;
    const match = RADIUS_PART.exec(part);
    if (!match) return undefined;
    const amount = Number(match[1]);
    if (amount === 0 || (match[2] === 'px' && amount >= PILL_RADIUS_PX)) return part;
    changed = true;
    return `calc(${part} * var(--mx-radius-scale, 1))`;
  });
  return changed && rewritten.every((part) => part !== undefined) ? rewritten.join(' ') : undefined;
}

export function scopeSelector(selector: string): string {
  const part = selector.trim();
  if (/^(?:html|:root)(?![\w-])/.test(part)) return part.replace(/^(?:html|:root)/, SCOPE);
  if (/^\.dark(?![\w-])/.test(part)) return `${SCOPE}${part}`;
  return `${SCOPE} ${part}`;
}

function wrappers(rule: Rule): AtRule[] | undefined {
  const chain: AtRule[] = [];
  for (let node = rule.parent; node && node.type !== 'root'; node = node.parent) {
    if (node.type !== 'atrule') return undefined;
    const atRule = node as AtRule;
    if (atRule.name !== 'media' && atRule.name !== 'supports') return undefined;
    chain.unshift(atRule);
  }
  return chain;
}

export function buildAdapter(sourceCss: string): AdapterResult {
  const tokens = new Set<string>();
  const lines = new Set<string>();
  postcss.parse(sourceCss).walkRules((rule) => {
    const chain = wrappers(rule);
    if (!chain || SKIPPED_SELECTOR.test(rule.selector)) return;
    const declarations: string[] = [];
    rule.each((node) => {
      if (node.type !== 'decl') return;
      const property = node.prop.toLowerCase();
      const kind = kindOf(property);
      const value = kind ? rewriteColors(node.value, kind, tokens) : RADIUS.test(property) ? rewriteRadius(node.value) : undefined;
      if (value) declarations.push(`${node.prop}:${value}!important`);
    });
    if (!declarations.length) return;
    const selector = rule.selectors.map(scopeSelector).join(',');
    const body = `${selector}{${declarations.join(';')}}`;
    lines.add(chain.reduceRight((inner, atRule) => `@${atRule.name} ${atRule.params}{${inner}}`, body));
  });
  const header = '/* Generated by `pnpm sync:upstream` from the live Movix stylesheet. Do not edit by hand. */';
  return { css: `${header}\n${[...lines].join('\n')}\n`, tokens: [...tokens].sort() };
}
