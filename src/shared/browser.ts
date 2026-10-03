import { OPEN_EDITOR_MESSAGE } from './editor-messages';

// The slice of the WebExtensions API Motix uses, typed once for both `browser` (Firefox) and `chrome`.
export type StorageChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;

export interface StorageArea {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export interface ExtensionTab { id?: number; url?: string }

export interface BrowserApi {
  runtime: {
    getURL: (path: string) => string;
    onMessage: { addListener: (listener: (message: unknown) => void) => void };
  };
  tabs: {
    query: (query: { active: boolean; currentWindow: boolean }) => Promise<ExtensionTab[]>;
    create: (properties: { url: string }) => Promise<unknown>;
    sendMessage: (tabId: number, message: unknown) => Promise<unknown>;
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

/** Opens the editor in its own tab, for when the active tab is not a Movix site. */
export async function openEditorTab(): Promise<void> {
  const api = getBrowserApi();
  if (api) await api.tabs.create({ url: api.runtime.getURL('themes.html') });
}

/**
 * Asks the content script in the active Movix tab to open the editor in place. Messaging the
 * page, rather than navigating the tab, needs no access to the tab's URL and keeps the page loaded.
 */
export async function openEditorInActiveTab(): Promise<boolean> {
  const tab = await activeTab();
  if (tab?.id === undefined) return false;
  try {
    await getBrowserApi()?.tabs.sendMessage(tab.id, { type: OPEN_EDITOR_MESSAGE });
    return true;
  } catch {
    // No content script in that tab (not a Movix page, or opened before the extension loaded).
    return false;
  }
}
