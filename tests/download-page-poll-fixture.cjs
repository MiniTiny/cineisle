// Actual page lifecycle -> AppService -> task/PersistentDownload -> LocalStore.
// The interval clock and the two native request backends are explicit fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), common = require('./contract-external.cjs');
const { fixture } = require('./resource-cache-result.cjs');
const h = require('./feature-regression.test.cjs'), { AppService: A } = h.load('service/AppService.ets'), { LocalStore } = h.load('service/LocalStore.ets'), { Downloads } = h.load('pages/Downloads.ets');
const { downloadKey } = h.load('utils/DownloadIdentity.ts'), api = h.platform.get('@ohos.request'), io = h.platform.get('@ohos.file.fs'), router = h.platform.get('@ohos.router');
const original = { poll: A.pollDownloads, subscribe: A.subscribeDownloads, unsubscribe: A.unsubscribeDownloads, interval: global.setInterval, clear: global.clearInterval, agent: api.agent, back: router.back, successful: api.SESSION_SUCCESSFUL, failed: api.SESSION_FAILED, open: io.openSync, close: io.closeSync, write: io.writeSync };
const settle = async () => { for (let i = 0; i < 12; ++i) await new Promise(setImmediate); };
let trace, clock, pages, gates, pending, inPoll, names, environment;
const nativeFailure = phase => { if (process.argv.includes('--native-' + phase + '-init-failure')) throw Object.assign(Error('injected download page ' + phase + ' failure'), { code: 'EIO', contractInjected: true }); };
function intervals() {
  let now = 0, nextId = 0; const jobs = new Map(), periods = [];
  const result = { jobs, periods,
    setInterval: (callback, period) => trace.call('interval-create', () => { nativeFailure('interval'); const id = nextId++; periods.push(period); const delay = Math.max(1, Number(period) || 1); jobs.set(id, { callback, period: delay, due: now + delay }); return id; }, { period }),
    clearInterval: id => trace.call('interval-clear', () => jobs.delete(id)),
    async advance(amount) {
      const end = now + amount;
      for (;;) { const next = [...jobs.entries()].filter(([, j]) => j.due <= end).sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]; if (!next) break; const [, job] = next; now = job.due; job.due += job.period; job.callback(); await settle(); }
      now = end; await settle();
    }
  }; return result;
}
async function query(backend) {
  const reply = await trace.call(backend === 'agent' ? 'agent-query' : 'task-query', async () => {
    nativeFailure('query'); if (environment.gate) { const gate = environment.gate; environment.gate = undefined; await gate.promise; }
    return environment.unavailable ? { unavailable: true } : { info: backend === 'agent' ? { progress: { state: environment.state, processed: environment.bytes, sizes: [100] } } : { downloadId: 1, downloadedBytes: environment.bytes, downloadTotalBytes: 100, status: environment.status } };
  });
  // This deliberate functional case preserves the production silent fallback.
  // Unrelated injected failures above remain inside the observed API body.
  if (reply.unavailable) throw Error('expected native query unavailable');
  return reply.info;
}
const f = { assert, h, A, trace: () => trace, clock: () => clock, env: () => environment,
  defer() { const gate = h.deferred(); gates.push(gate); environment.gate = gate; return gate; },
  async page(layer, backend, seed = true) {
    if (seed) {
      h.activate(); const record = { id: 'movie', item: { Id: 'movie', Name: 'Fixture', Type: 'Movie' }, path: path.join(A.local.directory, 'movie.mp4'), state: 'downloading', progress: 0, received: 0, total: 100, expectedSize: 100, ...(backend === 'agent' ? { agentId: '1' } : {}) };
      fs.writeFileSync(record.path, 'explicit partial file fixture'); A.downloads = [record]; A.local.saveDownloads(A.downloads);
      await fixture('download-seed', () => assert.equal(new LocalStore(h.context, A.client.session).downloads()[0]?.id, 'movie'));
      if (backend === 'legacy') A.tasks.set(downloadKey(record), { getTaskInfo: () => query('legacy') });
    }
    let p, form;
    if (layer === 'sdk') { const ui = trace.call('ui-compile', () => require('./brand-forms.test.cjs')); form = ui.render('Downloads', { locked: false, records: A.downloads, appService: A, intervals: clock }); p = form.view; }
    else p = new Downloads();
    const actualChanged = p.changed; let changes = 0; p.changed = () => { ++changes; return actualChanged(); }; p.aboutToAppear();
    const client = A.client, local = A.local, record = A.downloads[0];
    const r = { p, form, client, local, record, show: () => p.onPageShow(), hide: () => p.onPageHide(), disappear: () => p.aboutToDisappear(),
      snapshot: () => ({ calls: { ...trace.calls }, periods: [...clock.periods], timers: [...clock.jobs.keys()], timer: p.timer, changes, listener: A.downloadListener === p.changed, listenerAbsent: A.downloadListener === undefined, progress: record?.progress, state: record?.state, cold: new LocalStore(h.context, client.session).downloads(), records: p.records.length, message: p.message, backs: form ? form.events.filter(e => e[0] === 'back').length : trace.calls['router-back'] || 0 })
    }; pages.push(r); return r;
  },
  async invoke(action) { try { return { value: await action() }; } catch (unexpected) { if (unexpected?.code === 'ERR_RESOURCE_FIXTURE') throw unexpected; return { unexpected }; } },
  run: tests => common.run(tests, 'download-page-poll', async () => {
    await settle(); h.reset(); A.downloadListener = undefined; A.polling = false; h.load('utils/Strings.ets').initializeStrings(h.context.resourceManager);
    trace = common.external('download-page-poll', (process.argv.find(a => a.startsWith('--fault=')) || '').slice(8)); clock = intervals(); pages = []; gates = []; pending = new Set(); inPoll = 0; names = new Map(); environment = { bytes: 50, state: 32, status: 0, unavailable: false, gate: undefined };
    if (process.argv.includes('--fault=setup')) assert.fail('unrelated download page setup failure');
    global.setInterval = clock.setInterval; global.clearInterval = clock.clearInterval;
    A.pollDownloads = () => { const job = trace.call('poll', () => { ++inPoll; return original.poll.call(A).finally(() => { --inPoll; }); }); pending.add(job); job.finally(() => pending.delete(job)); return job; };
    A.subscribeDownloads = listener => trace.call('subscribe', () => original.subscribe.call(A, listener));
    A.unsubscribeDownloads = listener => trace.call('unsubscribe', () => original.unsubscribe.call(A, listener));
    router.back = () => trace.call('router-back', () => {});
    api.SESSION_SUCCESSFUL = 8; api.SESSION_FAILED = 9; api.agent = { State: { COMPLETED: 64, FAILED: 65, STOPPED: 49, REMOVED: 80 }, show: id => { assert.equal(id, '1'); return query('agent'); } };
    io.openSync = (...args) => { const file = original.open(...args); names.set(file.fd, path.basename(args[0])); return file; };
    io.closeSync = file => { const result = original.close(file); names.delete(file.fd); return result; };
    io.writeSync = (...args) => inPoll > 0 && names.get(args[0]) === 'downloads.json.tmp' ? trace.call('file-write', () => { nativeFailure('write'); return original.write(...args); }, { filename: names.get(args[0]) }) : original.write(...args);
  }, async () => {
    for (const r of pages) r.hide(); clock.jobs.clear(); A.downloadListener = undefined; for (const gate of gates) gate.resolve(); await Promise.allSettled([...pending]); await settle();
    A.pollDownloads = original.poll; A.subscribeDownloads = original.subscribe; A.unsubscribeDownloads = original.unsubscribe; global.setInterval = original.interval; global.clearInterval = original.clear; api.agent = original.agent; api.SESSION_SUCCESSFUL = original.successful; api.SESSION_FAILED = original.failed; router.back = original.back; io.openSync = original.open; io.closeSync = original.close; io.writeSync = original.write;
  }, () => trace.healthy())
};
module.exports = f;
