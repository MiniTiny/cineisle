const f = require('./legacy-image-contract-fixture.cjs'), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const version of ['10.8.9', '10.10.0', '']) for (const backdrop of [false, true]) for (const tag of ['', 'tag with / 字']) {
  test(`legacy image ${version || 'cold'} ${backdrop ? 'backdrop' : 'primary'} ${tag ? 'tagged' : 'untagged'}`, async check => {
    const url = f.url(version, 'movie/字', tag, backdrop);
    const actual = { path: url.pathname, width: url.searchParams.get('maxWidth'), quality: url.searchParams.get('quality'), tag: url.searchParams.get('tag'), reads: f.requests().length };
    check(() => {
      assert.equal(actual.path, '/jellyfin/Items/movie%2F%E5%AD%97/Images/' + (backdrop ? 'Backdrop/0' : 'Primary'));
      assert.equal(actual.width, backdrop ? '960' : '360'); assert.equal(actual.quality, '85');
      assert.equal(actual.tag, tag || null); assert.equal(actual.reads, 0);
    });
  });
}
if (require.main === module) f.run(tests).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = tests;
