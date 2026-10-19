// Real query/page lifecycle methods with explicit HTTP fixtures. No native UI/server claim.
const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const { AppService } = h.load('service/AppService.ets');
const { searchPage, browseParams, cachedItems } = h.load('utils/Browse.ts');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const item = (id, type = 'Movie', name = 'Island') => ({ Id: id, Type: type, Name: name });
const ids = values => Array.from(values, i => i.Id);
const value = (params, key) => params.find(p => p.key === key)?.value;
function page(props = {}) {
  h.activate(); return h.page({ locked: false, signedIn: true, mode: 'search', searchExpanded: true, search: 'Island', searchQuery: 'Island', ...props });
}
test('every same-name identity keeps its server order through page admission', () => {
  const values = searchPage([], [item('e', 'Episode'), item('m2'), item('s', 'Series'), item('m1')], 4);
  assert.deepEqual(ids(values), ['e', 'm2', 's', 'm1']);
});
for (const type of ['', 'Movie', 'Series', 'Episode']) test('server search type is query-scoped: ' + (type || 'all'), () => {
  const p = browseParams('search', ' Island ', '', '', 'DatePlayed', true, '', type);
  assert.equal(value(p, 'IncludeItemTypes'), type || 'Movie,Series,Episode');
  assert.equal(value(p, 'SearchTerm'), 'Island'); assert.equal(value(p, 'SortBy'), 'SortName');
  assert.equal(value(browseParams('favorites', '', '', '', '', false, '', type), 'IncludeItemTypes'), 'Movie,Series,Episode');
});
test('offline type and case-insensitive query filter the whole account cache', () => {
  const s = h.snapshot([item('m'), item('s', 'Series'), item('e', 'Episode'), item('other', 'Episode', 'Ocean')]);
  assert.deepEqual(ids(cachedItems(s, 'search', 'isLAND', '', '', 'SortName', false, 'Episode')), ['e']);
  assert.deepEqual(ids(cachedItems(s, 'search', 'Island', '', '', 'SortName', false, 'unsupported')), ['e', 'm', 's']);
});
test('page validation preserves raw loaded offset and admits final/empty results', () => {
  assert.deepEqual(ids(searchPage([item('m')], [item('e', 'Episode')], 2)), ['m', 'e']);
  assert.deepEqual(ids(searchPage([], [], 0)), []);
});
test('real generated HTTP query loads 60 then 1 with independent type sections', async () => {
  const p = page(); const values = Array.from({ length: 61 }, (_, i) => item('id' + i, ['Movie', 'Series', 'Episode'][i % 3]));
  h.queue.push(h.response({ Items: values.slice(0, 60), TotalRecordCount: 61 }), h.response({ Items: values.slice(60), TotalRecordCount: 61 }));
  await p.load(); assert.equal(p.items.length, 60); assert.equal(p.total, 61);
  await p.load(true); assert.equal(p.items.length, 61); assert.equal(p.total, 61);
  const url = new URL(h.requests.at(-1).url); assert.equal(url.searchParams.get('startIndex'), '60'); assert.equal(url.searchParams.get('limit'), '60');
  assert.equal(url.searchParams.get('searchTerm'), 'Island'); assert.deepEqual(['Movie', 'Series', 'Episode'].map(type => p.items.filter(i => i.Type === type).length), [21, 20, 20]);
});
for (const [name, current, incoming, total, type] of [
  ['duplicate page', [], [item('a'), item('a')], 2], ['overlap', [item('a')], [item('a')], 2],
  ['empty gap', [], [], 20], ['decreased count', [item('a')], [item('b')], 1],
  ['wrong type', [], [item('a')], 1, 'Episode'], ['unsupported type', [], [item('a', 'Person')], 1],
  ['invalid count', [], [item('a')], NaN]
]) test('broken search page is rejected: ' + name, () => assert.throws(() => searchPage(current, incoming, total, type), /api_response_invalid/));
test('append uses submitted query and a single global offset even after input is edited', async () => {
  const p = page({ search: 'Unsubmitted edit', items: [item('m')], total: 2 }); let params;
  AppService.client.items = async query => { params = query; return { Items: [item('e', 'Episode')], TotalRecordCount: 2 }; };
  await p.load(true);
  assert.equal(value(params, 'SearchTerm'), 'Island'); assert.equal(value(params, 'StartIndex'), '1');
  assert.equal(value(params, 'Limit'), '60'); assert.deepEqual(ids(p.items), ['m', 'e']);
});
test('changing type requests page zero and clears the previous type results', async () => {
  const p = page({ items: [item('m')], total: 200 }); let params;
  AppService.client.items = async query => { params = query; return { Items: [item('e', 'Episode')], TotalRecordCount: 61 }; };
  await p.changeSearchType(3);
  assert.equal(p.searchType, 'Episode'); assert.equal(value(params, 'IncludeItemTypes'), 'Episode');
  assert.equal(value(params, 'StartIndex'), '0'); assert.equal(p.total, 61); assert.deepEqual(ids(p.items), ['e']);
});
test('busy, PIN, signed-out and invalid type selections cannot issue a query', async () => {
  for (const props of [{ busy: true }, { locked: true }, { signedIn: false }]) {
    const p = page(props); let calls = 0; AppService.client.items = async () => { calls++; };
    await p.changeSearchType(3); assert.equal(calls, 0); assert.equal(p.searchType, '');
  }
  const p = page(); for (const index of [-1, 4, 1.1, NaN]) await p.changeSearchType(index);
  assert.equal(p.searchType, '');
});
test('failed/duplicate append keeps list and offset available for an exact retry', async () => {
  const p = page({ items: [item('m')], total: 2 }); const starts = []; let calls = 0;
  AppService.client.items = async params => { starts.push(value(params, 'StartIndex')); return { Items: [item(calls++ ? 'e' : 'm', calls > 1 ? 'Episode' : 'Movie')], TotalRecordCount: 2 }; };
  await p.load(true); assert.deepEqual(ids(p.items), ['m']); assert.equal(p.total, 2); assert.ok(p.message);
  await p.load(true); assert.deepEqual(ids(p.items), ['m', 'e']); assert.deepEqual(starts, ['1', '1']);
});
for (const action of ['hide', 'account', 'close', 'query']) test('late result cannot publish after ' + action, async () => {
  const p = page(); const pending = h.deferred(); AppService.client.items = () => pending.promise;
  const loading = p.load();
  if (action === 'hide') p.onPageHide();
  else if (action === 'account') h.activate('other');
  else if (action === 'close') p.switchTab(4);
  else { p.searchQuery = 'Ocean'; AppService.client.items = async () => ({ Items: [item('new')], TotalRecordCount: 1 }); await p.load(); }
  pending.resolve({ Items: [item('old')], TotalRecordCount: 1 }); await loading;
  assert.ok(!ids(p.items).includes('old')); if (action === 'query') assert.deepEqual(ids(p.items), ['new']);
});
test('manual offline type change uses cache without an HTTP request', async () => {
  const p = page(); AppService.snapshot = h.snapshot([item('m'), item('e', 'Episode')]);
  AppService.experience = { snapshot: () => ({ offline: true, pending: [], positions: [] }) };
  AppService.client.items = () => { throw new Error('must not query offline'); };
  await p.changeSearchType(3); assert.deepEqual(ids(p.items), ['e']); assert.equal(p.usingCache, true); assert.equal(p.total, 1);
});
test('account reset and closing search clear submitted query and type', () => {
  const p = page({ searchType: 'Episode' }); p.resetAccountState(); assert.equal(p.searchQuery, ''); assert.equal(p.searchType, '');
  p.searchQuery = 'Island'; p.searchType = 'Movie'; p.load = () => {}; p.switchTab(4); assert.equal(p.searchQuery, ''); assert.equal(p.searchType, '');
});
if (require.main === module) (async () => {
  for (const [name, fn] of tests) { h.reset(); await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} search section regressions passed. Explicit HTTP/cache fixtures do not prove native layouts or real Jellyfin.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
