// The slice of the WebExtensions API Motix uses, typed once for both `browser` (Firefox) and `chrome`.
export type StorageChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;

export interface StorageArea {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export interface ExtensionTab { id?: number; url?: string }

export interface BrowserApi {
  runtime: { getURL: (path: string) => string };
  tabs: {
    query: (query: { active: boolean; currentWindow: boolean }) => Promise<ExtensionTab[]>;
    create: (properties: { url: string }) => Promise<unknown>;
    update: (tabId: number, properties: { url: string }) => Promise<unknown>;
  };
  storage: {
    local: StorageArea;
    onChanged: { addListener: (listener: StorageChangeListener) => void; removeListener: (listener: StorageChangeListener) => void };
  };
}

export function getBrowserApi(): BrowserApi | undefined {
  const root = globalThis as typeof globalThis & { browser?: BrowserApi; chrome?: BrowserApi };
  const api = root.browser ?? root.chrome;
  return api?.storage ? api : undefined;
}

async function activeTab(): Promise<ExtensionTab | undefined> {
  try {
    return (await getBrowserApi()?.tabs.query({ active: true, currentWindow: true }))?.[0];
  } catch {
    return undefined;
  }
}

export async function activeTabHostname(): Promise<string> {
  try {
    const url = (await activeTab())?.url;
    return url ? new URL(url).hostname : '';
  } catch {
    return '';
  }
}

/** Opens the full-page editor in a new tab, optionally bound to a Movix hostname. */
export async function openEditorTab(hostname?: string): Promise<void> {
  const api = getBrowserApi();
  if (!api) return;
  const query = hostname ? `?site=${encodeURIComponent(hostname)}` : '';
  await api.tabs.create({ url: `${api.runtime.getURL('themes.html')}${query}` });
}

/** Sends the active Movix tab to `/themes`, where the content script embeds the editor. */
export async function navigateToThemesRoute(): Promise<void> {
  const tab = await activeTab();
  if (tab?.id === undefined || !tab.url) return;
  await getBrowserApi()?.tabs.update(tab.id, { url: new URL('/themes', tab.url).toString() });
}
