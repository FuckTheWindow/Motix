import { getBrowserApi } from '../shared/browser';
import { CLOSE_EDITOR_MESSAGE, PREVIEW_THEME_MESSAGE } from '../shared/editor-messages';
import type { MotixTheme } from '../shared/types';
import { validateTheme } from '../theme/validation';

const FRAME_ID = 'motix-themes-iframe';
// Wide enough for two theme tiles per row and the save bar; narrow screens get the full width.
const PANEL_WIDTH = 440;
const SLIDE_MS = 240;

let frame: HTMLIFrameElement | undefined;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Docks the extension's editor beside the page. Movix stays visible and usable next to it, so every
 * change the editor previews can be judged on the real site.
 */
export function openEditorFrame(): void {
  const api = getBrowserApi();
  if (frame || !api || !document.body) return;
  frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.title = 'Motix';
  frame.src = `${api.runtime.getURL('themes.html')}?embedded=1&site=${encodeURIComponent(location.hostname)}`;
  frame.style.cssText = [
    'position:fixed', 'top:0', 'right:0', 'bottom:0', `width:min(${PANEL_WIDTH}px,100vw)`, 'height:100dvh',
    'border:0', 'margin:0', 'z-index:2147483646', 'background:#15131c', 'color-scheme:dark',
    'box-shadow:-18px 0 48px rgb(0 0 0 / .45)',
    reducedMotion() ? '' : `transform:translateX(100%);transition:transform ${SLIDE_MS}ms cubic-bezier(.25,1,.5,1)`,
  ].filter(Boolean).join(';');
  document.body.append(frame);
  if (!reducedMotion()) requestAnimationFrame(() => requestAnimationFrame(() => { if (frame) frame.style.transform = 'translateX(0)'; }));
}

export function closeEditorFrame(): void {
  if (!frame) return;
  const closing = frame;
  frame = undefined;
  if (reducedMotion()) { closing.remove(); return; }
  closing.style.transform = 'translateX(100%)';
  closing.addEventListener('transitionend', () => closing.remove(), { once: true });
  // In case the transition never runs (hidden tab), the frame still goes.
  window.setTimeout(() => closing.remove(), SLIDE_MS + 100);
}

export function isEditorOpen(): boolean {
  return Boolean(frame);
}

export type EditorFrameMessage =
  | { type: typeof CLOSE_EDITOR_MESSAGE }
  | { type: typeof PREVIEW_THEME_MESSAGE; theme: MotixTheme | null };

/** Reads a message only if it comes from the editor frame this script created, with a well-formed payload. */
export function readEditorFrameMessage(event: MessageEvent): EditorFrameMessage | undefined {
  if (!frame || event.source !== frame.contentWindow) return undefined;
  const data = event.data as { type?: unknown; theme?: unknown } | null;
  if (data?.type === CLOSE_EDITOR_MESSAGE) return { type: CLOSE_EDITOR_MESSAGE };
  if (data?.type === PREVIEW_THEME_MESSAGE && (data.theme === null || validateTheme(data.theme))) {
    return { type: PREVIEW_THEME_MESSAGE, theme: data.theme as MotixTheme | null };
  }
  return undefined;
}
