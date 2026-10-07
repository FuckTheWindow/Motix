import { getBrowserApi } from '../shared/browser';
import { isSupportedMovixDomain } from '../shared/domains';
import { CLOSE_EDITOR_MESSAGE, OPEN_EDITOR_MESSAGE, PREVIEW_THEME_MESSAGE } from '../shared/editor-messages';
import { getSettings, onSettingsChanged, resolveActiveTheme, resolveEnabled } from '../shared/storage';
import type { MotixSettings, MotixTheme } from '../shared/types';
import { closeEditorFrame, openEditorFrame, readEditorFrameMessage } from './editor-frame';
import { isThemesPath, returnPath, watchPathChanges } from './route-detector';
import { applyTheme, removeTheme } from './theme-injector';

let settings: MotixSettings | undefined;
// While the editor is open, its unsaved draft wins over the stored theme (null: Movix's original look).
let preview: { theme: MotixTheme | null } | undefined;

function render(): void {
  if (!settings) return;
  if (preview) {
    if (preview.theme) applyTheme(preview.theme, { themePlayer: settings.themePlayer });
    else removeTheme();
    return;
  }
  const theme = resolveActiveTheme(settings, location.hostname);
  // "Original" means Movix exactly as shipped, so nothing is injected at all.
  if (!resolveEnabled(settings, location.hostname) || theme.id === 'original') removeTheme();
  else applyTheme(theme, { themePlayer: settings.themePlayer });
}

function openEditor(): void {
  openEditorFrame();
}

function closeEditor(): void {
  closeEditorFrame();
  preview = undefined;
  render();
}

/**
 * `/themes` is a way in, not a page: the editor opens beside the site and Movix is sent back to the page it
 * came from (`?return=`, else the home page). `announce` tells Movix's router, which only exists once the app runs.
 */
function enterFromThemesPath(announce: boolean): void {
  history.replaceState(history.state, '', returnPath(location.search));
  if (announce) window.dispatchEvent(new PopStateEvent('popstate'));
}

function start(): void {
  void getSettings().then((next) => { settings = next; render(); }).catch((error: unknown) => console.warn('[Motix] Could not load the theme:', error));
  const stopSettings = onSettingsChanged((next) => { settings = next; render(); });

  // Arriving on /themes directly: fix the URL before Movix boots, then open the editor once there is a body.
  const openOnReady = isThemesPath(location.pathname);
  if (openOnReady) enterFromThemesPath(false);
  const stopRoutes = watchPathChanges((pathname) => {
    if (!isThemesPath(pathname)) return;
    enterFromThemesPath(true);
    openEditor();
  });

  getBrowserApi()?.runtime.onMessage.addListener((message) => {
    if ((message as { type?: unknown } | null)?.type === OPEN_EDITOR_MESSAGE) openEditor();
  });

  window.addEventListener('message', (event) => {
    const message = readEditorFrameMessage(event);
    if (message?.type === CLOSE_EDITOR_MESSAGE) closeEditor();
    if (message?.type === PREVIEW_THEME_MESSAGE) {
      preview = { theme: message.theme };
      render();
    }
  });
  window.addEventListener('pagehide', () => { stopSettings(); stopRoutes(); closeEditorFrame(); }, { once: true });

  if (openOnReady) {
    // The script runs at document_start, before <body> exists for the editor frame to attach to.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openEditor, { once: true });
    else openEditor();
  }
}

if (isSupportedMovixDomain(location.hostname)) start();
