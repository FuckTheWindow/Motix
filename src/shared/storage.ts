import type { MotixSettings, MotixTheme } from './types';
import { BUILT_IN_MOVIX_DOMAINS, isSupportedMovixDomain, normalizeHostname, validatedDirectoryDomains } from './domains';
import { DEFAULT_THEMES, findTheme } from '../data/themes';
import { validateTheme } from './validation';

const STORAGE_KEY = 'motixSettings';

type ChangeListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => void;
type StorageAreaLike = {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  onChanged?: { addListener: (callback: ChangeListener) => void; removeListener?: (callback: ChangeListener) => void };
};
type BrowserLike = { storage?: { local: StorageAreaLike; onChanged?: StorageAreaLike['onChanged'] } };

function storageArea(): StorageAreaLike | undefined {
  const root = globalThis as typeof globalThis & { browser?: BrowserLike; chrome?: BrowserLike };
  return root.browser?.storage?.local ?? root.chrome?.storage?.local;
}

export function defaultSettings(): MotixSettings {
  return { schemaVersion: 1, globalThemeId: 'original', domainThemes: {}, customThemes: [], customCss: {}, supportedDomains: [...BUILT_IN_MOVIX_DOMAINS], userDomains: [], motixEnabled: true, disabledDomains: [], perDomainEnabled: {}, directoryCacheAt: 0, previewMode: 'desktop' };
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

export function settingsNeedMigration(raw: unknown, normalized: MotixSettings): boolean {
  return stableSerialize(raw) !== stableSerialize(normalized);
}

function migrate(raw: unknown): MotixSettings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const old = raw as Partial<MotixSettings> & { themeId?: string; enabled?: boolean };
  const customThemes = Array.isArray(old.customThemes) ? old.customThemes.filter(validateTheme) : [];
  const userDomains = validatedDirectoryDomains(old.userDomains);
  const supportedDomains = [...new Set([...BUILT_IN_MOVIX_DOMAINS, ...validatedDirectoryDomains(old.supportedDomains), ...userDomains])];
  const oldDomainThemes = old.domainThemes && typeof old.domainThemes === 'object' ? old.domainThemes : {};
  const domainThemes = Object.fromEntries(Object.entries(oldDomainThemes).filter(([domain, id]) => isSupportedMovixDomain(domain, supportedDomains) && typeof id === 'string' && Boolean(findTheme(id, customThemes))));
  const oldPerDomain = old.perDomainEnabled && typeof old.perDomainEnabled === 'object' ? old.perDomainEnabled : {};
  const perDomainEnabled = Object.fromEntries(Object.entries(oldPerDomain).filter(([domain, enabled]) => isSupportedMovixDomain(domain, supportedDomains) && typeof enabled === 'boolean'));
  const oldCss = old.customCss && typeof old.customCss === 'object' ? old.customCss : {};
  const customCss = Object.fromEntries(Object.entries(oldCss).filter(([id, css]) => Boolean(findTheme(id, customThemes)) && typeof css === 'string'));
  return {
    ...defaults,
    schemaVersion: 1,
    globalThemeId: findTheme(old.globalThemeId ?? old.themeId ?? 'original', customThemes)?.id ?? 'original',
    customThemes,
    supportedDomains,
    userDomains,
    domainThemes,
    motixEnabled: typeof old.motixEnabled === 'boolean' ? old.motixEnabled : typeof old.enabled === 'boolean' ? old.enabled : true,
    disabledDomains: Array.isArray(old.disabledDomains) ? old.disabledDomains.filter((domain): domain is string => typeof domain === 'string' && isSupportedMovixDomain(domain, supportedDomains)).map(normalizeHostname) : [],
    perDomainEnabled,
    customCss,
    directoryCacheAt: typeof old.directoryCacheAt === 'number' ? old.directoryCacheAt : 0,
    previewMode: old.previewMode === 'tablet' || old.previewMode === 'mobile' ? old.previewMode : 'desktop',
  };
}

