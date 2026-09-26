import type { MotixTheme } from '../shared/types';
import { generateThemeCss } from '../shared/theme-css';

const STYLE_ID = 'motix-theme-styles';

export function applyTheme(theme: MotixTheme): void {
  if (!document.documentElement) return;
  document.documentElement.dataset.motixTheme = theme.id;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.dataset.motixOwned = 'true';
    (document.head ?? document.documentElement).append(style);
  }
  style.textContent = generateThemeCss(theme);
}

export function removeTheme(): void {
  document.getElementById(STYLE_ID)?.remove();
  delete document.documentElement.dataset.motixTheme;
}
