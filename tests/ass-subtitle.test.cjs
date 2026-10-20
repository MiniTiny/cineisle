// Actual async orchestration with explicit native/image fixtures; not a native render acceptance.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const requests = [], responses = [], images = [], imageResponses = [];
let closes = 0, failures = 0, published = [];
const native = { async create() { return { native: true }; },
  async render(...args) { requests.push(args); assert.ok(responses.length, 'explicit native frame fixture required'); return await responses.shift(); },
  close() { closes++; } };
h.platform.set('libcineisle_ass.so', native);
h.platform.set('@ohos.multimedia.image', { PixelMapFormat: { RGBA_8888: 3 }, AlphaType: { PREMUL: 2 },
  async createPixelMap(buffer, options) { images.push({ buffer, options }); return imageResponses.length ? await imageResponses.shift() : bitmap(); } });
h.platform.set('@ohos.font', { getUIFontConfig: () => ({ fontDir: ['/system/fonts/'],
  generic: [{ family: 'Fixture', alias: [], adjust: [] }], fallbackGroups: [] }),
  getFontByName: () => ({ path: path.join(h.directory, 'font.ttf') }) });
const { AssSubtitle } = h.load('service/AssSubtitle.ets');
const { styledSubtitleBounds } = h.load('utils/StyledSubtitle.ts');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
function bitmap() { return { releases: 0, async release() { this.releases++; } }; }
function frame(overrides = {}) { return { changed: true, present: true, canvasWidth: 640, canvasHeight: 360,
  left: 40, top: 60, width: 2, height: 1, rgba: new ArrayBuffer(8), ...overrides }; }
async function fixture() {
  h.reset(); requests.length = 0; responses.length = 0; images.length = 0; imageResponses.length = 0;
  closes = failures = 0; published = []; fs.writeFileSync(path.join(h.directory, 'font.ttf'), 'fixture; not a native font');
  return AssSubtitle.create('explicit ASS fixture', h.directory, value => published.push(value), () => { failures++; });
}
test('in-flight work is serialized and intermediate clocks are replaced by the newest request', async () => {
  const renderer = await fixture(), first = h.deferred(); responses.push(first.promise, frame());
  renderer.render(100, 640, 360); renderer.render(200, 640, 360); renderer.render(300, 640, 360);
  assert.equal(requests.length, 1); first.resolve(frame()); await settle();
  assert.deepEqual(requests.map(value => value[1]), [100, 300]); assert.equal(failures, 0);
  assert.equal(images[0].options.srcPixelFormat, 3); assert.equal(images[0].options.pixelFormat, 3); assert.equal(images[0].options.alphaType, 2);
  renderer.close();
});
test('unchanged native frames retain the previous image while an ended frame clears it', async () => {
  const renderer = await fixture(); responses.push(frame(), frame({ changed: false, present: false, rgba: new ArrayBuffer(0) }),
    frame({ present: false, width: 0, height: 0, rgba: new ArrayBuffer(0) }));
  renderer.render(100, 640, 360); await settle(); const first = published.at(-1);
  renderer.render(200, 640, 360); await settle(); assert.equal(published.at(-1), first); assert.equal(images.length, 1);
  renderer.render(2000, 640, 360); await settle(); assert.equal(published.at(-1), undefined); renderer.close();
});
test('clear invalidates publication but consumes a native frame needed by the next unchanged result', async () => {
  const renderer = await fixture(), gate = h.deferred(); responses.push(gate.promise, frame({ changed: false, present: false, rgba: new ArrayBuffer(0) }));
  renderer.render(100, 640, 360); renderer.clear(); renderer.render(900, 640, 360); gate.resolve(frame()); await settle();
  assert.equal(published.filter(Boolean).length, 1); assert.equal(images.length, 1); assert.equal(requests.at(-1)[1], 900); renderer.close();
});
test('close during native work cancels publication without starting image conversion', async () => {
  const renderer = await fixture(), gate = h.deferred(); responses.push(gate.promise);
  renderer.render(100, 640, 360); renderer.close(); renderer.close(); gate.resolve(frame()); await settle();
  assert.equal(closes, 1); assert.equal(images.length, 0); assert.equal(published.filter(Boolean).length, 0); assert.equal(failures, 0);
});
test('a map completed after close is released before reaching either consumer', async () => {
  const renderer = await fixture(), gate = h.deferred(), map = bitmap(); responses.push(frame()); imageResponses.push(gate.promise);
  renderer.render(100, 640, 360); await settle(); assert.equal(images.length, 1);
  renderer.close(); gate.resolve(map); await settle(); assert.equal(map.releases, 1); assert.equal(published.filter(Boolean).length, 0);
});
test('closing the renderer preserves an already published image held by page and PiP consumers', async () => {
  const renderer = await fixture(), map = bitmap(); responses.push(frame()); imageResponses.push(map);
  renderer.render(100, 640, 360); await settle(); const page = published.at(-1), pip = published.at(-1);
  renderer.close(); assert.equal(page.bitmap, map); assert.equal(pip.bitmap, map); assert.equal(map.releases, 0);
});
test('native failure clears the visible frame, closes once, and rejects further work', async () => {
  const renderer = await fixture(); responses.push(Promise.reject(Error('native failure')));
  renderer.render(100, 640, 360); await settle(); renderer.render(200, 640, 360);
  assert.equal(closes, 1); assert.equal(failures, 1); assert.equal(requests.length, 1); assert.equal(published.at(-1), undefined);
});
test('render surfaces are bounded while source dimensions are preserved', async () => {
  const renderer = await fixture(); responses.push(frame()); renderer.render(100.9, 6000, 3000); await settle();
  assert.deepEqual(requests[0].slice(1), [100, 1920, 960, 6000, 3000]); renderer.close();
});
test('invalid clocks and source geometry do not reach the native worker', async () => {
  const renderer = await fixture();
  for (const args of [[NaN, 640, 360], [-1, 640, 360], [100, 0, 360], [100, 1.5, 360], [100, 640, Infinity], [100, 32769, 360]]) renderer.render(...args);
  assert.equal(requests.length, 0); renderer.close();
});
test('contain and cover geometry use video-canvas coordinates including crop offsets', () => {
  const value = { bitmap: bitmap(), canvasWidth: 640, canvasHeight: 360, left: 40, top: 60, width: 160, height: 28 };
  assert.deepEqual(styledSubtitleBounds(value, 360, 360, false), { left: 22.5, top: 112.5, width: 90, height: 15.75 });
  assert.deepEqual(styledSubtitleBounds(value, 360, 360, true), { left: -100, top: 60, width: 160, height: 28 });
  assert.equal(styledSubtitleBounds(value, 0, 360, false), undefined); assert.equal(styledSubtitleBounds(value, NaN, 360, false), undefined);
});
(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(tests.length + ' ASS async subtitle tests passed. Native/image fixtures do not prove font matching, GPU lifetime, memory stability or player UI.');
})().catch(error => { console.error(error); process.exitCode = 1; });
