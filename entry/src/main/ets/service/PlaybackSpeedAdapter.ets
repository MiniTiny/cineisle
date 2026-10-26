import media from '@ohos.multimedia.media';
import { PlaybackRate } from '../utils/PlaybackRate';

interface SpeedBinding { rate: PlaybackRate; speed: media.PlaybackSpeed }
// Read SDK members by name; their numeric order is not the product's rate order.
function speedBindings(): SpeedBinding[] {
  return [
    { rate: PlaybackRate.Half, speed: media.PlaybackSpeed.SPEED_FORWARD_0_50_X },
    { rate: PlaybackRate.ThreeQuarters, speed: media.PlaybackSpeed.SPEED_FORWARD_0_75_X },
    { rate: PlaybackRate.Normal, speed: media.PlaybackSpeed.SPEED_FORWARD_1_00_X },
    { rate: PlaybackRate.OneAndQuarter, speed: media.PlaybackSpeed.SPEED_FORWARD_1_25_X },
    { rate: PlaybackRate.OneAndHalf, speed: media.PlaybackSpeed.SPEED_FORWARD_1_50_X },
    { rate: PlaybackRate.OneAndThreeQuarters, speed: media.PlaybackSpeed.SPEED_FORWARD_1_75_X },
    { rate: PlaybackRate.Double, speed: media.PlaybackSpeed.SPEED_FORWARD_2_00_X }
  ];
}
export function nativePlaybackSpeed(rate: number): media.PlaybackSpeed | undefined {
  return speedBindings().find((binding: SpeedBinding) => binding.rate === rate)?.speed;
}
export function playbackRateFromNative(speed: media.PlaybackSpeed): number | undefined {
  return speedBindings().find((binding: SpeedBinding) => binding.speed === speed)?.rate;
}
