// Independent boundary expectations. Do not import the production limit declarations.
const assert = require('node:assert/strict');
const { fixture, runCase } = require('./mpv-probe-result.cjs');
const n = require(process.argv[2]), mode = process.argv[3];
const tests = [], test = (name, fn) => tests.push([name, fn]);
const request = () => ({ api: 15, source: 'fixture://movie', surface: '1' });
const observe = promise => promise.then(value => ({ value }), error => ({ error }));
const utf8 = size => '中😀'.repeat(Math.floor(size / 7)) + 'x'.repeat(size % 7);
const clip = (value, bytes) => { let result = ''; for (const char of value) { if (Buffer.byteLength(result + char) > bytes) break; result += char; } return result; };
async function until(check) {
  await fixture('barrier', async () => {
    const end = Date.now() + 4000;
    while (!check()) { assert.ok(Date.now() < end, 'fixture barrier did not reach its expected state'); await new Promise(setImmediate); }
  });
}
async function opened(fn) {
  const handle = await fixture('setup', () => n.create(request()));
  try { return await fn(handle); } finally { await fixture('cleanup', () => n.release(handle)); }
}

if (mode.startsWith('api-')) {
  test('native loader rejects incompatible libmpv ' + mode, async () => {
    n.configure({ version: mode === 'api-major' ? (3 << 16) | 5 : (2 << 16) | 4 });
    const capability = await n.capability(15); assert.equal(capability.supported, false); assert.equal(capability.loaded, false);
    await assert.rejects(n.create(request()), { message: 'mpv_unavailable' });
    assert.equal(n.inspect().created, 0); assert.equal(n.inspect().active, 0);
  });
} else {
  test('native API14 refuses loading before any libmpv version or create call', async () => {
    assert.deepEqual(await n.capability(14), { supported: false, loaded: false, apiVersion: 0, active: 0 });
    await assert.rejects(n.create({ ...request(), api: 14 }), { message: 'mpv_unavailable' });
    assert.equal(n.inspect().versionCalls, 0); assert.equal(n.inspect().created, 0);
  });
  for (const api of [15, 16, 999, 1000]) test('native supported API ' + api, async () => {
    const capability = await n.capability(api); assert.equal(capability.supported, true); assert.equal(capability.apiVersion, (2 << 16) | 5);
    const handle = await n.create({ ...request(), api }); await n.release(handle);
    assert.equal((await n.capability(api)).active, 0);
  });
  for (const api of [-1, 0.5, 1001, NaN, Infinity, '15']) test('native malformed API preserves synchronous error ' + api, () => {
    assert.throws(() => n.capability(api), { message: 'mpv_argument_invalid' });
    assert.throws(() => n.create({ ...request(), api }), { message: 'mpv_argument_invalid' });
  });
  test('native missing options retain software defaults and actual engine budgets', async () => opened(async handle => {
    assert.equal(n.inspect().options.hwdec, 'no'); assert.equal(n.inspect().options.vo, 'gpu-next');
    assert.equal(n.inspect().options.ao, 'ohaudio'); assert.equal(n.inspect().options['network-timeout'], '15');
    assert.equal(n.inspect().options['demuxer-max-bytes'], '32MiB');
    assert.equal(n.inspect().options['demuxer-max-back-bytes'], '32MiB');
    assert.equal(n.inspect().options.config, 'no'); assert.equal(n.inspect().options['load-scripts'], 'no');
    assert.equal(n.inspect().options['sub-auto'], 'no'); assert.equal(n.inspect().options['audio-file-auto'], 'no');
    assert.equal(n.inspect().options.cache, 'yes'); assert.equal(n.inspect().options['cache-pause-initial'], 'yes');
    assert.equal((await n.snapshot(handle)).hardwareDecoder, 'no');
  }));
  for (const hardwareDecoder of ['no', 'ohcodec', 'ohcodec-copy']) for (const videoOutput of ['gpu', 'gpu-next']) {
    test(`native allowed backend ${hardwareDecoder}/${videoOutput}`, async () => {
      const handle = await n.create({ ...request(), hardwareDecoder, videoOutput, fontConfiguration: '/fixture/fonts.conf' });
      try { assert.equal(n.inspect().options.hwdec, hardwareDecoder); assert.equal(n.inspect().options.vo, videoOutput); assert.equal(n.inspect().options['sub-fonts-config'], '/fixture/fonts.conf'); }
      finally { await n.release(handle); }
    });
  }
  for (const [field, maximum] of [['source', 16384], ['fontConfiguration', 4096], ['surface', 24]]) for (const delta of [-1, 0, 1]) {
    test(`native create ${field} byte boundary ${maximum + delta}`, async () => {
      const size = maximum + delta;
      const value = field === 'surface' ? '0'.repeat(size - 1) + '1' : field === 'fontConfiguration' ? '/' + utf8(size - 1) : utf8(size);
      assert.equal(Buffer.byteLength(value), size);
      const before = n.inspect().created;
      if (delta === 1) { assert.throws(() => n.create({ ...request(), [field]: value }), { message: 'mpv_argument_invalid' }); assert.equal(n.inspect().created, before); }
      else {
        const handle = await n.create({ ...request(), [field]: value });
        try {
          if (field === 'source') assert.equal(n.inspect().commands.find(c => c.name === 'loadfile').value, value);
          if (field === 'fontConfiguration') assert.equal(n.inspect().options['sub-fonts-config'], value);
          if (field === 'surface') assert.equal(n.inspect().options.wid, '1');
        } finally { await fixture('cleanup', () => n.release(handle)); }
      }
    });
  }
  for (const value of ['', 'a\0b', 'a\rb', 'a\nb', 7]) test('native source malformed value ' + JSON.stringify(value), () => {
    assert.throws(() => n.create({ ...request(), source: value }), { message: 'mpv_argument_invalid' }); assert.equal(n.inspect().created, 0);
  });
  for (const fontConfiguration of ['', 'relative/fonts', 'x\0y']) test('native font path malformed ' + JSON.stringify(fontConfiguration), () => {
    assert.throws(() => n.create({ ...request(), fontConfiguration }), { message: 'mpv_argument_invalid' }); assert.equal(n.inspect().created, 0);
  });
  for (const surface of ['0', '-1', '1x', '18446744073709551616']) test('native surface ID execution rejection cleans up ' + surface, async () => {
    await assert.rejects(n.create({ ...request(), surface }), { message: 'mpv_argument_invalid' });
    assert.equal(n.inspect().created, 1); assert.equal(n.inspect().destroyed, 1); assert.equal(n.inspect().active, 0);
  });
  for (const [field, value] of [['hardwareDecoder', 'mediacodec'], ['videoOutput', 'null']]) test('native invalid backend ' + field, () => {
    assert.throws(() => n.create({ ...request(), [field]: value }), { message: 'mpv_argument_invalid' }); assert.equal(n.inspect().created, 0);
  });
  for (const field of ['hardwareDecoder', 'videoOutput']) for (const size of [31, 32, 33]) {
    test(`native backend ${field} UTF-8 byte boundary ${size}`, async () => {
      const value = utf8(size);
      await fixture('input', () => { assert.equal(Buffer.byteLength(value), size); assert.ok(value.length < size); });
      // All three values fail the whitelist. The actual copy trace independently
      // proves whether String() admitted the bytes before whitelist evaluation.
      assert.throws(() => n.create({ ...request(), [field]: value }), { message: 'mpv_argument_invalid' });
      const reads = n.stringReads();
      assert.deepEqual(reads.filter(r => !r.copy).map(r => r.bytes), [15, 1, size]);
      const admitted = size <= 32 ? [15, 1, size] : [15, 1];
      assert.deepEqual(reads.filter(r => r.copy).map(r => r.bytes), admitted, 'backend byte budget must precede whitelist rejection');
      assert.deepEqual(reads.filter(r => r.copy).map(r => r.capacity), admitted.map(n => n + 1));
      assert.equal(n.inspect().created, 0);
    });
  }
  for (const layer of ['N-API', 'core']) for (const axis of ['width', 'height']) for (const value of [1, 8191, 8192, 0, -1, 1.5, 8193, NaN, Infinity, -Infinity]) {
    test(`${layer} surface ${axis} independently ${value}`, async () => opened(async handle => {
      const [width, height] = axis === 'width' ? [value, 1] : [1, value];
      const call = () => layer === 'N-API' ? n.command(handle, { type: 'surface-size', value: width, height }) : n.coreSurface(handle, width, height);
      if ([1, 8191, 8192].includes(value)) {
        await call(); assert.deepEqual(n.inspect().properties, [{ name: 'ohos-surface-size', value: `${width}x${height}` }]);
      } else {
        if (layer === 'core') assert.throws(call, { message: 'mpv_argument_invalid' });
        else if (!Number.isFinite(value)) assert.throws(call, { message: 'mpv_closed' });
        else await assert.rejects(call(), { message: 'mpv_argument_invalid' });
        assert.deepEqual(n.inspect().properties, [], 'rejected axis must not reach libmpv');
      }
    }));
  }
  for (const [type, values, accepted] of [
    ['speed', [0.249, 0.25, 4, 4.001], [0.25, 4]],
    ['volume', [-0.001, 0, 1, 1.001], [0, 1]],
    ['seek', [-1, 0, 1e12, 1e12 + 1], [0, 1e12]]
  ]) for (const value of values) test(`native ${type} independent range ${value}`, async () => opened(async handle => {
    const promise = n.command(handle, { type, value });
    if (!accepted.includes(value)) await assert.rejects(promise, { message: 'mpv_argument_invalid' });
    else {
      await promise;
      if (type === 'seek') assert.equal(n.inspect().commands.at(-1).value, (value / 1000).toFixed(6));
      else assert.equal(Number(n.inspect().properties.at(-1).value), type === 'volume' ? value * 100 : value);
    }
  }));
  for (const size of [31, 32, 33]) test('native command type bytes ' + size, async () => opened(async handle => {
    const call = () => n.command(handle, { type: 'x'.repeat(size), value: 0 });
    if (size > 32) assert.throws(call, { message: 'mpv_closed' });
    else await assert.rejects(call(), { message: 'mpv_command_failed' });
  }));
  for (const [field, maximum] of [['plain', 16384], ['styled', 32768]]) for (const delta of [-1, 0, 1]) test(`native snapshot ${field} UTF-8 clip ${maximum + delta}`, async () => opened(async handle => {
    const value = utf8(maximum + delta); n.configure({ [field]: value }); const snapshot = await n.snapshot(handle);
    assert.equal(snapshot[field === 'plain' ? 'subtitleText' : 'subtitleAss'], clip(value, maximum));
  }));
  for (const size of [65535, 65536, 65537]) test('native snapshot full event bytes ' + size, async () => opened(async handle => {
    const value = utf8(size); n.configure({ full: value }); const snapshot = await n.snapshot(handle);
    assert.equal(snapshot.subtitleOverflow, size > 65536); assert.equal(snapshot.subtitleEvents, size > 65536 ? '' : value);
  }));
  for (const [field, maximum] of [['language', 63], ['codec', 63], ['title', 256]]) for (const delta of [-1, 0, 1]) test(`native track ${field} UTF-8 clip ${maximum + delta}`, async () => opened(async handle => {
    const value = utf8(maximum + delta); n.configure({ trackCount: 1, [field]: value });
    assert.equal((await n.snapshot(handle)).tracks[0][field], clip(value, maximum));
  }));
  for (const trackCount of [-1, 255, 256, 257]) test('native track array budget ' + trackCount, async () => opened(async handle => {
    // Repeated IDs keep the independent historical-identity guard out of the way.
    n.configure({ trackCount, repeatTrackId: true });
    if (trackCount < 0 || trackCount > 256) await assert.rejects(n.snapshot(handle), { message: 'mpv_tracks_invalid' });
    else assert.equal((await n.snapshot(handle)).tracks.length, trackCount);
  }));
  test('native historical track identities independently fill 255/256 and reject 257', async () => opened(async handle => {
    n.configure({ trackCount: 255 }); assert.equal((await n.snapshot(handle)).tracks.length, 255);
    n.configure({ trackCount: 1, firstTrackId: 256 }); assert.equal((await n.snapshot(handle)).tracks[0].index, 255);
    n.configure({ trackCount: 1, firstTrackId: 257 }); await assert.rejects(n.snapshot(handle), { message: 'mpv_tracks_invalid' });
    n.configure({ trackCount: 1, firstTrackId: 1 }); assert.equal((await n.snapshot(handle)).tracks[0].index, 0);
  }));
  for (const events of [127, 128, 129]) test('native per-snapshot event budget ' + events, async () => opened(async handle => {
    n.configure({ events }); await n.snapshot(handle); assert.equal(n.inspect().eventCalls, 128);
    await n.snapshot(handle); assert.equal(n.inspect().eventCalls, events === 129 ? 130 : 129);
  }));
  test('native failed initialization rejects only after resource cleanup and permits retry', async () => {
    n.configure({ failInitialize: true }); await assert.rejects(n.create(request()), { message: 'mpv_initialize_failed' });
    assert.equal(n.inspect().active, 0); assert.equal(n.inspect().live, 0); assert.equal(n.inspect().destroyed, 1);
    n.configure({}); await opened(async () => { assert.equal(n.inspect().active, 1); });
    assert.equal(n.inspect().destroyed, 2);
  });
  test('native execute admits four overlapping opens and rejects the fifth without leaking reservation', async () => {
    n.configure({ block: 'initialize' }); const initial = [];
    const pending = Array.from({ length: 4 }, () => observe(n.create(request())).then(result => { initial.push(result); return result; })); let fifth;
    try {
      await until(() => n.inspect().blocked === 4 || initial.length);
      assert.ok(!initial.some(result => result.error), 'all four initial opens must be admitted');
      assert.equal(n.inspect().blocked, 4); assert.equal(n.inspect().active, 4);
      pending.push(observe(n.create(request())).then(result => (fifth = result)));
      await until(() => fifth || n.inspect().blocked === 5);
      assert.equal(fifth?.error?.message, 'mpv_busy'); assert.equal(n.inspect().active, 4); assert.equal(n.inspect().created, 4);
    } finally {
      await fixture('cleanup', async () => {
        n.unblock(); const outcomes = await Promise.all(pending);
        await Promise.all(outcomes.filter(o => o.value).map(o => n.release(o.value)));
      });
    }
    assert.equal(n.inspect().active, 0); assert.equal(n.inspect().destroyed, 4);
    await opened(async () => {});
  });
  for (const layer of ['N-API', 'core']) test(`${layer} queue admits 63/64, rejects 65 and releases while full`, async () => {
    const handle = await fixture('setup', () => n.create(request())); n.configure({ block: 'set:pause' });
    const pending = [observe(n.command(handle, { type: 'pause', value: 0 }))]; let release;
    try {
      await until(() => n.inspect().blocked === 1); assert.equal(n.queueSize(handle), 0);
      for (let i = 0; i < 64; ++i) {
        let work; assert.doesNotThrow(() => { work = n.command(handle, { type: 'volume', value: i / 64 }); });
        pending.push(observe(work));
        if (i === 62) assert.equal(n.queueSize(handle), 63);
      }
      assert.equal(n.queueSize(handle), 64);
      if (layer === 'N-API') assert.throws(() => { const work = n.command(handle, { type: 'volume', value: 1 }); pending.push(observe(work)); }, { message: 'mpv_closed' });
      else assert.throws(() => n.coreEnqueue(handle, false), { message: 'mpv_busy' });
      assert.equal(n.queueSize(handle), 64);
      if (layer === 'core') n.coreEnqueue(handle, true);
      release = n.release(handle); assert.equal(n.queueSize(handle), 65);
      assert.throws(() => n.command(handle, { type: 'volume', value: 0 }), { message: 'mpv_closed' });
      assert.equal(n.inspect().blocked, 1); assert.equal(n.inspect().active, 1);
    } finally {
      await fixture('cleanup', async () => {
        n.unblock(); const outcomes = await Promise.all(pending);
        await (release || n.release(handle));
        assert.ok(outcomes.every(o => !o.error));
      });
    }
    assert.equal(n.inspect().active, 0); assert.equal(n.inspect().destroyed, 1);
    assert.deepEqual(n.inspect().properties.filter(p => p.name === 'volume').map(p => Number(p.value)), Array.from({ length: 64 }, (_, i) => i / 64 * 100));
  });
  test('native command failure and closed/foreign handle error identities are unchanged', async () => {
    const handle = await n.create(request()); n.configure({ failProperty: true });
    await assert.rejects(n.command(handle, { type: 'surface-size', value: 1, height: 1 }), { message: 'mpv_command_failed' });
    await n.release(handle); await n.release(handle);
    assert.throws(() => n.command(handle, { type: 'volume', value: 0 }), { message: 'mpv_closed' });
    assert.throws(() => n.snapshot({}), { message: 'mpv_closed' });
    assert.equal(n.inspect().destroyed, 1);
  });
}

(async () => {
  const selected = process.argv[4] ? tests.filter(([name]) => name.includes(process.argv[4])) : tests;
  assert.ok(selected.length, 'no selected native MPV cases');
  for (const [name, fn] of selected) {
    await runCase(name, fn, { before: () => n.reset(), after: () => {
      assert.equal(n.inspect().active, 0); assert.equal(n.inspect().live, 0);
    } });
    console.log('PASS ' + name);
  }
  console.log(`${selected.length} native MPV fixture cases passed (${mode}).`);
})().catch(error => { n.unblock(); console.error(error); process.exitCode = 1; });
