import { useEffect, useRef, useState } from 'react';
import { openEditorInActiveTab, openEditorTab } from '../../shared/browser';
import { selectTheme, setEnabled } from '../../shared/storage';
import type { MotixTheme } from '../../shared/types';
import { Icon } from '../components/Icon';
import { ThemeGallery } from '../components/ThemeGallery';
import { Wordmark } from '../components/Wordmark';
import { accentStyle } from '../editor/EditorApp';
import { useMotixData } from '../hooks/useMotixData';
import { t } from '../i18n';

// Motix's own colour, for when there is no theme to borrow one from.
const BRAND_ACCENT = '#f5a524';

export function PopupApp({ site }: { site?: string }) {
  const { settings, hostname, supported, scope, activeTheme, enabled, reload } = useMotixData(site);
  const [message, setMessage] = useState('');
  const themesRef = useRef<HTMLDivElement>(null);
  // Open on the active theme, wherever it sits in the list.
  const activeId = activeTheme?.id;
  useEffect(() => {
    themesRef.current?.querySelector('input:checked')?.closest('.mx-tile')?.scrollIntoView({ block: 'center' });
  }, [activeId]);

  // The click shows at once; storage confirms a moment later.
  const [pendingId, setPendingId] = useState<string>();
  const chooseTheme = async (theme: MotixTheme) => {
    setPendingId(theme.id);
    try {
      await selectTheme(theme.id, scope);
      await reload();
      setMessage(t('themeChanged', { name: theme.name }));
    } finally {
      setPendingId(undefined);
    }
  };
  const toggle = async () => {
    await setEnabled(!enabled, scope);
    await reload();
    setMessage('');
  };
  const customize = async () => {
    if (await openEditorInActiveTab()) window.close();
    else setMessage(t('reloadTab'));
  };

  // Nothing is drawn until settings arrive, so the accent never flashes from Motix's colour to the theme's.
  if (!settings) return <main className="mx-popup mx-popup-loading" aria-busy="true" />;
  const ready = supported && activeTheme;
  return (
    <main className="mx-popup" style={accentStyle(ready && enabled ? activeTheme.colors.primary : BRAND_ACCENT)}>
      <header className="mx-popup-head">
        <Wordmark withTagline />
        {supported && (
          <input
            type="checkbox" role="switch" className="mx-switch" checked={enabled} aria-label={t('popupSwitch', { host: hostname })}
            onChange={() => void toggle()}
          />
        )}
      </header>

      {ready ? (
        <>
          <div className="mx-popup-status">
            <strong>{enabled ? t('popupOn', { host: hostname }) : t('popupOff', { host: hostname })}</strong>
            <span className="mx-help">{enabled ? t('popupOnHint') : t('popupOffHint')}</span>
          </div>
          <div className="mx-popup-themes" ref={themesRef}>
            <ThemeGallery group="mx-popup-theme" label={t('themeFor', { host: hostname })} customThemes={settings.customThemes} selectedId={pendingId ?? activeTheme.id} disabled={!enabled} onSelect={(theme) => void chooseTheme(theme)} />
          </div>
          <div className="mx-popup-actions">
            <button type="button" className="mx-button mx-button-primary mx-button-block" onClick={() => void customize()}>{t('customize')}</button>
            <span className="mx-help">{t('customizeHint')}</span>
          </div>
        </>
      ) : (
        <div className="mx-popup-empty">
          <strong>{hostname ? t('notSupported') : t('noSite')}</strong>
          <p className="mx-help">{hostname ? t('notSupportedHint') : t('noSiteHint')}</p>
          <button type="button" className="mx-button mx-button-block" onClick={() => void openEditorTab()}>{t('openEditor')}<Icon name="external" /></button>
        </div>
      )}

      <p className="mx-popup-foot" role="status">{message || t('privacy')}</p>
    </main>
  );
}
