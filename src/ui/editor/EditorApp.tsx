import { useState } from 'react';
import { MOVIX_PRIMARY_DOMAIN } from '../../shared/domains';
import { saveTheme, selectTheme, updateSettings } from '../../shared/storage';
import type { MotixSettings, MotixTheme } from '../../shared/types';
import { DEFAULT_THEMES } from '../../theme/presets';
import { parseThemeImport, validateCustomCss } from '../../theme/validation';
import { Brand } from '../components/Brand';
import { ThemePreview } from '../components/ThemePreview';
import { useMotixData } from '../hooks/useMotixData';
import { AdvancedPanel } from './AdvancedPanel';
import { ColorsStep, NameStep, SaveStep, ShapeStep, STEP_LABELS, StyleStep, type ApplyScope } from './steps';

const FALLBACK_NAME = 'My Custom Theme';

interface EditorProps {
  site?: string;
  /** Present when the editor is embedded in a Movix page; closes it and returns to the site. */
  onClose?: () => void;
}

export function EditorApp({ site, onClose }: EditorProps) {
  const { settings, hostname, supported, scope, activeTheme, reload } = useMotixData(site);

  return (
    <div className={`motix-shell ${onClose ? 'motix-embedded' : ''}`} id="top">
      <header className="motix-topbar">
        <Brand />
        <div className="motix-top-actions">
          {onClose
            ? <button type="button" className="motix-btn motix-btn-small" onClick={onClose}>← Back to Movix</button>
            : <a className="motix-btn motix-btn-small" href={`https://${supported ? hostname : MOVIX_PRIMARY_DOMAIN}/`}>Go to Movix →</a>}
        </div>
      </header>
      <main className="motix-page-wrap">
        <div className="motix-intro">
          <div>
            <span className="motix-eyebrow">YOUR MOVIX, YOUR STYLE</span>
            <h1 className="motix-h1">Customize your Movix experience</h1>
            <p>Pick a look, play with colors, and see your changes instantly. No code, no complicated settings—just make it feel like yours.</p>
          </div>
          {hostname && <div className="motix-domain-pill">{supported ? '●' : '○'} {hostname}{supported ? ' · Supported' : ' · Not supported'}</div>}
        </div>
        {/* The form owns a draft seeded from storage, so it only mounts once settings have loaded. */}
        {settings && activeTheme && <EditorForm settings={settings} activeTheme={activeTheme} scope={scope} reload={reload} />}
      </main>
    </div>
  );
}

function customName(theme: MotixTheme): string {
  return theme.isCustom ? theme.name : `My ${theme.name} Theme`;
}

