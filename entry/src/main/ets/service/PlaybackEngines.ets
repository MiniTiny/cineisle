import deviceInfo from '@ohos.deviceInfo';
import { EngineChoice } from '../utils/EngineChoice';
import { PlaybackEngine, NativePlaybackEngine } from './PlaybackEngine';
import { MpvPlaybackEngine } from './MpvPlaybackEngine';

export class PlaybackEngines {
  // Cheap UI eligibility check. The optional library is probed only on explicit MPV selection or playback.
  static canOfferMpv(): boolean { return deviceInfo.sdkApiVersion >= 15; }
  static async validate(choice: EngineChoice): Promise<void> {
    if (choice !== 'native' && choice !== 'mpv') { throw new Error('engine_invalid'); }
    if (choice === 'mpv') {
      try { if (!await MpvPlaybackEngine.available()) { throw new Error('unavailable'); } }
      catch (e) { throw new Error('engine_mpv_unavailable'); }
    }
  }
  static async create(choice: EngineChoice, cacheDirectory: string = ''): Promise<PlaybackEngine> {
    if (choice === 'native') { return NativePlaybackEngine.create(); }
    if (choice !== 'mpv') { throw new Error('engine_invalid'); }
    // Keep a requested backend failure visible; choosing another engine is an explicit user action.
    try { return await MpvPlaybackEngine.create(cacheDirectory); }
    catch (e) { throw new Error('engine_mpv_unavailable'); }
  }
}
