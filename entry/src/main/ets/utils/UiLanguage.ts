export type UiLanguage = 'system' | 'zh-CN' | 'en-US';
export function validUiLanguage(value: string): boolean { return ['system', 'zh-CN', 'en-US'].includes(value); }
export function effectiveUiLanguage(choice: UiLanguage, system: string): string {
  if (choice !== 'system') { return choice; }
  // Only these translations are shipped. Other system languages use the complete English pack.
  return /^zh(?:-(?:Hans(?:-|$)|CN(?:-|$)|SG(?:-|$))|$)/i.test(system) ? 'zh-CN' : 'en-US';
}
