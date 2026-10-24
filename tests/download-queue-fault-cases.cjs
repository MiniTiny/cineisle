const app = 'entry/src/main/ets/service/AppService.ets', persistent = 'entry/src/main/ets/service/PersistentDownload.ets';
const recipes = [], add = (id, file, old, replacement, name) => recipes.push({ id: 'queue-' + id, file, old, replacement, name, suite: 'download-queue-boundaries.test.cjs' });
for (const label of ['legacy', 'agent']) {
  add(label + '-guard', app, ".filter((r: DownloadRecord) => r.state === 'downloading').length < AppService.maxQueuedActiveDownloads", ".filter((r: DownloadRecord) => r.state === 'downloading').length < Number.MAX_SAFE_INTEGER", `queue ${label} count 5`);
  add(label + '-comparison', app, '.length < AppService.maxQueuedActiveDownloads', '.length <= AppService.maxQueuedActiveDownloads', `queue ${label} count 5`);
  for (const [cap, count] of [[3, 4], [5, 5]]) add(`${label}-cap-${cap}`, app, 'maxQueuedActiveDownloads: number = 4', 'maxQueuedActiveDownloads: number = ' + cap, `queue ${label} count ${count}`);
  const signature = "static async download(item: MediaItem, sourceId: string = '', network?: DownloadNetwork): Promise<void> {";
  add(label + '-accidental-global-cap', app, signature, signature + "\n    if (AppService.downloads.filter((r: DownloadRecord) => r.state === 'downloading').length >= 4) { throw new Error('download_exists'); }", `queue ${label} direct fifth remains allowed`);
}
add('agent-terminal-pump', app, "if (record.state !== 'downloading') { AppService.pumpDownloads(); }", '', 'queue agent complete releases slot');
add('legacy-complete-pump', app, "record.state = 'complete'; record.progress = 1; AppService.tasks.delete(downloadKey(record));\n      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();", "record.state = 'complete'; record.progress = 1; AppService.tasks.delete(downloadKey(record));\n      local.saveDownloads(AppService.downloads); AppService.downloadListener?.();", 'queue legacy complete releases slot');
add('legacy-fail-pump', app, "record.state = 'failed'; record.failure = text('download_failure_reason', Number.isFinite(reason) ? reason : 0); AppService.tasks.delete(downloadKey(record));\n      local.saveDownloads(AppService.downloads); AppService.downloadListener?.(); AppService.pumpDownloads();", "record.state = 'failed'; record.failure = text('download_failure_reason', Number.isFinite(reason) ? reason : 0); AppService.tasks.delete(downloadKey(record));\n      local.saveDownloads(AppService.downloads); AppService.downloadListener?.();", 'queue legacy fail releases slot');
add('legacy-owned', app, "if (!owned()) { return; }\n      record.state = 'complete';", "record.state = 'complete';", 'queue legacy late old account event cannot save or pump');
add('agent-owned', persistent, 'if (!owned() || finished)', 'if (finished)', 'queue agent late old account event cannot save or pump');
const controls = [
  ['queue legacy count 5', 'legacy-create'], ['queue agent count 5', 'agent-create'], ['queue agent count 5', 'agent-start'],
  ['queue legacy count 4', 'statvfs'], ['queue agent count 4', 'file-open'], ['queue legacy count 4', 'file-rename']
].map(([name, phase]) => ({ name, phase, suite: 'download-queue-boundaries.test.cjs' }));
module.exports = { recipes, controls };
