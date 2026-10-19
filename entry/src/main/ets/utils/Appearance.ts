export class AppearanceOptions { amoled: boolean = false; extraInfo: boolean = false }
export function validAppearance(value: AppearanceOptions): boolean { return !!value && typeof value.amoled === 'boolean' && typeof value.extraInfo === 'boolean'; }
export function copyAppearance(value: AppearanceOptions): AppearanceOptions { return { amoled: value.amoled, extraInfo: value.extraInfo }; }
