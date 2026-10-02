import { useState, type ChangeEvent } from 'react';
import { validateCustomCss } from '../../theme/validation';

interface Props {
  css: string;
  onCssChange: (css: string) => void;
  themePlayer: boolean;
  onThemePlayerChange: (themePlayer: boolean) => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

export function AdvancedPanel({ css, onCssChange, themePlayer, onThemePlayerChange, onImport, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState<{ valid: boolean; text: string } | null>(null);

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.currentTarget.value = '';
    if (file) onImport(file);
  };
  const checkCss = () => {
    const result = validateCustomCss(css);
    setCheck({ valid: result.valid, text: result.valid ? 'Extra styles look okay.' : result.error ?? 'Please check your CSS.' });
  };

  return (
    <div className="motix-editor-section">
      <div className="motix-inline">
        <label className="motix-btn motix-import-label">
          Import theme
          <input aria-label="Import a Motix theme file" type="file" accept=".json,application/json" onChange={importFile} hidden />
        </label>
        <button type="button" className="motix-btn" onClick={onExport}>Export theme</button>
      </div>
      <button type="button" className="motix-btn" style={{ marginTop: 12 }} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {open ? 'Hide advanced options' : 'Advanced options'}
      </button>
      {open && (
        <div className="motix-advanced">
          <label className="motix-color-field">
            <input type="checkbox" checked={themePlayer} onChange={(event) => onThemePlayerChange(event.currentTarget.checked)} />
            <span><strong>Theme the video player too</strong><small>Off by default: the player keeps Movix’s own colors.</small></span>
          </label>
          <p className="motix-help" style={{ marginTop: 14 }}>
            The box below is for people who already know CSS. Extra styles are restricted to local CSS rules—no scripts or remote files.
          </p>
          <label className="motix-label" htmlFor="advanced-css">Extra visual styles</label>
          <textarea className="motix-textarea" id="advanced-css" value={css} onChange={(event) => { onCssChange(event.currentTarget.value); setCheck(null); }} placeholder=".section-title { letter-spacing: 2px; }" />
          <div className="motix-actions">
            <button type="button" className="motix-btn motix-btn-small" onClick={checkCss}>Check styles</button>
            <button type="button" className="motix-btn motix-btn-small" onClick={() => { onCssChange(''); setCheck(null); }}>Clear</button>
          </div>
          {check && <p className={`motix-notice ${check.valid ? '' : 'motix-error'}`} role="status">{check.text}</p>}
        </div>
      )}
    </div>
  );
}
