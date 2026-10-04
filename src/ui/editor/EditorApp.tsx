import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MOVIX_PRIMARY_DOMAIN } from '../../shared/domains';
import { PREVIEW_THEME_MESSAGE } from '../../shared/editor-messages';
import { deleteCustomTheme, domainOverrides, getSettings, resolveActiveTheme, saveSettings, saveTheme, selectTheme, storeCustomTheme, updateSettings } from '../../shared/storage';
import type { MotixSettings, MotixTheme, ThemeColors } from '../../shared/types';
import { DEFAULT_THEMES, findTheme } from '../../theme/presets';
import { parseThemeImport, validateCustomCss } from '../../theme/validation';
import { Icon } from '../components/Icon';
import { ThemePreview } from '../components/ThemePreview';
import { Wordmark } from '../components/Wordmark';
import { useMotixData } from '../hooks/useMotixData';
import { t, translateError } from '../i18n';
import { textOn, uiAccent } from '../ui-color';
import { SaveBar, type ApplyScope, type Toast } from './SaveBar';
import { AdvancedSection, ColorsSection, ShapeSection, ThemeSection } from './sections';

const TOAST_MS = 6000;
const SAVED_FLASH_MS = 1600;

interface EditorProps {
  site?: string;
  /** Present when the editor is docked beside a Movix page; closes it and hands the page back. */
  onClose?: () => void;
}

/** The accent the editor dresses itself in: the theme being edited, so the tool takes on the user's colours. */
export function accentStyle(accent: string): CSSProperties {
  const ui = uiAccent(accent);
  return { '--mx-accent': ui, '--mx-on-accent': textOn(ui) } as CSSProperties;
}

export function EditorApp({ site, onClose }: EditorProps) {
  const { settings, hostname, supported, scope, activeTheme, reload } = useMotixData(site);
  const embedded = Boolean(onClose);

  return (
    <div className={`mx-app ${embedded ? 'mx-app-embedded' : 'mx-app-page'}`}>
      {/* The form owns a draft seeded from storage, so it only mounts once settings have loaded. */}
      {settings && activeTheme
        ? <EditorForm settings={settings} activeTheme={activeTheme} hostname={hostname} supported={supported} scope={scope} reload={reload} onClose={onClose} />
        : <div className="mx-loading" aria-busy="true" />}
    </div>
  );
}

const isPreset = (theme: MotixTheme) => DEFAULT_THEMES.some((preset) => preset.id === theme.id);

const COLOR_KEYS: Array<keyof ThemeColors> = ['background', 'surface', 'card', 'cardHover', 'primary', 'primaryHover', 'text', 'muted', 'border'];

/**
 * Everything about a theme that changes how Movix looks. Colours are read in a fixed order: storage hands
 * objects back with their keys sorted, so the same theme must not compare as different after a save.
 */
function lookOf(theme: MotixTheme, css: string): string {
  const { colors, radius, shadow, glow, buttonSize, style } = theme;
  return JSON.stringify([COLOR_KEYS.map((key) => colors[key].toLowerCase()), radius, shadow, glow, buttonSize, style === 'retro', css.trim()]);
}

