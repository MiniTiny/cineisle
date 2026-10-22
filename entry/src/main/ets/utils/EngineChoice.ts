export type EngineChoice = 'native' | 'mpv';
export function validEngineChoice(value: string): boolean { return value === 'native' || value === 'mpv'; }
export function engineChoiceCaption(value: EngineChoice): string { return value === 'mpv' ? 'engine_mpv' : 'engine_native'; }
