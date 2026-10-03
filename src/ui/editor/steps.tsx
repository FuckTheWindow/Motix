import type { MotixTheme, ThemeColors } from '../../shared/types';
import { RangeSetting, type SliderKey, type SliderSetting } from '../components/RangeSetting';
import { ThemeLogo } from '../components/ThemeLogo';
import { ThemeSwatch } from '../components/ThemeSwatch';

export const STEP_LABELS = ['Style', 'Colors', 'Shape', 'Name', 'Save'] as const;

const COLOR_FIELDS: Array<{ key: keyof ThemeColors; label: string; help: string }> = [
  { key: 'background', label: 'Site background', help: 'The main color behind everything.' },
  { key: 'card', label: 'Movie card color', help: 'The color behind movie details.' },
  { key: 'primary', label: 'Button color', help: 'The color that makes buttons pop.' },
  { key: 'primaryHover', label: 'Button hover color', help: 'What buttons look like when you point at them.' },
  { key: 'text', label: 'Main text color', help: 'The color of titles and important text.' },
  { key: 'muted', label: 'Secondary text', help: 'For descriptions and quieter words.' },
  { key: 'border', label: 'Border color', help: 'Lines around cards and menus.' },
  { key: 'surface', label: 'Menu color', help: 'The color of menus and smaller panels.' },
  { key: 'cardHover', label: 'Card hover color', help: 'The card color when your pointer is over it.' },
];

const SLIDERS: SliderSetting[] = [
  { key: 'radius', label: 'Corner roundness', help: 'Choose how soft the corners feel.', low: 'Square', high: 'Very round', max: 32, unit: ' px' },
  { key: 'shadow', label: 'Shadow strength', help: 'Give cards a little lift from the page.', low: 'None', high: 'Strong', max: 100, unit: '%' },
  { key: 'glow', label: 'Glow effect', help: 'Add a soft colored glow around highlights.', low: 'None', high: 'Bright', max: 100, unit: '%' },
  { key: 'buttonSize', label: 'Button size', help: 'Make buttons smaller or easier to tap.', low: 'Compact', high: 'Large', max: 100, unit: '%' },
];

function StepHead({ title, hint }: { title: string; hint: string }) {
  return <div className="motix-panel-head"><div><h2>{title}</h2><p>{hint}</p></div></div>;
}

export function StyleStep({ themes, selectedId, onSelect }: { themes: MotixTheme[]; selectedId: string; onSelect: (theme: MotixTheme) => void }) {
  return (
    <div className="motix-editor-section">
      <StepHead title="Choose a starting style" hint="You can change every detail later." />
      <div className="motix-presets">
        {themes.map((preset) => (
          <button className="motix-preset" type="button" key={preset.id} aria-pressed={selectedId === preset.id} onClick={() => onSelect(preset)}>
            <ThemeSwatch theme={preset} />
            <strong>{preset.name}</strong>
            <small>{preset.description}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorsStep({ theme, onChange }: { theme: MotixTheme; onChange: (key: keyof ThemeColors, value: string) => void }) {
  return (
    <div className="motix-editor-section">
      <StepHead title="Choose your colors" hint="Tap a color square to pick a new one." />
      <div className="motix-color-grid">
        {COLOR_FIELDS.map(({ key, label, help }) => (
          <label className="motix-color-field" key={key}>
            <input aria-label={label} type="color" value={theme.colors[key]} onChange={(event) => onChange(key, event.currentTarget.value)} />
            <span><strong>{label}</strong><small>{help}</small></span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface ShapeStepProps {
  theme: MotixTheme;
  onSliderChange: (key: SliderKey, value: number) => void;
  onMonospaceChange: (monospace: boolean) => void;
}

export function ShapeStep({ theme, onSliderChange, onMonospaceChange }: ShapeStepProps) {
  return (
    <div className="motix-editor-section">
      <StepHead title="Change shape and depth" hint="Make cards and buttons feel just right." />
      {SLIDERS.map((setting) => <RangeSetting key={setting.key} theme={theme} setting={setting} onChange={onSliderChange} />)}
      <label className="motix-label" htmlFor="theme-font">Lettering</label>
      <span className="motix-help">Choose the overall feel of the letters.</span>
      <select className="motix-select" id="theme-font" value={theme.style === 'retro' ? 'retro' : 'default'} onChange={(event) => onMonospaceChange(event.currentTarget.value === 'retro')}>
        <option value="default">Movix default</option>
        <option value="retro">Retro (typewriter)</option>
      </select>
    </div>
  );
}

export function NameStep({ theme, name, onChange }: { theme: MotixTheme; name: string; onChange: (name: string) => void }) {
  return (
    <div className="motix-editor-section">
      <StepHead title="Give your theme a name" hint="A name helps you find it later." />
      <label className="motix-label" htmlFor="theme-name">Theme name</label>
      <input className="motix-input" id="theme-name" value={name} maxLength={48} onChange={(event) => onChange(event.currentTarget.value)} placeholder="My Retro Green Theme" />
      <p className="motix-help" style={{ marginTop: 8 }}>Example: “My Retro Green Theme” or “Movie Night”</p>
      <div style={{ marginTop: 18 }}>
        <ThemeLogo theme={theme} />
        <div style={{ marginTop: 12 }}><ThemeSwatch theme={theme} /></div>
      </div>
    </div>
  );
}

export type ApplyScope = 'domain' | 'global';

interface SaveStepProps {
  name: string;
  hostname?: string;
  applyScope: ApplyScope;
  onScopeChange: (scope: ApplyScope) => void;
}

export function SaveStep({ name, hostname, applyScope, onScopeChange }: SaveStepProps) {
  return (
    <div className="motix-editor-section">
      <StepHead title="Save your creation" hint="Your theme stays on this device." />
      <strong className="motix-label">{name}</strong>
      {hostname ? (
        <>
          <label className="motix-label" htmlFor="apply-scope">Use this theme</label>
          <select id="apply-scope" className="motix-select" value={applyScope} onChange={(event) => onScopeChange(event.currentTarget.value as ApplyScope)}>
            <option value="global">On every Movix website</option>
            <option value="domain">Only on {hostname}</option>
          </select>
        </>
      ) : (
        <span className="motix-help">This theme will be used on every Movix website.</span>
      )}
      <p className="motix-help" style={{ marginTop: 12 }}>Saving applies the theme to your open Movix tabs straight away.</p>
    </div>
  );
}
