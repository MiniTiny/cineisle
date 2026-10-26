const f = require('./trickplay-target-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const mode of ['lower', 'preview', 'page']) for (const [w, h, output] of [[639, 400, { width: 639, height: 400 }], [640, 400, { width: 640, height: 400 }], [641, 400, { width: 640, height: 399 }], [1920, 1080, { width: 640, height: 360 }]]) {
  test(`${mode} trickplay source width ${w}`, async check => {
    f.p.imageState.info = { size: { width: w, height: h } }; let result, bitmap, time, imageMatches, seeks;
    if (mode === 'lower') result = await f.lower();
    else if (mode === 'preview') { const p = f.preview(); p.request(35000); await f.settle(); ({ map: bitmap, time } = p.published.at(-1)); }
    else { const p = f.page(); p.request(35000); await f.settle(); bitmap = p.view.thumbnail; time = p.view.thumbnailTime; imageMatches = p.image()?.args[0] === bitmap; seeks = p.seeks; }
    const stats = f.stats();
    check(() => { if (result) assert.ifError(result.error); else { assert.ok(bitmap); assert.equal(time, 30000); if (mode === 'page') { assert.equal(imageMatches, true); assert.deepEqual(seeks, []); } }
      assert.deepEqual(stats.decoded, [{ desiredSize: output, editable: false }]); assert.deepEqual(stats.bytes, [[255, 216, 2, 255, 217]]); assert.equal(stats.sourceReleases, 1); assert.equal(stats.bitmapReleases, mode === 'lower' ? 1 : 0); });
  });
}
for (const axis of ['width', 'height']) for (const n of [32767, 32768, 32769]) test(`page trickplay independent ${axis} ${n}`, async check => {
  f.p.imageState.info = { size: { width: axis === 'width' ? n : 1, height: axis === 'height' ? n : 1 } };
  const p = f.page(); p.request(35000); await f.settle(); const visible = !!p.view.thumbnail, stats = f.stats();
  check(() => { assert.equal(visible, n <= 32768); assert.equal(stats.decoded.length, n <= 32768 ? 1 : 0); assert.equal(stats.sourceReleases, 1); assert.equal(stats.bitmapReleases, 0); });
});
test('page trickplay retains retired bitmaps until the actual Image completion callback', async check => {
  f.p.imageState.info = { size: { width: 1920, height: 1080 } }; const p = f.page();
  p.request(0); await f.settle(); p.image().attrs.onComplete[0]();
  p.request(35000); await f.settle(); const second = p.view.thumbnail;
  p.request(65000); await f.settle(); const before = f.stats(), image = p.image(); image.attrs.onComplete[0](); await f.settle(); const after = f.stats(), time = p.view.thumbnailTime;
  p.view.preview.clear(); await f.settle(); const cleared = f.stats();
  check(() => { assert.equal(image.args[0], second); assert.equal(before.created, 2); assert.equal(before.bitmapReleases, 0); assert.equal(after.created, 3); assert.equal(after.bitmapReleases, 1); assert.equal(time, 60000); assert.equal(cleared.bitmapReleases, 3); assert.equal(cleared.sourceReleases, 3); });
});
test('preview trickplay hide rejects an in-flight bitmap independently of data replacement', async check => {
  const gate = f.blockBitmap(), p = f.preview(); p.request(35000); await f.settle(); p.preview.hide(); gate.resolve(); await f.settle(); const stats = f.stats(), published = p.published.filter(p => p.map);
  check(() => { assert.deepEqual(published, []); assert.equal(stats.created, 1); assert.equal(stats.sourceReleases, 1); assert.equal(stats.bitmapReleases, 1); });
});
test('page trickplay hide rejects an in-flight bitmap through the production lifecycle', async check => {
  const gate = f.blockBitmap(), p = f.page(); p.request(35000); await f.settle(); p.view.onPageHide(); gate.resolve(); await f.settle(); const stats = f.stats(), bitmap = p.view.thumbnail;
  check(() => { assert.equal(bitmap, undefined); assert.equal(p.view.visible, false); assert.equal(stats.created, 1); assert.equal(stats.sourceReleases, 1); assert.equal(stats.bitmapReleases, 1); });
});
test('preview trickplay coalesces to the last pending frame', async check => {
  const gate = f.blockBitmap(), p = f.preview(); p.request(0); await f.settle(); p.request(35000); p.request(65000); gate.resolve(); await f.settle(); const stats = f.stats(), times = p.published.filter(p => p.map).map(p => p.time);
  check(() => { assert.deepEqual(times, [60000]); assert.equal(stats.created, 2); assert.equal(stats.bitmapReleases, 1); assert.deepEqual(stats.bytes, [[255, 216, 1, 255, 217], [255, 216, 3, 255, 217]]); });
});
test('preview trickplay skips a rendered frame already decoded', async check => {
  const p = f.preview(); p.request(35000); await f.settle(); p.preview.rendered(); p.request(45000); await f.settle(); const stats = f.stats();
  check(() => { assert.equal(stats.created, 1); assert.equal(stats.sourceReleases, 1); assert.equal(stats.bitmapReleases, 0); });
});
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
