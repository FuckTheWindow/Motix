import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { DEFAULT_THEMES } from '../data/themes';
import { isSupportedMovixDomain, normalizeHostname } from '../shared/domains';
import { activeTabUrl, getBrowserApi, navigateToThemesRoute, openThemesPage, sendTabMessage } from '../shared/browser';
import { getActiveTheme, getSettings, isEnabled, resetDomain, resolveActiveTheme, saveSettings, saveTheme, setEnabled } from '../shared/storage';
import { refreshSupportedDomains } from '../shared/domain-discovery';
import { parseThemeImport, validateCustomCss } from '../shared/validation';
import type { Atmosphere, MotixSettings, MotixTheme } from '../shared/types';
import { DEFAULT_THEMES as PRESET_THEMES } from '../data/themes';

const ATMOSPHERES: Atmosphere[] = ['retro', 'cyberpunk', 'cinema', 'nature', 'ocean', 'arcade', 'minimal', 'terminal'];
const ATMOSPHERE_LABELS: Record<Atmosphere, string> = { retro: 'Retro', cyberpunk: 'Cyberpunk', cinema: 'Cinema', nature: 'Nature', ocean: 'Ocean', arcade: 'Arcade', minimal: 'Minimal', terminal: 'Terminal' };
const COLOR_FIELDS: Array<{ key: keyof MotixTheme['colors']; label: string; help: string }> = [
  { key: 'background', label: 'Site background', help: 'The main color behind everything.' },
  { key: 'card', label: 'Movie card color', help: 'The color behind movie details.' },
  { key: 'primary', label: 'Button color', help: 'The color that makes buttons pop.' },
  { key: 'text', label: 'Main text color', help: 'The color of titles and important text.' },
  { key: 'muted', label: 'Secondary text', help: 'For descriptions and quieter words.' },
  { key: 'border', label: 'Border color', help: 'Lines around cards and menus.' },
  { key: 'surface', label: 'Menu color', help: 'The color of menus and smaller panels.' },
  { key: 'cardHover', label: 'Card hover color', help: 'The card color when your pointer is over it.' },
];
type SliderKey = 'radius' | 'shadow' | 'glow' | 'contrast' | 'buttonSize';
const SLIDERS: Array<{ key: SliderKey; label: string; help: string; low: string; high: string }> = [
  { key: 'radius', label: 'Corner roundness', help: 'Choose how soft the corners feel.', low: 'Square', high: 'Very round' },
  { key: 'shadow', label: 'Shadow strength', help: 'Give cards a little lift from the page.', low: 'None', high: 'Strong' },
  { key: 'glow', label: 'Glow effect', help: 'Add a soft colored glow around highlights.', low: 'None', high: 'Bright' },
  { key: 'contrast', label: 'Contrast', help: 'Make bright and dark colors stand apart.', low: 'Soft', high: 'Bold' },
  { key: 'buttonSize', label: 'Button size', help: 'Make buttons smaller or easier to tap.', low: 'Compact', high: 'Large' },
];

function useInitialData(site?: string) {
  const [settings, setSettings] = useState<MotixSettings | null>(null);
  const [theme, setTheme] = useState<MotixTheme>(DEFAULT_THEMES[0]!);
  const [hostname, setHostname] = useState(site ?? '');
  const [sourceTabId, setSourceTabId] = useState<number | undefined>();
  const [enabled, setEnabledValue] = useState(true);
  useEffect(() => {
    let live = true;
    void (async () => {
      const params = new URLSearchParams(location.search);
      const tabIdValue = params.get('sourceTabId');
      const tabId = tabIdValue === null ? Number.NaN : Number(tabIdValue);
      const sourceTab = Number.isInteger(tabId) && tabId >= 0 ? tabId : undefined;
      const actualHost = site ?? (sourceTab === undefined ? (await activeTabUrl().then((url) => { try { return url ? new URL(url).hostname : ''; } catch { return ''; } })) : '') ?? '';
      const nextSettings = await getSettings();
      const nextEnabled = await isEnabled(actualHost || undefined);
      const nextTheme = resolveActiveTheme(nextSettings, actualHost || undefined);
      if (live) { setHostname(actualHost); setSourceTabId(sourceTab); setSettings(nextSettings); setEnabledValue(nextEnabled); setTheme(nextTheme); }
    })();
    return () => { live = false; };
  }, [site]);
  const reload = async () => {
    const nextSettings = await getSettings();
    setSettings(nextSettings);
    setTheme(await getActiveTheme(hostname || undefined));
    setEnabledValue(await isEnabled(hostname || undefined));
  };
  return { settings, setSettings, theme, setTheme, hostname, setHostname, sourceTabId, enabled, setEnabledValue, reload };
}