function newThemeId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function download(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface EditorFormProps {
  settings: MotixSettings;
  activeTheme: MotixTheme;
  scope?: string;
  /** Storage change events keep an installed extension in sync; the dev server has none, so writes reload explicitly. */
  reload: () => Promise<void>;
}

function EditorForm({ settings, activeTheme, scope, reload }: EditorFormProps) {
  const [draft, setDraft] = useState(activeTheme);
  const [name, setName] = useState(() => customName(activeTheme));
  const [css, setCss] = useState(activeTheme.customCss ?? '');
  const [step, setStep] = useState(1);
  const [applyScope, setApplyScope] = useState<ApplyScope>('global');
  const [saving, setSaving] = useState(false);
  // Held locally so the checkbox answers at once instead of waiting for the storage round trip.
  const [themePlayer, setThemePlayer] = useState(settings.themePlayer);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);

  const finalName = name.trim() || FALLBACK_NAME;
  const notify = (text: string) => setStatus({ error: false, text });
  const fail = (reason: unknown, fallback: string) => setStatus({ error: true, text: reason instanceof Error ? reason.message : fallback });

  const load = (theme: MotixTheme) => {
    setDraft(theme);
    setName(customName(theme));
    setCss(theme.customCss ?? '');
    setStatus(null);
  };

  const save = async () => {
    const cssCheck = validateCustomCss(css);
    if (!cssCheck.valid) { setStatus({ error: true, text: cssCheck.error ?? 'Please check your extra styles.' }); return; }
    // Editing a preset never overwrites it: the result is saved as a new custom theme.
    const theme: MotixTheme = { ...draft, id: draft.isCustom ? draft.id : newThemeId(), name: finalName, customCss: css, isCustom: true };
    setSaving(true);
    try {
      await saveTheme(theme, applyScope === 'domain' ? scope : undefined);
      await reload();
      setDraft(theme);
      notify('Your theme has been saved and applied!');
    } catch (reason) {
      fail(reason, 'Could not save your theme.');
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    await selectTheme('original', scope);
    await reload();
    load(DEFAULT_THEMES[0]!);
    notify('The original Movix look is back.');
  };

  const importTheme = async (file: File) => {
    try {
      load(parseThemeImport(await file.text()));
      notify('Theme imported. Save it to keep it on this device.');
    } catch (reason) {
      fail(reason, 'Could not import this theme.');
    }
  };

  const exportTheme = () => {
    const content = JSON.stringify({ schemaVersion: 1, theme: { ...draft, name: finalName, customCss: css } }, null, 2);
    download(`${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.motix.json`, content);
  };

  return (
    <div className="motix-layout">
      <section className="motix-panel">
        <div className="motix-panel-head">
          <div><h2>Make it yours</h2><p>Follow the steps or jump to anything you want.</p></div>
          <span className="motix-domain-pill">Step {step} of {STEP_LABELS.length}</span>
        </div>
        <nav className="motix-steps" aria-label="Editor steps">
          {STEP_LABELS.map((label, index) => (
            <button type="button" key={label} aria-current={step === index + 1 ? 'step' : undefined} aria-pressed={step === index + 1} onClick={() => setStep(index + 1)}>
              {index + 1} · {label}
            </button>
          ))}
        </nav>

        {step === 1 && <StyleStep themes={[...DEFAULT_THEMES, ...settings.customThemes]} selectedId={draft.id} onSelect={load} />}
        {step === 2 && <ColorsStep theme={draft} onChange={(key, value) => setDraft((current) => ({ ...current, colors: { ...current.colors, [key]: value } }))} />}
        {step === 3 && (
          <ShapeStep
            theme={draft}
            onSliderChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
            onMonospaceChange={(monospace) => setDraft((current) => ({ ...current, style: monospace ? 'retro' : 'modern' }))}
          />
        )}
        {step === 4 && <NameStep theme={draft} name={name} onChange={setName} />}
        {step === 5 && <SaveStep name={finalName} hostname={scope} applyScope={applyScope} onScopeChange={setApplyScope} />}

        <div className="motix-actions">
          {step > 1 && <button className="motix-btn" type="button" onClick={() => setStep(step - 1)}>← Previous</button>}
          {step < STEP_LABELS.length && <button className="motix-btn" type="button" onClick={() => setStep(step + 1)}>Next step →</button>}
        </div>
        <div className="motix-editor-section">
          <div className="motix-actions">
            <button className="motix-btn motix-btn-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save theme'}</button>
            <button className="motix-btn" type="button" onClick={() => { load(activeTheme); notify('Your unsaved changes were cancelled.'); }}>Cancel</button>
            <button className="motix-btn motix-btn-danger" type="button" onClick={() => void reset()}>Reset to original</button>
          </div>
          {status && <p className={`motix-notice ${status.error ? 'motix-error' : ''}`} role={status.error ? 'alert' : 'status'}>{status.text}</p>}
        </div>
        <AdvancedPanel
          css={css}
          onCssChange={setCss}
          themePlayer={themePlayer}
          onThemePlayerChange={(next) => { setThemePlayer(next); void updateSettings({ themePlayer: next }).then(reload); }}
          onImport={(file) => void importTheme(file)}
          onExport={exportTheme}
        />
      </section>
      <div>
        <ThemePreview theme={draft} mode={settings.previewMode} onModeChange={(previewMode) => void updateSettings({ previewMode }).then(reload)} />
        <section className="motix-panel" style={{ marginTop: 16 }}>
          <div className="motix-panel-head"><div><h2>Made for you</h2><p>These changes only affect how the website looks.</p></div></div>
          <ul className="motix-help" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }}>
            <li>No video or account changes</li>
            <li>Your themes stay on this device</li>
            <li>Motix does not add ads or collect data</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
