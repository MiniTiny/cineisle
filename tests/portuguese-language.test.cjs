// Real language policy/service with durable preference faults; not native locale acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./feature-regression.test.cjs');
const prefs = require('./preferences-platform.cjs').install(h.platform, h.directory);
const { LanguagePreferences: L } = h.load('service/LanguagePreferences.ets');
const { effectiveUiLanguage, validUiLanguage, UI_LANGUAGES, uiLanguageCaption } = h.load('utils/UiLanguage.ts');
const tests = []; const test = (name, run) => tests.push([name, run]);
let locale = 'zh-Hans-CN', preferred = 'default', failApply = 0;
const calls = [];
const context = { ...h.context, getApplicationContext: () => ({ setLanguage(value) {
  calls.push(value); if (failApply-- > 0) throw Error('native apply failed');
} }) };
Object.assign(h.platform.get('@ohos.i18n').System, {
  getSystemLanguage: () => 'pt', getSystemLocale: () => locale,
  getAppPreferredLanguage: () => preferred, setAppPreferredLanguage: value => { preferred = value; }
});
function reset() {
  h.reset(); prefs.reset(); fs.rmSync(path.join(h.directory, 'ui_language.fixture.json'), { force: true });
  Object.assign(L, { context: undefined, store: undefined, loading: undefined, writes: Promise.resolve(), value: 'system', persisted: '', applied: '', issue: '' });
  locale = 'zh-Hans-CN'; preferred = 'default'; failApply = 0; calls.length = 0;
}
const read = p => JSON.parse(fs.readFileSync(p)).string;
const disk = () => JSON.parse(fs.readFileSync(path.join(h.directory, 'ui_language.fixture.json')));
const values = () => Object.fromEntries(read('entry/src/main/resources/pt_PT/element/string.json').map(x => [x.name, x.value]));
test('Portugal is a canonical distinct choice with its own native caption', () => {
  assert.equal(validUiLanguage('pt-PT'), true);
  assert.equal(UI_LANGUAGES.filter(x => x === 'pt-PT').length, 1);
  assert.equal(uiLanguageCaption('pt-PT', 'System'), 'Português (Portugal)');
  for (const invalid of ['pt', 'pt_PT', 'PT-PT', 'pt-AO', 'pt-PT-x-test', ' pt-PT', '../pt-PT']) assert.equal(validUiLanguage(invalid), false, invalid);
});
test('system-follow distinguishes region from script, extensions and private-use', () => {
  for (const input of ['pt', 'pt-PT', 'pt_PT', ' PT_latn_PT ', 'pt-Latn', 'pt-AO', 'pt-MZ', 'pt-FR', 'pt-DE', 'pt-ES', 'pt-IT', 'pt-PT-x-BR', 'pt-x-BR', 'pt-Latn-PT-u-rg-brzzzz', 'pt-PT-u-nu-latn']) {
    assert.equal(effectiveUiLanguage('system', input), 'pt-PT', input);
  }
  for (const input of ['pt-BR', 'pt_BR', 'pt-Latn-BR', 'PT_latn_br', 'pt-BR-u-nu-latn', 'pt-BR-x-PT']) {
    assert.equal(effectiveUiLanguage('system', input), 'pt-BR', input);
  }
  for (const input of ['pt-Cyrl-BR', 'pt-Cyrl-PT', 'pt-BRA', 'pt--BR', 'pt-', 'por-PT', 'en-PT']) assert.equal(effectiveUiLanguage('system', input), 'en-US', input);
  assert.equal(effectiveUiLanguage('pt-PT', 'pt-BR'), 'pt-PT');
});
test('all597 independent Portugal values retain complete keys, placeholders, newlines and technical names', () => {
  const pt = read('entry/src/main/resources/pt_PT/element/string.json');
  const base = read('entry/src/main/resources/base/element/string.json');
  const en = new Map(read('entry/src/main/resources/en_US/element/string.json').map(x => [x.name, x.value]));
  assert.equal(pt.length, 597); assert.equal(new Set(pt.map(x => x.name)).size, 597);
  assert.deepEqual(pt.map(x => x.name).sort(), base.map(x => x.name).sort());
  const unchanged = new Set(['version', 'subtitle_chip', 'runtime_minutes', 'trailer', 'ok']);
  const technical = /\b(?:Jellyfin|CineIsle|HarmonyOS|OpenHarmony|Intro Skipper|Quick Connect|Jellyscrub|SRT|ASS|SSA|BIF|HTTP|HTTPS|API|AMOLED|PINs?|MB|MiB|Wi-Fi|PiP|MPV)\b/g;
  const tokens = s => (s.match(technical) || []).map(x => x === 'PINs' ? 'PIN' : x).sort();
  for (const x of pt) {
    const source = en.get(x.name); assert.ok(x.value.trim(), x.name); assert.ok(!/[\u3400-\u9fff]/.test(x.value), x.name);
    assert.deepEqual(x.value.match(/%(?:\d+\$)?[dsf%]/g), source.match(/%(?:\d+\$)?[dsf%]/g), x.name);
    assert.equal(x.value.split('\n').length, source.split('\n').length, x.name);
    assert.deepEqual(tokens(x.value), tokens(source), x.name);
    if (!unchanged.has(x.name)) assert.notEqual(x.value, source, x.name);
  }
  assert.deepEqual(read('AppScope/resources/pt_PT/element/string.json'), [{ name: 'app_name', value: 'CineIsle' }]);
});
test('visible European terminology is distinct from the preserved Brazilian pack', () => {
  const pt = values(); const br = Object.fromEntries(read('entry/src/main/resources/pt_BR/element/string.json').map(x => [x.name, x.value]));
  for (const [key, value] of Object.entries({ settings: 'Definições', username: 'Nome de utilizador', password: 'Palavra-passe', download: 'Transferir', downloads: 'Transferências', download_progress: 'A transferir %d%%', detail_size: 'Tamanho do ficheiro', continue_watching: 'Continuar a ver', detail_actions: 'Reproduzir e gerir', login_credentials: 'Ligue a sua biblioteca' })) {
    assert.equal(pt[key], value, key); assert.notEqual(pt[key], br[key], key);
  }
  assert.equal(br.settings, 'Configurações'); assert.equal(br.download_progress, 'Baixando %d%%');
});
test('destructive scope, retained files and unconfirmed side effects remain explicit', () => {
  const pt = values();
  assert.match(pt.server_delete_confirm, /permanentemente/); assert.match(pt.server_delete_confirm, /todos os utilizadores/); assert.match(pt.server_delete_confirm, /serão mantidos/);
  assert.match(pt.remove_account_confirm, /não será eliminado/); assert.match(pt.sync_cache_write_failed, /alterações foram mantidas/);
  assert.match(pt.change_queued_blocked, /não confirmadas pelo servidor/); assert.match(pt.change_queued_blocked, /em pausa/);
  assert.match(pt.caption_scope, /outras aplicações/); assert.match(pt.player_relative_volume_hint, /sistema estiver silenciado/);
  assert.match(pt.mpv_options_hint, /pode haver/); assert.match(pt.mpv_options_hint, /software/); assert.match(pt.mpv_options_hint, /efetivos/);
  assert.match(pt.ui_language_hint, /português de Portugal/); assert.match(pt.ui_language_hint, /português do Brasil/); assert.match(pt.ui_language_hint, /apenas a interface/);
});
test('explicit Portugal persists through cold reconstruction while system changes to Brazil', async () => {
  await L.attach(context); await L.save('pt-PT', () => true);
  assert.deepEqual(disk(), { choice_v1: 'pt-PT' }); assert.equal(preferred, 'pt-PT');
  prefs.state.instances.clear(); Object.assign(L, { store: undefined, loading: undefined, value: 'system', persisted: '', applied: '' });
  locale = 'pt-Latn-BR'; await L.attach(context); assert.equal(L.snapshot(), 'pt-PT'); assert.equal(calls.at(-1), 'pt-PT');
  const count = calls.length; L.systemChanged(); assert.equal(calls.length, count);
});
test('system-follow crosses both Portuguese regions without rewriting the global choice', async () => {
  locale = 'pt-Latn-PT'; await L.attach(context); assert.equal(calls.at(-1), 'pt-PT');
  locale = 'pt-Latn-BR'; L.systemChanged(); assert.equal(calls.at(-1), 'pt-BR');
  locale = 'pt'; L.systemChanged(); assert.equal(calls.at(-1), 'pt-PT');
  assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default'); assert.equal(prefs.state.calls.some(x => x[0] === 'put'), false);
});
test('native apply failure restores the prior Brazilian choice and durable value', async () => {
  await L.attach(context); await L.save('pt-BR', () => true); failApply = 1;
  await assert.rejects(L.save('pt-PT', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'pt-BR'); assert.equal(preferred, 'pt-BR'); assert.equal(disk().choice_v1, 'pt-BR');
});
test('flush failure preserves Portugal when a switch to Brazil is unconfirmed', async () => {
  await L.attach(context); await L.save('pt-PT', () => true); prefs.state.failFlush = 1;
  await assert.rejects(L.save('pt-BR', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'pt-PT'); assert.equal(preferred, 'pt-PT'); assert.equal(disk().choice_v1, 'pt-PT');
});
test('late persistence after page ownership is revoked cannot publish Portugal', async () => {
  await L.attach(context); await L.save('pt-BR', () => true);
  let owner = true; const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const pending = L.save('pt-PT', () => owner); await new Promise(setImmediate); owner = false; gate.resolve();
  await assert.rejects(pending, /ui_language_cancelled/);
  assert.equal(L.snapshot(), 'pt-BR'); assert.equal(preferred, 'pt-BR'); assert.equal(disk().choice_v1, 'pt-BR');
});
(async () => { for (const [name, run] of tests) { reset(); await run(); console.log('PASS ' + name); } console.log(`${tests.length} Portugal language regressions passed. Native locale, glyph and layout acceptance remain separate.`); })().catch(error => { console.error(error); process.exitCode = 1; });
