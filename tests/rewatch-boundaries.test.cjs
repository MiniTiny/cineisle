const f = require('./rewatch-fixture.cjs');
const { assert, h, A, playedRecommendations, observed, ids, movie, client, random, response, queue, page, paths, params, state } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
for (const count of [0, 1, 14, 15, 16]) test('rewatch fallback size ' + count, check => {
  const input = Array.from({ length: count }, (_, i) => movie(i)), before = [...input];
  const value = playedRecommendations([], input);
  const expected = count === 0 ? [] : Array.from({ length: Math.min(count - 1, 15) }, (_, i) => String(i + 1)).concat(count <= 15 ? ['0'] : []);
  check(() => { assert.deepEqual(ids(value), expected); assert.equal(state().randomCalls, Math.max(0, count - 1)); assert.deepEqual(input, before); });
});
test('rewatch strict watched filtering precedes stable deduplication', check => {
  const first = movie('a', true, { Name: 'first watched' });
  const groups = [movie('a', false), first, movie('a', true, { Name: 'later' }), movie('b', 1), movie('c', 'true'), movie('d', null), movie('e', true, { UserData: undefined })];
  const value = playedRecommendations(groups, [movie('fallback')]);
  check(() => { assert.deepEqual(value, [first]); assert.strictEqual(value[0], first); assert.equal(state().randomCalls, 0); });
});
test('rewatch fallback filters and deduplicates before shuffling', check => {
  const a = movie('a'), b = movie('b'), c = movie('c'), d = movie('d');
  random([.75, 0, .5]);
  const input = [movie('skip', false), a, b, movie('a'), c, d], original = [...input];
  const value = playedRecommendations([movie('plugin-unwatched', false)], input);
  check(() => { assert.deepEqual(value, [c, b, a, d]); assert.equal(state().randomCalls, 3); assert.deepEqual(input, original); });
});
test('rewatch high random value retains Fisher Yates self swaps', check => {
  random(() => .9999999999999999); const value = playedRecommendations([], ['a', 'b', 'c', 'd'].map(id => movie(id)));
  check(() => { assert.deepEqual(ids(value), ['a', 'b', 'c', 'd']); assert.equal(state().randomCalls, 3); });
});
test('rewatch fractional draws preserve floor and descending swap order', check => {
  random([.6, .4, .2]); const value = playedRecommendations([], ['a', 'b', 'c', 'd'].map(id => movie(id)));
  check(() => { assert.deepEqual(ids(value), ['d', 'a', 'b', 'c']); assert.equal(state().randomCalls, 3); });
});
test('rewatch plugin output is uncapped and bypasses fallback random', check => {
  const groups = Array.from({ length: 43 }, (_, i) => movie(i));
  const value = playedRecommendations(groups, [movie('fallback')]);
  check(() => { assert.deepEqual(value, groups); assert.equal(value.length, 43); assert.equal(state().randomCalls, 0); });
});
for (const version of ['10.8.13', '10.10.0']) for (const cold of [false, true]) {
  const label = `${version} ${cold ? 'cold' : 'warm'}`;
  test('rewatch plugin actual parameters ' + label, async check => {
    const c = client(version, cold); if (cold) queue(response({ Id: 'server', Version: version }));
    queue(response([{ Items: [movie('a'), movie('not', false)] }, { Items: [movie('a'), movie('b')] }]));
    const result = await observed(c.recommend()), query = params();
    check(() => {
      assert.ifError(result.error); assert.deepEqual(ids(result.value), ['a', 'b']);
      assert.equal(query.get('categoryLimit'), '5'); assert.equal(query.get('itemLimit'), '8'); assert.equal(query.get('fields'), 'People'); assert.equal(query.get('userId'), 'a');
      assert.deepEqual(paths(), [...(cold ? ['/jellyfin/System/Info/Public'] : []), '/jellyfin/Movies/Recommendations']);
      assert.equal(state().randomCalls, 0); assert.equal(h.queue.length, 0);
    });
  });
  test('rewatch fallback actual parameters ' + label, async check => {
    const c = client(version, cold); if (cold) queue(response({ Id: 'server', Version: version }));
    queue(response([{ Items: [movie('not', false)] }]), response(page(Array.from({ length: 16 }, (_, i) => movie(i)))));
    const result = await observed(c.recommend()), query = params();
    check(() => {
      assert.ifError(result.error); assert.deepEqual(ids(result.value), Array.from({ length: 15 }, (_, i) => String(i + 1)));
      assert.equal(query.get('limit'), '100'); assert.equal(query.get('isPlayed'), 'true'); assert.equal(query.get('sortBy'), 'DatePlayed'); assert.equal(query.get('sortOrder'), 'Descending'); assert.equal(query.get('includeItemTypes'), 'Movie');
      assert.equal(state().randomCalls, 15); assert.deepEqual(state().trace, [...(cold ? ['version'] : []), 'plugin', 'fallback', ...Array(15).fill('random')]); assert.equal(h.queue.length, 0);
      assert.equal(paths().at(-1), '/jellyfin/Items');
    });
  });
}
for (const [label, plugin] of [['empty', []], ['missing items', [{}]], ['null group', [null]], ['not array', {}], ['partial malformed', [{ Items: [movie('partial')] }, { Items: {} }]]]) test('rewatch plugin fallback ' + label, async check => {
  const c = client(); queue(response(plugin), response(page([movie('fallback')])));
  const result = await observed(c.recommend());
  check(() => { assert.ifError(result.error); assert.deepEqual(ids(result.value), ['fallback']); assert.deepEqual(state().trace, ['plugin', 'fallback']); });
});
for (const status of [401, 403, 404, 500]) test('rewatch optional plugin status ' + status, async check => {
  const c = client(); queue(response({}, status), response(page([movie('fallback')])));
  const result = await observed(c.recommend());
  check(() => { assert.ifError(result.error); assert.deepEqual(ids(result.value), ['fallback']); assert.deepEqual(state().trace, ['plugin', 'fallback']); });
});
for (const [status, message] of [[401, 'login_expired'], [403, 'permission_denied'], [500, 'http_failed:500']]) test('rewatch fallback error propagates ' + status, async check => {
  const c = client(); queue(response([]), response({}, status)); const result = await observed(c.recommend());
  check(() => { assert.equal(result.error?.message, message); assert.deepEqual(state().trace, ['plugin', 'fallback']); assert.equal(state().randomCalls, 0); });
});
test('rewatch version failure remains outside optional plugin catch', async check => {
  const c = client('10.10.0', true); queue(response({}, 401), response([{ Items: [movie('forbidden')] }])); const result = await observed(c.recommend());
  check(() => { assert.equal(result.error?.message, 'login_expired'); assert.deepEqual(state().trace, ['version']); });
});
test('rewatch fallback mapping failure propagates outside plugin catch', async check => {
  const c = client(); queue(response([]), response({ Items: {}, TotalRecordCount: 1 }));
  const result = await observed(c.recommend());
  check(() => { assert.equal(result.error?.message, 'api_response_invalid'); assert.deepEqual(state().trace, ['plugin', 'fallback']); });
});
test('rewatch fallback waits for the plugin result before making its request', async check => {
  const c = client(), gate = h.deferred(); queue(gate.promise, response(page([movie('fallback')])));
  const pending = observed(c.recommend());
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
  const stalled = state(); gate.resolve(response([])); const result = await pending;
  check(() => { assert.deepEqual(stalled.trace, ['plugin']); assert.ifError(result.error); assert.deepEqual(ids(result.value), ['fallback']); assert.deepEqual(state().trace, ['plugin', 'fallback']); });
});
test('rewatch real facade preserves uncapped plugin groups', async check => {
  const c = client(), values = Array.from({ length: 43 }, (_, i) => movie(i)); queue(response([{ Items: values }]), response(page([movie('forbidden-fallback')])));
  const result = await observed(c.recommend());
  check(() => { assert.ifError(result.error); assert.deepEqual(ids(result.value), ids(values)); assert.equal(state().randomCalls, 0); assert.deepEqual(state().trace, ['plugin']); });
});
test('rewatch Index load uses production facade and fallback', async check => {
  client(); queue(response([]), response(page(Array.from({ length: 16 }, (_, i) => movie(i)))));
  const p = h.page({ tab: 0, discover: false }); await p.load();
  check(() => { assert.deepEqual(ids(p.items), Array.from({ length: 15 }, (_, i) => String(i + 1))); assert.equal(p.total, 15); assert.equal(p.busy, false); assert.equal(p.message, ''); assert.equal(params().get('limit'), '100'); });
});
for (const [status, key] of [[401, 'login_expired'], [403, 'permission_denied'], [500, 'http_failed']]) test('rewatch Index error display ' + status, async check => {
  client(); queue(response([]), response({}, status)); const p = h.page({ tab: 0, discover: false }); await p.load();
  check(() => { assert.equal(p.message, status === 500 ? f.strings.text(key, 500) : f.strings.text(key)); assert.equal(p.busy, false); assert.deepEqual(p.items, []); });
});
test('rewatch old account response cannot publish or start a new request', async check => {
  const c = client(), gate = h.deferred(), oldRequest = h.platform.get('@ohos.net.http').createHttp;
  h.platform.get('@ohos.net.http').createHttp = () => {
    const connection = oldRequest(); return { ...connection, async request(url, options) { await gate.promise; return connection.request(url, options); } };
  };
  queue(response([{ Items: [movie('old')] }])); const p = h.page({ tab: 0, discover: false }), pending = p.load();
  h.activate('b'); gate.resolve(); await pending;
  check(() => { assert.deepEqual(p.items, []); assert.notStrictEqual(A.client, c); assert.deepEqual(state().trace, ['plugin']); });
});
test('rewatch late plugin miss retains old request scope but cannot publish', async check => {
  client(); const gate = h.deferred(); queue(gate.promise, response(page([movie('old-fallback')])));
  const p = h.page({ tab: 0, discover: false }), pending = p.load();
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
  h.activate('b'); gate.resolve(response([])); await pending;
  check(() => { assert.deepEqual(p.items, []); assert.equal(params().get('userId'), 'a'); assert.equal(A.client.session.userId, 'b'); assert.deepEqual(state().trace, ['plugin', 'fallback']); });
});
if (require.main === module) f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
