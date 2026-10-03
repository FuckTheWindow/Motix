import type { MotixTheme } from '../../shared/types';

export function ThemeSwatch({ theme }: { theme: MotixTheme }) {
  const { background, card, primary, text } = theme.colors;
  return (
    <div className="motix-swatch" aria-label={`${theme.name} color preview`}>
      {[background, card, primary, text].map((color, index) => <span key={index} style={{ background: color }} />)}
    </div>
  );
}
