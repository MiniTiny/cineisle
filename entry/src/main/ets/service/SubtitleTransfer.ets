import { SubtitleTransferLimits } from '../utils/SubtitleLimits';
import common from '@ohos.app.ability.common';
import request from '@ohos.request';
import { DownloadNetworkGuard } from './DownloadNetworkGuard';
import fs from '@ohos.file.fs';
import { ApiQuery, ApiTransport } from '../api/generated/JellyfinApi';
import { DownloadNetwork } from '../utils/Downloads';

// The generated client still owns the subtitle route. The OS enforces download network constraints.
export class SubtitleTransfer implements ApiTransport {
  private static readonly completionTimeoutMs: number = 30000;
  private static readonly ownershipPollIntervalMs: number = 500;
  private base: ApiTransport;
  private context: common.UIAbilityContext;
  private path: string;
  private policy: DownloadNetwork;
  private owned: () => boolean;
  constructor(base: ApiTransport, context: common.UIAbilityContext, path: string, policy: DownloadNetwork, owned: () => boolean) {
    this.base = base; this.context = context; this.path = path + '.fetch'; this.policy = policy; this.owned = owned;
  }
  url(path: string, query: ApiQuery[]): string { return this.base.url(path, query); }
  request<T>(path: string, method: string, query: ApiQuery[], body: string): Promise<T> { return this.base.request<T>(path, method, query, body); }
  async text(path: string, method: string, query: ApiQuery[], body: string): Promise<string> {
    if (method !== 'GET' || body || !this.owned()) { throw new Error('offline_subtitle_failed'); }
    const agent = canIUse('SystemCapability.Request.FileTransferAgent');
    if (!agent) { await DownloadNetworkGuard.legacy(this.policy); }
    if (!this.owned()) { throw new Error('offline_subtitle_failed'); }
    return new Promise<string>((resolve, reject) => {
      let finished = false; let timer = -1; let watch = -1; let remove: (() => Promise<void>) | undefined;
      const finish = async (failed: boolean): Promise<void> => {
        if (finished) { return; } finished = true; clearTimeout(timer); clearInterval(watch);
        let content = ''; let error = failed || !this.owned();
        try {
          if (!error) {
            if (!fs.accessSync(this.path) || fs.statSync(this.path).size > SubtitleTransferLimits.maxBytes) { error = true; }
            else { content = fs.readTextSync(this.path); }
          }
        } catch (e) { error = true; }
        try { await remove?.(); } catch (e) { error = true; }
        try { if (fs.accessSync(this.path)) { fs.unlinkSync(this.path); } } catch (e) { error = true; }
        if (error) { reject(new Error('offline_subtitle_failed')); } else { resolve(content); }
      };
      const start = async (): Promise<void> => {
        try {
          if (agent) {
            const task = await request.agent.create(this.context, { action: request.agent.Action.DOWNLOAD, url: this.url(path, query),
              mode: request.agent.Mode.FOREGROUND, saveas: this.path, overwrite: true,
              network: this.policy.mobile ? request.agent.Network.ANY : request.agent.Network.WIFI,
              metered: this.policy.mobile, roaming: this.policy.mobile && this.policy.roaming, redirect: false, retry: false });
            remove = async () => { await request.agent.remove(task.tid); };
            task.on('completed', () => { finish(false); }); task.on('failed', () => { finish(true); });
            task.on('progress', (progress: request.agent.Progress) => { if (!this.owned() || progress.processed > SubtitleTransferLimits.maxBytes) { finish(true); } });
            if (!this.owned()) { await finish(true); return; }
            await task.start();
          } else {
            const task = await request.downloadFile(this.context, { url: this.url(path, query), filePath: this.path,
              enableMetered: this.policy.mobile, enableRoaming: this.policy.mobile && this.policy.roaming });
            remove = async () => { if (!await task.delete()) { throw new Error('cancel_download_failed'); } };
            task.on('complete', () => { finish(false); }); task.on('fail', () => { finish(true); });
            task.on('progress', (received: number) => { if (!this.owned() || received > SubtitleTransferLimits.maxBytes) { finish(true); } });
            if (!this.owned()) { await finish(true); return; }
          }
          if (!finished) { timer = setTimeout(() => { finish(true); }, SubtitleTransfer.completionTimeoutMs); watch = setInterval(() => { if (!this.owned()) { finish(true); } }, SubtitleTransfer.ownershipPollIntervalMs); }
        } catch (e) { await finish(true); }
      };
      start();
    });
  }
}
