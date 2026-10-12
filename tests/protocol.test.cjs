// Runs the actual shared TypeScript logic without an emulator or npm installation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const sdk = process.env.DEVECO_CONTENTS || '/Applications/DevEco-Studio.app/Contents';
const ts = require(path.join(sdk, 'tools/hvigor/hvigor/node_modules/typescript'));
const root = path.resolve(__dirname, '../entry/src/main/ets');
const cache = new Map();
const platform = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} }; cache.set(file, module);
  const localRequire = id => {
    if (platform.has(id)) return platform.get(id);
    if (id.startsWith('.')) {
      const full = path.resolve(path.dirname(file), id);
      return load(fs.existsSync(full + '.ts') ? full + '.ts' : full + '.ets');
    }
    return createRequire(file)(id);
  };
  vm.runInThisContext(`(function(require, module, exports) {${js}\n})`, { filename: file })(localRequire, module, module.exports);
  return module.exports;
}
const p = load('utils/Protocol.ts');
const item = (id, count, people = [], played = true) => ({ Id: id, Name: id, Type: 'Movie', People: people, UserData: { PlayCount: count, Played: played } });
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
test('preserves Jellyfin reverse-proxy base path', () => assert.equal(p.normalizeServer(' https://example.org/jellyfin/// '), 'https://example.org/jellyfin'));
test('rejects missing scheme, embedded credentials, query and fragment', () => {
  for (const url of ['example.org', 'file:///etc/passwd', 'https://user:pw@server', 'https://server?api_key=a', 'https://server/#x', 'https://']) assert.throws(() => p.normalizeServer(url));
});
test('query safely encodes unicode and reserved characters', () => assert.equal(p.queryString([{ key: 'SearchTerm', value: '电影 & /#?' }]), 'SearchTerm=%E7%94%B5%E5%BD%B1%20%26%20%2F%23%3F'));
test('Jellyfin ticks use 100ns units, sanitize invalid progress', () => {
  assert.equal(p.secondsToTicks(12.25), 122500000);
  for (const n of [NaN, Infinity, -1]) assert.equal(p.secondsToTicks(n), 0);
});
test('cache namespace includes both server and user', () => {
  assert.notEqual(p.accountKey('server1', 'user1'), p.accountKey('server2', 'user1'));
  assert.notEqual(p.accountKey('server1', 'user1'), p.accountKey('server1', 'user2'));
  assert.throws(() => p.accountKey('../server', 'user1'));
  assert.throws(() => p.safeItemId('../movie'));
});
test('recommendations keep current Android played-only rule and deduplicate', () => {
  const result = p.playedRecommendations([item('a', 1), item('a', 1), item('b', 0, [], false)], []);
  assert.deepEqual(result.map(x => x.Id), ['a']);
});
test('recommendation fallback returns at most 15 unique watched films', () => {
  const candidates = Array.from({ length: 30 }, (_, i) => item(String(i), 1));
  candidates.push(item('unwatched', 0, [], false));
  const result = p.playedRecommendations([], candidates);
  assert.equal(result.length, 15); assert.equal(new Set(result.map(x => x.Id)).size, 15);
  assert.ok(result.every(x => x.UserData.Played));
});
test('actor order sums film and show play counts without duplicate roles', () => {
  const a = { Id: 'a', Name: 'A', Type: 'Actor' }, b = { Id: 'b', Name: 'B', Type: 'Actor' }, d = { Id: 'd', Name: 'Director', Type: 'Director' };
  const show = item('show', 5, [b]); show.Type = 'Series';
  const episode = item('episode', 100, [a]); episode.Type = 'Episode';
  const result = p.rankActors([item('movie', 2, [a, a, b, d]), show, episode]);
  assert.deepEqual(result.map(x => [x.person.Id, x.playCount, x.itemCount]), [['b', 7, 2], ['a', 2, 1]]);
});
const requests = [], queue = [];
let disposed = 0;
const method = { GET: 'GET', POST: 'POST', DELETE: 'DELETE' };
platform.set('@ohos.net.http', { RequestMethod: method, HttpDataType: { STRING: 'STRING' }, createHttp() {
  return { async request(url, options) { requests.push({ url, options }); const value = queue.shift(); if (value instanceof Error) throw value; return value; }, destroy() { disposed++; } };
}});
platform.set('@ohos.util', { generateRandomUUID: () => 'device-id' });
const { JellyfinClient } = load('service/JellyfinClient.ets');
const session = { server: 'https://server/jellyfin', userId: 'user-id', serverId: 'server-id', token: 'secret', deviceId: 'device-id' };
const client = new JellyfinClient(session, '10.10.0');
const response = (value, status = 200) => ({ responseCode: status, result: typeof value === 'string' ? value : JSON.stringify(value) });
test('API carries token in authorization header and retains base path', async () => {
  queue.push(response({ Items: [], TotalRecordCount: 0 })); await client.items([{ key: 'SearchTerm', value: 'a&b' }]);
  const call = requests.at(-1); assert.ok(call.url.startsWith('https://server/jellyfin/Items?'));
  assert.ok(call.url.includes('searchTerm=a%26b')); assert.ok(!call.url.includes('secret'));
  assert.ok(call.options.header.Authorization.includes('Token="secret"'));
});
test('rejects HTTP auth errors and HTML gateways; always closes HTTP client', async () => {
  for (const r of [response('', 401), response('', 403), response('<html>gateway</html>'), new Error('offline')]) {
    queue.push(r); const before = disposed; await assert.rejects(() => client.request('/x')); assert.equal(disposed, before + 1);
  }
});
test('server errors retain the HTTP failure message', async () => { queue.push(response('', 500)); await assert.rejects(() => client.request('/x'), /http_failed/); });
test('accepts 204 action responses', async () => { queue.push(response('', 204)); await client.favorite('movie', true); assert.equal(requests.at(-1).options.method, 'POST'); });
test('progress report uses Jellyfin session endpoint and tick conversion', async () => {
  queue.push(response('', 204)); await client.report('Progress', 'movie', 'source', 'play-session', 12.25, true);
  const call = requests.at(-1); assert.equal(call.url, 'https://server/jellyfin/Sessions/Playing/Progress');
  const body = JSON.parse(call.options.extraData); assert.equal(body.PositionTicks, 122500000); assert.equal(body.IsPaused, true); assert.equal(body.PlayMethod, 'DirectPlay');
});
test('direct-play stream encodes media source and auth query', () => {
  const url = client.stream('movie', 'a&source'); assert.ok(url.includes('static=true')); assert.ok(url.includes('mediaSourceId=a%26source')); assert.ok(url.includes('api_key=secret'));
});
(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(`${tests.length} tests passed. Platform mocks do not prove device playback.`);
})().catch(e => { console.error(e); process.exitCode = 1; });
