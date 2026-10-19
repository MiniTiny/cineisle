export class AppearanceOptions { amoled: boolean = false; extraInfo: boolean = false; dynamicColors?: boolean = true }
export function validAppearance(value: AppearanceOptions): boolean { return !!value && typeof value.amoled === 'boolean' && typeof value.extraInfo === 'boolean' && (value.dynamicColors === undefined || typeof value.dynamicColors === 'boolean'); }
export function copyAppearance(value: AppearanceOptions): AppearanceOptions { return { amoled: value.amoled, extraInfo: value.extraInfo, dynamicColors: value.dynamicColors ?? true }; }
