import { BUILT_IN_MOVIX_DOMAINS, validatedDirectoryDomains } from './domains';
import { getSettings, saveSettings } from './storage';

const DIRECTORY_URL = 'https://movix.online/';
const REQUEST_TIMEOUT_MS = 8_000;

export async function refreshSupportedDomains(): Promise<string[]> {
  const settings = await getSettings();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(DIRECTORY_URL, { signal: controller.signal, credentials: 'omit', redirect: 'follow' });
    const finalHost = new URL(response.url).hostname.toLowerCase();
    if (!response.ok || (finalHost !== 'movix.online' && !BUILT_IN_MOVIX_DOMAINS.some((root) => finalHost === root || finalHost.endsWith(`.${root}`)))) throw new Error('The Movix directory could not be reached safely.');
    const html = await response.text();
    if (html.length > 1_000_000) throw new Error('The Movix directory response was unexpectedly large.');
    const document = new DOMParser().parseFromString(html, 'text/html');
    const hrefs = [...document.querySelectorAll('a[href]')].map((link) => link.getAttribute('href') ?? '');
    const discovered = validatedDirectoryDomains(hrefs);
    if (!discovered.length) throw new Error('No verified Movix domains were found. Your cached list was kept.');
    const merged = [...new Set([...BUILT_IN_MOVIX_DOMAINS, ...discovered])];
    await saveSettings({ ...settings, supportedDomains: merged, directoryCacheAt: Date.now() });
    return merged;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The Movix directory took too long to reply. Your cached domain list was kept.');
    throw error instanceof Error ? error : new Error('The Movix directory could not be checked. Your cached list was kept.');
  } finally {
    clearTimeout(timeout);
  }
}
