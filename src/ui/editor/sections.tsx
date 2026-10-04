import { useId, type ReactNode, type RefObject } from 'react';
import type { MotixTheme, ThemeColors } from '../../shared/types';
import { ColorField } from '../components/ColorField';
import { Icon } from '../components/Icon';
import { RangeSetting, type SliderKey, type SliderSetting } from '../components/RangeSetting';
import { ThemeGallery } from '../components/ThemeGallery';
import { t, themeDescription, type MessageKey } from '../i18n';
import { requestReveal, revealOnOpen } from '../reveal';
import { contrastRatio } from '../ui-color';

/** A collapsible section; `<details>` gives keyboard and screen-reader behaviour for free. */
export function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="mx-section" open={open} onToggle={revealOnOpen}>
      <summary className="mx-section-head" onClick={requestReveal}>
        <h2 className="mx-section-title">{title}</h2>
        <span className="mx-section-chevron"><Icon name="chevron" /></span>
      </summary>
      <div className="mx-section-body">{children}</div>
    </details>
  );
}

interface ThemeSectionProps {
  customThemes: MotixTheme[];
  draft: MotixTheme;
  modified: boolean;
  confirmingDelete: boolean;
  onSelect: (theme: MotixTheme) => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function ThemeSection({ customThemes, draft, modified, confirmingDelete, onSelect, onDuplicate, onExport, onDelete }: ThemeSectionProps) {
  return (
    <Section title={t('sectionTheme')} open>
      <ThemeGallery group="mx-editor-theme" label={t('sectionTheme')} customThemes={customThemes} selectedId={draft.id} modified={modified} showEmptyMine onSelect={onSelect} />
      <p className="mx-theme-caption"><strong>{draft.name}</strong> · {themeDescription(draft)}</p>
      {draft.isCustom && customThemes.some((theme) => theme.id === draft.id) && (
        <div className="mx-toolbar" role="group" aria-label={draft.name}>
          <button type="button" className="mx-button mx-button-quiet" onClick={onDuplicate}><Icon name="copy" />{t('duplicate')}</button>
          <button type="button" className="mx-button mx-button-quiet" onClick={onExport}><Icon name="download" />{t('export')}</button>
          <button type="button" className={`mx-button mx-button-quiet ${confirmingDelete ? 'mx-button-danger' : ''}`} onClick={onDelete}>
            <Icon name="trash" />{confirmingDelete ? t('confirmDelete') : t('delete')}
          </button>
        </div>
      )}
    </Section>
  );
}

const KEY_COLORS: Array<{ key: keyof ThemeColors; label: MessageKey; help: MessageKey }> = [
  { key: 'background', label: 'colorBackground', help: 'colorBackgroundHelp' },
  { key: 'primary', label: 'colorPrimary', help: 'colorPrimaryHelp' },
  { key: 'text', label: 'colorText', help: 'colorTextHelp' },
];
const MORE_COLORS: Array<{ key: keyof ThemeColors; label: MessageKey }> = [
  { key: 'surface', label: 'colorSurface' },
  { key: 'card', label: 'colorCard' },
  { key: 'cardHover', label: 'colorCardHover' },
  { key: 'primaryHover', label: 'colorPrimaryHover' },
  { key: 'muted', label: 'colorMuted' },
  { key: 'border', label: 'colorBorder' },
];
const MIN_TEXT_CONTRAST = 4.5;

export function ColorsSection({ theme, onChange }: { theme: MotixTheme; onChange: (key: keyof ThemeColors, value: string) => void }) {
  const ratio = contrastRatio(theme.colors.text, theme.colors.background);
  return (
    <Section title={t('sectionColors')} open>
      <div className="mx-fields">
        {KEY_COLORS.map(({ key, label, help }) => <ColorField key={key} label={t(label)} help={t(help)} value={theme.colors[key]} onChange={(value) => onChange(key, value)} />)}
      </div>
      {ratio < MIN_TEXT_CONTRAST && (
        <p className="mx-callout mx-callout-warning" role="status">
          <Icon name="warning" />{t('lowContrast', { ratio: ratio.toFixed(1).replace('.', t('decimalSeparator')) })}
        </p>
      )}
      <details className="mx-more" onToggle={revealOnOpen}>
        <summary className="mx-more-head" onClick={requestReveal}><span>{t('moreColors')}</span><Icon name="chevron" /></summary>
        <div className="mx-fields">
          {MORE_COLORS.map(({ key, label }) => <ColorField key={key} label={t(label)} value={theme.colors[key]} onChange={(value) => onChange(key, value)} />)}
        </div>
      </details>
    </Section>
  );
}

const SLIDERS: Array<Omit<SliderSetting, 'label' | 'low' | 'high'> & { label: MessageKey; low: MessageKey; high: MessageKey }> = [
  { key: 'radius', label: 'radius', low: 'radiusLow', high: 'radiusHigh', max: 32, unit: ' px' },
  { key: 'shadow', label: 'shadow', low: 'shadowLow', high: 'shadowHigh', max: 100, unit: ' %' },
  { key: 'glow', label: 'glow', low: 'glowLow', high: 'glowHigh', max: 100, unit: ' %' },
  { key: 'buttonSize', label: 'buttonSize', low: 'buttonSizeLow', high: 'buttonSizeHigh', max: 100, unit: ' %' },
];

interface ShapeSectionProps {
  theme: MotixTheme;
  onSliderChange: (key: SliderKey, value: number) => void;
  onMonospaceChange: (monospace: boolean) => void;
}

export function ShapeSection({ theme, onSliderChange, onMonospaceChange }: ShapeSectionProps) {
  const legend = useId();
  const retro = theme.style === 'retro';
  return (
    <Section title={t('sectionShape')}>
      {SLIDERS.map((slider) => (
        <RangeSetting key={slider.key} theme={theme} setting={{ ...slider, label: t(slider.label), low: t(slider.low), high: t(slider.high) }} onChange={onSliderChange} />
      ))}
      <div className="mx-field" role="radiogroup" aria-labelledby={legend}>
        <span className="mx-label" id={legend}>{t('lettering')}</span>
        <div className="mx-segmented">
          {[{ value: false, label: t('letteringMovix') }, { value: true, label: t('letteringRetro') }].map(({ value, label }) => (
            <label key={label} className="mx-segment">
              <input type="radio" className="mx-cover-input" name="mx-lettering" checked={retro === value} onChange={() => onMonospaceChange(value)} />
              <span style={value ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' } : undefined}>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </Section>
  );
}

interface AdvancedSectionProps {
  css: string;
  cssError?: string;
  cssRef: RefObject<HTMLTextAreaElement>;
  detailsRef: RefObject<HTMLDetailsElement>;
  onCssChange: (css: string) => void;
  themePlayer: boolean;
  onThemePlayerChange: (themePlayer: boolean) => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

export function AdvancedSection({ css, cssError, cssRef, detailsRef, onCssChange, themePlayer, onThemePlayerChange, onImport, onExport }: AdvancedSectionProps) {
  const cssId = useId();
  return (
    <details className="mx-section" ref={detailsRef} onToggle={revealOnOpen}>
      <summary className="mx-section-head" onClick={requestReveal}>
        <h2 className="mx-section-title">{t('sectionAdvanced')}</h2>
        <span className="mx-section-chevron"><Icon name="chevron" /></span>
      </summary>
      <div className="mx-section-body">
        <label className="mx-check">
          <input type="checkbox" role="switch" className="mx-switch" checked={themePlayer} aria-describedby={`${cssId}-player`} onChange={(event) => onThemePlayerChange(event.currentTarget.checked)} />
          <span>
            <span className="mx-label">{t('themePlayer')}</span>
            <span className="mx-help" id={`${cssId}-player`}>{t('themePlayerHelp')}</span>
          </span>
        </label>

        <div className="mx-field">
          <label className="mx-label" htmlFor={cssId}>{t('customCss')}</label>
          <span className="mx-help" id={`${cssId}-help`}>{t('customCssHelp')}</span>
          <textarea
            ref={cssRef} className="mx-input mx-textarea" id={cssId} value={css} spellCheck={false}
            placeholder=".section-title { letter-spacing: 2px; }"
            aria-invalid={cssError ? true : undefined}
            aria-describedby={cssError ? `${cssId}-help ${cssId}-error` : `${cssId}-help`}
            onChange={(event) => onCssChange(event.currentTarget.value)}
          />
          {cssError && <p className="mx-field-error" id={`${cssId}-error`} role="alert">{cssError}</p>}
        </div>

        <div className="mx-toolbar">
          <label className="mx-button mx-button-quiet">
            <Icon name="upload" />{t('importTheme')}
            <input
              type="file" className="mx-visually-hidden" accept=".json,application/json" aria-label={t('importLabel')}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                // Reset so picking the same file twice still fires a change event.
                event.currentTarget.value = '';
                if (file) onImport(file);
              }}
            />
          </label>
          <button type="button" className="mx-button mx-button-quiet" onClick={onExport}><Icon name="download" />{t('exportTheme')}</button>
        </div>
      </div>
    </details>
  );
}
