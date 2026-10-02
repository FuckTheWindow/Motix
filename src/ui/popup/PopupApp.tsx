import { useState } from 'react';
import { openEditorInActiveTab, openEditorTab } from '../../shared/browser';
import { selectTheme, setEnabled } from '../../shared/storage';
import { DEFAULT_THEMES } from '../../theme/presets';
import { Brand } from '../components/Brand';
import { ThemeSwatch } from '../components/ThemeSwatch';
import { useMotixData } from '../hooks/useMotixData';

export function PopupApp({ site }: { site?: string }) {
  const { settings, hostname, supported, scope, activeTheme, enabled, reload } = useMotixData(site);
  const [message, setMessage] = useState('');

  const chooseTheme = async (id: string) => {
    await selectTheme(id, scope);
    await reload();
    setMessage('Theme changed!');
  };
  const toggle = async () => {
    await setEnabled(!enabled, scope);
    await reload();
    setMessage(enabled ? 'Motix is off for this site.' : 'Motix is on for this site.');
  };

  const customize = async () => {
    if (await openEditorInActiveTab()) window.close();
    else setMessage('Reload this Movix tab, then try again.');
  };

  return (
    <main className="motix-shell motix-popup">
      <Brand />
      <div className="motix-popup-domain" title={hostname}>{hostname || 'No website tab detected'}</div>
      <div className="motix-popup-card" style={{ marginTop: 14 }}>
        <div className="motix-toggle-row">
          <div>
            <strong>{supported ? 'Motix is ready' : 'This site is not supported'}</strong>
            <div className="motix-popup-footer">
              {supported ? 'Only the look of this site can change.' : 'Motix only runs on official Movix domains.'}
            </div>
          </div>
          <button className="motix-switch" type="button" role="switch" aria-checked={enabled && supported} aria-label="Enable Motix for this website" disabled={!supported} onClick={() => void toggle()} />
        </div>
      </div>

      {supported && settings && activeTheme ? (
        <>
          <div className="motix-popup-theme">
            <ThemeSwatch theme={activeTheme} />
            <div><strong>{activeTheme.name}</strong><small>Active theme</small></div>
          </div>
          <label className="motix-label" htmlFor="quick-theme">Quick theme selection</label>
          <select id="quick-theme" className="motix-select" value={activeTheme.id} onChange={(event) => void chooseTheme(event.currentTarget.value)}>
            {[...DEFAULT_THEMES, ...settings.customThemes].map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
          </select>
          <div className="motix-popup-actions">
            {/* The editor opens inside the site, where "Back to Movix" returns to the page the user was on. */}
            <button type="button" className="motix-btn motix-btn-primary" onClick={() => void customize()}>Customize theme</button>
          </div>
        </>
      ) : (
        <div className="motix-popup-actions">
          <button type="button" className="motix-btn motix-btn-primary" onClick={() => void openEditorTab()}>Open Motix Themes</button>
        </div>
      )}

      {message && <p className="motix-notice" role="status">{message}</p>}
      <p className="motix-popup-footer">Motix changes colors and style only. Your data stays private on this device.</p>
    </main>
  );
}
