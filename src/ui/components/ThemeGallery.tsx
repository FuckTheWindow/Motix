import type { CSSProperties } from 'react';
import type { MotixTheme } from '../../shared/types';
import { DEFAULT_THEMES } from '../../theme/presets';
import { t } from '../i18n';
import { textOn } from '../ui-color';

const ANIME_IDS = new Set(['one-punch-man', 'onimai', 'dragon-ball-z', 'demon-slayer']);

function screenStyle(theme: MotixTheme): CSSProperties {
  const { colors } = theme;
  return {
    '--t-bg': colors.background,
    '--t-surface': colors.surface,
    '--t-card': colors.card,
    '--t-accent': colors.primary,
    '--t-on-accent': textOn(colors.primary),
    '--t-text': colors.text,
    '--t-muted': colors.muted,
    '--t-border': colors.border,
    // The tile is a tenth of the real site, so corners shrink with it but stay visible.
    '--t-radius': `${Math.max(1, Math.round(theme.radius / 4))}px`,
  } as CSSProperties;
}

/** A miniature Movix screen in the theme's colours and corner radius: header, banner, accent button, poster row. */
export function ThemeScreen({ theme }: { theme: MotixTheme }) {
  return (
    <span className="mx-screen" style={screenStyle(theme)} aria-hidden="true">
      <span className="mx-screen-bar"><span className="mx-screen-logo" /><span className="mx-screen-nav" /></span>
      <span className="mx-screen-hero"><span className="mx-screen-title" /><span className="mx-screen-button" /></span>
      <span className="mx-screen-row"><span /><span /><span /><span /></span>
    </span>
  );
}

interface TileProps {
  theme: MotixTheme;
  group: string;
  checked: boolean;
  modified?: boolean;
  disabled?: boolean;
  onSelect: (theme: MotixTheme) => void;
}

function ThemeTile({ theme, group, checked, modified, disabled, onSelect }: TileProps) {
  const id = `${group}-${theme.id}`;
  return (
    <label className="mx-tile" htmlFor={id}>
      <input
        type="radio" className="mx-cover-input" id={id} name={group} value={theme.id} checked={checked} disabled={disabled}
        aria-describedby={modified ? `${id}-edited` : undefined}
        onChange={() => onSelect(theme)}
      />
      <ThemeScreen theme={theme} />
      <span className="mx-tile-name">{theme.name}</span>
      {modified && <span className="mx-tile-edited" id={`${id}-edited`}>{t('edited')}</span>}
    </label>
  );
}

interface GalleryProps {
  /** Radio group name; also prefixes element ids, so it must be unique per page. */
  group: string;
  customThemes: MotixTheme[];
  selectedId: string;
  /** Marks the selected tile as changed from its saved version. */
  modified?: boolean;
  disabled?: boolean;
  /** When set, an empty "My themes" group stays visible and teaches how to fill it. */
  showEmptyMine?: boolean;
  label: string;
  onSelect: (theme: MotixTheme) => void;
}

/** Every theme as a radio group: arrow keys move through them, and screen readers hear "Dracula, radio, 6 of 16". */
export function ThemeGallery({ group, customThemes, selectedId, modified, disabled, showEmptyMine, label, onSelect }: GalleryProps) {
  const groups = [
    { key: 'mine', title: t('myThemes'), themes: customThemes },
    { key: 'collection', title: t('collection'), themes: DEFAULT_THEMES.filter((theme) => !ANIME_IDS.has(theme.id)) },
    { key: 'anime', title: t('anime'), themes: DEFAULT_THEMES.filter((theme) => ANIME_IDS.has(theme.id)) },
  ];
  return (
    <fieldset className="mx-gallery" disabled={disabled}>
      <legend className="mx-visually-hidden">{label}</legend>
      {groups.map(({ key, title, themes }) => {
        if (!themes.length && !(key === 'mine' && showEmptyMine)) return null;
        return (
          <div className="mx-gallery-group" key={key}>
            <h3 className="mx-gallery-title">{title}</h3>
            {themes.length ? (
              <div className="mx-tiles">
                {themes.map((theme) => (
                  <ThemeTile key={theme.id} theme={theme} group={group} checked={theme.id === selectedId} modified={modified && theme.id === selectedId} disabled={disabled} onSelect={onSelect} />
                ))}
              </div>
            ) : <p className="mx-empty">{t('myThemesEmpty')}</p>}
          </div>
        );
      })}
    </fieldset>
  );
}
