export type UiLanguage = 'system' | 'zh-CN' | 'zh-TW' | 'en-US' | 'fr-FR' | 'es-ES' | 'de-DE';
export const UI_LANGUAGES: UiLanguage[] = ['system', 'zh-CN', 'zh-TW', 'en-US', 'fr-FR', 'es-ES', 'de-DE'];
export function validUiLanguage(value: string): boolean { return UI_LANGUAGES.includes(value as UiLanguage); }
export function uiLanguageCaption(choice: UiLanguage, systemLabel: string): string {
  if (choice === 'system') { return systemLabel; }
  if (choice === 'zh-CN') { return '简体中文'; }
  if (choice === 'de-DE') { return 'Deutsch'; }
  if (choice === 'es-ES') { return 'Español'; }
  if (choice === 'fr-FR') { return 'Français'; }
  return choice === 'zh-TW' ? '繁體中文' : 'English';
}
export function effectiveUiLanguage(choice: UiLanguage, system: string): string {
  if (choice !== 'system') { return choice; }
  const parts = system.trim().replace(/_/g, '-').toLowerCase().split('-');
  if (parts[0] === 'de') { return 'de-DE'; }
  if (parts[0] === 'es') { return 'es-ES'; }
  if (parts[0] === 'fr') { return 'fr-FR'; }
  if (parts[0] !== 'zh') { return 'en-US'; }
  // Explicit script takes precedence over region; HK/MO share the shipped Traditional pack.
  if (parts[1] === 'hant' || ['tw', 'hk', 'mo'].includes(parts[1])) { return 'zh-TW'; }
  if (parts.length === 1 || ['hans', 'cn', 'sg'].includes(parts[1])) { return 'zh-CN'; }
  return 'en-US';
}
