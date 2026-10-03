export type Atmosphere = 'retro' | 'cyberpunk' | 'cinema' | 'nature' | 'ocean' | 'arcade' | 'minimal' | 'terminal';
export type ThemeStyle = 'classic' | 'modern' | 'retro' | 'futuristic' | 'minimal';
export type PreviewMode = 'desktop' | 'tablet' | 'mobile';

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  cardHover: string;
  primary: string;
  primaryHover: string;
  text: string;
  muted: string;
  border: string;
}

export interface MotixTheme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  radius: number;
  shadow: number;
  glow: number;
  buttonSize: number;
  style: ThemeStyle;
  // Kept so themes exported by earlier versions still import; neither affects the generated CSS.
  atmosphere: Atmosphere;
  contrast: number;
  customCss?: string;
  isCustom?: boolean;
}

export interface MotixSettings {
  schemaVersion: 2;
  globalThemeId: string;
  domainThemes: Record<string, string>;
  customThemes: MotixTheme[];
  motixEnabled: boolean;
  perDomainEnabled: Record<string, boolean>;
  themePlayer: boolean;
  previewMode: PreviewMode;
}
