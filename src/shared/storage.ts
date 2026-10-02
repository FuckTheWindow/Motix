import { DEFAULT_THEMES, findTheme } from '../theme/presets';
import { validateTheme } from '../theme/validation';
import { getBrowserApi, type StorageChangeListener } from './browser';
import { isSupportedMovixDomain, normalizeHostname } from './domains';
import type { MotixSettings, MotixTheme } from './types';

const STORAGE_KEY = 'motixSettings';
const UNSUPPORTED_DOMAIN = 'This domain is not supported by Motix.';

export function defaultSettings(): MotixSettings {
  return { schemaVersion: 2, globalThemeId: 'original', domainThemes: {}, customThemes: [], motixEnabled: true, perDomainEnabled: {}, themePlayer: false, previewMode: 'desktop' };
}

// Fields written by schema version 1 that version 2 folds into the current shape.
interface LegacySettings { themeId?: unknown; enabled?: unknown; disabledDomains?: unknown }

function recordOf<T>(value: unknown, keep: (domain: string, item: unknown) => item is T): Record<string, T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value).flatMap(([domain, item]) => (isSupportedMovixDomain(domain) && keep(domain, item) ? [[normalizeHostname(domain), item] as const] : []));
  return Object.fromEntries(entries);
}

/** Normalises anything read from storage (older schema, hand-edited, corrupt) into valid settings. */
export function migrateSettings(raw: unknown): MotixSettings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return defaults;
  const old = raw as { [Key in keyof MotixSettings]?: unknown } & LegacySettings;
  const customThemes = Array.isArray(old.customThemes) ? old.customThemes.filter(validateTheme) : [];
  const knownThemeId = (id: unknown): id is string => typeof id === 'string' && Boolean(findTheme(id, customThemes));
  const legacyDisabled = Array.isArray(old.disabledDomains) ? Object.fromEntries(old.disabledDomains.map((domain) => [domain, false])) : {};
  const globalThemeId = [old.globalThemeId, old.themeId].find(knownThemeId) ?? defaults.globalThemeId;
  const motixEnabled = [old.motixEnabled, old.enabled].find((value): value is boolean => typeof value === 'boolean') ?? true;
  return {
    schemaVersion: 2,
    globalThemeId,
    domainThemes: recordOf(old.domainThemes, (_domain, id): id is string => knownThemeId(id)),
    customThemes,
    motixEnabled,
    perDomainEnabled: { ...recordOf(legacyDisabled, (_domain, enabled): enabled is boolean => enabled === false), ...recordOf(old.perDomainEnabled, (_domain, enabled): enabled is boolean => typeof enabled === 'boolean') },
    themePlayer: old.themePlayer === true,
    previewMode: old.previewMode === 'tablet' || old.previewMode === 'mobile' ? old.previewMode : 'desktop',
  };
}

export async function getSettings(): Promise<MotixSettings> {
  const area = getBrowserApi()?.storage.local;
  // Outside an extension (the Vite dev server) settings live in localStorage.
  if (!area) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return migrateSettings(stored ? JSON.parse(stored) as unknown : null);
    } catch {
      return defaultSettings();
    }
  }
  return migrateSettings((await area.get(STORAGE_KEY))[STORAGE_KEY]);
}

export async function saveSettings(settings: MotixSettings): Promise<void> {
  const normalized = migrateSettings(settings);
  const area = getBrowserApi()?.storage.local;
  if (area) await area.set({ [STORAGE_KEY]: normalized });
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function resolveActiveTheme(settings: MotixSettings, hostname?: string): MotixTheme {
  const domain = hostname ? normalizeHostname(hostname) : undefined;
  const id = (domain && settings.domainThemes[domain]) || settings.globalThemeId;
  return findTheme(id, settings.customThemes) ?? DEFAULT_THEMES[0]!;
}

/** A per-domain choice wins over the global switch, so one site can stay on while the rest are off. */
export function resolveEnabled(settings: MotixSettings, hostname?: string): boolean {
  const domain = hostname ? normalizeHostname(hostname) : undefined;
  return (domain ? settings.perDomainEnabled[domain] : undefined) ?? settings.motixEnabled;
}

function assertSupported(hostname: string | undefined): void {
  if (hostname && !isSupportedMovixDomain(hostname)) throw new Error(UNSUPPORTED_DOMAIN);
}

/** Stores a theme and makes it active, either for one domain or globally. */
export async function saveTheme(theme: MotixTheme, hostname?: string): Promise<void> {
  if (!validateTheme(theme)) throw new Error('This theme has invalid settings.');
  assertSupported(hostname);
  const settings = await getSettings();
  const isPreset = DEFAULT_THEMES.some((preset) => preset.id === theme.id);
  const customThemes = settings.customThemes.filter((existing) => existing.id !== theme.id);
  if (!isPreset) customThemes.push({ ...theme, isCustom: true });
  await saveSettings({
    ...settings,
    customThemes,
    globalThemeId: hostname ? settings.globalThemeId : theme.id,
    // A global choice replaces per-domain ones, so "every Movix website" means every one.
    domainThemes: hostname ? { ...settings.domainThemes, [normalizeHostname(hostname)]: theme.id } : {},
  });
}

export async function selectTheme(themeId: string, hostname?: string): Promise<void> {
  assertSupported(hostname);
  const settings = await getSettings();
  await saveSettings(hostname
    ? { ...settings, domainThemes: { ...settings.domainThemes, [normalizeHostname(hostname)]: themeId } }
    : { ...settings, globalThemeId: themeId, domainThemes: {} });
}

export async function setEnabled(enabled: boolean, hostname?: string): Promise<void> {
  assertSupported(hostname);
  const settings = await getSettings();
  await saveSettings(hostname
    ? { ...settings, perDomainEnabled: { ...settings.perDomainEnabled, [normalizeHostname(hostname)]: enabled } }
    : { ...settings, motixEnabled: enabled });
}

export async function updateSettings(patch: Partial<Pick<MotixSettings, 'themePlayer' | 'previewMode'>>): Promise<void> {
  await saveSettings({ ...await getSettings(), ...patch });
}

export function onSettingsChanged(callback: (settings: MotixSettings) => void): () => void {
  const event = getBrowserApi()?.storage.onChanged;
  if (!event) return () => undefined;
  const listener: StorageChangeListener = (changes, areaName) => {
    if (areaName === 'local' && STORAGE_KEY in changes) callback(migrateSettings(changes[STORAGE_KEY]?.newValue));
  };
  event.addListener(listener);
  return () => event.removeListener(listener);
}
