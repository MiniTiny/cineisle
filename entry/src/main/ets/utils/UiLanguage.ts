export type UiLanguage = 'system' | 'zh-CN' | 'zh-TW' | 'en-US' | 'fr-FR' | 'es-ES' | 'de-DE' | 'it-IT' | 'pt-PT' | 'pt-BR' | 'ko-KR';
export const UI_LANGUAGES: UiLanguage[] = ['system', 'zh-CN', 'zh-TW', 'en-US', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR', 'ko-KR'];
export function validUiLanguage(value: string): boolean { return UI_LANGUAGES.includes(value as UiLanguage); }
export function uiLanguageCaption(choice: UiLanguage, systemLabel: string): string {
  if (choice === 'system') { return systemLabel; }
  if (choice === 'zh-CN') { return '简体中文'; }
  if (choice === 'pt-PT') { return 'Português (Portugal)'; }
  if (choice === 'pt-BR') { return 'Português (Brasil)'; }
  if (choice === 'ko-KR') { return '한국어'; }
  if (choice === 'it-IT') { return 'Italiano'; }
  if (choice === 'de-DE') { return 'Deutsch'; }
  if (choice === 'es-ES') { return 'Español'; }
  if (choice === 'fr-FR') { return 'Français'; }
  return choice === 'zh-TW' ? '繁體中文' : 'English';
}
export function effectiveUiLanguage(choice: UiLanguage, system: string): string {
  if (choice !== 'system') { return choice; }
  const parts = system.trim().replace(/_/g, '-').toLowerCase().split('-');
  if (parts[0] === 'ko') {
    if (parts.some(part => !/^[a-z0-9]{1,8}$/.test(part))) { return 'en-US'; }
    // The Korean pack serves Korean regions; incompatible explicit scripts keep the fallback.
    let regionIndex = 1;
    if (parts[1]?.length === 4) {
      if (parts[1] !== 'kore' && parts[1] !== 'hang') { return 'en-US'; }
      regionIndex = 2;
    }
    const region = parts[regionIndex] ?? '';
    if (region === '' || /^[a-z]{2}$|^\d{3}$/.test(region) || region.length === 1) { return 'ko-KR'; }
    return 'en-US';
  }
  if (parts[0] === 'pt') {
    if (parts.some(part => !/^[a-z0-9]{1,8}$/.test(part))) { return 'en-US'; }
    // Only the region subtag selects Brazil; extension/private-use BR is not a region.
    // The independent Portugal pack also serves generic Latin Portuguese.
    let regionIndex = 1;
    if (parts[1]?.length === 4) {
      if (parts[1] !== 'latn') { return 'en-US'; }
      regionIndex = 2;
    }
    const region = parts[regionIndex] ?? '';
    if (region === 'br') { return 'pt-BR'; }
    if (region === '' || /^[a-z]{2}$|^\d{3}$/.test(region) || region.length === 1) { return 'pt-PT'; }
    return 'en-US';
  }
  if (parts[0] === 'it') { return 'it-IT'; }
  if (parts[0] === 'de') { return 'de-DE'; }
  if (parts[0] === 'es') { return 'es-ES'; }
  if (parts[0] === 'fr') { return 'fr-FR'; }
  if (parts[0] !== 'zh') { return 'en-US'; }
  // Explicit script takes precedence over region; HK/MO share the shipped Traditional pack.
  if (parts[1] === 'hant' || ['tw', 'hk', 'mo'].includes(parts[1])) { return 'zh-TW'; }
  if (parts.length === 1 || ['hans', 'cn', 'sg'].includes(parts[1])) { return 'zh-CN'; }
  return 'en-US';
}
