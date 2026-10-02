import type { CSSProperties } from 'react';
import type { MotixTheme, PreviewMode } from '../../shared/types';
import { ThemeLogo } from './ThemeLogo';

const MODES: PreviewMode[] = ['desktop', 'tablet', 'mobile'];

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
    '--preview-radius': `${theme.radius}px`,
    '--preview-shadow': lift + glow,
  } as CSSProperties;
}

/** A miniature Movix-like page, so changes can be judged before they are saved. */
export function ThemePreview({ theme, mode, onModeChange }: Props) {
  return (
    <section className="motix-panel motix-preview-panel" aria-label="Live theme preview">
      <div className="motix-preview-head">
        <div className="motix-panel-head" style={{ margin: 0 }}>
          <div><h2>See it live</h2><p>Your changes show up here right away.</p></div>
        </div>
        <div className="motix-preview-tabs" aria-label="Preview size">
          {MODES.map((size) => (
            <button type="button" key={size} aria-pressed={mode === size} onClick={() => onModeChange(size)}>
              {size[0]!.toUpperCase() + size.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className="motix-preview-frame" data-mode={mode} style={previewVariables(theme)}>
        <div className="motix-preview-nav">
          <ThemeLogo theme={theme} />
          <span>Discover · Movies · Series</span>
          <button type="button" className="motix-preview-menu" aria-label="Preview menu">☰</button>
        </div>
        <div className="motix-preview-feature">
          <span className="motix-preview-badge">✦ FEATURED TONIGHT</span>
          <h3>A story worth staying in for</h3>
          <p>Pick a film, get comfortable, and make this space yours.</p>
        </div>
        <div className="motix-preview-card">
          <div className="motix-poster" aria-label="Decorative movie poster">🎬</div>
          <div>
            <h4>Midnight in the City</h4>
            <p>A small mystery turns into a big adventure under the neon lights.</p>
            <button type="button">▶ Play preview</button>
          </div>
        </div>
        <div className="motix-progress" aria-label="Progress preview"><span /></div>
        <div className="motix-preview-modal">
          <strong>Ready for movie night?</strong>
          <p>Your watchlist is waiting. Pick up where you left off.</p>
        </div>
      </div>
    </section>
  );
}
