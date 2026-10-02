import type { MotixTheme } from '../../shared/types';

export type SliderKey = 'radius' | 'shadow' | 'glow' | 'buttonSize';

export interface SliderSetting {
  key: SliderKey;
  label: string;
  help: string;
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
  return (
    <div className="motix-slider">
      <div className="motix-slider-row">
        <label htmlFor={id}>{setting.label}</label>
        <output htmlFor={id}>{theme[setting.key]}{setting.unit}</output>
      </div>
      <span className="motix-help">{setting.help}</span>
      <input id={id} type="range" min="0" max={setting.max} value={theme[setting.key]} onChange={(event) => onChange(setting.key, Number(event.currentTarget.value))} />
      <div className="motix-range-labels"><span>{setting.low}</span><span>{setting.high}</span></div>
    </div>
  );
}
