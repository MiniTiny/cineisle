// Product ArkUI producers, cache, transport and decoder stay real. Only Harmony APIs are fixtures.
const f = require('./catalog-contract-fixture.cjs').make('poster-profiles');
const { h, A, assert } = f, fs = require('node:fs'), path = require('node:path');
const p = require('./poster-platform.cjs').install(h);
const { PosterCache } = h.load('service/PosterCache.ets');
const { decodePoster } = h.load('service/PosterBitmap.ets');
const image = h.platform.get('@ohos.multimedia.image'), createImageSource = image.createImageSource;
const io = h.platform.get('@ohos.file.fs');
const originalIO = Object.fromEntries(['mkdir', 'listFile', 'open', 'write', 'rename', 'read', 'close', 'fsync'].map(key => [key, io[key]]));
let views = [], caches = [];
const jpeg = () => new Uint8Array([255, 216, 255, 1, 2, 3, 4, 5]).buffer;
function cache() { const value = new PosterCache(h.context); caches.push(value); return value; }
function ui() { return f.trace().call('ui-compile', () => require('./brand-forms.test.cjs')); }
function producer(id) {
  const item = { ...h.film('one'), ImageTags: { Primary: 'primary-tag' }, BackdropImageTags: ['backdrop-tag'], People: [{ Id: 'person', Name: 'Actor', Type: 'Actor', PrimaryImageTag: 'person-tag' }] };
  const common = { appService: A, posterDecode: decodePoster, realMediaCard: true };
  const options = {
    default: ['CachedImage', { imageId: 'one', tag: 'primary-tag' }],
    card: ['MediaCard', { item, wide: false }],
    wide: ['MediaCard', { item, wide: true }],
    cast: ['DetailMetadataPanel', { item }],
    actor: ['Index', { ready: true, signedIn: true, tab: 3, profiles: [{ person: item.People[0], works: [], watched: 0, unplayed: 0, tags: [] }] }],
    detail: ['Detail', { item: { ...item, People: [] } }]
  };
  const [name, props] = options[id];
  const rendered = f.trace().call('ui-render', () => ui().render(name, { ...common, ...props }));
  const candidates = name === 'CachedImage' ? [rendered.view] : rendered.childViews.filter(view => typeof view.visibleArea === 'function');
  const view = f.trace().call('ui-target', () => { assert.equal(candidates.length, 1); return candidates[0]; });
  views.push(view);
  // Calling the production lifecycle and emitted visibility callback keeps the actual load path.
  view.aboutToAppear();
  const images = ui().flat(rendered.roots).filter(node => node.type === 'Image' && node.attrs.onVisibleAreaChange);
  const show = f.trace().call('ui-visibility', () => { assert.equal(images.length, 1); return images[0].attrs.onVisibleAreaChange[1]; });
  return { rendered, view, show, descriptor: () => ({ id: view.imageId, tag: view.tag, backdrop: view.backdrop, width: view.pixelWidth }) };
}
function recordIO() {
  for (const [key, method] of Object.entries(originalIO)) io[key] = (...args) => f.trace().call('cache-' + key, () => method(...args));
}
module.exports = { ...f, p, cache, producer, jpeg, ui,
  async load(entry) { entry.show(true); await f.settle(); await A.posters.usage(); await f.settle(); },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    p.reset(); views = []; caches = []; recordIO();
    image.createImageSource = bytes => f.trace().call('image-source', () => {
      // Failure occurs in the native API fixture, not via the external trace injection switch.
      if (process.argv.includes('--native-image-init-failure')) throw Object.assign(Error('native image source initialization failed'), { code: 'EIO' });
      const value = createImageSource(bytes), getInfo = value.getImageInfo.bind(value), createMap = value.createPixelMap.bind(value);
      value.getImageInfo = () => f.trace().call('image-info', () => getInfo());
      value.createPixelMap = options => f.trace().call('bitmap-create', () => createMap(options));
      return value;
    });
    p.imageState.info = { size: { width: 1600, height: 2400 } };
    if (process.argv.includes('--native-disk-init-failure')) {
      fs.mkdirSync(path.dirname(p.root), { recursive: true }); fs.writeFileSync(p.root, 'blocked cache directory');
    }
    try { await test.action(check); }
    finally { for (const view of views) view.aboutToDisappear(); await f.settle(); for (const value of caches) value.cancelAll(false); Object.assign(io, originalIO); image.createImageSource = createImageSource; }
  } })))
};
