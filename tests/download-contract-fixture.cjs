// Product ArkTS services and LocalStore run unchanged; only Harmony/Jellyfin are fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { fixture, runCase, classify } = require('./resource-cache-result.cjs');
const { AppService: A } = h.load('service/AppService.ets');
const { DownloadSpace: D } = h.load('service/DownloadSpace.ets');
const { PersistentDownload: P } = h.load('service/PersistentDownload.ets');
const { LocalStore } = h.load('service/LocalStore.ets');
const strings = h.load('utils/Strings.ets');
const api = h.platform.get('@ohos.request'), io = h.platform.get('@ohos.file.fs');
const originalIO = Object.fromEntries(['openSync', 'writeSync', 'renameSync', 'readTextSync', 'statSync'].map(k => [k, io[k]]));
const originalNow = Date.now;
const observe = promise => Promise.resolve(promise).then(value => ({ value }), error => ({ error }));
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };
const item = (id = 'movie', extra = {}) => ({ ...h.film(id), CanDownload: true, ...extra });
let errors = [], selectedFault = '', environment, expectedFailures = new Set();
let requestedStage = '', operationStage = 'account-init', createdTasks = 0, startedTasks = 0, published = false, platformCalls = {};
const openedFiles = new Map();
function platform(phase, fn, details = {}) {
  platformCalls[phase] = (platformCalls[phase] || 0) + 1;
  const snapshot = injected => ({ version: 1, phase, stage: operationStage, createdTasks, startedTasks, calls: { ...platformCalls }, injected, ...details });
  const fileReady = !phase.startsWith('file-') || createdTasks > 0;
  const stageReady = !requestedStage || operationStage === requestedStage;
  const indexFile = !phase.startsWith('file-') || /^downloads\.json(?:\.tmp)?$/.test(details.target || details.filename || '');
  if (selectedFault === phase && fileReady && stageReady && indexFile) {
    const error = Object.assign(Error('injected download platform failure: ' + phase), { code: 'EIO' });
    error.downloadState = snapshot(true);
    errors.push({ phase, error }); throw error;
  }
  const failed = error => { if (!expectedFailures.has(phase)) { error.downloadState = snapshot(false); errors.push({ phase, error }); } throw error; };
  try { const value = fn(); return value?.then ? value.catch(failed) : value; } catch (error) { return failed(error); }
}
async function healthy() { await fixture('download-platform', () => {
  if (!errors.length) return;
  if (!published) { console.error('DOWNLOAD_PLATFORM_STATE ' + JSON.stringify(errors[0].error.downloadState)); published = true; }
  throw Object.assign(errors[0].error, { platformPhase: errors[0].phase });
}); }
async function before() {
  Object.assign(io, originalIO); Date.now = originalNow;
  await settle(); h.reset(); A.mutations.clear(); A.downloadListener = undefined; D.subtitleReservations.clear();
  require('./download-platform.cjs').install(h.platform);
  strings.initializeStrings(h.context.resourceManager);
  errors = []; expectedFailures.clear(); selectedFault = (process.argv.find(s => s.startsWith('--fault=')) || '').slice(8);
  requestedStage = (process.argv.find(s => s.startsWith('--io-stage=')) || '').slice(11);
  operationStage = 'account-init'; createdTasks = startedTasks = 0; published = false; platformCalls = {}; openedFiles.clear();
  io.openSync = (...args) => {
    const filename = path.basename(args[0]); const file = platform('file-open', () => originalIO.openSync(...args), { filename });
    openedFiles.set(file.fd, filename); return file;
  };
  io.writeSync = (...args) => platform('file-write', () => originalIO.writeSync(...args), { filename: openedFiles.get(args[0]) });
  for (const [key, phase] of [['renameSync', 'file-rename'], ['readTextSync', 'file-read']]) {
    io[key] = (...args) => platform(phase, () => originalIO[key](...args), { filename: path.basename(args[0]), ...(key === 'renameSync' ? { target: path.basename(args[1]) } : {}) });
  }
  environment = { free: 1024 ** 4, spaceCalls: [] };
  h.platform.get('@ohos.file.statvfs').getFreeSize = async directory => platform('statvfs', () => {
    environment.spaceCalls.push(directory); return environment.free;
  });
}
async function after() { Date.now = originalNow; Object.assign(io, originalIO); A.downloadListener = undefined; await settle(); }
function record(extra = {}) {
  return { id: 'movie', item: item(), path: path.join(A.local?.directory || h.directory, 'movie.mp4'), state: 'downloading', progress: 0, ...extra };
}
function backend(agent, hooks = {}) {
  const client = h.activate(), made = [], events = [], removed = [], saves = [];
  operationStage = 'transfer';
  if (agent) h.capabilities.add('SystemCapability.Request.FileTransferAgent'); else h.capabilities.delete('SystemCapability.Request.FileTransferAgent');
  client.detail = async id => hooks.detail ? hooks.detail(id) : item(id);
  client.playbackInfo = async id => hooks.playbackInfo ? hooks.playbackInfo(id) : ({ MediaSources: [{ Id: 'source', Name: 'HD', Container: 'mp4', Size: 100 }] });
  client.stream = (id, source) => `https://example.invalid/${id}/${source}`;
  const local = A.local, save = local.saveDownloads.bind(local);
  local.saveDownloads = records => { save(records); saves.push(JSON.parse(JSON.stringify(records))); };
  const make = options => {
    const handlers = {}, task = { tid: String(made.length + 1), options, handlers,
      on(name, fn) { events.push('bind:' + name); handlers[name] = fn; },
      async start() { return platform('agent-start', async () => { events.push('start'); startedTasks++; if (hooks.start) await hooks.start(task); }); },
      async delete() { removed.push(task.tid); return true; },
      async getTaskInfo() { return platform('legacy-info', () => hooks.info ? hooks.info(task) : { downloadId: 1, downloadedBytes: 0, downloadTotalBytes: 100, status: 0 }); }
    };
    made.push(task); createdTasks++; return task;
  };
  api.agent = { Action: { DOWNLOAD: 17 }, Mode: { BACKGROUND: 23 }, Network: { WIFI: 41, ANY: 37 },
    State: { COMPLETED: 64, FAILED: 65, STOPPED: 49, REMOVED: 80 },
    async create(context, options) { return platform('agent-create', async () => { events.push('create'); if (hooks.create) await hooks.create(options); return make(options); }); },
    async remove(id) { removed.push(id); if (hooks.remove) return hooks.remove(id); },
    async show(id) { return platform('agent-show', async () => hooks.show ? hooks.show(id) : ({ progress: { state: 32, processed: 50, sizes: [100] } })); },
    async getTask(context, id) { return platform('agent-getTask', async () => { if (hooks.getTask) return hooks.getTask(id); return made.find(t => t.tid === id); }); }
  };
  api.SESSION_SUCCESSFUL = 8; api.SESSION_FAILED = 9;
  api.downloadFile = async (context, options) => platform('legacy-create', async () => { events.push('create'); if (hooks.create) await hooks.create(options); return make(options); });
  return { client, local, made, events, removed, saves,
    async emit(task, event, processed = 50, state) {
      if (event === 'complete' || event === 'completed') fs.writeFileSync(task.options.saveas || task.options.filePath, 'video');
      if (agent) task.handlers[event]({ state: state ?? (event === 'completed' ? 64 : event === 'failed' ? 65 : 32), processed, sizes: [100] });
      else task.handlers[event](processed, 100);
      await settle();
    }
  };
}
async function run(tests, label) {
  const selected = process.argv[2], cases = selected ? tests.filter(t => t.name === selected) : tests;
  assert.ok(cases.length, 'No selected download cases');
  for (const { name, action } of cases) {
    await runCase(name, async check => {
      const expectations = []; let failure;
      try { await action(fn => expectations.push(fn)); } catch (error) { failure = error; }
      // Check the real platform calls before allowing any target assertion to kill a mutation.
      await healthy(); if (failure) throw failure;
      assert.ok(expectations.length, 'No boundary assertion reached');
      try { for (const expectation of expectations) check(expectation); }
      finally { await healthy(); }
    }, before, after);
    console.log('PASS ' + name);
  }
  console.log(`${cases.length} ${label} tests passed. Harmony services are fixtures; device/background acceptance is separate.`);
}
module.exports = { assert, fs, path, h, A, D, P, LocalStore, strings, api, io, originalIO, originalNow, observe, settle, item, record, backend, run, classify, fixture,
  env: () => environment, expectFailure: phase => expectedFailures.add(phase), stage: name => { operationStage = name; } };
