const f = require('./home-contract-fixture.cjs'), { assert, h, A, ProgressiveHome, client, media, view, page, response, settle } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
function seed(count) {
  if (!count) return [];
  if (count === 1) { A.snapshot = h.snapshot([media('cached')]); return [{ id: 'cached', kind: 'cached', name: '', libraryId: '', items: [media('cached')] }]; }
  const ids = ['b', 'a', 'removed'], items = ids.map(id => media('cached-' + id)), libraries = ids.map(id => view(id, 'movies'));
  A.snapshot = h.snapshot(items, libraries, ids.map(id => ({ libraryId: id, itemIds: ['cached-' + id] })));
  return ids.map((id, i) => ({ id: 'library-' + id, kind: 'cached', name: libraries[i].Name, libraryId: id, collectionType: 'movies', items: [items[i]] }));
}
function start(entry, c, preview) {
  if (entry === 'Index') { const p = h.page({ tab: 1 }), operation = p.load(); return { loader: p.homeLoader, operation, p, sections: () => p.homeSections }; }
  const updates = [], loader = new ProgressiveHome(c, u => updates.push(u));
  return { loader, operation: loader.start(preview), updates, sections: () => updates.at(-1).sections };
}
for (const entry of ['progressive', 'Index']) for (const count of [0, 1, 3]) test(`${entry} initial request set with ${count} cached shelves`, async check => {
  const c = client(), preview = seed(count), gates = Object.fromEntries(['resume', 'nextup', 'views'].map(k => [k, h.deferred()]));
  f.provider((phase, url) => gates[phase] ? gates[phase].promise : response([media('live-' + url.searchParams.get('parentId'))]));
  const r = start(entry, c, preview); await settle();
  const initial = f.requests().map(v => v.phase), initialSections = r.sections().map(s => s.id), refs = r.loader.requests.slice(), initialPending = [...r.loader.pending];
  gates.views.resolve(response(page([view('a', 'movies'), view('b', 'movies')]))); await settle();
  const published = r.sections().map(s => s.id), requests = r.loader.requests.slice(), phases = f.requests().map(v => v.phase), latest = f.requests().filter(v => v.phase === 'latest').map(v => [v.url.searchParams.get('parentId'), v.url.searchParams.get('limit')]);
  gates.resume.resolve(response(page([media('resume-live')]))); gates.nextup.resolve(response(page([media('nextup-live')]))); await r.operation;
  check(() => { assert.deepEqual(initial, ['resume', 'nextup', 'views']); assert.deepEqual(initialPending, ['resume', 'nextup', 'libraries']); assert.deepEqual(initialSections, preview.map(s => s.id)); assert.deepEqual(phases, ['resume', 'nextup', 'views', 'latest', 'latest']); assert.deepEqual(latest, [['a', '12'], ['b', '12']]); assert.deepEqual(published, ['library-a', 'library-b']); assert.deepEqual(requests.map(v => v.id), ['resume', 'nextup', 'libraries', 'library-a', 'library-b']); assert.ok(requests.slice(0, 3).every((v, i) => v === refs[i])); assert.deepEqual(r.sections().map(s => s.id), ['resume', 'nextup', 'library-a', 'library-b']); if (r.p) { assert.equal(r.p.message, ''); assert.deepEqual(r.p.homeFailures, []); } });
});
for (const entry of ['progressive', 'Index']) test(`${entry} empty views retires cached shelves`, async check => {
  const c = client(), preview = seed(3); f.provider(phase => phase === 'views' ? response(page([])) : response(page([media(phase)])));
  const r = start(entry, c, preview); await r.operation;
  check(() => { assert.deepEqual(r.sections().map(v => v.id), ['resume', 'nextup']); assert.deepEqual(r.loader.requests.map(v => v.id), ['resume', 'nextup', 'libraries']); assert.equal(f.requests().filter(v => v.phase === 'latest').length, 0); });
});
for (const target of ['resume', 'nextup']) test(`initial ${target} retry retains request after views`, async check => {
  const c = client(), preview = seed(3); let count = 0;
  f.provider((phase, url) => phase === target && count++ === 0 ? response({}, 500) : phase === 'views' ? response(page([view('a', 'movies')])) : phase === 'latest' ? response([media('live-a')]) : response(page([media(phase)])));
  const r = start('progressive', c, preview), refs = r.loader.requests.slice(0, 3); await r.operation; const failure = r.updates.at(-1).failures.map(e => ({ id: e.id, message: e.message }));
  r.loader.retry(target); await settle();
  check(() => { assert.deepEqual(failure, [{ id: target, message: 'http_failed:500' }]); assert.deepEqual(r.updates.at(-1).failures, []); assert.equal(f.requests().filter(v => v.phase === target).length, 2); assert.ok(r.loader.requests.slice(0, 3).every((v, i) => v === refs[i])); assert.deepEqual(r.sections().map(v => v.id), ['resume', 'nextup', 'library-a']); });
});
test('views failure keeps cache order and retry replaces the prefix once', async check => {
  const c = client(), preview = seed(3); let count = 0;
  f.provider((phase, url) => phase === 'views' ? count++ === 0 ? response({}, 500) : response(page([view('a', 'movies'), view('b', 'movies')])) : phase === 'latest' ? response([media('live-' + url.searchParams.get('parentId'))]) : response(page([])));
  const r = start('progressive', c, preview); await r.operation; const before = { ids: r.sections().map(v => v.id), errors: r.updates.at(-1).failures.map(v => v.message), latest: f.requests().filter(v => v.phase === 'latest').length }; r.loader.retry('libraries'); await settle();
  check(() => { assert.deepEqual(before, { ids: ['library-b', 'library-a', 'library-removed'], errors: ['http_failed:500'], latest: 0 }); assert.deepEqual(r.sections().map(v => v.id), ['library-a', 'library-b']); assert.deepEqual(r.loader.requests.map(v => v.id), ['resume', 'nextup', 'libraries', 'library-a', 'library-b']); assert.equal(f.requests().filter(v => v.phase === 'views').length, 2); assert.deepEqual(r.updates.at(-1).failures, []); });
});
test('successful views refresh preserves only initial objects and new library order', async check => {
  const c = client(), preview = seed(3); let libraries = [view('a', 'movies'), view('b', 'movies')];
  f.provider((phase, url) => phase === 'views' ? response(page(libraries)) : phase === 'latest' ? response([media('live-' + url.searchParams.get('parentId'))]) : response(page([media(phase)])));
  const r = start('progressive', c, preview), initial = r.loader.requests.slice(0, 3); await r.operation;
  libraries = [view('b', 'movies'), view('a', 'movies')]; r.loader.retry('libraries'); await settle();
  check(() => { assert.deepEqual(r.loader.requests.map(v => v.id), ['resume', 'nextup', 'libraries', 'library-b', 'library-a']); assert.ok(initial.every((v, i) => r.loader.requests[i] === v)); assert.deepEqual(r.sections().map(v => v.id), ['resume', 'nextup', 'library-b', 'library-a']); assert.deepEqual(f.requests().filter(v => v.phase === 'latest').map(v => v.url.searchParams.get('parentId')), ['a', 'b', 'b', 'a']); });
});
test('cancelled initial requests cannot enqueue libraries or publish late data', async check => {
  const c = client(), preview = seed(3), gates = Object.fromEntries(['resume', 'nextup', 'views'].map(k => [k, h.deferred()])); f.provider(phase => gates[phase].promise);
  const r = start('progressive', c, preview); await settle(); r.loader.cancel(); await r.operation; const n = r.updates.length;
  gates.views.resolve(response(page([view('late', 'movies')]))); gates.resume.resolve(response(page([media('late-resume')]))); gates.nextup.resolve(response(page([media('late-nextup')]))); await settle();
  check(() => { assert.equal(r.updates.length, n); assert.deepEqual(f.requests().map(v => v.phase), ['resume', 'nextup', 'views']); });
});
test('Index new client owns home after old initial responses arrive late', async check => {
  const c = client(), preview = seed(3), gates = Object.fromEntries(['resume', 'nextup', 'views'].map(k => [k, h.deferred()])); f.provider(phase => gates[phase].promise);
  const r = start('Index', c, preview); await settle(); client(); f.provider((phase, url) => phase === 'views' ? response(page([view('new', 'movies')])) : phase === 'latest' ? response([media('new-library')]) : response(page([media('new-' + phase)])));
  await r.p.load(); const before = JSON.stringify(r.p.homeSections);
  gates.views.resolve(response(page([view('old', 'movies')]))); gates.resume.resolve(response(page([media('old-resume')]))); gates.nextup.resolve(response(page([media('old-nextup')]))); await r.operation; await settle();
  check(() => { assert.equal(JSON.stringify(r.p.homeSections), before); assert.deepEqual(r.p.homeSections.map(v => v.id), ['resume', 'nextup', 'library-new']); assert.equal(f.requests().some(v => v.phase === 'latest' && v.url.searchParams.get('parentId') === 'old'), false); assert.equal(r.p.message, ''); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
