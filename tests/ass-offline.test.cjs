// Actual cache, file transactions and account guards; HTTP is an explicit fixture.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets');
const { validDownloads } = h.load('utils/Cache.ts');
const { validAssDocument, subtitleFormat } = h.load('utils/Playback.ts');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const ass = '[Script Info]\nScriptType: v4.00+\nPlayResX: 640\nPlayResY: 360\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, Bold, Alignment\nStyle: Default,sans-serif,30,&H000000FF,-1,2\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\pos(80,60)}中文, Arabic\n';
const srt = '1\n00:00:01,000 --> 00:00:03,000\nlegacy subtitle\n';
function fixture(legacy = true) {
  h.reset(); const client = h.activate();
  const record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source', path: path.join(AppService.local.directory, 'movie.mp4'), state: 'complete', progress: 1, subtitleState: 'ready' };
  fs.writeFileSync(record.path, 'video fixture');
  if (legacy) { record.subtitles = [{ index: 8, title: 'legacy', language: 'zho', path: path.join(AppService.local.directory, 'movie.subtitle-8.srt'), state: 'ready' }]; fs.writeFileSync(record.subtitles[0].path, srt); }
  AppService.downloads = [record]; AppService.local.saveDownloads([record]);
  const source = { Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'ass', Language: 'zho' }] };
  client.playbackInfo = async () => ({ MediaSources: [source] }); const requests = [];
  client.subtitle = async (...args) => { requests.push(args); return ass; };
  return { client, record, source, requests };
}
test('ASS/SSA preserve styles, other text streams use SRT, malformed documents are rejected', () => {
  for (const Codec of ['ass', 'SSA', 'ASS']) assert.equal(subtitleFormat({Codec}), 'ass');
  for (const Codec of ['srt', 'subrip', 'vtt', undefined]) assert.equal(subtitleFormat({Codec}), 'srt');
  assert.equal(validAssDocument(ass), true);
  for (const value of [srt, '<html>error</html>', ass.replace('[Script Info]', '[Unknown]'), ass.replace('0:00:03.00', '0:00:00.00'), ass.replace('0:00:01.00', '0:99:01.00'), ass + '\0', 'x'.repeat(1048577)]) assert.equal(validAssDocument(value), false);
  assert.equal(validAssDocument('\uFEFF' + ass.replace(/\n/g, '\r\n')), true);
});
test('new offline ASS persists raw overrides and encoded format while video remains unchanged', async () => {
  const {record, requests} = fixture(false); await AppService.retrySubtitles(record);
  const sub = record.subtitles[0]; assert.equal(sub.format, 'ass'); assert.ok(sub.path.endsWith('.subtitle-8.ass'));
  assert.equal(requests[0][4], 'ass'); assert.equal(OfflineSubtitles.document(sub), ass);
  assert.equal(validDownloads(AppService.local.downloads(), AppService.local.directory), true);
  assert.equal(fs.readFileSync(record.path, 'utf8'), 'video fixture'); assert.throws(() => OfflineSubtitles.read(sub), /offline_subtitle/);
});
test('legacy SRT remains readable until replacement ASS is saved, then only its owned old file is removed', async () => {
  const {client, record} = fixture(); const old = record.subtitles[0], wait = h.deferred(); client.subtitle = () => wait.promise;
  const pending = AppService.retrySubtitles(record); await new Promise(setImmediate);
  assert.equal(record.subtitles[0], old); assert.equal(OfflineSubtitles.read(old)[0].text, 'legacy subtitle');
  assert.equal(AppService.local.downloads()[0].subtitles[0].path, old.path);
  wait.resolve(ass); await pending; assert.equal(record.subtitles[0].format, 'ass'); assert.equal(fs.existsSync(old.path), false);
});
for (const failure of ['network', 'invalid', 'write', 'rename']) test('failed ASS upgrade preserves playable SRT: ' + failure, async () => {
  const {client, record} = fixture(); const old = record.subtitles[0], api = h.platform.get('@ohos.file.fs');
  const open = api.openSync, rename = api.renameSync;
  if (failure === 'network') client.subtitle = async () => { throw Error('http_403'); };
  if (failure === 'invalid') client.subtitle = async () => srt;
  if (failure === 'write') api.openSync = (file, ...args) => { if (file.endsWith('.ass.tmp')) throw Error('disk full'); return open(file, ...args); };
  if (failure === 'rename') api.renameSync = (from, to) => { if (from.endsWith('.ass.tmp')) throw Error('rename failed'); return rename(from, to); };
  try { await AppService.retrySubtitles(record); } finally { api.openSync = open; api.renameSync = rename; }
  assert.equal(record.subtitleState, 'failed'); assert.equal(record.subtitles[0], old); assert.equal(OfflineSubtitles.document(old), srt);
  assert.equal(fs.existsSync(old.path.replace(/srt$/, 'ass')), false); assert.equal(fs.existsSync(old.path.replace(/srt$/, 'ass.tmp')), false);
});
test('failed metadata commit rolls back the ASS upgrade and removes the unindexed new file', async () => {
  const {record} = fixture(); const old = record.subtitles[0], save = AppService.local.saveDownloads.bind(AppService.local);
  AppService.local.saveDownloads = values => { if (values[0].subtitles[0].format === 'ass') throw Error('save failed'); save(values); };
  await assert.rejects(AppService.retrySubtitles(record), /save failed/);
  assert.equal(record.subtitles[0], old); assert.equal(OfflineSubtitles.document(old), srt);
  assert.equal(AppService.local.downloads()[0].subtitles[0].path, old.path); assert.equal(fs.existsSync(old.path.replace(/srt$/, 'ass')), false);
});
test('cache metadata rejects wrong format, mismatched suffix, traversal and duplicate identities; absent format remains SRT', () => {
  const {record, source} = fixture(); assert.equal(validDownloads([record], AppService.local.directory), true);
  record.subtitles = OfflineSubtitles.plan(record, source, AppService.local.directory); assert.equal(validDownloads([record], AppService.local.directory), true);
  for (const change of [s => s.format = 'ssa', s => s.format = 'srt', s => s.format = '../../outside', s => s.path += '/../outside.ass']) {
    const bad = structuredClone(record); change(bad.subtitles[0]); assert.equal(validDownloads([bad], AppService.local.directory), false);
  }
  const duplicate = structuredClone(record); duplicate.subtitles.push({...duplicate.subtitles[0]}); assert.equal(validDownloads([duplicate], AppService.local.directory), false);
});
for (const action of ['remove', 'account']) test('late ASS response cannot write after ' + action, async () => {
  const {client, record} = fixture(); const old = record.subtitles[0], wait = h.deferred(); client.subtitle = () => wait.promise;
  const pending = AppService.retrySubtitles(record); await new Promise(setImmediate);
  if (action === 'remove') await AppService.removeDownload(record); else h.activate('other');
  wait.resolve(ass); await pending; assert.equal(fs.existsSync(old.path.replace(/srt$/, 'ass')), false);
  assert.equal(AppService.downloads.length, 0);
});
test('retry skips an intact ASS, refetches a missing document, and removal cleans owned format leftovers', async () => {
  const {record, requests} = fixture(); await AppService.retrySubtitles(record); const sub = record.subtitles[0];
  await AppService.retrySubtitles(record); assert.equal(requests.length, 1);
  fs.unlinkSync(sub.path); await AppService.retrySubtitles(record); assert.equal(requests.length, 2);
  const leftover = sub.path.replace(/ass$/, 'srt'); fs.writeFileSync(leftover, srt); fs.writeFileSync(sub.path + '.tmp', 'partial');
  await AppService.removeDownload(record); for (const file of [sub.path, leftover, sub.path + '.tmp']) assert.equal(fs.existsSync(file), false);
});
test('an in-flight ASS replacement reserves space without replacing its playable SRT metadata', async () => {
  const {client, record} = fixture(), wait = h.deferred(); client.subtitle = () => wait.promise;
  const {DownloadSpace} = h.load('service/DownloadSpace.ets'); const api = h.platform.get('@ohos.file.statvfs'), original = api.getFreeSize;
  const pending = AppService.retrySubtitles(record); await new Promise(setImmediate);
  api.getFreeSize = async () => 11 * 1048576;
  try { await assert.rejects(DownloadSpace.checkOptional(AppService.local.directory, 0, AppService.downloads), /download_space/); }
  finally { wait.resolve(ass); await pending; }
  try { await DownloadSpace.checkOptional(AppService.local.directory, 0, AppService.downloads); } finally { api.getFreeSize = original; }
});
test('a UI notification failure cannot roll back an already saved ASS file index', async () => {
  const {record} = fixture(); AppService.downloadListener = () => { throw Error('view disposed'); };
  try { await AppService.retrySubtitles(record); } finally { AppService.downloadListener = undefined; }
  assert.equal(record.subtitleState, 'ready'); assert.equal(OfflineSubtitles.document(AppService.local.downloads()[0].subtitles[0]), ass);
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); } console.log(tests.length + ' ASS offline regression tests passed. Network fixtures do not prove Jellyfin extraction or OS durability.'); })().catch(error => { console.error(error); process.exitCode = 1; });
