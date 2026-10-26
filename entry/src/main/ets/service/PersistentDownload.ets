import common from '@ohos.app.ability.common';
import request from '@ohos.request';
import fs from '@ohos.file.fs';
import { DownloadRecord } from '../model/Models';
import { text } from '../utils/Strings';
import { downloadNetwork } from '../utils/Downloads';

// The OS owns background file transfer. Only the task ID and safe status enter application JSON.
export class PersistentDownload {
  private static readonly progressSaveIntervalMs: number = 1000;
  // Preserve the existing UTF-16 slice used for the platform task title.
  private static readonly maxTitleCodeUnits: number = 256;
  static available(): boolean { return canIUse('SystemCapability.Request.FileTransferAgent'); }
  private static apply(record: DownloadRecord, progress: request.agent.Progress): void {
    const total = progress.sizes[0] ?? 0; record.received = Math.max(0, progress.processed); record.total = Math.max(0, total);
    record.progress = total > 0 ? Math.max(0, Math.min(1, progress.processed / total)) : 0;
    if (progress.state === request.agent.State.COMPLETED) {
      record.state = fs.accessSync(record.path) ? 'complete' : 'missing'; record.progress = record.state === 'complete' ? 1 : 0;
    } else if (progress.state === request.agent.State.FAILED || progress.state === request.agent.State.STOPPED || progress.state === request.agent.State.REMOVED) {
      record.state = 'failed'; record.failure = text('download_failure_reason', progress.state);
    } else { record.state = 'downloading'; }
  }
  private static bind(task: request.agent.Task, record: DownloadRecord, owned: () => boolean, save: () => void): void {
    let finished = false; let lastSave = 0;
    const update = (progress: request.agent.Progress): void => {
      if (!owned() || finished) { return; }
      PersistentDownload.apply(record, progress);
      finished = record.state !== 'downloading';
      if (finished || Date.now() - lastSave >= PersistentDownload.progressSaveIntervalMs) {
        lastSave = Date.now();
        save();
      }
    };
    task.on('progress', update); task.on('completed', update); task.on('failed', update);
  }
  static async create(context: common.UIAbilityContext, record: DownloadRecord, url: string, owned: () => boolean, save: () => void): Promise<void> {
    const policy = record.network ?? downloadNetwork();
    const task = await request.agent.create(context, { action: request.agent.Action.DOWNLOAD, url: url, title: record.item.Name.slice(0, PersistentDownload.maxTitleCodeUnits),
      mode: request.agent.Mode.BACKGROUND, saveas: record.path, overwrite: true, network: policy.mobile ? request.agent.Network.ANY : request.agent.Network.WIFI, metered: policy.mobile, roaming: policy.mobile && policy.roaming, retry: true, redirect: false });
    if (!owned()) { await request.agent.remove(task.tid); throw new Error('login_required'); }
    record.agentId = task.tid;
    try { save(); PersistentDownload.bind(task, record, owned, save); await task.start(); }
    catch (e) { try { await request.agent.remove(task.tid); } catch (ignored) {} throw new Error('download_create_failed'); }
  }
  static async restore(context: common.UIAbilityContext, record: DownloadRecord, owned: () => boolean, save: () => void): Promise<void> {
    const info = await request.agent.show(record.agentId!); if (!owned()) { return; }
    PersistentDownload.apply(record, info.progress); save();
    if (record.state === 'downloading') { const task = await request.agent.getTask(context, record.agentId!); if (owned()) { PersistentDownload.bind(task, record, owned, save); } }
  }
  static async poll(record: DownloadRecord, owned: () => boolean, save: () => void): Promise<void> {
    const info = await request.agent.show(record.agentId!); if (owned()) { PersistentDownload.apply(record, info.progress); save(); }
  }
  static async remove(record: DownloadRecord): Promise<void> { if (record.agentId) { await request.agent.remove(record.agentId); } }
}
