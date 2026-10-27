// Real SystemPlayback/Controller/AV adapter; Session/PiP/AV APIs are explicit fixtures.
const f = require('./playback-rate-fixture.cjs').make('system-skip'), { h } = f;
const sessionAPI = h.platform.get('@ohos.multimedia.avsession'), pipAPI = h.platform.get('@ohos.PiPWindow');
const createSession = sessionAPI.createAVSession, createPiP = pipAPI.create;
module.exports = { ...f,
  async rig(kind, position = 30000) {
    const r = await f.system(); r.c.seek(position); r.s.sync(true); await h.settle();
    const player = h.nativePlayers.at(-1), seek = player?.seek.bind(player), controllerSeek = r.c.seek.bind(r.c), attempts = [];
    r.c.seek = value => { attempts.push(value); return controllerSeek(value); };
    if (player) { player.calls.length = 0; player.seek = value => f.trace().call('native-seek', () => seek(value)); }
    if (kind === 'pip') { await r.s.startPiP(); await h.settle(); }
    const window = h.systemPlatform.windows.at(-1);
    return { ...r, player, attempts,
      command: (event, amount) => f.trace().call('control-event', async () => {
        if (kind === 'session') await r.session?.emit(event, amount);
        else await window?.emit('controlPanelActionEvent', event, amount);
        await h.settle();
      }),
      snapshot: () => ({ position: r.c.snapshot().position, attempts: [...attempts], seeks: (player?.calls || []).filter(c => c[0] === 'seek').map(c => c[1]), published: r.session?.states.at(-1)?.position.elapsedTime, errors: [...r.errors] })
    };
  },
  run: tests => f.run(tests.map(test => ({ ...test, async action(check) {
    sessionAPI.createAVSession = (...args) => f.trace().call('native-session-create', async () => {
      if (process.argv.includes('--native-session-init-failure')) throw Object.assign(Error('injected native Session initializer failure'), { code: 'EIO', contractInjected: true });
      return createSession(...args);
    });
    pipAPI.create = (...args) => f.trace().call('native-pip-create', async () => {
      if (process.argv.includes('--native-pip-init-failure')) throw Object.assign(Error('injected native PiP initializer failure'), { code: 'EIO', contractInjected: true });
      return createPiP(...args);
    });
    try { await test.action(check); }
    finally { sessionAPI.createAVSession = createSession; pipAPI.create = createPiP; }
  } })))
};
