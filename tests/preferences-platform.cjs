// File-backed stand-in for native Preferences. It tests the application's put/flush contract, not SDK XML.
const fs = require('node:fs');
const path = require('node:path');
function install(platform, directory) {
  require('./security-platform.cjs').install(platform);
  require('./captions-platform.cjs').install(platform);
  if (!platform.has('@ohos.resourceschedule.backgroundTaskManager')) { platform.set('@ohos.resourceschedule.backgroundTaskManager', { BackgroundMode: { DATA_TRANSFER: 1, AUDIO_PLAYBACK: 2 } }); }
  if (!platform.has('@ohos.app.ability.wantAgent')) { platform.set('@ohos.app.ability.wantAgent', {}); }
  const state = { calls: [], instances: new Map(), failOpen: false, failGet: false, failPut: 0, failFlush: 0, flushWait: undefined };
  const api = { async getPreferences(context, options) {
    state.calls.push(['open', options.name]);
    if (state.failOpen) throw Error('open failed');
    const filename = path.join(context.filesDir || directory, options.name + '.fixture.json');
    if (!state.instances.has(filename)) {
      const instance = {
        filename, values: fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {},
        async get(key, fallback) { state.calls.push(['get', key]); if (state.failGet) throw Error('read failed'); return this.values[key] ?? fallback; },
        async put(key, value) { state.calls.push(['put', key, value]); if (state.failPut-- > 0) throw Error('put failed'); this.values[key] = value; },
        async flush() {
          state.calls.push(['flush']); if (state.flushWait) await state.flushWait;
          if (state.failFlush-- > 0) throw Error('flush failed');
          fs.mkdirSync(path.dirname(filename), { recursive: true });
          fs.writeFileSync(filename + '.tmp', JSON.stringify(this.values)); fs.renameSync(filename + '.tmp', filename);
        }
      };
      state.instances.set(filename, instance);
    }
    return state.instances.get(filename);
  } };
  platform.set('@ohos.data.preferences', api);
  return { state, api, reset() {
    state.calls.length = 0; state.instances.clear(); state.failOpen = state.failGet = false; state.failPut = state.failFlush = 0; state.flushWait = undefined;
    const filename = path.join(directory, 'playback_languages.fixture.json'); fs.rmSync(filename, { force: true });
  } };
}
module.exports = { install };
