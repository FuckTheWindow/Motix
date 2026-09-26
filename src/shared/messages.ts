import type { MotixMessage, MotixTheme } from './types';

export const messages = {
  applyTheme: (hostname: string): MotixMessage => ({ type: 'APPLY_THEME', payload: { hostname } }),
  removeTheme: (): MotixMessage => ({ type: 'REMOVE_THEME' }),
  getActiveTheme: (hostname?: string): MotixMessage => ({ type: 'GET_ACTIVE_THEME', payload: { hostname } }),
  saveTheme: (theme: MotixTheme, hostname?: string): MotixMessage => ({ type: 'SAVE_THEME', payload: { theme, hostname } }),
  resetTheme: (hostname?: string): MotixMessage => ({ type: 'RESET_THEME', payload: { hostname } }),
  setEnabled: (enabled: boolean, hostname?: string): MotixMessage => ({ type: 'SET_MOTIX_ENABLED', payload: { enabled, hostname } }),
  getSupportedDomains: (): MotixMessage => ({ type: 'GET_SUPPORTED_DOMAINS' }),
  refreshSupportedDomains: (): MotixMessage => ({ type: 'REFRESH_SUPPORTED_DOMAINS' }),
  openThemesPage: (hostname?: string): MotixMessage => ({ type: 'OPEN_THEMES_PAGE', payload: { hostname } }),
};
