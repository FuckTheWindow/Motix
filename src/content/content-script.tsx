import { isSupportedMovixDomain } from '../shared/domains';
import { getBrowserApi } from '../shared/browser';
import { getSettings, onSettingsChanged } from '../shared/storage';
import { generateThemeCss } from '../shared/theme-css';
import { DEFAULT_THEMES, findTheme } from '../data/themes';
import type { MotixTheme } from '../shared/types';

if (isSupportedMovixDomain(location.hostname)) {
  const api = getBrowserApi();
  let originalTitle = document.title;
  let frame: HTMLIFrameElement | undefined;
  let originalRootDisplay: string | undefined;
  let currentInjectedCss: string | undefined;
  let injectionQueue: Promise<void> = Promise.resolve();

  const queuePageCss = (css?: string) => {
    if (!api) return;
    injectionQueue = injectionQueue.then(async () => {
      if (css === currentInjectedCss) return;
      if (css === undefined) {
        if (!currentInjectedCss) return;
        const result = await api.runtime.sendMessage({ type: 'MOTIX_REMOVE_PAGE_CSS', hostname: location.hostname, css: currentInjectedCss });
        if (result && typeof result === 'object' && 'ok' in result && result.ok === true) currentInjectedCss = undefined;
        else console.warn('[Motix] Could not remove page styles:', result);
        return;
      }
      const result = await api.runtime.sendMessage({ type: 'MOTIX_SET_PAGE_CSS', hostname: location.hostname, css, previousCss: currentInjectedCss });
      if (result && typeof result === 'object' && 'ok' in result && result.ok === true) currentInjectedCss = css;
      else console.warn('[Motix] Theme could not be injected into this page:', result);
    }).catch((error) => console.warn('[Motix] Theme injection failed:', error));
  };

  const removeTheme = () => {
    document.getElementById('motix-theme-styles')?.remove();
    delete document.documentElement.dataset.motixTheme;
    queuePageCss();
  };
  const apply = (theme: MotixTheme) => {
    let style = document.getElementById('motix-theme-styles') as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = 'motix-theme-styles';
      style.dataset.motixOwned = 'true';
      (document.head ?? document.documentElement).append(style);
    }
    document.documentElement.dataset.motixTheme = theme.id;
    const css = generateThemeCss(theme);
    style.textContent = css;
    queuePageCss(css);
  };
  const update = async () => {
    const settings = await getSettings();
    const hostname = location.hostname.toLowerCase().replace(/\.$/, '');
    const enabled = settings.perDomainEnabled[hostname] ?? settings.motixEnabled;
    if (!enabled) { removeTheme(); return; }
    const id = settings.domainThemes[hostname] ?? settings.globalThemeId;
    if (id === 'original') { removeTheme(); return; }
    const theme = findTheme(id, settings.customThemes) ?? DEFAULT_THEMES[0]!;
    apply(theme);
  };
  const stopEditor = () => {
    if (!frame) return;
    frame.remove(); frame = undefined;
    const root = document.getElementById('root');
    if (root && originalRootDisplay !== undefined) root.style.display = originalRootDisplay;
    originalRootDisplay = undefined;
    document.title = originalTitle;
  };
  const startEditor = () => {
    if (!document.body || frame || !api) return;
    originalTitle = document.title;
    const root = document.getElementById('root');
    if (root) { originalRootDisplay = root.style.display; root.style.display = 'none'; }
    frame = document.createElement('iframe');
    frame.id = 'motix-themes-iframe';
    frame.title = 'Motix theme editor';
    frame.src = `${api.runtime.getURL('themes.html')}?embedded=1&site=${encodeURIComponent(location.hostname)}`;
    frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646;background:#10120f';
    document.body.append(frame);
  };
  const checkRoute = () => {
    if (location.pathname.replace(/\/+$/, '') === '/themes') startEditor();
    else stopEditor();
  };
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function (...args: Parameters<History['pushState']>) { originalPush.apply(this, args); queueMicrotask(checkRoute); };
  history.replaceState = function (...args: Parameters<History['replaceState']>) { originalReplace.apply(this, args); queueMicrotask(checkRoute); };
  window.addEventListener('popstate', checkRoute);
  window.addEventListener('message', (event) => {
    if (event.source !== frame?.contentWindow) return;
    if (event.data?.type === 'MOTIX_APPLY_THEME') {
      if (event.data.hostname === location.hostname) void update();
      return;
    }
    if (event.data?.type !== 'MOTIX_CLOSE_EDITOR') return;
    history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    stopEditor();
  });
  api?.runtime.onMessage.addListener((raw) => {
    const message = raw as { type?: string; hostname?: string };
    if (message.hostname && message.hostname.toLowerCase() !== location.hostname.toLowerCase()) return;
    if (message.type === 'APPLY_THEME') void update();
    if (message.type === 'REMOVE_THEME') removeTheme();
  });
  const unsubscribe = onSettingsChanged(() => { void update(); });
  window.addEventListener('pagehide', () => { unsubscribe(); stopEditor(); }, { once: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', checkRoute, { once: true });
  else checkRoute();
  void update();
}
