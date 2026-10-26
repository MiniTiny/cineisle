// Real facade, generated operations, transport and Index methods; only external HTTP/random are fixtures.
const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const { fixture, runCase } = require('./resource-cache-result.cjs');
const { AppService: A } = h.load('service/AppService.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { playedRecommendations } = h.load('utils/Protocol.ts');
const strings = h.load('utils/Strings.ets');
const http = h.platform.get('@ohos.net.http'), originalCreate = http.createHttp, originalRandom = Math.random;
let errors, calls, trace, randomCalls, selectedFault, randomSource, published;
const observed = promise => Promise.resolve(promise).then(value => ({ value }), error => ({ error }));
const ids = items => items.map(item => item.Id);
const movie = (id, played = true, extra = {}) => ({ ...h.film(String(id)), UserData: { Played: played }, ...extra });
function external(phase, operation, details = {}) {
  calls[phase] = (calls[phase] || 0) + 1; trace.push(phase);
  if (selectedFault === phase) {
    const error = Object.assign(Error('injected rewatch external failure: ' + phase), { code: 'EIO' });
    error.rewatchState = { version: 1, phase, calls: { ...calls }, randomCalls, injected: true, ...details };
    errors.push({ phase, error }); throw error;
  }
  const failed = error => { errors.push({ phase, error }); throw error; };
  try { const result = operation(); return result?.then ? result.catch(failed) : result; } catch (error) { return failed(error); }
}
async function healthy() { await fixture('rewatch-external', () => {
  if (!errors.length) return;
  if (!published) { console.error('REWATCH_EXTERNAL_STATE ' + JSON.stringify(errors[0].error.rewatchState)); published = true; }
  throw errors[0].error;
}); }
async function before() {
  h.reset(); strings.initializeStrings(h.context.resourceManager);
  errors = []; calls = {}; trace = []; randomCalls = 0; randomSource = () => 0; published = false;
  selectedFault = (process.argv.find(arg => arg.startsWith('--fault=')) || '').slice(8);
  if (selectedFault === 'setup') assert.fail('injected unrelated rewatch setup assertion');
  http.createHttp = () => {
    const connection = originalCreate();
    return { ...connection, request(url, options) {
      const pathname = new URL(url).pathname;
      const phase = pathname.endsWith('/System/Info/Public') ? 'version' : pathname.endsWith('/Movies/Recommendations') ? 'plugin' : 'fallback';
      return external(phase, () => connection.request(url, options), { pathname });
    } };
  };
  Math.random = () => external('random', () => { randomCalls++; return randomSource(randomCalls - 1); });
}
async function after() { http.createHttp = originalCreate; Math.random = originalRandom; }
function client(version = '10.10.0', cold = false) {
  const active = h.activate();
  const value = new JellyfinClient({ ...active.session }, cold ? '' : version); A.useClient(value); return value;
}
function random(source) { randomSource = typeof source === 'function' ? source : index => source[index]; }
function response(data, code = 200) { return { responseCode: code, result: JSON.stringify(data) }; }
function queue(...values) { h.queue.push(...values); }
function page(items) { return { Items: items, TotalRecordCount: items.length }; }
function paths() { return h.requests.map(r => new URL(r.url).pathname); }
function params(index = -1) { return new URL(h.requests.at(index).url).searchParams; }
async function run(tests) {
  const selected = process.argv[2], cases = selected ? tests.filter(t => t.name === selected) : tests;
  assert.ok(cases.length, 'No selected rewatch cases');
  for (const { name, action } of cases) {
    await runCase(name, async check => {
      const expectations = []; let failure;
      try { await action(fn => expectations.push(fn)); } catch (error) { failure = error; }
      await healthy(); if (failure) throw failure;
      assert.ok(expectations.length, 'No rewatch boundary reached');
      try { for (const expectation of expectations) check(expectation); } finally { await healthy(); }
    }, before, after);
    console.log('PASS ' + name);
  }
  console.log(`${cases.length} rewatch boundary tests passed. HTTP and random are fixtures; real Jellyfin/device acceptance is separate.`);
}
module.exports = { assert, h, A, strings, playedRecommendations, observed, ids, movie, client, random, response, queue, page, paths, params, run,
  state: () => ({ calls: { ...calls }, trace: [...trace], randomCalls }) };