const defaultName = (theme: MotixTheme) => (theme.isCustom ? theme.name : t('defaultName', { name: theme.name }));
const newThemeId = () => `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** The name, or the name with a number, so two custom themes never share one. */
function uniqueName(name: string, customThemes: MotixTheme[], exceptId?: string): string {
  const taken = new Set(customThemes.filter((theme) => theme.id !== exceptId).map((theme) => theme.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let index = 2; ; index++) {
    const candidate = `${name.slice(0, 44)} ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function download(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const fileName = (name: string) => `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'motix-theme'}.motix.json`;

interface Draft { theme: MotixTheme; css: string; name: string }
const draftOf = (theme: MotixTheme): Draft => ({ theme, css: theme.customCss ?? '', name: defaultName(theme) });

interface EditorFormProps {
  settings: MotixSettings;
  activeTheme: MotixTheme;
  hostname: string;
  supported: boolean;
  scope?: string;
  /** Storage change events keep an installed extension in sync; the dev server has none, so writes reload explicitly. */
  reload: () => Promise<void>;
  onClose?: () => void;
}

function EditorForm({ settings, activeTheme, hostname, supported, scope, reload, onClose }: EditorFormProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(activeTheme));
  // A site-specific save is the default: it matches the popup, and never overrides other sites' choices.
  const [applyScope, setApplyScope] = useState<ApplyScope>(scope ? 'site' : 'global');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [toast, setToast] = useState<Toast>();
  const [cssError, setCssError] = useState<string>();
  // The theme whose deletion awaits a second click; any other theme selected cancels it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  // Held locally so the switch answers at once instead of waiting for the storage round trip.
  const [themePlayer, setThemePlayer] = useState(settings.themePlayer);
  const nameRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  // Open on the active theme, wherever it sits in the gallery.
  useEffect(() => {
    mainRef.current?.querySelector('input[name="mx-editor-theme"]:checked')?.closest('.mx-tile')?.scrollIntoView({ block: 'center' });
  }, []);
  const cssRef = useRef<HTMLTextAreaElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);

  const { theme, css, name } = draft;
  // The stored version of the theme the draft started from: what "modified" and "unsaved" compare against.
  const stored = findTheme(theme.id, settings.customThemes) ?? theme;
  const lookChanged = lookOf(theme, css) !== lookOf(stored, stored.customCss ?? '');
  const preset = isPreset(theme);
  const nameChanged = !preset && name.trim() !== stored.name;
  const dirty = lookChanged || nameChanged || theme.id !== activeTheme.id;
  const finalName = name.trim() || t('fallbackName');
  const confirmingDelete = confirmDeleteId === theme.id;
  const where = applyScope === 'site' && scope ? scope : t('everywhere');
  const activeWhere = scope && settings.domainThemes[scope] ? scope : t('everywhere');

  const notify = useCallback((next: Toast) => setToast(next), []);
  useEffect(() => {
    if (!toast || toast.error) return undefined;
    const timer = window.setTimeout(() => setToast(undefined), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!justSaved) return undefined;
    const timer = window.setTimeout(() => setJustSaved(false), SAVED_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [justSaved]);

  // Docked beside Movix, every draft change shows on the real page before anything is saved.
  const previewTheme = useMemo<MotixTheme | null>(() => {
    if (theme.id === 'original' && !lookChanged) return null;
    return { ...theme, customCss: validateCustomCss(css).valid ? css : stored.customCss ?? '' };
  }, [theme, css, lookChanged, stored]);
  useEffect(() => {
    if (onClose) window.parent.postMessage({ type: PREVIEW_THEME_MESSAGE, theme: previewTheme }, '*');
  }, [onClose, previewTheme]);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateTheme = (patch: Partial<MotixTheme>) => setDraft((current) => ({ ...current, theme: { ...current.theme, ...patch } }));

  const load = (next: MotixTheme) => {
    const previous = draft;
    setDraft(draftOf(next));
    setCssError(undefined);
    // Switching away from unsaved work is one click, so it is also one click to get it back.
    if (dirty && next.id !== theme.id) notify({ text: t('loadedStatus', { name: next.name }), undo: () => setDraft(previous) });
  };

  const save = async () => {
    const cssCheck = validateCustomCss(css);
    if (!cssCheck.valid) {
      const message = translateError(cssCheck.error);
      setCssError(message);
      if (advancedRef.current) advancedRef.current.open = true;
      // The error sits on the field itself (announced there), which is opened and focused.
      cssRef.current?.focus();
      return;
    }
    const target = applyScope === 'site' ? scope : undefined;
    setSaving(true);
    try {
      if (preset && !lookChanged) {
        await selectTheme(theme.id, target);
        notify({ text: t('appliedStatus', { name: theme.name, where }) });
      } else {
        // Editing a preset never overwrites it: the result becomes a new custom theme.
        const saved: MotixTheme = {
          ...theme,
          id: preset ? newThemeId() : theme.id,
          name: uniqueName(finalName, settings.customThemes, preset ? undefined : theme.id),
          customCss: css,
          isCustom: true,
        };
        await saveTheme(saved, target);
        setDraft(draftOf(saved));
        notify({ text: t('savedStatus', { name: saved.name, where }) });
      }
      await reload();
      setJustSaved(true);
    } catch (reason) {
      notify({ text: translateError(reason), error: true });
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDraft(draftOf(activeTheme));
    setCssError(undefined);
    notify({ text: t('discardedStatus') });
  };

  const duplicate = async () => {
    const copy: MotixTheme = { ...theme, customCss: css, id: newThemeId(), name: uniqueName(t('copySuffix', { name: finalName }).slice(0, 48), settings.customThemes), isCustom: true };
    try {
      await storeCustomTheme(copy);
      await reload();
      setDraft(draftOf(copy));
      notify({ text: t('duplicatedStatus', { name: copy.name }) });
      nameRef.current?.focus();
    } catch (reason) {
      notify({ text: translateError(reason), error: true });
    }
  };

  const remove = async () => {
    if (!confirmingDelete) { setConfirmDeleteId(theme.id); return; }
    const before = settings;
    const deleted = theme;
    await deleteCustomTheme(deleted.id);
    await reload();
    setConfirmDeleteId(undefined);
    const restore = async () => { await saveSettings(before); await reload(); setDraft(draftOf(deleted)); };
    // Load whatever is now active here, since the deleted theme may have been it.
    setDraft(draftOf(resolveActiveTheme(await getSettings(), scope)));
    notify({ text: t('deletedStatus', { name: deleted.name }), undo: () => void restore() });
  };

  const importTheme = async (file: File) => {
    try {
      const imported = parseThemeImport(await file.text());
      // An imported file must not silently replace a theme already on this device.
      const fresh = settings.customThemes.some((existing) => existing.id === imported.id) ? { ...imported, id: newThemeId() } : imported;
      setDraft(draftOf(fresh));
      notify({ text: t('importedStatus') });
    } catch (reason) {
      notify({ text: translateError(reason), error: true });
    }
  };

  const exportTheme = () => {
    const content = JSON.stringify({ schemaVersion: 1, theme: { ...theme, name: finalName, customCss: css } }, null, 2);
    download(fileName(finalName), content);
  };

  const requestClose = useCallback(() => {
    if (!onClose) return;
    if (dirty) setConfirmingLeave(true);
    else onClose();
  }, [dirty, onClose]);

  // Ctrl/Cmd+S saves from anywhere; Escape closes the docked editor (asking first if work would be lost).
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveRef.current(); }
      if (event.key === 'Escape' && !event.defaultPrevented) {
        if (confirmingLeave) setConfirmingLeave(false);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmingLeave, requestClose]);

  const replacedSites = domainOverrides(settings, scope).length;
  const siteLabel = hostname && !supported ? t('unsupportedSite', { host: hostname }) : scope ?? t('allSites');

  return (
    <div className="mx-editor" style={accentStyle(theme.colors.primary)}>
      <div className="mx-editor-column">
        <header className="mx-header">
          <Wordmark />
          <div className="mx-header-title">
            <h1>{t('themes')}</h1>
            <span className={`mx-site ${scope ? 'mx-site-on' : ''}`}><span className="mx-site-dot" aria-hidden="true" />{siteLabel}</span>
          </div>
          {onClose
            ? <button type="button" className="mx-button mx-button-quiet mx-button-icon" aria-label={t('closeEditor')} title={t('closeEditor')} onClick={requestClose}><Icon name="close" size={18} /></button>
            : <a className="mx-button mx-button-quiet mx-button-small" href={`https://${scope ?? MOVIX_PRIMARY_DOMAIN}/`}>{t('goToMovix')}<Icon name="external" /></a>}
        </header>

        <main className="mx-editor-main" ref={mainRef}>
          <ThemeSection
            customThemes={settings.customThemes} draft={{ ...theme, name: preset ? theme.name : finalName }} modified={lookChanged} confirmingDelete={confirmingDelete}
            onSelect={load} onDuplicate={() => void duplicate()} onExport={exportTheme} onDelete={() => void remove()}
          />
          <ColorsSection theme={theme} onChange={(key: keyof ThemeColors, value) => updateTheme({ colors: { ...theme.colors, [key]: value } })} />
          <ShapeSection
            theme={theme}
            onSliderChange={(key, value) => updateTheme({ [key]: value })}
            onMonospaceChange={(monospace) => updateTheme({ style: monospace ? 'retro' : 'modern' })}
          />
          <AdvancedSection
            css={css} cssError={cssError} cssRef={cssRef} detailsRef={advancedRef}
            onCssChange={(next) => { update({ css: next }); setCssError(undefined); }}
            themePlayer={themePlayer}
            onThemePlayerChange={(next) => { setThemePlayer(next); void updateSettings({ themePlayer: next }).then(reload); }}
            onImport={(file) => void importTheme(file)}
            onExport={exportTheme}
          />
        </main>

        <SaveBar
          site={scope} scope={applyScope} onScopeChange={setApplyScope} replacedSites={replacedSites}
          showName={!preset || lookChanged} name={name} onNameChange={(next) => update({ name: next })} nameRef={nameRef}
          dirty={dirty} activeWhere={activeWhere} primaryLabel={preset && !lookChanged ? t('apply') : t('save')}
          saving={saving} justSaved={justSaved} onSave={() => void save()} onDiscard={discard}
          toast={toast} onDismissToast={() => setToast(undefined)}
          confirmingLeave={confirmingLeave} onStay={() => setConfirmingLeave(false)} onLeave={() => onClose?.()}
        />
      </div>
      {!onClose && <aside className="mx-editor-preview"><ThemePreview theme={theme} mode={settings.previewMode} onModeChange={(previewMode) => void updateSettings({ previewMode }).then(reload)} /></aside>}
    </div>
  );
}
