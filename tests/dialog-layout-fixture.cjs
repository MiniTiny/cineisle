// Production ArkUI builders and callbacks; only platform and business I/O are stand-ins.
const assert = require('node:assert/strict');
const { external, run } = require('./contract-external.cjs');
let ui, trace, errorText;
const selectedFault = (process.argv.find(a => a.startsWith('--native-failure=')) || '').split('=')[1];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function platform({ expectedFailure, closeGate, errorMessage } = {}) {
  const events = [], contents = [], alerts = [], timers = [], toasts = [], passedOptions = [], calls = {};
  const enter = phase => {
    calls[phase] = (calls[phase] || 0) + 1;
    events.push(phase);
    console.error('DIALOG_NATIVE_ENTRY ' + JSON.stringify({ phase, call: calls[phase], failed: selectedFault === phase }));
  };
  // Expected error-path samples stay distinct from unrelated initialization failures.
  const observe = (phase, operation) => expectedFailure === phase ? (trace.call(phase, () => {}), operation()) : trace.call(phase, operation);
  const fail = () => Object.assign(Error('native dialog initialization failed'), { code: 'EIO' });
  const prompt = {
    openCustomDialog(content, options) { return observe('dialog-open', async () => {
      enter('dialog-open'); if (selectedFault === 'dialog-open') throw fail();
      if (expectedFailure === 'dialog-open') throw Error(errorMessage || 'dialog open failed: EIO');
      events.push(['opened', options]);
    }); },
    closeCustomDialog(content) { return observe('dialog-close', async () => {
      enter('dialog-close'); if (selectedFault === 'dialog-close') throw fail();
      if (closeGate) await closeGate.promise;
      if (expectedFailure === 'dialog-close') throw Error(errorMessage || 'dialog close failed: EIO');
      events.push('close-resolved');
    }); },
    showToast(value) { enter('toast'); toasts.push(value.message); }
  };
  const context = { fp2px: n => n, vp2px: n => n, px2vp: n => n,
    getPromptAction() { return observe('prompt-init', () => {
      enter('prompt-init'); if (selectedFault === 'prompt-init') throw fail(); return prompt;
    }); }, getFocusController: () => ({ clearFocus() {} }) };
  class ComponentContent {
    constructor(context, builder, data) { observe('content-create', () => {
      enter('content-create'); if (selectedFault === 'content-create') throw fail();
      this.data = data; this.disposed = 0; contents.push(this);
      // Execute the actual SDK-generated builder, including CompactDialog.actions.
      builder(data);
    }); }
    dispose() { return observe('content-dispose', () => {
      enter('content-dispose'); this.disposed++;
      if (expectedFailure === 'content-dispose') throw Error('dialog dispose failed: EIO');
    }); }
  }
  return { context, ComponentContent, events, contents, alerts, timers, toasts, calls, options: passedOptions,
    observeOptions(value) { passedOptions.push(value); },
    AlertDialog: { show(options) { return observe('native-alert', () => {
      enter('native-alert'); if (selectedFault === 'native-alert') throw fail(); alerts.push(options);
    }); } },
    setTimeout(callback, ms) { events.push(['timer', ms]); timers.push(callback); return timers.length; },
    flush() { while (timers.length) timers.shift()(); }
  };
}
const movie = { Id: 'movie', Name: 'Movie', Type: 'Movie', CanDownload: true, CanDelete: true, MediaSources: [{ Id: 'source' }] };
const episode = { ...movie, Id: 'episode', Type: 'Episode' };
const record = { id: 'movie', path: '/fixture/movie', state: 'complete', progress: 1, item: movie };
const entries = [
  ['account-remove', 'Accounts', 'remove_saved_account', { accounts: [{ key: 'saved', userName: 'Saved', active: false }] }, 'remove'],
  ['server-remove', 'Accounts', 'remove_saved_server', { editingId: 'server' }, 'removeServer'],
  ['accounts-reset', 'Accounts', 'reset_saved_accounts', {}, 'reset'],
  ['detail-download', 'Detail', 'download', { item: movie, loaded: true }, 'download'],
  ['detail-delete', 'Detail', 'server_delete', { item: movie, loaded: true }, 'deleteMedia'],
  ['detail-batch', 'Detail', 'download', { item: { Id: 'season', Name: 'Season', Type: 'Season' }, children: [episode], loaded: true, selectingEpisodes: true, selectedEpisodes: ['episode'] }, 'batchDownload'],
  ['downloads-remove', 'Downloads', 'remove_download', { category: 'complete', records: [record] }, 'removeDownload'],
  ['favorites-remove', 'Favorites', 'batch_unfavorite', { all: [movie], visibleItems: [movie], selected: ['movie'], selection: true }, 'edit'],
  ['posters-clear', 'Settings', 'poster_cache_clear', { deviceVisible: true, posterKnown: true }, 'posterClear'],
  ['index-reason', 'Index', null, { signedIn: true, tab: 0, items: [movie], discoveries: [{ item: movie, actors: ['Actor'], genres: ['Genre'] }] }, null],
  ['index-remove', 'Index', 'remove_download', { signedIn: true, mode: 'downloads', downloads: [record] }, 'removeDownload'],
  ['index-logout', 'Index', 'change_account', { signedIn: true, tab: 4 }, 'logout']
].map(([id, page, label, props, action]) => ({ id, page, label, props, action }));
function makePage(entry, width, height, options = {}) {
  const native = platform(options);
  const f = trace.call('page-render', () => ui.render(entry.page, { ...entry.props, viewportWidth: width, viewportHeight: height,
    busy: false, locked: false, errorText, dialogPlatform: native }, options.scale || 1));
  f.view.ownerClient = f.AppService.client; f.view.client = f.AppService.client;
  // Terminal I/O remains a business fixture; every page guard/action closure stays real.
  f.AppService.logout = async () => f.events.push(['logout']);
  if (options.businessFailure) {
    const fail = async () => { throw Error('business action failed: EIO'); };
    if (entry.action === 'posterClear') f.AppService.posters.clear = fail;
    else f.AppService[({remove:'removeAccount',reset:'resetAccounts'})[entry.action] || entry.action] = fail;
  }
  return { ...f, native, trigger() {
    return trace.call('page-entry', () => {
      if (entry.id === 'index-reason') {
        const card = f.childViews.find(v => v.props?.onReason);
        assert.ok(card, 'Production MediaCard reason callback missing'); return card.props.onReason(movie);
      }
      const button = ui.button(f, entry.label); assert.ok(button, 'Production button missing: ' + entry.id);
      assert.notEqual(button.attrs.enabled?.[0], false); return button.attrs.onClick[0]();
    });
  } };
}
function bottom(width, height, actions, options = {}) {
  const native = platform(options), data = { title: 'Title', message: 'Message', width, height, actions: [], choose() {}, release() {} };
  const f = trace.call('page-render', () => ui.render('CompactDialog', { data, errorText, dialogPlatform: native }));
  return { ...f, native, trigger() { return trace.call('dialog-entry', () => f.showBrandDialog(() => native.context,
    { title: 'Title', message: 'Message', buttons: actions }, width, height)); } };
}
function clickDialog(r, index) {
  const outer = ui.flat(r.roots).findLast(n=>n.attrs.id?.[0]==='CineIsleCompactDialog');
  const buttons = ui.flat(outer.children).filter(n=>n.type==='Button');
  assert.ok(buttons[index], 'Production CompactDialog button missing');
  return buttons[index].attrs.onClick[0]();
}
module.exports = { entries, makePage, bottom, settle, deferred, clickDialog, flat: value => ui.flat(value),
  run(tests) { return run(tests, 'dialog layout', async () => {
    trace = external('dialog-layout');
    if (process.argv.includes('--unrelated-setup-failure')) assert.fail('Unrelated SDK setup assertion');
    ui = require('./brand-forms.test.cjs');
    const host = require('./feature-regression.test.cjs'), strings = host.load('utils/Strings.ets');
    const stringsByName = Object.fromEntries(JSON.parse(require('node:fs').readFileSync('entry/src/main/resources/base/element/string.json','utf8')).string.map(v=>[v.name,v.value]));
    strings.initializeStrings({getStringByNameSync:name=>stringsByName[name]||name}); errorText = strings.errorText;
  }, async () => {}, () => trace.healthy()); }
};
