import { useState, type CSSProperties } from 'react';
import type { MotixTheme, PreviewMode } from '../../shared/types';
import { t } from '../i18n';
import { textOn } from '../ui-color';

const MODES = [
  { mode: 'desktop', label: () => t('previewDesktop') },
  { mode: 'mobile', label: () => t('previewMobile') },
] as const;

interface Props {
  theme: MotixTheme;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
}

function previewVariables(theme: MotixTheme): CSSProperties {
  const { colors } = theme;
  const lift = `0 7px 20px rgba(0,0,0,${Math.min(0.65, theme.shadow / 160)})`;
  const glow = theme.glow ? `, 0 0 ${Math.round(theme.glow * 0.12)}px ${colors.primary}50` : '';
  return {
    '--preview-bg': colors.background,
    '--preview-surface': colors.surface,
    '--preview-card': colors.card,
    '--preview-border': colors.border,
    '--preview-text': colors.text,
    '--preview-muted': colors.muted,
    '--preview-accent': colors.primary,
    '--preview-on-accent': textOn(colors.primary),
    '--preview-radius': `${theme.radius}px`,
    '--preview-shadow': lift + glow,
    '--preview-font': theme.style === 'retro' ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
    '--preview-button-scale': 0.8 + theme.buttonSize / 250,
  } as CSSProperties;
}

/**
 * A miniature Movix page for when the editor is opened on its own. Opened from a Movix page, the editor
 * previews on the real site instead and this mock is not shown.
 */
export function ThemePreview({ theme, mode, onModeChange }: Props) {
  // Answers the click at once; the stored preference catches up.
  const [chosen, setChosen] = useState<PreviewMode>();
  const current = (chosen ?? mode) === 'mobile' ? 'mobile' : 'desktop';
  const choose = (next: PreviewMode) => { setChosen(next); onModeChange(next); };
  return (
    <section className="mx-preview" aria-labelledby="mx-preview-title">
      <div className="mx-preview-head">
        <div>
          <h2 className="mx-preview-title" id="mx-preview-title">{t('preview')}</h2>
          <p className="mx-help">{t('previewHint')}</p>
        </div>
        <div className="mx-segmented" role="radiogroup" aria-label={t('preview')}>
          {MODES.map(({ mode: value, label }) => (
            <label key={value} className="mx-segment">
              <input type="radio" className="mx-cover-input" name="mx-preview-mode" checked={current === value} onChange={() => choose(value)} />
              <span>{label()}</span>
            </label>
          ))}
        </div>
      </div>
      {/* Purely visual: none of it is focusable, so keyboard users are not sent through a fake site. */}
      <div className="mx-preview-frame" data-mode={current} style={previewVariables(theme)} aria-hidden="true">
        <div className="mx-preview-nav">
          <strong className="mx-preview-logo">MOVIX</strong>
          <span>{t('mockNav')}</span>
        </div>
        <div className="mx-preview-feature">
          <span className="mx-preview-badge">{t('mockBadge')}</span>
          <h3>{t('mockTitle')}</h3>
          <p>{t('mockText')}</p>
        </div>
        <div className="mx-preview-card">
          <div className="mx-preview-poster" />
          <div>
            <h4>{t('mockCard')}</h4>
            <p>{t('mockCardText')}</p>
            <span className="mx-preview-play">{t('mockPlay')}</span>
          </div>
        </div>
        <div className="mx-preview-progress"><span /></div>
        <div className="mx-preview-modal">
          <strong>{t('mockModal')}</strong>
          <p>{t('mockModalText')}</p>
        </div>
      </div>
    </section>
  );
}
