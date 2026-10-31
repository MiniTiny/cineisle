// Production language policy and durable preference transaction. Native glyph/layout checks are separate.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const prefs = require('./preferences-platform.cjs').install(h.platform, h.directory);
const { LanguagePreferences: L } = h.load('service/LanguagePreferences.ets');
const { effectiveUiLanguage, validUiLanguage, UI_LANGUAGES, uiLanguageCaption } = h.load('utils/UiLanguage.ts');
const tests = [], test = (name, run) => tests.push([name, run]);
let locale, preferred, failApply; const calls = [];
const context = { ...h.context, getApplicationContext: () => ({ setLanguage(value) {
  calls.push(value); if (failApply-- > 0) throw Error('native configuration failed');
} }) };
Object.assign(h.platform.get('@ohos.i18n').System, {
  getSystemLocale: () => locale, getAppPreferredLanguage: () => preferred,
  setAppPreferredLanguage: value => { preferred = value; }
});
function reset() {
  h.reset(); prefs.reset(); fs.rmSync(path.join(h.directory, 'ui_language.fixture.json'), { force: true });
  Object.assign(L, { context: undefined, store: undefined, loading: undefined, writes: Promise.resolve(),
    value: 'system', persisted: '', applied: '', issue: '' });
  locale = 'zh-Hans-CN'; preferred = 'default'; failApply = 0; calls.length = 0;
}
const read = p => JSON.parse(fs.readFileSync(p)).string;
const values = () => Object.fromEntries(read('entry/src/main/resources/pl_PL/element/string.json').map(r => [r.name, r.value]));
const disk = () => JSON.parse(fs.readFileSync(path.join(h.directory, 'ui_language.fixture.json')));
test('Polish is a canonical unique choice and preserves the existing choice order', () => {
  assert.deepEqual(Array.from(UI_LANGUAGES), ['system', 'zh-CN', 'zh-TW', 'en-US', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR', 'ko-KR', 'ru-RU', 'pl-PL']);
  assert.equal(validUiLanguage('pl-PL'), true); assert.equal(uiLanguageCaption('pl-PL', 'System'), 'Polski');
  for (const input of ['pl', 'pl_PL', 'PL-PL', 'pl-Latn-PL', 'pl-PL-x-test', ' pl-PL', '../pl-PL']) assert.equal(validUiLanguage(input), false, input);
});
test('system Polish uses Latin resources and incompatible explicit scripts use the fallback', () => {
  for (const input of ['pl', 'pl-PL', 'pl_PL', 'PL_pl', ' pl-Latn-PL ', 'pl-Latn', 'pl-US', 'pl-GB', 'pl-001', 'pl-PL-u-nu-latn', 'pl-PL-x-US']) assert.equal(effectiveUiLanguage('system', input), 'pl-PL', input);
  for (const input of ['pol', 'pl-Cyrl-PL', 'pl-Hans-PL', 'pl--PL', 'pl-', 'pl-POL', 'pl/pl-PL', 'en-PL', 'uk-UA']) assert.equal(effectiveUiLanguage('system', input), 'en-US', input);
  assert.equal(effectiveUiLanguage('pl-PL', 'zh-Hans-CN'), 'pl-PL');
});
test('all597 Polish resources are authored with complete keys and valid format contracts', () => {
  const pl = read('entry/src/main/resources/pl_PL/element/string.json');
  const base = read('entry/src/main/resources/base/element/string.json');
  const en = new Map(read('entry/src/main/resources/en_US/element/string.json').map(r => [r.name, r.value]));
  assert.equal(pl.length, 597); assert.equal(new Set(pl.map(r => r.name)).size, 597);
  assert.deepEqual(pl.map(r => r.name).sort(), base.map(r => r.name).sort());
  const technical = /\b(?:Jellyfin|CineIsle|HarmonyOS|OpenHarmony|Intro Skipper|Quick Connect|Jellyscrub|SRT|ASS|SSA|BIF|HTTP|HTTPS|API|AMOLED|PINs?|MB|MiB|Wi-Fi|PiP|MPV)\b/g;
  const tokens = s => (s.match(technical) || []).map(s => s === 'PINs' ? 'PIN' : s).sort();
  for (const r of pl) {
    const source = en.get(r.name); assert.ok(r.value.trim(), r.name); assert.ok(!/[\u3400-\u9fff]/.test(r.value), r.name);
    assert.deepEqual(r.value.match(/%(?:\d+\$)?[dsf%]/g), source.match(/%(?:\d+\$)?[dsf%]/g), r.name);
    assert.equal(r.value.split('\n').length, source.split('\n').length, r.name);
    assert.deepEqual(tokens(r.value), tokens(source), r.name);
    if (!['version', 'subtitle_chip', 'runtime_minutes'].includes(r.name)) { assert.match(r.value, /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/, r.name); assert.notEqual(r.value, source, r.name); }
  }
  assert.deepEqual(read('AppScope/resources/pl_PL/element/string.json'), [{ name: 'app_name', value: 'CineIsle' }]);
});
test('Polish wording preserves destructive scope, retained data and unconfirmed outcomes', () => {
  const pl = values();
  assert.equal(pl.settings, 'Ustawienia'); assert.equal(pl.username, 'Nazwa użytkownika'); assert.equal(pl.play, 'Odtwórz');
  assert.match(pl.server_delete_confirm, /Trwale usunąć/); assert.match(pl.server_delete_confirm, /wszystkich użytkowników/); assert.match(pl.server_delete_confirm, /zostaną zachowane/);
  assert.match(pl.remove_account_confirm, /wyłącznie lokalnie/); assert.match(pl.remove_account_confirm, /Zawartość serwera nie zostanie usunięta/);
  assert.match(pl.download_location_hint, /Odinstalowanie aplikacji usuwa także te pliki/);
  assert.match(pl.change_queued_blocked, /nie zostały potwierdzone przez serwer/); assert.match(pl.change_queued_blocked, /Automatyczne wysyłanie jest wstrzymane/);
  assert.match(pl.caption_scope, /systemową konfigurację/); assert.match(pl.caption_scope, /inne aplikacje/); assert.match(pl.caption_scope, /Powrót odrzuca niezapisane zmiany/);
  assert.match(pl.caption_color_hint, /#RRGGBB/); assert.match(pl.caption_color_hint, /#AARRGGBB/);
  assert.match(pl.ui_language_hint, /polski/); assert.match(pl.ui_language_hint, /tylko interfejs/); assert.match(pl.ui_language_hint, /osobne/);
});
test('explicit Polish saves its full global token and survives cold reconstruction', async () => {
  await L.attach(context); await L.save('pl-PL', () => true);
  assert.deepEqual(disk(), { choice_v1: 'pl-PL' }); assert.equal(preferred, 'pl-PL'); assert.equal(calls.at(-1), 'pl-PL');
  prefs.state.instances.clear(); Object.assign(L, { store: undefined, loading: undefined, value: 'system', persisted: '', applied: '' });
  locale = 'fr-CA'; await L.attach(context); assert.equal(L.snapshot(), 'pl-PL'); assert.equal(calls.at(-1), 'pl-PL');
});
test('explicit Polish remains stable across system locale changes', async () => {
  await L.attach(context); await L.save('pl-PL', () => true); const count = calls.length;
  locale = 'pt-BR'; L.systemChanged(); assert.equal(calls.length, count); assert.equal(L.snapshot(), 'pl-PL'); assert.equal(preferred, 'pl-PL');
});
test('system follow applies Polish and later French without rewriting the saved choice', async () => {
  locale = 'pl-Latn-PL'; await L.attach(context); assert.equal(calls.at(-1), 'pl-PL');
  locale = 'fr-CA'; L.systemChanged(); assert.equal(calls.at(-1), 'fr-FR');
  assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default'); assert.equal(prefs.state.calls.some(r => r[0] === 'put'), false);
});
test('failed flush retains the previously confirmed Polish setting', async () => {
  await L.attach(context); await L.save('pl-PL', () => true); prefs.state.failFlush = 1;
  await assert.rejects(L.save('en-US', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'pl-PL'); assert.equal(disk().choice_v1, 'pl-PL'); assert.equal(preferred, 'pl-PL');
});
test('native application failure rolls Polish back to the previous English setting', async () => {
  await L.attach(context); await L.save('en-US', () => true); failApply = 1;
  await assert.rejects(L.save('pl-PL', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('page ownership revoked during persistence cannot publish Polish', async () => {
  await L.attach(context); await L.save('en-US', () => true);
  let owner = true; const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const pending = L.save('pl-PL', () => owner); await new Promise(setImmediate); owner = false; gate.resolve();
  await assert.rejects(pending, /ui_language_cancelled/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('malformed Polish token is retained until an explicit valid repair', async () => {
  const store = await prefs.api.getPreferences(context, { name: 'ui_language' }); await store.put('choice_v1', 'pl'); await store.flush();
  await assert.rejects(L.attach(context), /ui_language_invalid/); assert.equal(disk().choice_v1, 'pl');
  await L.save('pl-PL', () => true); assert.equal(disk().choice_v1, 'pl-PL'); assert.equal(L.snapshot(), 'pl-PL');
});
test('queued Polish and English writes serialize through the real preference service', async () => {
  await L.attach(context); const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const first = L.save('pl-PL', () => true), second = L.save('en-US', () => true); await new Promise(setImmediate);
  assert.equal(prefs.state.calls.filter(r => r[0] === 'put').length, 1); gate.resolve(); await Promise.all([first, second]);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
(async () => {
  for (const [name, run] of tests) { reset(); await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} Polish language regressions passed. Native system locale, glyphs and layout remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
