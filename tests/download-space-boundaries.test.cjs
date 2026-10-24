const f = require('./download-contract-fixture.cjs');
const { assert, fs, path, h, A, D, strings, observe, backend, item, record } = f;
const { AppFailure } = h.load('utils/Failures.ts');
const tests = [], test = (name, action) => tests.push({ name, action });
const M = 1048576;
for (const entry of ['check', 'optional']) for (const delta of [-1, 0, 1]) test(`space ${entry} margin ${delta}`, async check => {
  f.env().free = 8388608 + delta;
  const r = await observe(entry === 'check' ? D.check(h.directory, record(), []) : D.checkOptional(h.directory, 0, []));
  check(() => { assert.equal(!!r.error, delta < 0); assert.deepEqual(f.env().spaceCalls, [h.directory]); });
});
for (const entry of ['check', 'optional']) for (const axis of ['video', 'pending', 'claim', 'combined']) for (const delta of [-1, 0, 1]) test(`space ${entry} ${axis} ${delta}`, async check => {
  const active = record({ expectedSize: 100, subtitleState: 'pending', subtitles: [{ path: path.join(h.directory, 'pending.srt'), state: 'pending' }] });
  fs.writeFileSync(active.path, Buffer.alloc(40)); fs.writeFileSync(active.subtitles[0].path, Buffer.alloc(10));
  if (axis !== 'video' && axis !== 'combined') active.state = 'complete';
  if (axis !== 'pending' && axis !== 'combined') active.subtitleState = 'ready';
  const release = axis === 'claim' || axis === 'combined' ? D.reserveSubtitles(active, 2) : () => {};
  const reserved = axis === 'video' ? 60 : axis === 'pending' ? 4194294 : axis === 'claim' ? 8388608 : 8388668;
  f.env().free = 8388608 + reserved + delta;
  try {
    const r = await observe(entry === 'check' ? D.check(h.directory, record(), [active]) : D.checkOptional(h.directory, 0, [active]));
    check(() => assert.equal(!!r.error, delta < 0));
  } finally { release(); }
});
for (const subtitleOnly of [false, true]) for (const delta of [-1, 0, 1]) test(`space new subtitleOnly=${subtitleOnly} ${delta}`, async check => {
  const r = record({ expectedSize: 71, subtitles: [{ path: path.join(h.directory, 'absent.srt'), state: 'ready' }] });
  f.env().free = 12582912 + (subtitleOnly ? 0 : 71) + delta;
  const result = await observe(D.check(h.directory, r, [], subtitleOnly));
  check(() => assert.equal(!!result.error, delta < 0));
});
test('space ready files and excess received bytes do not reserve again', async check => {
  const r = record({ expectedSize: 3, subtitleState: 'pending', subtitles: [{ path: path.join(h.directory, 'ready.srt'), state: 'ready' }] });
  fs.writeFileSync(r.path, 'oversized'); fs.writeFileSync(r.subtitles[0].path, Buffer.alloc(4194305)); f.env().free = 8388608;
  const optional = await observe(D.checkOptional(h.directory, 0, [r]));
  const ready = await observe(D.check(h.directory, r, [], true));
  check(() => { assert.equal(optional.error, undefined); assert.equal(ready.error, undefined); });
});
test('space claims use max per record and sum between records with idempotent release', async check => {
  const a = record({ state: 'complete' }), b = record({ state: 'complete' });
  const first = D.reserveSubtitles(a, 1), second = D.reserveSubtitles(a, 2), duplicate = D.reserveSubtitles(a, 1), other = D.reserveSubtitles(b, 1);
  try {
    f.env().free = 20971520; const initial = await observe(D.checkOptional(h.directory, 0, [a, b]));
    first(); first(); second(); f.env().free = 16777216; const reduced = await observe(D.checkOptional(h.directory, 0, [a, b]));
    duplicate(); other(); f.env().free = 8388608; const released = await observe(D.checkOptional(h.directory, 0, [a, b]));
    check(() => { assert.equal(initial.error, undefined); assert.equal(reduced.error, undefined); assert.equal(released.error, undefined); });
  } finally { first(); second(); duplicate(); other(); }
});
for (const free of [-1, NaN, Infinity, 8388608.5, Number.MAX_SAFE_INTEGER + 1]) for (const entry of ['check', 'optional']) test(`space invalid free ${entry} ${free}`, async check => {
  f.env().free = free;
  const r = await observe(entry === 'check' ? D.check(h.directory, record(), []) : D.checkOptional(h.directory, 0, []));
  check(() => assert.equal(r.error?.message, 'download_space_check_failed'));
});
for (const bytes of [-1, .5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) test(`space invalid optional bytes ${bytes}`, async check => {
  const r = await observe(D.checkOptional(h.directory, bytes, [])); check(() => assert.equal(r.error?.message, 'download_space_check_failed'));
});
test('space invalid new total retains insufficient identity', async check => {
  const result = await observe(D.check(h.directory, record({ expectedSize: NaN }), []));
  check(() => { assert.ok(result.error instanceof AppFailure); assert.equal(result.error.failureCode, 'download_space_insufficient'); });
});
test('space statvfs errors retain distinct entry identities', async check => {
  const error = Object.assign(Error('native statvfs unavailable'), { code: 123 });
  h.platform.get('@ohos.file.statvfs').getFreeSize = async () => { throw error; };
  const normal = await observe(D.check(h.directory, record(), [])), optional = await observe(D.checkOptional(h.directory, 0, []));
  check(() => { assert.equal(normal.error.message, 'download_space_check_failed'); assert.strictEqual(optional.error, error); });
});
test('space display keeps ceil floor and captured language through the real Downloads retry', async check => {
  const b = backend(false), r = record({ state: 'complete', mediaSourceId: 'source', subtitleState: 'failed' });
  A.downloads = [r]; b.local.saveDownloads([r]);
  b.client.playbackInfo = async () => ({ MediaSources: [{ Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 1, Codec: 'srt' }] }] });
  let language = 'zh'; strings.initializeStrings({ getStringByNameSync: (key, ...args) => language + ':' + key + ':' + args.join(',') });
  f.env().free = 12582911;
  const { Downloads } = h.load('pages/Downloads.ets'), page = new Downloads(); page.client = b.client;
  await page.retrySubtitles(r);
  const direct = await observe(D.check(h.directory, record({ expectedSize: 1 }), []));
  // Separately force the required-MiB ceil at 8MiB+1, with available below one MiB.
  f.env().free = M - 1; const rounded = await observe(D.check(h.directory, record({ expectedSize: 1 }), []));
  language = 'en'; const captured = strings.errorText(rounded.error);
  strings.initializeStrings({ getStringByNameSync() { throw Error('resource unavailable'); } });
  check(() => {
    assert.equal(page.message, 'zh:download_space_insufficient:12,11'); assert.equal(page.busy, false);
    assert.equal(direct.error, undefined); assert.ok(rounded.error instanceof AppFailure);
    assert.equal(rounded.error.failureCode, 'download_space_insufficient'); assert.equal(rounded.error.category, 'storage');
    assert.deepEqual(rounded.error.params, [9, 0]); assert.equal(captured, 'zh:download_space_insufficient:9,0'); assert.equal(strings.errorText(rounded.error), captured);
  });
});
for (const agent of [false, true]) for (const delta of [-1, 0, 1]) test(`space video production ${agent ? 'agent' : 'legacy'} ${delta}`, async check => {
  const b = backend(agent); f.env().free = 8388708 + delta;
  const r = await observe(A.download(item()));
  check(() => { assert.equal(!!r.error, delta < 0); assert.equal(b.made.length, delta < 0 ? 0 : 1); assert.equal(A.downloads.length, delta < 0 ? 0 : 1); });
});
for (const delta of [-1, 0, 1]) test(`space BIF production ${delta}`, async check => {
  backend(false); let work = 0, admitted;
  // The resource repository invokes its callback; the real AppService admission closure and DownloadSpace execute.
  A.trickplays = { load(client, local, id, offline, owned, admit) { admitted = observe(admit(async () => { work++; })); return { result: Promise.resolve(undefined), cancel() {} }; } };
  f.env().free = 25165824 + delta; A.trickplay('movie', false, () => true); const result = await admitted;
  check(() => { assert.equal(work, delta < 0 ? 0 : 1); assert.equal(!!result.error, delta < 0); assert.deepEqual(f.env().spaceCalls, [A.local.directory]); });
});
for (const delta of [-1, 0, 1]) test(`space BIF actual cache ${delta}`, async check => {
  require('./poster-platform.cjs').install(h);
  const b = backend(false), { TrickplayRepository } = h.load('service/TrickplayRepository.ets');
  const { bif } = require('./bif-fixture.cjs'); let transfers = 0;
  b.client.trickplay = () => ({ result: Promise.resolve(bif()), cancel() {} });
  const transfer = b.client.trickplay; b.client.trickplay = (...args) => { transfers++; return transfer(...args); };
  A.trickplays = new TrickplayRepository(); f.env().free = 25165824 + delta;
  const result = await A.trickplay('movie', false, () => true).result;
  check(() => { assert.ok(result); assert.equal(transfers, 1); assert.equal(fs.existsSync(path.join(b.local.directory, 'trickplay-v1/movie.bif')), delta >= 0); assert.deepEqual(f.env().spaceCalls, [b.local.directory]); });
});
test('space retry reserves overlapping replacement and releases after failure', async check => {
  const b = backend(false), r = record({ state: 'complete', mediaSourceId: 'source', subtitleState: 'ready', subtitles: [{ index: 8, title: 'old', language: '', state: 'ready', path: path.join(b.local.directory, 'movie.subtitle-8.srt') }] });
  fs.writeFileSync(r.path, 'video'); fs.writeFileSync(r.subtitles[0].path, '1\n00:00:01,000 --> 00:00:02,000\nold\n');
  A.downloads = [r]; b.local.saveDownloads([r]);
  b.client.playbackInfo = async () => ({ MediaSources: [{ Id: 'source', MediaStreams: [{ Type: 'Subtitle', Index: 8, Codec: 'ass' }] }] });
  const gate = h.deferred(); b.client.subtitle = () => gate.promise;
  const pending = observe(A.retrySubtitles(r)); await f.settle();
  f.env().free = 12582911; const during = await observe(D.checkOptional(b.local.directory, 0, A.downloads));
  const oldPath = r.subtitles[0].path; gate.reject(Error('network_failed')); await pending;
  f.env().free = 8388608; const after = await observe(D.checkOptional(b.local.directory, 0, A.downloads));
  check(() => { assert.equal(during.error?.message, 'download_space_check_failed'); assert.equal(after.error, undefined); assert.equal(oldPath.endsWith('.srt'), true); assert.equal(fs.existsSync(oldPath), true); });
});
if (require.main === module) f.run(tests, 'download space boundary').catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
