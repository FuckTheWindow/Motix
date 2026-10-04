import { useId, useState } from 'react';
import { t } from '../i18n';
import { normalizeHex } from '../ui-color';

interface Props {
  label: string;
  help?: string;
  value: string;
  onChange: (hex: string) => void;
}

/** A swatch that opens the system picker, plus a hex field for pasting exact colours. */
export function ColorField({ label, help, value, onChange }: Props) {
  const id = useId();
  // What the user is typing, tied to the colour it was typed against: a new outside value (another theme
  // loaded, the picker used) simply replaces it.
  const [edit, setEdit] = useState<{ text: string; base: string }>();
  const text = edit && edit.base === value ? edit.text : value;

  const type = (next: string) => {
    // A full six-digit code applies at once; a short one waits for the field to lose focus, so typing
    // "#abcdef" is not cut short at "#abc".
    const hex = /^#?[0-9a-f]{6}$/i.test(next.trim()) ? normalizeHex(next) : undefined;
    if (hex && hex !== value) {
      setEdit({ text: next, base: hex });
      onChange(hex);
    } else {
      setEdit({ text: next, base: value });
    }
  };
  const settle = () => {
    const hex = normalizeHex(text);
    if (hex && hex !== value) onChange(hex);
    setEdit(undefined);
  };

  return (
    <div className="mx-color">
      <div className="mx-color-text">
        <label className="mx-label" htmlFor={id}>{label}</label>
        {help && <span className="mx-help" id={`${id}-help`}>{help}</span>}
      </div>
      <div className="mx-color-inputs">
        <span className="mx-swatch" style={{ background: value }}>
          <input type="color" aria-label={t('colorPicker', { label })} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
        </span>
        <input
          className="mx-input mx-hex" id={id} type="text" inputMode="text" spellCheck={false} autoComplete="off" maxLength={7}
          value={text} aria-describedby={help ? `${id}-help` : undefined} title={t('hexHint')}
          aria-invalid={normalizeHex(text) ? undefined : true}
          onChange={(event) => type(event.currentTarget.value)}
          onBlur={settle}
          onKeyDown={(event) => { if (event.key === 'Enter') settle(); }}
        />
      </div>
    </div>
  );
}