function Brand() {
  return <a className="motix-brand" href="#top" aria-label="Motix home"><span className="motix-brand-mark" aria-hidden="true">✦</span><span>motix<small>Make Movix yours</small></span></a>;
}

function ThemeLogo({ theme }: { theme: MotixTheme }) {
  const hasPresetLogo = PRESET_THEMES.some((preset) => preset.id === theme.id);
  if (hasPresetLogo) {
    return <img src={`logos/${theme.id}.png`} alt={`${theme.name} logo`} width={96} height={24} style={{ imageRendering: 'auto' }} />;
  }
  return <strong style={{ color: theme.colors.primary, letterSpacing: 3, fontSize: 20 }}>MOTIX</strong>;
}

function ThemeSwatch({ theme }: { theme: MotixTheme }) {
  return <div className="motix-swatch" aria-label={`${theme.name} color preview`}><span style={{ background: theme.colors.background }} /><span style={{ background: theme.colors.card }} /><span style={{ background: theme.colors.primary }} /><span style={{ background: theme.colors.text }} /></div>;
}

function RangeSetting({ theme, setting, onChange }: { theme: MotixTheme; setting: typeof SLIDERS[number]; onChange: (key: SliderKey, value: number) => void }) {
  const value = theme[setting.key];
  return <div className="motix-slider"><div className="motix-slider-row"><label htmlFor={`range-${setting.key}`}>{setting.label}</label><output htmlFor={`range-${setting.key}`}>{value}{setting.key === 'radius' ? ' px' : '%'}</output></div><span className="motix-help">{setting.help}</span><input id={`range-${setting.key}`} type="range" min="0" max={setting.key === 'radius' ? 32 : 100} value={value} onChange={(event) => onChange(setting.key, Number(event.currentTarget.value))} /><div className="motix-range-labels"><span>{setting.low}</span><span>{setting.high}</span></div></div>;
}

function ThemePreview({ theme, mode, setMode }: { theme: MotixTheme; mode: MotixSettings['previewMode']; setMode: (mode: MotixSettings['previewMode']) => void }) {
  const previewStyle: CSSProperties = {
    '--preview-bg': theme.colors.background,
    '--preview-surface': theme.colors.surface,
    '--preview-card': theme.colors.card,
    '--preview-border': theme.colors.border,
    '--preview-text': theme.colors.text,
    '--preview-muted': theme.colors.muted,
    '--preview-accent': theme.colors.primary,
    '--preview-radius': `${theme.radius}px`,
    '--preview-shadow': `0 7px 20px rgba(0,0,0,${Math.min(0.65, theme.shadow / 160)})${theme.glow ? `, 0 0 ${Math.round(theme.glow * .12)}px ${theme.colors.primary}50` : ''}`,
  } as CSSProperties;
  return <section className="motix-panel motix-preview-panel" aria-label="Live theme preview"><div className="motix-preview-head"><div className="motix-panel-head" style={{ margin: 0 }}><div><h2>See it live</h2><p>Your changes show up here right away.</p></div></div><div className="motix-preview-tabs" aria-label="Preview size">{(['desktop', 'tablet', 'mobile'] as const).map((size) => <button type="button" key={size} aria-pressed={mode === size} onClick={() => setMode(size)}>{size[0]!.toUpperCase() + size.slice(1)}</button>)}</div></div><div className="motix-preview-frame" data-mode={mode} style={previewStyle}><div className="motix-preview-nav"><ThemeLogo theme={theme} /><span>Discover　 Movies　 Series</span><button type="button" className="motix-preview-menu" aria-label="Preview menu">☰</button></div><div className="motix-preview-feature"><span className="motix-preview-badge">✦ FEATURED TONIGHT</span><h3>A story worth staying in for</h3><p>Pick a film, get comfortable, and make this space yours.</p></div><div className="motix-preview-card"><div className="motix-poster" aria-label="Decorative movie poster">🎬</div><div><h4>Midnight in the City</h4><p>A small mystery turns into a big adventure under the neon lights.</p><button type="button">▶ Play preview</button></div></div><div className="motix-progress" aria-label="Progress preview"><span /></div><div className="motix-preview-modal"><strong>Ready for movie night?</strong><p>Your watchlist is waiting. Pick up where you left off.</p></div></div></section>;
}

