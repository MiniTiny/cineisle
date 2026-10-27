const assert = require('node:assert/strict');
const h = require('./feature-regression.test.cjs');
const common = require('./contract-external.cjs');
const { AppService: A } = h.load('service/AppService.ets');
const { JellyfinClient } = h.load('service/JellyfinClient.ets');
const { ProgressiveHome } = h.load('service/ProgressiveHome.ets');
const { loadHome, cachedHome } = h.load('service/HomeFeed.ets');
const strings = h.load('utils/Strings.ets');
const http = h.platform.get('@ohos.net.http'), originalCreate = http.createHttp;
let trace, requests, respond;
const media = id => h.film(id);
const view = (id, type) => ({ ...h.library(id), CollectionType: type });
const response = (value, status = 200) => ({ responseCode: status, result: JSON.stringify(value) });
const page = items => ({ Items: items, TotalRecordCount: items.length });
const phaseOf = pathname => pathname.endsWith('/System/Info/Public') ? 'version' : pathname.endsWith('/Resume') ? 'resume' : pathname.endsWith('/NextUp') ? 'nextup' : pathname.endsWith('/Latest') ? 'latest' : 'views';
async function before() {
  h.reset(); strings.initializeStrings(h.context.resourceManager);
  const fault = (process.argv.find(arg => arg.startsWith('--fault=')) || '').slice(8);
  trace = common.external('home', fault); requests = [];
  if (fault === 'setup') assert.fail('unrelated home setup assertion');
  respond = (phase, url) => phase === 'version' ? response({ Id: 'server', Version: '10.10.0' }) : phase === 'latest' ? response([media('latest-' + url.searchParams.get('parentId'))]) : phase === 'views' ? response(page([])) : response(page([media(phase)]));
  http.createHttp = () => {
    const connection = trace.call('create', () => {
      if (process.argv.includes('--native-init-failure')) throw Object.assign(Error('injected native HTTP initializer failure'), { code: 'EIO', contractInjected: true });
      return originalCreate();
    });
    return { ...connection, async request(address, options) {
      const url = trace.call('parse-url', () => new URL(address)), phase = phaseOf(url.pathname); requests.push({ url, options, phase });
      return trace.call(phase, () => respond(phase, url, options), { pathname: url.pathname });
    } };
  };
}
async function after() { http.createHttp = originalCreate; }
function client(version = '10.10.0', cold = false) {
  const active = h.activate();
  const c = new JellyfinClient({ ...active.session }, cold ? '' : version); A.useClient(c); return c;
}
const settle = async () => { for (let i = 0; i < 12; i++) await new Promise(setImmediate); };
const observed = promise => Promise.resolve(promise).then(value => ({ value }), error => ({ error }));
module.exports = { assert, h, A, ProgressiveHome, loadHome, cachedHome, strings, media, view, response, page, client, settle, observed,
  provider: fn => { respond = fn; }, requests: () => requests, trace: () => trace,
  run: tests => common.run(tests, 'home', before, after, () => trace.healthy()) };
