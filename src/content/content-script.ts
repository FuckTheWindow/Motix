import { getBrowserApi } from '../shared/browser';
import { isSupportedMovixDomain } from '../shared/domains';
import { OPEN_EDITOR_MESSAGE } from '../shared/editor-messages';
import { getSettings, onSettingsChanged, resolveActiveTheme, resolveEnabled } from '../shared/storage';
import type { MotixSettings } from '../shared/types';
import { closeEditorFrame, isEditorFrameMessage, openEditorFrame } from './editor-frame';
import { isThemesPath, returnPath, themesUrlFrom, watchPathChanges } from './route-detector';
import { applyTheme, removeTheme } from './theme-injector';

function render(settings: MotixSettings): void {
  const theme = resolveActiveTheme(settings, location.hostname);
  // "Original" means Movix exactly as shipped, so nothing is injected at all.
  if (!resolveEnabled(settings, location.hostname) || theme.id === 'original') removeTheme();
  else applyTheme(theme, { themePlayer: settings.themePlayer });
}

function syncEditor(): void {
  if (isThemesPath(location.pathname)) openEditorFrame();
  else closeEditorFrame();
}

function start(): void {
  void getSettings().then(render).catch((error: unknown) => console.warn('[Motix] Could not load the theme:', error));
  const stopSettings = onSettingsChanged(render);
  const stopRoutes = watchPathChanges(syncEditor);
  // Set when the popup opened the editor over the current page, which is then one history entry back.
  let openedOverPage = false;

  getBrowserApi()?.runtime.onMessage.addListener((message) => {
    if ((message as { type?: unknown } | null)?.type !== OPEN_EDITOR_MESSAGE) return;
    if (!isThemesPath(location.pathname)) {
      // Only the URL changes: Movix keeps the current page mounted, hidden behind the editor.
      history.pushState({}, '', themesUrlFrom(location.pathname, location.search));
      openedOverPage = true;
    }
    syncEditor();
  });

  window.addEventListener('message', (event) => {
    if (!isEditorFrameMessage(event)) return;
    closeEditorFrame();
    if (openedOverPage) {
      openedOverPage = false;
      history.back();
      return;
    }
    // Movix's router lives in the page's world: changing the URL and announcing it is how we hand control back.
    history.pushState({}, '', returnPath(location.search));
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  window.addEventListener('pagehide', () => { stopSettings(); stopRoutes(); closeEditorFrame(); }, { once: true });

  // The script runs at document_start, before <body> exists for the editor frame to attach to.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncEditor, { once: true });
  else syncEditor();
}

if (isSupportedMovixDomain(location.hostname)) start();
