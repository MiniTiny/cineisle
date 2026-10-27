const f = require('./resource-timeout-fixture.cjs').make('quick-secret'), { h } = f;
const { QuickConnectLogin } = h.load('service/QuickConnectLogin.ets');
let secret, gate, active, page, version;
const fixture = { ...f,
  initGate: value => { gate = value; },
  version: value => { version = value; },
  stats() { return { requests: f.requests().map(r => ({ path: r.url.pathname, method: r.options.method, tokenHeader: (r.options.header?.Authorization || '').includes('Token='), secretMatches: r.url.pathname.endsWith('/Connect') ? r.url.searchParams.get('secret') === secret : undefined })), storedLength: active?.secret.length || 0, bound: !!f.A.client, assets: h.assets.size }; },
  async start(mode, value) {
    secret = value;
    if (mode === 'facade') { active = new QuickConnectLogin(); return f.observed(active.begin('https://example.invalid/jellyfin')); }
    const u = f.trace().call('ui-compile', () => require('./brand-forms.test.cjs'));
    page = f.trace().call('ui-render', () => u.render('Accounts', { server: 'https://example.invalid/jellyfin', servers: [], adding: true, quickEntry: true, locked: false, quickConnect: QuickConnectLogin, strings: f.strings }));
    active = page.view.quick; await u.button(page, 'quick_connect_login').attrs.onClick[0](); await f.settle(); return { value: page.view.quickCode };
  },
  async invoke(mode, value, accepted) {
    const result = await this.start(mode, value); let pollError;
    if (accepted && !result.error && result.value) { if (mode === 'facade') pollError = (await f.observed(active.poll())).error; else { await page.view.checkQuick(); await f.settle(); } }
    return { ...result, pollError, message: page?.view.message, code: mode === 'facade' ? result.value : page?.view.quickCode, busy: page?.view.busy, ...this.stats() };
  },
  cancel(mode) { if (mode === 'facade') active.cancel(); else page.view.onPageHide(); },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    secret = ''; gate = active = page = undefined; version = '10.10.0';
    f.phaseFor(url => url.pathname.endsWith('/Enabled') ? 'quick-enabled' : url.pathname.endsWith('/Initiate') ? 'quick-initiate' : url.pathname.endsWith('/Connect') ? 'quick-state' : 'quick-auth');
    f.provider(url => {
      if (url.pathname.endsWith('/System/Info/Public')) return f.response({ Id: 'server', Version: version });
      if (url.pathname.endsWith('/Enabled')) return f.response(true);
      if (url.pathname.endsWith('/Initiate')) return gate ? gate.promise : f.response({ Code: 'ABC123', Secret: secret, Authenticated: false });
      if (url.pathname.endsWith('/Connect')) return f.response({ Code: 'ABC123', Secret: secret, Authenticated: false });
      throw Error('unexpected anonymous QuickConnect route');
    });
    try { await test.action(check); }
    finally { gate?.resolve(f.response({ Code: 'ABC123', Secret: secret, Authenticated: false })); page?.view.cancelQuick(); active?.cancel(); await f.settle(); }
  } })))
};
module.exports = fixture;
