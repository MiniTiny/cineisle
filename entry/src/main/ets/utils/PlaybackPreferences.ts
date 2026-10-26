import { TrackChoice } from './Playback';

export class PlaybackPreferences {
  version: number = 1;
  audioLanguage: string = '';
  subtitleLanguage: string = '';
  subtitlesOff: boolean = false;
}

class PlaybackLanguageRules {
  static readonly maximumTagCodeUnits: number = 63;
  static readonly exactScore: number = 100;
  static readonly compatibleScriptScore: number = 80;
  static readonly regionalFallbackScore: number = 40;
  static readonly baseFallbackScore: number = 50;
}

const aliases: Record<string, string> = {
  eng: 'en', zho: 'zh', chi: 'zh', jpn: 'ja', kor: 'ko', fra: 'fr', fre: 'fr', deu: 'de', ger: 'de',
  spa: 'es', ita: 'it', por: 'pt', rus: 'ru', ara: 'ar', hin: 'hi', tha: 'th', vie: 'vi', ind: 'id',
  nld: 'nl', dut: 'nl', tur: 'tr', pol: 'pl', ces: 'cs', cze: 'cs', ell: 'el', gre: 'el', swe: 'sv',
  dan: 'da', nor: 'no', fin: 'fi', heb: 'he', hun: 'hu', ron: 'ro', rum: 'ro', ukr: 'uk', msa: 'ms', may: 'ms'
};

// Accept a language code with optional script/region subtags; names and undetermined tracks never match.
export function normalizeLanguage(value: string): string {
  if (typeof value !== 'string') { return ''; }
  const tag = value.trim().toLowerCase().replace(/_/g, '-');
  if (tag.length > PlaybackLanguageRules.maximumTagCodeUnits || !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(tag)) { return ''; }
  const parts = tag.split('-');
  if (parts[0] === 'und' || parts[0] === 'zxx' || parts[0] === 'mul') { return ''; }
  parts[0] = aliases[parts[0]] ?? parts[0];
  return parts.join('-');
}

export function copyPreferences(value: PlaybackPreferences): PlaybackPreferences {
  return { version: 1, audioLanguage: value.audioLanguage, subtitleLanguage: value.subtitleLanguage, subtitlesOff: value.subtitlesOff };
}

export function validPreferences(value: PlaybackPreferences): boolean {
  return !!value && value.version === 1 && typeof value.audioLanguage === 'string' && typeof value.subtitleLanguage === 'string' &&
    typeof value.subtitlesOff === 'boolean' &&
    (!value.audioLanguage.trim() || !!normalizeLanguage(value.audioLanguage)) && (!value.subtitleLanguage.trim() || !!normalizeLanguage(value.subtitleLanguage));
}

export function canonicalPreferences(value: PlaybackPreferences): PlaybackPreferences {
  if (!validPreferences(value)) { throw new Error('playback_language_invalid'); }
  return { version: 1, audioLanguage: normalizeLanguage(value.audioLanguage), subtitleLanguage: normalizeLanguage(value.subtitleLanguage), subtitlesOff: value.subtitlesOff };
}

function script(tag: string): string {
  const parts = tag.split('-');
  const explicit = parts.slice(1).find((part: string) => /^[a-z]{4}$/.test(part));
  if (explicit) { return explicit; }
  if (parts[0] === 'zh') {
    if (parts.some((part: string) => ['tw', 'hk', 'mo'].includes(part))) { return 'hant'; }
    if (parts.some((part: string) => ['cn', 'sg'].includes(part))) { return 'hans'; }
  }
  return '';
}

function languageScore(wanted: string, available: string): number {
  if (!available || wanted.split('-')[0] !== available.split('-')[0]) { return 0; }
  if (wanted === available) { return PlaybackLanguageRules.exactScore; }
  const wantedScript = script(wanted); const actualScript = script(available);
  if (wantedScript && actualScript && wantedScript !== actualScript) { return 0; }
  if (wantedScript && wantedScript === actualScript) { return PlaybackLanguageRules.compatibleScriptScore; }
  return available.includes('-') ? PlaybackLanguageRules.regionalFallbackScore : PlaybackLanguageRules.baseFallbackScore;
}

export function preferredTrack(tracks: TrackChoice[], language: string, selected: string): string | undefined {
  const wanted = normalizeLanguage(language);
  if (!wanted) { return undefined; }
  let key: string | undefined = undefined; let best = 0;
  for (const track of tracks) {
    const score = languageScore(wanted, normalizeLanguage(track.language ?? ''));
    // The low bit retains the selected track only when the language scores tie.
    const ranked = score ? score * 2 + (track.key === selected ? 1 : 0) : 0;
    if (ranked > best) { best = ranked; key = track.key; }
  }
  return key;
}
