export type Atmosphere = 'retro' | 'cyberpunk' | 'cinema' | 'nature' | 'ocean' | 'arcade' | 'minimal' | 'terminal';
export type ThemeStyle = 'classic' | 'modern' | 'retro' | 'futuristic' | 'minimal';

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
  atmosphere: Atmosphere;
  colors: ThemeColors;
  radius: number;
  shadow: number;
  glow: number;
  contrast: number;
  buttonSize: number;
  style: ThemeStyle;
  customCss?: string;
  isCustom?: boolean;
}

export interface MotixSettings {
  schemaVersion: number;
  globalThemeId: string;
  domainThemes: Record<string, string>;
  customThemes: MotixTheme[];
  customCss: Record<string, string>;
  supportedDomains: string[];
  userDomains: string[];
  motixEnabled: boolean;
  disabledDomains: string[];
  perDomainEnabled: Record<string, boolean>;
  directoryCacheAt: number;
  previewMode: 'desktop' | 'tablet' | 'mobile';
}

export interface MotixMessage {
  type: 'APPLY_THEME' | 'REMOVE_THEME' | 'GET_ACTIVE_THEME' | 'SAVE_THEME' | 'DELETE_THEME' | 'RESET_THEME' | 'IMPORT_THEME' | 'EXPORT_THEME' | 'SET_MOTIX_ENABLED' | 'GET_SUPPORTED_DOMAINS' | 'REFRESH_SUPPORTED_DOMAINS' | 'OPEN_THEMES_PAGE';
  payload?: unknown;
}
