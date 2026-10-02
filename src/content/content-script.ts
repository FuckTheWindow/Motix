import { isSupportedMovixDomain } from '../shared/domains';
import { getSettings, onSettingsChanged, resolveActiveTheme, resolveEnabled } from '../shared/storage';
import type { MotixSettings } from '../shared/types';
import { closeEditorFrame, isEditorFrameMessage, openEditorFrame } from './editor-frame';
import { isThemesPath, watchPathChanges } from './route-detector';
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

  window.addEventListener('message', (event) => {
    if (!isEditorFrameMessage(event)) return;
    // Movix's router lives in the page's world: changing the URL and announcing it is how we hand control back.
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    closeEditorFrame();
  });
  window.addEventListener('pagehide', () => { stopSettings(); stopRoutes(); closeEditorFrame(); }, { once: true });

  // The script runs at document_start, before <body> exists for the editor frame to attach to.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncEditor, { once: true });
  else syncEditor();
}

if (isSupportedMovixDomain(location.hostname)) start();
