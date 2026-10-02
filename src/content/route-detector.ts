export const isThemesPath = (pathname: string): boolean => pathname.replace(/\/+$/, '') === '/themes';

const POLL_INTERVAL_MS = 400;

interface NavigationLike { addEventListener: (type: 'currententrychange', listener: () => void) => void; removeEventListener: (type: 'currententrychange', listener: () => void) => void }

/**
 * Calls back whenever the SPA changes path. Content scripts run in an isolated world, so
 * wrapping `history.pushState` here would never see the page's own calls; the Navigation API
 * reports them, and polling covers browsers that lack it.
 */
export function watchPathChanges(callback: (pathname: string) => void): () => void {
  let currentPath = location.pathname;
  const notify = () => {
    if (location.pathname === currentPath) return;
    currentPath = location.pathname;
    callback(currentPath);
  };
  window.addEventListener('popstate', notify);
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  if (navigation) {
    navigation.addEventListener('currententrychange', notify);
    return () => {
      window.removeEventListener('popstate', notify);
      navigation.removeEventListener('currententrychange', notify);
    };
  }
  const timer = window.setInterval(notify, POLL_INTERVAL_MS);
  return () => {
    window.removeEventListener('popstate', notify);
    window.clearInterval(timer);
  };
}
