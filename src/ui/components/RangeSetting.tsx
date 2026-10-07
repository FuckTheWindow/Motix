import type { CSSProperties } from 'react';
import type { MotixTheme } from '../../shared/types';

export type SliderKey = 'radius' | 'shadow' | 'glow' | 'buttonSize';

export interface SliderSetting {
  key: SliderKey;
  label: string;
  low: string;
  high: string;
  max: number;
  unit: string;
}

interface Props {
  theme: MotixTheme;
  setting: SliderSetting;
  onChange: (key: SliderKey, value: number) => void;
}

export function RangeSetting({ theme, setting, onChange }: Props) {
  const id = `range-${setting.key}`;
  const value = theme[setting.key];
  return (
    <div className="mx-range">
      <div className="mx-range-head">
        <label className="mx-label" htmlFor={id}>{setting.label}</label>
        {/* Not an <output>: its implicit live region would announce every step while dragging; the slider's
            own aria-valuetext already gives screen readers the value. */}
        <span className="mx-range-value" aria-hidden="true">{value}{setting.unit}</span>
      </div>
      <input
        id={id} type="range" min="0" max={setting.max} value={value}
        aria-valuetext={`${value}${setting.unit}`}
        style={{ '--mx-fill': `${(value / setting.max) * 100}%` } as CSSProperties}
        onChange={(event) => onChange(setting.key, Number(event.currentTarget.value))}
      />
      <div className="mx-range-ends" aria-hidden="true"><span>{setting.low}</span><span>{setting.high}</span></div>
    </div>
  );
}
