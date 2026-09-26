export interface ExtensionTab { id?: number; url?: string; }
export interface BrowserApi {
  runtime: {
    sendMessage: (message: unknown) => Promise<unknown>;
    getURL: (path: string) => string;
    onMessage: { addListener: (listener: (message: unknown) => void) => void };
  };
  tabs: {
    query: (query: { active: boolean; currentWindow: boolean }) => Promise<ExtensionTab[]>;
    create: (properties: { url: string }) => Promise<unknown>;
    update: (tabId: number, properties: { url: string }) => Promise<unknown>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
  };
  permissions?: { request: (permissions: { origins: string[] }) => Promise<boolean> };
  storage: { local: unknown };
}

export function getBrowserApi(): BrowserApi | undefined {
  const root = globalThis as typeof globalThis & { browser?: BrowserApi; chrome?: BrowserApi };
  return root.browser ?? root.chrome;
}

export async function activeTabUrl(): Promise<string | undefined> {
  try {
    const api = getBrowserApi();
    return (await api?.tabs.query({ active: true, currentWindow: true }))?.[0]?.url;
  } catch {
    return undefined;
  }
}

export async function openThemesPage(hostname?: string): Promise<void> {
  const api = getBrowserApi();
  if (!api) return;
  const activeTab = (await api.tabs.query({ active: true, currentWindow: true }))[0];
  const params = new URLSearchParams();
  if (hostname) params.set('site', hostname);
  if (activeTab?.id !== undefined) params.set('sourceTabId', String(activeTab.id));
  const suffix = params.size ? `?${params.toString()}` : '';
  await api.tabs.create({ url: `${api.runtime.getURL('themes.html')}${suffix}` });
}

export async function sendTabMessage(tabId: number | undefined, message: unknown): Promise<boolean> {
  const api = getBrowserApi();
  if (!api || tabId === undefined) return false;
  try {
    await api.tabs.sendMessage(tabId, message);
    return true;
  } catch {
    return false;
  }
}

export async function navigateToThemesRoute(): Promise<void> {
  const api = getBrowserApi();
  if (!api) return;
  const tab = (await api.tabs.query({ active: true, currentWindow: true }))[0];
  if (tab?.id && tab.url) {
    const target = new URL(tab.url);
    target.pathname = '/themes';
    target.search = '';
    target.hash = '';
    await api.tabs.update(tab.id, { url: target.toString() });
  }
}
