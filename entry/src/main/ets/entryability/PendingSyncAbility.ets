import WorkSchedulerExtensionAbility from '@ohos.WorkSchedulerExtensionAbility';
import workScheduler from '@ohos.resourceschedule.workScheduler';
import { PendingSync } from '../service/PendingSync';
import { AppLock } from '../service/AppLock';
import { initializeStrings } from '../utils/Strings';

export default class PendingSyncAbility extends WorkSchedulerExtensionAbility {
  onWorkStart(work: workScheduler.WorkInfo): void {
    if (work.workId !== PendingSync.WORK_ID) { return; }
    initializeStrings(this.context.resourceManager);
    PendingSync.configure(this.context);
    this.run();
  }
  private async run(): Promise<void> {
    try { await AppLock.ensureInitialized(); await PendingSync.run(); } catch (e) { /* Outbox remains durable for the next eligible run. */ }
  }
  onWorkStop(work: workScheduler.WorkInfo): void { if (work.workId === PendingSync.WORK_ID) { PendingSync.stop(); } }
}
