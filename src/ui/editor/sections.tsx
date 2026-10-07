import { css as cssLanguage } from '@codemirror/lang-css';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import CodeMirror, { type EditorView, type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { MotixTheme, ThemeColors } from '../../shared/types';
import { ColorField } from '../components/ColorField';
import { Icon } from '../components/Icon';
import { RangeSetting, type SliderKey, type SliderSetting } from '../components/RangeSetting';
import { ThemeGallery } from '../components/ThemeGallery';
import { t, themeDescription, type MessageKey } from '../i18n';
import { requestReveal, revealOnOpen } from '../reveal';
import { contrastRatio } from '../ui-color';

// The repo's own custom-CSS guide (selectors, pitfalls, a pre-ship checklist): docs/CUSTOM_CSS_GUIDE.md,
// rendered by GitHub. Only resolves once the branch holding it is pushed and merged to main.
const CUSTOM_CSS_GUIDE_URL = 'https://github.com/FuckTheWindow/Motix/blob/main/docs/CUSTOM_CSS_GUIDE.md';

// A stable array identity, so CodeMirror does not tear down and rebuild its extensions on every render.
const CSS_EDITOR_EXTENSIONS = [cssLanguage()];

/**
 * CodeMirror's actual focusable, screen-reader-facing node (contentDOM, inside .cm-content) is not the
 * element react-codemirror puts id/aria-* props on, so this applies them imperatively instead, once the
 * view exists. Returns the `onCreateEditor` callback to hand to `<CodeMirror>`.
 *
 * Naming it needs `aria-labelledby` or `aria-label`, not `<label for>` + `id`: `for` only establishes an
 * accessible name on elements HTML calls "labelable" (input, textarea, select, …) — contentDOM is a
 * `role="textbox"` div, not one of those, so a browser's accessibility tree silently ignores a `for`
 * pointing at it even though the DOM attributes look right. Caught by an actual accessible-name query
 * (Playwright's `getByLabel`, which reads the real accessibility tree over CDP) finding nothing, after
 * inspecting raw DOM attributes said it should have worked.
 *
 * The view is captured through `onCreateEditor` — fired deterministically, exactly once, the moment it
 * exists — rather than read back out through a `RefObject` prop in an effect, which can run before the
 * library's own internal ref assignment and silently find nothing. It's kept in a plain local `useRef`
 * (not state) since the DOM node under it is about to be mutated directly: only a ref a component owns
 * itself, not a prop or a `useState` value, lints as a legitimate place to do that.
 */
function useCssEditorA11y(describedBy: string, invalid: boolean, name: { labelledBy: string } | { label: string }): (view: EditorView) => void {
  const nameValue = 'labelledBy' in name ? name.labelledBy : name.label;
  const nameAttr = 'labelledBy' in name ? 'aria-labelledby' : 'aria-label';
  const viewRef = useRef<EditorView | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const content = viewRef.current?.contentDOM;
    if (!content) return;
    content.setAttribute(nameAttr, nameValue);
    content.setAttribute('aria-describedby', describedBy);
    if (invalid) content.setAttribute('aria-invalid', 'true');
    else content.removeAttribute('aria-invalid');
  }, [ready, nameAttr, nameValue, describedBy, invalid]);
  return (view) => { viewRef.current = view; setReady(true); };
}

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
  cssRef: RefObject<ReactCodeMirrorRef>;
  detailsRef: RefObject<HTMLDetailsElement>;
  onCssChange: (css: string) => void;
  themePlayer: boolean;
  onThemePlayerChange: (themePlayer: boolean) => void;
  onImport: (file: File) => void;
  onExport: () => void;
}

export function AdvancedSection({ css, cssError, cssRef, detailsRef, onCssChange, themePlayer, onThemePlayerChange, onImport, onExport }: AdvancedSectionProps) {
  const cssId = useId();
  const cssLabelId = `${cssId}-label`;
  const cssHelpId = `${cssId}-help`;
  const cssErrorId = `${cssId}-error`;
  const describedBy = cssError ? `${cssHelpId} ${cssErrorId}` : cssHelpId;
  const invalid = Boolean(cssError);
  const onCreateEditor = useCssEditorA11y(describedBy, invalid, { labelledBy: cssLabelId });

  // The inline field is cramped for anything beyond a tweak, so it can open as a bigger modal
  // instead, filling the docked panel's own viewport edge to edge (the panel itself stays put —
  // an iframe can't grow past its own box, and there's no need for it to here).
  const [cssModalOpen, setCssModalOpen] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const modalTitleId = `${cssId}-modal-title`;
  const modalOnCreateEditor = useCssEditorA11y(describedBy, invalid, { label: t('cssModalTitle') });

  // The single source of truth for "is it open" is the <dialog> itself: Escape closes it natively,
  // so state is synced from its own `close` event, not duplicated into every place that could close it.
  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return;
    const onNativeClose = () => setCssModalOpen(false);
    dialog.addEventListener('close', onNativeClose);
    return () => dialog.removeEventListener('close', onNativeClose);
  }, []);
  useEffect(() => {
    const dialog = modalRef.current;
    if (!dialog) return;
    if (cssModalOpen && !dialog.open) dialog.showModal();
    if (!cssModalOpen && dialog.open) dialog.close();
  }, [cssModalOpen]);

  return (
    <>
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
            <div className="mx-field-head">
              <label className="mx-label" id={cssLabelId}>{t('customCss')}</label>
              <button
                type="button" className="mx-button mx-button-quiet mx-button-icon mx-button-small" aria-label={t('cssExpand')} title={t('cssExpand')}
                onClick={() => setCssModalOpen(true)}
              >
                <Icon name="expand" size={14} />
              </button>
            </div>
            <span className="mx-help" id={cssHelpId}>
              {t('customCssHelp')}{' '}
              <a href={CUSTOM_CSS_GUIDE_URL} target="_blank" rel="noreferrer">{t('customCssGuide')}</a>
            </span>
            <CodeMirror
              ref={cssRef}
              className={`mx-code-editor${invalid ? ' mx-code-editor-invalid' : ''}`}
              value={css}
              theme={vscodeDark}
              extensions={CSS_EDITOR_EXTENSIONS}
              placeholder=".section-title { letter-spacing: 2px; }"
              onChange={onCssChange}
              onCreateEditor={onCreateEditor}
            />
            {cssError && <p className="mx-field-error" id={cssErrorId} role="alert">{cssError}</p>}
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

      {/* A sibling of <details>, not a descendant: a closed section forces display:none on its own
          direct children, which would make showModal() throw on a dialog caught in that subtree. */}
      <dialog ref={modalRef} className="mx-css-modal" aria-labelledby={modalTitleId}>
        <div className="mx-css-modal-head">
          <h2 id={modalTitleId}>{t('cssModalTitle')}</h2>
          <button type="button" className="mx-button mx-button-quiet mx-button-icon" aria-label={t('cssCollapse')} title={t('cssCollapse')} onClick={() => modalRef.current?.close()}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <CodeMirror
          className={`mx-code-editor mx-code-editor-large${invalid ? ' mx-code-editor-invalid' : ''}`}
          value={css}
          theme={vscodeDark}
          extensions={CSS_EDITOR_EXTENSIONS}
          placeholder=".section-title { letter-spacing: 2px; }"
          onChange={onCssChange}
          onCreateEditor={modalOnCreateEditor}
          autoFocus={cssModalOpen}
        />
        {/* Only while open: a role="alert" in both places at once would announce the same error twice. */}
        {cssModalOpen && cssError && <p className="mx-field-error" role="alert">{cssError}</p>}
      </dialog>
    </>
  );
}
