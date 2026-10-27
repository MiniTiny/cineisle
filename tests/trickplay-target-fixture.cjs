// Real BIF parsing/Preview/PosterBitmap and SDK Player callbacks; image APIs remain explicit fixtures.
const f = require('./catalog-contract-fixture.cjs').make('trickplay-target'), { h } = f;
const p = require('./poster-platform.cjs').install(h), api = h.platform.get('@ohos.multimedia.image'), create = api.createImageSource;
const { parseBif } = h.load('utils/Bif.ts'), { bif } = require('./bif-fixture.cjs');
const { TrickplayPreview } = h.load('service/TrickplayPreview.ets'), { decodePoster } = h.load('service/PosterBitmap.ets');
let previews, sources, maps, gate;
const data = () => parseBif(bif());
const ui = () => f.trace().call('ui-compile', () => require('./brand-forms.test.cjs'));
const fixture = { ...f, p, data, ui,
  stats: () => ({ created: p.imageState.created, sourceReleases: p.imageState.sourceReleases, bitmapReleases: p.imageState.bitmapReleases,
    bytes: sources.map(s => [...s.bytes]), decoded: p.imageState.decoded.map(o => ({ desiredSize: { ...o.desiredSize }, editable: o.editable })), maps: maps.map(m => ({ released: m.released })) }),
  blockBitmap() { gate = h.deferred(); p.imageState.defer = gate.promise; return gate; },
  async lower() { const value = await f.observed(decodePoster(data().bytes.slice(data().frames[1].offset, data().frames[1].end), 640, () => true)); if (value.value) await value.value.release(); await f.settle(); return value; },
  preview() { const published = [], preview = new TrickplayPreview((map, time) => published.push({ map, time })); previews.push(preview); preview.set(data()); return { preview, published, request: pos => preview.request(pos, 90000) }; },
  page() {
    const u = ui(), seeks = [], page = f.trace().call('ui-render', () => u.render('Player', { route: { item: { Id: 'movie', Type: 'Movie' }, sources: [], offline: false }, alive: true, visible: true, state: 'playing', duration: 90000, playbackPosition: 10000, immersive: true, controlsVisible: true, locked: false, trickplayPreview: TrickplayPreview, controller: { seek: value => seeks.push(value), pause() {} } }));
    previews.push(page.view.preview); page.view.preview.set(data());
    return { ...page, seeks, request: pos => u.flat(page.roots).find(n => n.type === 'Slider').attrs.onChange[0](pos, 1),
      image() { page.view.initialRender(); return u.flat(page.roots).filter(n => n.type === 'Image' && n.attrs.accessibilityText?.[0] === 'app.string.player_trickplay_frame').at(-1); } };
  },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    p.reset(); previews = []; sources = []; maps = []; gate = undefined;
    api.createImageSource = bytes => f.trace().call('image-source', () => {
      if (process.argv.includes('--native-image-init-failure')) throw Object.assign(Error('injected native image initializer failure'), { code: 'EIO', contractInjected: true });
      const source = create(bytes), entry = { source, bytes: new Uint8Array(bytes), release: source.release.bind(source), released: false }; sources.push(entry);
      const info = source.getImageInfo.bind(source), bitmap = source.createPixelMap.bind(source);
      source.getImageInfo = async () => f.trace().call('image-info', () => info());
      source.createPixelMap = async options => f.trace().call('bitmap-create', async () => {
        if (process.argv.includes('--native-bitmap-init-failure')) throw Object.assign(Error('injected native bitmap initializer failure'), { code: 'EIO', contractInjected: true });
        const value = await bitmap(options), item = { value, release: value.release.bind(value), released: false }; maps.push(item);
        value.release = async () => f.trace().call('bitmap-release', async () => { await item.release(); item.released = true; }); return value;
      }, { width: options.desiredSize.width, height: options.desiredSize.height });
      source.release = async () => f.trace().call('image-source-release', async () => { await entry.release(); entry.released = true; }); return source;
    });
    try { await test.action(check); }
    finally { gate?.resolve(); previews.forEach(preview => preview.clear()); await f.settle(); for (const m of maps) if (!m.released) await m.release(); for (const s of sources) if (!s.released) await s.release(); api.createImageSource = create; }
  } })))
};
module.exports = fixture;
