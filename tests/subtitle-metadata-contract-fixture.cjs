// Real OfflineSubtitles.plan, retrySubtitles/client/Transfer, file transactions and metadata reload.
const f = require('./catalog-contract-fixture.cjs').make('subtitle-metadata'), { h, A } = f;
const fs = require('node:fs'), path = require('node:path');
const { OfflineSubtitles } = h.load('service/OfflineSubtitles.ets');
const api = h.platform.get('@ohos.request'), doc = '1\n00:00:01,000 --> 00:00:02,000\nmetadata\n';
let record, client, options;
const fixture = { ...f,
  plan(streams) { return OfflineSubtitles.plan(record, { Id: 'source', MediaStreams: streams }, A.local.directory); },
  async retry(streams) {
    f.phaseFor(() => 'playback-info');
    f.provider(url => url.pathname.endsWith('/System/Info/Public') ? f.response({ Id: client.session.serverId, Version: '10.10.0' }) : f.response({ MediaSources: [{ Id: 'source', MediaStreams: streams }] }));
    const error = (await f.observed(A.retrySubtitles(record))).error;
    return { error, record: JSON.parse(JSON.stringify(record)), restored: A.local.downloads(), task: options, requests: f.requests().map(r => ({ method: r.options.method, path: r.url.pathname })) };
  },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    client = f.client('10.10.0', true); options = undefined;
    record = { id: 'movie', item: h.film('movie'), mediaSourceId: 'source', path: path.join(A.local.directory, 'movie.mp4'), state: 'complete', progress: 1, subtitleState: 'pending' };
    fs.writeFileSync(record.path, 'unchanged video'); A.downloads = [record];
    const original = { ...api }; h.capabilities.add('SystemCapability.Request.FileTransferAgent');
    api.agent = { Action: { DOWNLOAD: 1 }, Mode: { FOREGROUND: 1 }, Network: { ANY: 2, WIFI: 1 },
      create: (_context, value) => f.trace().call('subtitle-create', async () => {
        if (process.argv.includes('--native-subtitle-init-failure')) throw Object.assign(Error('injected native subtitle initializer failure'), { code: 'EIO', contractInjected: true });
        const filename = value.saveas || value.filePath; options = { filename: path.basename(filename) };
        const callbacks = {};
        return { tid: 'metadata-task', on: (name, callback) => { callbacks[name] = callback; }, async start() { fs.writeFileSync(filename, doc); queueMicrotask(() => callbacks.completed?.()); } };
      }), remove: () => f.trace().call('subtitle-remove', async () => true) };
    try { await test.action(check); }
    finally { for (const key of Object.keys(api)) if (!(key in original)) delete api[key]; Object.assign(api, original); await f.settle(); }
  } })))
};
module.exports = fixture;
