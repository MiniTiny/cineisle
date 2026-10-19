// Real SDK builders/callbacks. Layout geometry and touch are separate native checks.
const assert = require('node:assert/strict');
const { render, flat, button } = require('./brand-forms.test.cjs');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const items = [{ Id: 'e', Name: 'Island', Type: 'Episode' }, { Id: 'm', Name: 'Island', Type: 'Movie' }, { Id: 's', Name: 'Island', Type: 'Series' }];
const page = (props = {}, scale = 1) => render('Index', { ready: true, signedIn: true, mode: 'search', searchExpanded: true, searchQuery: 'Island', items, total: 80, ...props }, scale);
for (const [width, height, scale] of [[320, 700, 1], [320, 700, 2], [760, 360, 1], [760, 360, 2]]) test(`search ${width}x${height}vp/${scale}x uses one scrolling grid with nonempty type headings`, () => {
  const f = page({ viewportWidth: width, viewportHeight: height }, scale); const nodes = flat(f.roots);
  assert.equal(nodes.filter(n => n.type === 'Grid').length, 1);
  assert.equal(nodes.filter(n => n.type === 'Scroll').length, 0);
  assert.deepEqual(f.events.filter(e => e[0] === 'card').map(e => e[1]), ['m', 's', 'e']);
  assert.equal(nodes.filter(n => n.type === 'Text' && n.args[0] === 'app.string.search_group_count').length, 3);
  assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.search_group_partial'));
  assert.ok(button(f, 'load_more'));
});
test('native type selector binds a new server query instead of filtering the loaded page', async () => {
  let calls = 0; const f = page({ load: () => calls++ });
  const select = flat(f.roots).find(n => n.type === 'Select' && n.attrs.accessibilityText?.[0] === 'app.string.search_type');
  assert.equal(select.args[0].length, 4); await select.attrs.onSelect[0](3);
  assert.equal(f.view.searchType, 'Episode'); assert.equal(calls, 1); assert.equal(f.view.searchQuery, 'Island');
});
test('busy type selector is disabled and cannot change type', () => {
  const f = page({ busy: true }); const select = flat(f.roots).find(n => n.type === 'Select' && n.attrs.accessibilityText?.[0] === 'app.string.search_type');
  assert.equal(select.attrs.enabled[0], false); select.attrs.onSelect[0](3); assert.equal(f.view.searchType, '');
});
test('only nonempty groups render, complete pages hide partial note and load-more', () => {
  const f = page({ items: [items[0]], total: 1 }); const nodes = flat(f.roots);
  assert.equal(nodes.filter(n => n.type === 'Text' && n.args[0] === 'app.string.search_group_count').length, 1);
  assert.ok(!nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.search_group_partial'));
  assert.equal(button(f, 'load_more'), undefined);
});
test('network/auth error does not render an empty-success state', () => {
  for (const props of [{ message: 'permission_denied' }, { busy: true }]) {
    const f = page({ items: [], total: 0, ...props });
    assert.ok(!flat(f.roots).some(n => n.type === 'Text' && n.args[0] === 'app.string.no_items'));
    assert.ok(!flat(f.roots).some(n => n.type === 'Text' && n.args[0] === 'app.string.search_loaded_count'));
  }
  assert.ok(flat(page({ items: [], total: 0 }).roots).some(n => n.type === 'Text' && n.args[0] === 'app.string.no_items'));
});
test('offline counts explicitly refer to account cache and never imply server totals', () => {
  const f = page({ usingCache: true, total: 3 }); const nodes = flat(f.roots);
  assert.ok(nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.search_cached_count'));
  assert.ok(!nodes.some(n => n.type === 'Text' && n.args[0] === 'app.string.search_loaded_count'));
});
test('submission freezes the query while preserving the selected type and history flow', () => {
  let submitted, saved; const f = page({ search: ' Ocean ', searchType: 'Episode', load() { submitted = this.searchQuery; } });
  f.AppService.experience.search = v => { saved = v; };
  button(f, 'search_action').attrs.onClick[0]();
  assert.equal(submitted, 'Ocean'); assert.equal(saved, ' Ocean '); assert.equal(f.view.searchType, 'Episode');
  f.view.search = 'Unsubmitted'; assert.equal(f.view.searchQuery, 'Ocean');
});
(async () => { for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} search section UI regressions passed. SDK builder fixtures do not prove native geometry or real-server behavior.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