export function MotixApp({ mode, site, onClose }: { mode: 'editor' | 'embedded'; site?: string; onClose?: () => void }) {
  const data = useInitialData(site);
  const { settings, setSettings, theme, setTheme, hostname, sourceTabId, enabled, reload } = data;
  const [step, setStep] = useState(1);
  const [themeName, setThemeName] = useState('My Custom Theme');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [cssDraft, setCssDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshingDomains, setRefreshingDomains] = useState(false);
  const [applyScope, setApplyScope] = useState<'domain' | 'global'>('global');
  const allThemes = useMemo(() => [...DEFAULT_THEMES, ...(settings?.customThemes ?? [])], [settings]);
  const supported = hostname ? isSupportedMovixDomain(hostname, settings?.supportedDomains ?? []) : false;
  useEffect(() => { if (supported) setApplyScope('domain'); }, [hostname, supported]);

  const selectTheme = (selected: MotixTheme) => {
    setTheme({ ...selected });
    setThemeName(selected.isCustom ? selected.name : `My ${selected.name} Theme`);
    setCssDraft(selected.customCss ?? '');
    setNotice(''); setError('');
  };
  const changeColor = (key: keyof MotixTheme['colors'], value: string) => setTheme((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));
  const changeSlider = (key: SliderKey, value: number) => setTheme((current) => ({ ...current, [key]: value }));
  const selectMode = async (next: MotixSettings['previewMode']) => {
    setSettings((current) => current ? { ...current, previewMode: next } : current);
    if (settings) await saveSettings({ ...settings, previewMode: next });
  };
  const save = async (): Promise<boolean> => {
    setSaving(true); setError(''); setNotice('');
    const cssValidation = validateCustomCss(cssDraft);
    if (!cssValidation.valid) { setError(cssValidation.error ?? 'Please check your extra styles.'); setSaving(false); return false; }
    const savedTheme: MotixTheme = { ...theme, id: theme.isCustom ? theme.id : `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name: themeName.trim() || 'My Custom Theme', customCss: cssDraft, isCustom: true };
    try {
      const targetDomain = applyScope === 'domain' && hostname && supported ? hostname : undefined;
      await saveTheme(savedTheme, targetDomain);
      setTheme(savedTheme);
      const nextSettings = await getSettings();
      setSettings(nextSettings);
      setTheme(resolveActiveTheme(nextSettings, hostname || undefined));
      setNotice('Your theme has been saved!');
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your theme.'); return false; }
    finally { setSaving(false); }
  };
  const applyToOpenWebsite = async () => {
    if (!hostname || !supported) { setError('Open a supported Movix website first to apply this theme there.'); return; }
    setError('');
    const saved = await save();
    if (!saved) return;
    if (mode === 'embedded') {
      window.parent.postMessage({ type: 'MOTIX_APPLY_THEME', hostname }, '*');
      setNotice('Your theme has been applied to this Movix page.');
      return;
    }
    const sent = await sendTabMessage(sourceTabId, { type: 'APPLY_THEME', hostname });
    if (sent) setNotice('Your theme has been applied to the open Movix tab.');
    else setNotice('Your theme is saved. Reload the Movix tab to apply it.');
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setError(''); setNotice('');
    try { const imported = parseThemeImport(await file.text()); selectTheme(imported); setNotice('Theme imported. Save it to keep it on this device.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not import this theme.'); }
  };
  const exportTheme = () => {
    const content = JSON.stringify({ schemaVersion: 1, theme: { ...theme, name: themeName.trim() || theme.name } }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${(themeName || theme.id).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.motix.json`; link.click(); URL.revokeObjectURL(url);
  };
  const cancel = () => { void reload(); setNotice('Your unsaved changes were cancelled.'); setError(''); };
  const reset = async () => {
    if (hostname && supported) await resetDomain(hostname);
    else await saveSettings({ ...(settings ?? await getSettings()), motixEnabled: false });
    await reload(); setNotice('Motix is off; the original website appearance is restored.');
  };

  return <div className={`motix-shell ${mode === 'embedded' ? 'motix-embedded' : ''}`} id="top"><header className="motix-topbar"><Brand /><div className="motix-top-actions">{mode === 'embedded' ? <button type="button" className="motix-btn motix-btn-small" onClick={onClose}>← Back to Movix</button> : <a className="motix-btn motix-btn-small" href="https://movix.online/" target="_blank" rel="noreferrer">Movix directory ↗</a>}</div></header><main className="motix-page-wrap"><div className="motix-intro"><div><span className="motix-eyebrow">YOUR MOVIX, YOUR STYLE</span><h1 className="motix-h1">Customize your Movix experience</h1><p>Pick a look, play with colors, and see your changes instantly. No code, no complicated settings—just make it feel like yours.</p></div>{hostname && <div className="motix-domain-pill">{supported ? '●' : '○'}　{hostname}{supported ? ' · Supported' : ' · Not supported'}</div>}</div><div className="motix-layout"><section className="motix-panel"><div className="motix-panel-head"><div><h2>Make it yours</h2><p>Follow the steps or jump to anything you want.</p></div><span className="motix-domain-pill">Step {step} of 6</span></div><nav className="motix-atmo-grid" aria-label="Editor steps">{['Style', 'Colors', 'Shape', 'Mood', 'Name', 'Save'].map((label, index) => <button type="button" key={label} aria-current={step === index + 1 ? 'step' : undefined} aria-pressed={step === index + 1} onClick={() => setStep(index + 1)}>{index + 1} · {label}</button>)}</nav>
      {step === 1 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Choose a starting style</h2><p>You can change every detail later.</p></div></div><div className="motix-presets">{allThemes.map((preset) => <button className="motix-preset" type="button" key={preset.id} aria-pressed={theme.id === preset.id} onClick={() => selectTheme(preset)}><ThemeSwatch theme={preset} /><strong>{preset.name}</strong><small>{preset.description}</small></button>)}</div><div className="motix-actions"><button className="motix-btn" type="button" onClick={() => selectTheme(DEFAULT_THEMES[0]!)}>Start with Original</button></div></div>}
      {step === 2 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Choose your colors</h2><p>Tap a color square to pick a new one.</p></div></div><div className="motix-color-grid">{COLOR_FIELDS.map(({ key, label, help }) => <label className="motix-color-field" key={key}><input aria-label={label} type="color" value={theme.colors[key]} onChange={(event) => changeColor(key, event.currentTarget.value)} /><span><strong>{label}</strong><small>{help}</small></span></label>)}</div><div className="motix-editor-section"><label className="motix-label" htmlFor="button-color-hover">Button hover color</label><span className="motix-help">What buttons look like when you point at them.</span><input id="button-color-hover" type="color" value={theme.colors.primaryHover} onChange={(event) => changeColor('primaryHover', event.currentTarget.value)} /></div></div>}
      {step === 3 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Change shape and depth</h2><p>Make cards and buttons feel just right.</p></div></div>{SLIDERS.map((setting) => <RangeSetting key={setting.key} theme={theme} setting={setting} onChange={changeSlider} />)}<label className="motix-label" htmlFor="theme-style">Title style</label><span className="motix-help">Choose the overall feel of the letters.</span><select className="motix-select" id="theme-style" value={theme.style} onChange={(event) => setTheme((current) => ({ ...current, style: event.currentTarget.value as MotixTheme['style'] }))}><option value="classic">Classic</option><option value="modern">Modern</option><option value="retro">Retro (typewriter)</option><option value="futuristic">Futuristic</option></select></div>}
      {step === 4 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Pick an atmosphere</h2><p>Choose the world your theme should feel like.</p></div></div><div className="motix-atmo-grid">{ATMOSPHERES.map((atmosphere) => <button type="button" key={atmosphere} aria-pressed={theme.atmosphere === atmosphere} onClick={() => setTheme((current) => ({ ...current, atmosphere }))}>{ATMOSPHERE_LABELS[atmosphere]}</button>)}</div><div className="motix-editor-section"><h2 style={{ fontSize: 16 }}>Want a different vibe?</h2><p className="motix-help">Pick a preset above to try its colors, then come back here and adjust any setting.</p></div></div>}
      {step === 5 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Give your theme a name</h2><p>A name helps you find it later.</p></div></div><label className="motix-label" htmlFor="theme-name">Theme name</label><input className="motix-input" id="theme-name" value={themeName} maxLength={48} onChange={(event) => setThemeName(event.currentTarget.value)} placeholder="My Retro Green Theme" /><p className="motix-help" style={{ marginTop: 8 }}>Example: “My Retro Green Theme” or “Movie Night”</p><div style={{ marginTop: 18 }}><ThemeLogo theme={theme} /><div style={{ marginTop: 12 }}><ThemeSwatch theme={theme} /></div></div></div>}
      {step === 6 && <div className="motix-editor-section"><div className="motix-panel-head"><div><h2>Save your creation</h2><p>Your theme stays on this device.</p></div></div><label className="motix-label">{themeName || 'My Custom Theme'}</label><span className="motix-help">Your themes stay on this device. Choose where this one should be active.</span>{supported && <label className="motix-label" htmlFor="apply-scope">Use this theme</label>} {supported && <select id="apply-scope" className="motix-select" value={applyScope} onChange={(event) => setApplyScope(event.currentTarget.value as 'domain' | 'global')}><option value="domain">Only on {hostname}</option><option value="global">On all approved Movix websites</option></select>}<div className="motix-actions"><button className="motix-btn motix-btn-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save my theme'}</button><button className="motix-btn" type="button" onClick={() => void applyToOpenWebsite()}>Apply changes to the open website</button></div><p className="motix-help" style={{ marginTop: 12 }}>Changes appear instantly in the preview and are applied to the website after saving.</p></div>}
      <div className="motix-actions"><button className="motix-btn" type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>← Previous</button><button className="motix-btn" type="button" onClick={() => setStep(Math.min(6, step + 1))} disabled={step === 6}>Next step →</button></div>
      <div className="motix-editor-section"><div className="motix-actions"><button className="motix-btn motix-btn-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save theme'}</button><button className="motix-btn" type="button" onClick={() => void applyToOpenWebsite()}>Apply changes to the open website</button><button className="motix-btn" type="button" onClick={cancel}>Cancel</button><button className="motix-btn motix-btn-danger" type="button" onClick={() => void reset()}>Reset to original</button></div>{notice && <p className="motix-notice" role="status">{notice}</p>}{error && <p className="motix-notice motix-error" role="alert">{error}</p>}</div>
      <div className="motix-editor-section"><div className="motix-inline"><label className="motix-btn motix-import-label">Import theme<input aria-label="Import a Motix theme file" type="file" accept=".json,.motix.json,application/json" onChange={(event) => void importFile(event)} hidden /></label><button type="button" className="motix-btn" onClick={exportTheme}>Export theme</button></div><div className="motix-inline" style={{ marginTop: 10 }}><button type="button" className="motix-btn motix-btn-small" disabled={refreshingDomains} onClick={() => { setRefreshingDomains(true); void (async () => { const granted = await getBrowserApi()?.permissions?.request({ origins: ['https://movix.online/*'] }); if (!granted) throw new Error('Motix needs optional permission to read the Movix directory.'); return refreshSupportedDomains(); })().then(async (domains) => { await reload(); setNotice(`Updated the approved domain list (${domains.length} hosts).`); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not refresh the domain list.')).finally(() => setRefreshingDomains(false)); }}>{refreshingDomains ? 'Checking directory…' : 'Refresh approved domains'}</button><small className="motix-help">Optional check; new sites still need to be verified by Motix.</small></div><button type="button" className="motix-btn" style={{ marginTop: 12 }} aria-expanded={advanced} onClick={() => setAdvanced((value) => !value)}>{advanced ? 'Hide advanced options' : 'Advanced options'}</button>{advanced && <div className="motix-advanced"><p className="motix-help">This section is for users who already know CSS. You can create a great theme without using it. Extra styles are restricted to local CSS rules—no scripts or remote files.</p><label className="motix-label" htmlFor="advanced-css">Extra visual styles</label><textarea className="motix-textarea" id="advanced-css" value={cssDraft} onChange={(event) => setCssDraft(event.currentTarget.value)} placeholder=".media-card { border-width: 2px; }" /><div className="motix-actions"><button type="button" className="motix-btn motix-btn-small" onClick={() => { const result = validateCustomCss(cssDraft); setError(result.valid ? '' : result.error ?? 'Please check your CSS.'); setNotice(result.valid ? 'Extra styles look okay.' : ''); }}>Check styles</button><button type="button" className="motix-btn motix-btn-small" onClick={() => setCssDraft('')}>Clear</button></div></div>}</div>
    </section><div><ThemePreview theme={theme} mode={settings?.previewMode ?? 'desktop'} setMode={(next) => void selectMode(next)} /><section className="motix-panel" style={{ marginTop: 16 }}><div className="motix-panel-head"><div><h2>Made for you</h2><p>These changes only affect how the website looks.</p></div></div><ul style={{ margin: 0, paddingLeft: 18, color: '#a4afa0', fontSize: 12, lineHeight: 1.9 }}><li>No video or account changes</li><li>Your themes stay on this device</li><li>Motix does not add ads or collect data</li></ul></section></div></div></main></div>;
}

export function MotixPopup() {
  const data = useInitialData();
  const { hostname, settings, theme, enabled, setEnabledValue, reload } = data;
  const supported = hostname ? isSupportedMovixDomain(hostname, settings?.supportedDomains ?? []) : false;
  const [message, setMessage] = useState('');
  const chooseQuickTheme = async (id: string) => {
    if (!settings) return;
    const nextSettings = hostname && supported
      ? { ...settings, domainThemes: { ...settings.domainThemes, [normalizeHostname(hostname)]: id } }
      : { ...settings, globalThemeId: id };
    await saveSettings(nextSettings); await reload(); setMessage('Theme changed!');
  };
  const toggle = async () => {
    const next = !enabled;
    await setEnabled(next, hostname && supported ? hostname : undefined);
    setEnabledValue(next);
    setMessage(next ? 'Motix is on for this site.' : 'Motix is off for this site.');
  };
  const openEditor = () => { void openThemesPage(hostname && supported ? hostname : undefined); };
  const openSiteThemes = () => { if (supported) void navigateToThemesRoute(); else openEditor(); };
  return <main className="motix-shell motix-popup"><Brand /><div className="motix-popup-domain" title={hostname}>{hostname || 'No website tab detected'}</div><div className="motix-popup-card" style={{ marginTop: 14 }}><div className="motix-toggle-row"><div><strong>{supported ? 'Motix is ready' : 'This site is not supported'}</strong><div className="motix-popup-footer">{supported ? 'Only the look of this site can change.' : 'Motix only runs on approved Movix domains.'}</div></div><button className="motix-switch" type="button" role="switch" aria-checked={enabled && supported} aria-label="Enable Motix for this website" disabled={!supported} onClick={() => void toggle()} /></div></div>{supported ? <><div className="motix-popup-theme"><ThemeSwatch theme={theme} /><div><strong>{theme.name}</strong><small>Active theme</small></div></div><label className="motix-label" htmlFor="quick-theme">Quick theme selection</label><select id="quick-theme" className="motix-select" value={theme.id} onChange={(event) => void chooseQuickTheme(event.currentTarget.value)}>{[...DEFAULT_THEMES, ...(settings?.customThemes ?? [])].map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="motix-popup-actions"><button type="button" className="motix-btn motix-btn-primary" onClick={openEditor}>Customize theme</button><button type="button" className="motix-btn" onClick={openSiteThemes}>Open Themes page</button></div></> : <div className="motix-popup-actions"><button type="button" className="motix-btn motix-btn-primary" onClick={() => void openThemesPage()}>Open Motix Themes</button></div>}{message && <p className="motix-notice" role="status">{message}</p>}<p className="motix-popup-footer">Motix changes colors and style only. Your data stays private on this device.</p></main>;
}
