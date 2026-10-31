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
const values = () => Object.fromEntries(read('entry/src/main/resources/ru_RU/element/string.json').map(r => [r.name, r.value]));
const disk = () => JSON.parse(fs.readFileSync(path.join(h.directory, 'ui_language.fixture.json')));
test('Russian is a canonical unique choice and preserves the existing choice order', () => {
  assert.deepEqual(Array.from(UI_LANGUAGES), ['system', 'zh-CN', 'zh-TW', 'en-US', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR', 'ko-KR', 'ru-RU', 'pl-PL']);
  assert.equal(validUiLanguage('ru-RU'), true); assert.equal(uiLanguageCaption('ru-RU', 'System'), 'Русский');
  for (const input of ['ru', 'ru_RU', 'RU-RU', 'ru-Cyrl-RU', 'ru-RU-x-test', ' ru-RU', '../ru-RU']) assert.equal(validUiLanguage(input), false, input);
});
test('system Russian uses Cyrillic resources and incompatible explicit scripts use the fallback', () => {
  for (const input of ['ru', 'ru-RU', 'ru_RU', 'RU_ru', ' ru-Cyrl-RU ', 'ru-Cyrl', 'ru-BY', 'ru-KZ', 'ru-001', 'ru-RU-u-nu-latn', 'ru-RU-x-US']) assert.equal(effectiveUiLanguage('system', input), 'ru-RU', input);
  for (const input of ['rus', 'ru-Latn-RU', 'ru-Hans-RU', 'ru--RU', 'ru-', 'ru-RUS', 'ru/ru-RU', 'en-RU', 'uk-UA']) assert.equal(effectiveUiLanguage('system', input), 'en-US', input);
  assert.equal(effectiveUiLanguage('ru-RU', 'zh-Hans-CN'), 'ru-RU');
});
test('all597 Russian resources are authored with complete keys and valid format contracts', () => {
  const ru = read('entry/src/main/resources/ru_RU/element/string.json');
  const base = read('entry/src/main/resources/base/element/string.json');
  const en = new Map(read('entry/src/main/resources/en_US/element/string.json').map(r => [r.name, r.value]));
  assert.equal(ru.length, 597); assert.equal(new Set(ru.map(r => r.name)).size, 597);
  assert.deepEqual(ru.map(r => r.name).sort(), base.map(r => r.name).sort());
  const technical = /\b(?:Jellyfin|CineIsle|HarmonyOS|OpenHarmony|Intro Skipper|Quick Connect|Jellyscrub|SRT|ASS|SSA|BIF|HTTP|HTTPS|API|AMOLED|PINs?|MB|MiB|Wi-Fi|PiP|MPV)\b/g;
  const tokens = s => (s.match(technical) || []).map(s => s === 'PINs' ? 'PIN' : s).sort();
  for (const r of ru) {
    const source = en.get(r.name); assert.ok(r.value.trim(), r.name); assert.ok(!/[\u3400-\u9fff]/.test(r.value), r.name);
    assert.deepEqual(r.value.match(/%(?:\d+\$)?[dsf%]/g), source.match(/%(?:\d+\$)?[dsf%]/g), r.name);
    assert.equal(r.value.split('\n').length, source.split('\n').length, r.name);
    assert.deepEqual(tokens(r.value), tokens(source), r.name);
    if (!['version', 'subtitle_chip'].includes(r.name)) { assert.match(r.value, /[А-Яа-яЁё]/, r.name); assert.notEqual(r.value, source, r.name); }
  }
  assert.deepEqual(read('AppScope/resources/ru_RU/element/string.json'), [{ name: 'app_name', value: 'CineIsle' }]);
});
test('Russian wording preserves destructive scope, retained data and unconfirmed outcomes', () => {
  const ru = values();
  assert.equal(ru.settings, 'Настройки'); assert.equal(ru.username, 'Имя пользователя'); assert.equal(ru.play, 'Воспроизвести');
  assert.match(ru.server_delete_confirm, /Безвозвратно/); assert.match(ru.server_delete_confirm, /всех пользователей/); assert.match(ru.server_delete_confirm, /файлы будут сохранены/);
  assert.match(ru.remove_account_confirm, /только локально/); assert.match(ru.remove_account_confirm, /Содержимое сервера не удаляется/);
  assert.match(ru.download_location_hint, /При удалении приложения эти файлы также удаляются/);
  assert.match(ru.change_queued_blocked, /не подтверждены сервером/); assert.match(ru.change_queued_blocked, /Автоматическая отправка приостановлена/);
  assert.match(ru.caption_scope, /системную конфигурацию/); assert.match(ru.caption_scope, /другие приложения/); assert.match(ru.caption_scope, /несохранённые изменения отбрасываются/);
  assert.match(ru.caption_color_hint, /#RRGGBB/); assert.match(ru.caption_color_hint, /#AARRGGBB/);
  assert.match(ru.ui_language_hint, /русский/); assert.match(ru.ui_language_hint, /только интерфейс/); assert.match(ru.ui_language_hint, /отдельными/);
});
test('explicit Russian saves its full global token and survives cold reconstruction', async () => {
  await L.attach(context); await L.save('ru-RU', () => true);
  assert.deepEqual(disk(), { choice_v1: 'ru-RU' }); assert.equal(preferred, 'ru-RU'); assert.equal(calls.at(-1), 'ru-RU');
  prefs.state.instances.clear(); Object.assign(L, { store: undefined, loading: undefined, value: 'system', persisted: '', applied: '' });
  locale = 'fr-CA'; await L.attach(context); assert.equal(L.snapshot(), 'ru-RU'); assert.equal(calls.at(-1), 'ru-RU');
});
test('explicit Russian remains stable across system locale changes', async () => {
  await L.attach(context); await L.save('ru-RU', () => true); const count = calls.length;
  locale = 'pt-BR'; L.systemChanged(); assert.equal(calls.length, count); assert.equal(L.snapshot(), 'ru-RU'); assert.equal(preferred, 'ru-RU');
});
test('system follow applies Russian and later French without rewriting the saved choice', async () => {
  locale = 'ru-Cyrl-RU'; await L.attach(context); assert.equal(calls.at(-1), 'ru-RU');
  locale = 'fr-CA'; L.systemChanged(); assert.equal(calls.at(-1), 'fr-FR');
  assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default'); assert.equal(prefs.state.calls.some(r => r[0] === 'put'), false);
});
test('failed flush retains the previously confirmed Russian setting', async () => {
  await L.attach(context); await L.save('ru-RU', () => true); prefs.state.failFlush = 1;
  await assert.rejects(L.save('en-US', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'ru-RU'); assert.equal(disk().choice_v1, 'ru-RU'); assert.equal(preferred, 'ru-RU');
});
test('native application failure rolls Russian back to the previous English setting', async () => {
  await L.attach(context); await L.save('en-US', () => true); failApply = 1;
  await assert.rejects(L.save('ru-RU', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('page ownership revoked during persistence cannot publish Russian', async () => {
  await L.attach(context); await L.save('en-US', () => true);
  let owner = true; const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const pending = L.save('ru-RU', () => owner); await new Promise(setImmediate); owner = false; gate.resolve();
  await assert.rejects(pending, /ui_language_cancelled/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('malformed Russian token is retained until an explicit valid repair', async () => {
  const store = await prefs.api.getPreferences(context, { name: 'ui_language' }); await store.put('choice_v1', 'ru'); await store.flush();
  await assert.rejects(L.attach(context), /ui_language_invalid/); assert.equal(disk().choice_v1, 'ru');
  await L.save('ru-RU', () => true); assert.equal(disk().choice_v1, 'ru-RU'); assert.equal(L.snapshot(), 'ru-RU');
});
test('queued Russian and English writes serialize through the real preference service', async () => {
  await L.attach(context); const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const first = L.save('ru-RU', () => true), second = L.save('en-US', () => true); await new Promise(setImmediate);
  assert.equal(prefs.state.calls.filter(r => r[0] === 'put').length, 1); gate.resolve(); await Promise.all([first, second]);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
(async () => {
  for (const [name, run] of tests) { reset(); await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} Russian language regressions passed. Native system locale, glyphs and layout remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
