import type { MotixTheme } from '../../shared/types';
import { DEFAULT_THEMES } from '../../theme/presets';

// Presets ship a pre-rendered wordmark (see scripts/generate-logos.ts); custom themes get a text one.
export function ThemeLogo({ theme }: { theme: MotixTheme }) {
  if (DEFAULT_THEMES.some((preset) => preset.id === theme.id)) {
    return <img src={`logos/${theme.id}.png`} alt={`${theme.name} logo`} width={96} height={24} />;
  }
  return <strong style={{ color: theme.colors.primary, letterSpacing: 3, fontSize: 20 }}>MOTIX</strong>;
}