export async function getSettings(): Promise<MotixSettings> {
  const area = storageArea();
  if (!area) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return migrate(stored ? JSON.parse(stored) as unknown : null);
    } catch {
      return defaultSettings();
    }
  }
  const result = await area.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  const settings = migrate(raw);
  if (settingsNeedMigration(raw, settings)) await area.set({ [STORAGE_KEY]: settings });
  return settings;
}

export async function saveSettings(settings: MotixSettings): Promise<void> {
  const area = storageArea();
  if (area) await area.set({ [STORAGE_KEY]: migrate(settings) });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(migrate(settings)));
}

export function resolveActiveTheme(settings: MotixSettings, hostname?: string): MotixTheme {
  const domain = hostname ? normalizeHostname(hostname) : undefined;
  const id = (domain && settings.domainThemes[domain]) || settings.globalThemeId;
  return findTheme(id, settings.customThemes) ?? DEFAULT_THEMES[0]!;
}

export async function getActiveTheme(hostname?: string): Promise<MotixTheme> {
  return resolveActiveTheme(await getSettings(), hostname);
}

export async function saveTheme(theme: MotixTheme, hostname?: string): Promise<void> {
  if (!validateTheme(theme)) throw new Error('This theme has invalid settings.');
  const settings = await getSettings();
  if (hostname && !isSupportedMovixDomain(hostname, settings.supportedDomains)) throw new Error('This domain is not approved by Motix.');
  const customThemes = settings.customThemes.filter((existing) => existing.id !== theme.id);
  if (theme.isCustom || !DEFAULT_THEMES.some((preset) => preset.id === theme.id)) customThemes.push({ ...theme, isCustom: true });
  const domainThemes = { ...settings.domainThemes };
  if (hostname) domainThemes[normalizeHostname(hostname)] = theme.id;
  await saveSettings({ ...settings, globalThemeId: hostname ? settings.globalThemeId : theme.id, domainThemes, customThemes });
}

export async function setEnabled(enabled: boolean, hostname?: string): Promise<void> {
  const settings = await getSettings();
  if (hostname && !isSupportedMovixDomain(hostname, settings.supportedDomains)) throw new Error('This domain is not approved by Motix.');
  await saveSettings(hostname
    ? { ...settings, perDomainEnabled: { ...settings.perDomainEnabled, [normalizeHostname(hostname)]: enabled } }
    : { ...settings, motixEnabled: enabled });
}

export async function isEnabled(hostname?: string): Promise<boolean> {
  const settings = await getSettings();
  if (!hostname) return settings.motixEnabled;
  const domain = normalizeHostname(hostname);
  return settings.perDomainEnabled[domain] ?? (!settings.disabledDomains.includes(domain) && settings.motixEnabled);
}

export async function resetDomain(hostname: string): Promise<void> {
  const settings = await getSettings();
  if (!isSupportedMovixDomain(hostname, settings.supportedDomains)) throw new Error('This domain is not approved by Motix.');
  const domain = normalizeHostname(hostname);
  await saveSettings({ ...settings, domainThemes: { ...settings.domainThemes, [domain]: 'original' }, perDomainEnabled: { ...settings.perDomainEnabled, [domain]: true } });
}

export async function resetAll(): Promise<void> {
  await saveSettings(defaultSettings());
}

export async function cacheDiscoveredDomains(raw: unknown): Promise<string[]> {
  const domains = validatedDirectoryDomains(raw);
  if (!domains.length) throw new Error('No approved Movix domains were found. Your previous list was kept.');
  const settings = await getSettings();
  const merged = [...new Set([...BUILT_IN_MOVIX_DOMAINS, ...domains])];
  await saveSettings({ ...settings, supportedDomains: merged, directoryCacheAt: Date.now() });
  return merged;
}

export function onSettingsChanged(callback: (settings: MotixSettings) => void): () => void {
  const root = globalThis as typeof globalThis & { browser?: BrowserLike; chrome?: BrowserLike };
  const event = root.browser?.storage?.onChanged ?? root.chrome?.storage?.onChanged;
  if (!event) return () => undefined;
  const listener: ChangeListener = (changes, areaName) => {
    if (areaName === 'local' && STORAGE_KEY in changes) callback(migrate(changes[STORAGE_KEY]?.newValue));
  };
  event.addListener(listener);
  return () => event.removeListener?.(listener);
}
