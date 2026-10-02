import type { MotixTheme } from '../shared/types';
import { generateThemeCss, type ThemeCssOptions } from '../theme/theme-css';

const STYLE_ID = 'motix-theme-styles';

// The adapter stylesheet shipped in the manifest only matches while this attribute is set,
// so adding and removing it (plus one <style> for the theme's variables) is all it takes.
export function applyTheme(theme: MotixTheme, options: ThemeCssOptions): void {
  const root = document.documentElement;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    (document.head ?? root).append(style);
  }
  style.textContent = generateThemeCss(theme, options);
  root.dataset.motixTheme = theme.id;
}

export function removeTheme(): void {
  document.getElementById(STYLE_ID)?.remove();
  delete document.documentElement.dataset.motixTheme;
}
