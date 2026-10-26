// Compatibility URL construction uses the real client and generated API, without pretending to perform HTTP.
const f = require('./catalog-contract-fixture.cjs').make('legacy-image');
module.exports = { ...f,
  url(version, id, tag, backdrop) {
    const client = f.client(version, !version);
    const value = f.trace().call('url-build', () => client.image(id, tag, backdrop));
    return f.trace().call('url-parse', () => new URL(value));
  },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) { await test.action(check); } })))
};
