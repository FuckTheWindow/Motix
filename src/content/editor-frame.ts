import { getBrowserApi } from '../shared/browser';
import { CLOSE_EDITOR_MESSAGE } from '../shared/editor-messages';

const FRAME_ID = 'motix-themes-iframe';

let frame: HTMLIFrameElement | undefined;
let hiddenRoot: { element: HTMLElement; display: string } | undefined;
let originalTitle = '';

/** Covers the page with the extension's editor while Movix's own app root is hidden. */
export function openEditorFrame(): void {
  const api = getBrowserApi();
  if (frame || !api || !document.body) return;
  originalTitle = document.title;
  const root = document.getElementById('root');
  if (root) {
    hiddenRoot = { element: root, display: root.style.display };
    root.style.display = 'none';
  }
  frame = document.createElement('iframe');
  frame.id = FRAME_ID;
  frame.title = 'Motix theme editor';
  frame.src = `${api.runtime.getURL('themes.html')}?embedded=1&site=${encodeURIComponent(location.hostname)}`;
  frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646;background:#10120f';
  document.body.append(frame);
}

export function closeEditorFrame(): void {
  if (!frame) return;
  frame.remove();
  frame = undefined;
  if (hiddenRoot) hiddenRoot.element.style.display = hiddenRoot.display;
  hiddenRoot = undefined;
  document.title = originalTitle;
}

export function isEditorFrameMessage(event: MessageEvent): boolean {
  return Boolean(frame) && event.source === frame?.contentWindow && (event.data as { type?: unknown } | null)?.type === CLOSE_EDITOR_MESSAGE;
}
