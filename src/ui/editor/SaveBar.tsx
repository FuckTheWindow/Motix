import { useId, type RefObject } from 'react';
import { Icon } from '../components/Icon';
import { t } from '../i18n';

export type ApplyScope = 'site' | 'global';

export interface Toast { text: string; error?: boolean; undo?: () => void }

interface Props {
  site?: string;
  scope: ApplyScope;
  onScopeChange: (scope: ApplyScope) => void;
  /** Other sites with their own theme, which a save for every site replaces. */
  replacedSites: number;
  showName: boolean;
  name: string;
  onNameChange: (name: string) => void;
  nameRef: RefObject<HTMLInputElement>;
  dirty: boolean;
  /** Where the saved theme is active, for the "up to date" line. */
  activeWhere: string;
  primaryLabel: string;
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
  onDiscard: () => void;
  toast?: Toast;
  onDismissToast: () => void;
  confirmingLeave: boolean;
  onStay: () => void;
  onLeave: () => void;
}

export function SaveBar(props: Props) {
  const { site, scope, onScopeChange, replacedSites, showName, name, onNameChange, nameRef, dirty, activeWhere, primaryLabel, saving, justSaved, onSave, onDiscard, toast, onDismissToast, confirmingLeave, onStay, onLeave } = props;
  const nameId = useId();
  const scopeId = useId();

  return (
    <footer className="mx-savebar">
      {/* Always in the DOM so screen readers announce what changes in it. */}
      <div className="mx-toast-region" aria-live="polite">
        {toast && (
          <div className={`mx-toast ${toast.error ? 'mx-toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}>
            <span>{toast.text}</span>
            {toast.undo && <button type="button" className="mx-button mx-button-quiet mx-button-small" onClick={() => { toast.undo?.(); onDismissToast(); }}><Icon name="undo" />{t('undo')}</button>}
          </div>
        )}
      </div>

      {confirmingLeave ? (
        <div className="mx-savebar-row mx-leave" role="alertdialog" aria-labelledby={`${nameId}-leave`}>
          <strong id={`${nameId}-leave`}>{t('leaveTitle')}</strong>
          <span className="mx-spacer" />
          <button type="button" className="mx-button" onClick={onStay} autoFocus>{t('leaveStay')}</button>
          <button type="button" className="mx-button mx-button-danger" onClick={onLeave}>{t('leaveGo')}</button>
        </div>
      ) : (
        <>
          {showName && (
            <div className="mx-field mx-savebar-name">
              <label className="mx-label" htmlFor={nameId}>{t('themeName')}</label>
              <input ref={nameRef} className="mx-input" id={nameId} value={name} maxLength={48} onChange={(event) => onNameChange(event.currentTarget.value)} />
            </div>
          )}
          {site && (
            <div className="mx-savebar-scope" role="radiogroup" aria-labelledby={scopeId}>
              <span className="mx-label" id={scopeId}>{t('applyOn')}</span>
              <div className="mx-segmented">
                {([['site', site], ['global', t('everySite')]] as const).map(([value, label]) => (
                  <label key={value} className="mx-segment">
                    <input type="radio" className="mx-cover-input" name="mx-apply-scope" checked={scope === value} onChange={() => onScopeChange(value)} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {scope === 'global' && replacedSites > 0 && <p className="mx-help mx-savebar-note">{t(site ? 'replacesSites' : 'replacesAllSites', { count: replacedSites })}</p>}
          <div className="mx-savebar-row">
            <span className={`mx-state ${dirty ? 'mx-state-dirty' : ''}`}>
              <span className="mx-state-dot" aria-hidden="true" />
              {dirty ? t('unsaved') : t('upToDate', { where: activeWhere })}
            </span>
            <span className="mx-spacer" />
            <button type="button" className="mx-button" disabled={!dirty || saving} onClick={onDiscard}>{t('discard')}</button>
            <button type="button" className="mx-button mx-button-primary" disabled={saving} title={t('saveShortcut')} onClick={onSave}>
              {justSaved ? <><Icon name="check" />{t('saved')}</> : saving ? t('saving') : primaryLabel}
            </button>
          </div>
        </>
      )}
    </footer>
  );
}
