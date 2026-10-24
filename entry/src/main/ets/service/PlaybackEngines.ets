import deviceInfo from '@ohos.deviceInfo';
import common from '@ohos.app.ability.common';
import { EngineChoice } from '../utils/EngineChoice';
import { PlaybackEngine, NativePlaybackEngine } from './PlaybackEngine';
import { MpvPlaybackEngine } from './MpvPlaybackEngine';
import { MpvPreferences } from './MpvPreferences';
import { MpvBridgeLimits } from '../utils/MpvLimits';

export class PlaybackEngines {
  // Cheap UI eligibility check. The optional library is probed only on explicit MPV selection or playback.
  static canOfferMpv(): boolean { return deviceInfo.sdkApiVersion >= MpvBridgeLimits.minPlatformApi; }
  static async validate(choice: EngineChoice): Promise<void> {
    if (choice !== 'native' && choice !== 'mpv') { throw new Error('engine_invalid'); }
    if (choice === 'mpv') {
      try { if (!await MpvPlaybackEngine.available()) { throw new Error('unavailable'); } }
      catch (e) { throw new Error('engine_mpv_unavailable'); }
    }
  }
  static async create(choice: EngineChoice, context?: common.UIAbilityContext): Promise<PlaybackEngine> {
    if (choice === 'native') { return NativePlaybackEngine.create(); }
    if (choice !== 'mpv') { throw new Error('engine_invalid'); }
    await PlaybackEngines.validate(choice);
    if (!context?.cacheDir) { throw new Error('mpv_options_load_failed'); }
    await MpvPreferences.load(context);
    const options = MpvPreferences.requireOptions();
    // Keep a requested backend failure visible; choosing another engine is an explicit user action.
    try { return await MpvPlaybackEngine.create(context.cacheDir, options); }
    catch (e) { throw new Error('engine_mpv_unavailable'); }
  }
}
