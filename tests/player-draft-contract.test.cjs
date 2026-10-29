const f = require('./catalog-contract-fixture.cjs').make('player-options'), { assert, h, A } = f;
const fs = require('node:fs'), path = require('node:path');
const tests = [], test = (name, action) => tests.push({ name, action });
const initial = () => ({ gestures: true, seek: true, zoom: true, startMaximized: false, back: 5000, forward: 15000, autoPiP: false, vertical: true, rememberBrightness: false, brightness: -1, dimOpacity: 0.6 });
const samples = [['12', 12000], ['123', 123000], ['001', 1000], ['0001', 1000], ['', undefined], [' ', undefined], [' 5', 5000], ['1e2', 100000], ['0x5', 5000], ['5.0', 5000], ['1.5', undefined], ['123\n', 123000], ['1\r\n', 1000], ['1\u2028', 1000], ['300', 300000], ['301', undefined]];
for (const [key, field, label] of [['back', 'seekBack', 'player_back_seconds'], ['forward', 'seekForward', 'player_forward_seconds']]) for (const [draft, expected] of samples) test('player draft actual ' + key + ' ' + JSON.stringify(draft), async check => {
  const client = f.client(); A.experience.update(state => { state.playerUi = initial(); });
  const filename = path.join(A.local.directory, 'experience.json'), beforeBytes = fs.readFileSync(filename, 'utf8'), before = JSON.parse(beforeBytes);
  const { render, flat, button } = f.trace().call('ui-compile', () => require('./brand-forms.test.cjs'));
  const r = f.trace().call('ui-render', () => render('Settings', { deviceVisible: true, appService: A })); r.view.ownerClient = client;
  const input = flat(r.roots).find(n => n.type === 'TextInput' && n.attrs.accessibilityText?.[0] === 'app.string.' + label);
  f.trace().call('ui-input', () => input.attrs.onChange[0](draft));
  const writes = f.trace().calls['file-write'] || 0, io = h.platform.get('@ohos.file.fs'), open = io.openSync;
  // These failures arise from real file operations inside the native stand-in, with no injection tag.
  if (process.argv.includes('--unannounced-file-open')) { const lock = path.join(A.local.directory, 'experience.lock'); fs.rmSync(lock, { force: true }); fs.mkdirSync(lock); }
  if (process.argv.includes('--unannounced-file-read')) { fs.unlinkSync(filename); fs.mkdirSync(filename); }
  if (process.argv.includes('--unannounced-file-write')) {
    fs.writeFileSync(filename + '.tmp', 'original');
    io.openSync = (name, flags) => open(name, name === filename + '.tmp' ? 0 : flags);
  }
  try { await f.trace().call('ui-save', () => button(r, 'player_save_steps').attrs.onClick[0]()); } finally { io.openSync = open; }
  const afterBytes = fs.readFileSync(filename, 'utf8'), after = JSON.parse(afterBytes);
  check(() => {
    assert.equal(input.attrs.maxLength[0], 3); assert.equal(r.view[field], draft);
    if (expected === undefined) { assert.equal(afterBytes, beforeBytes); assert.equal(r.view.message, 'player_steps_invalid'); assert.equal(f.trace().calls['file-write'] || 0, writes); }
    else { assert.equal(r.view.message, ''); assert.deepEqual(after.playerUi, { ...initial(), trickplay: true, introSkipper: true, [key]: expected });
      for (const field of Object.keys(before).filter(value => value !== 'playerUi')) assert.deepEqual(after[field], before[field]); }
  });
});
if (require.main === module) f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = tests;
