export const isThemesPath = (pathname: string): boolean => pathname.replace(/\/+$/, '') === '/themes';

export function watchPathChanges(callback: (pathname: string) => void): () => void {
  let currentPath = location.pathname;
  const notify = () => {
    if (location.pathname === currentPath) return;
    currentPath = location.pathname;
    callback(currentPath);
  };
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function (...args: Parameters<History['pushState']>) {
    originalPushState.apply(this, args);
    notify();
  };
  history.replaceState = function (...args: Parameters<History['replaceState']>) {
    originalReplaceState.apply(this, args);
    notify();
  };
  window.addEventListener('popstate', notify);
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', notify);
  };
}
