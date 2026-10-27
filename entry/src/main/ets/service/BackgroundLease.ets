import common from '@ohos.app.ability.common';
import background from '@ohos.resourceschedule.backgroundTaskManager';
import wantAgent from '@ohos.app.ability.wantAgent';

const backgroundRequestCode: number = 717;

// Audio and synchronization share a UIAbility background task; releasing one must retain the other.
export class BackgroundLease {
  private static modes: Set<background.BackgroundMode> = new Set();
  private static operations: Promise<void> = Promise.resolve();
  static set(context: common.UIAbilityContext, mode: background.BackgroundMode, enabled: boolean): Promise<void> {
    const operation = BackgroundLease.operations.then(async () => {
      const previous = new Set(BackgroundLease.modes);
      if (enabled) { BackgroundLease.modes.add(mode); } else { BackgroundLease.modes.delete(mode); }
      try {
        if (!BackgroundLease.modes.size) { if (previous.size) { await background.stopBackgroundRunning(context); } return; }
        const agent = await wantAgent.getWantAgent({ wants: [{ bundleName: context.abilityInfo.bundleName, abilityName: context.abilityInfo.name }],
          operationType: wantAgent.OperationType.START_ABILITY, requestCode: backgroundRequestCode, wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG] });
        const modes = Array.from(BackgroundLease.modes);
        if (modes.length === 1) { await background.startBackgroundRunning(context, modes[0], agent); }
        else { await background.startBackgroundRunning(context, modes.map((value: background.BackgroundMode) => value === background.BackgroundMode.AUDIO_PLAYBACK ? 'audioPlayback' : 'dataTransfer'), agent); }
      } catch (e) { BackgroundLease.modes = previous; throw new Error('background_unavailable'); }
    });
    BackgroundLease.operations = operation.catch(() => {}); return operation;
  }
}
