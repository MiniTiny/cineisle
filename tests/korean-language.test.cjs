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
const values = () => Object.fromEntries(read('entry/src/main/resources/ko_KR/element/string.json').map(r => [r.name, r.value]));
const disk = () => JSON.parse(fs.readFileSync(path.join(h.directory, 'ui_language.fixture.json')));
test('Korean is a canonical unique choice and preserves the existing choice order', () => {
  assert.deepEqual(Array.from(UI_LANGUAGES), ['system', 'zh-CN', 'zh-TW', 'en-US', 'fr-FR', 'es-ES', 'de-DE', 'it-IT', 'pt-PT', 'pt-BR', 'ko-KR', 'ru-RU', 'pl-PL']);
  assert.equal(validUiLanguage('ko-KR'), true); assert.equal(uiLanguageCaption('ko-KR', 'System'), '한국어');
  for (const input of ['ko', 'ko_KR', 'KO-KR', 'ko-Kore-KR', 'ko-KR-x-test', ' ko-KR', '../ko-KR']) assert.equal(validUiLanguage(input), false, input);
});
test('system Korean uses the Korean pack and incompatible explicit scripts use the fallback', () => {
  for (const input of ['ko', 'ko-KR', 'ko_KR', 'KO_kr', ' ko-Kore-KR ', 'ko-Hang-KR', 'ko-KP', 'ko-001', 'ko-KR-u-nu-latn', 'ko-KR-x-US']) assert.equal(effectiveUiLanguage('system', input), 'ko-KR', input);
  for (const input of ['kor', 'ko-Cyrl-KR', 'ko-Hans-KR', 'ko--KR', 'ko-', 'ko-KOR', 'ko/ko-KR', 'en-KR', 'ja-KR']) assert.equal(effectiveUiLanguage('system', input), 'en-US', input);
  assert.equal(effectiveUiLanguage('ko-KR', 'zh-Hans-CN'), 'ko-KR');
});
test('all597 Korean resources are authored with complete keys and valid format contracts', () => {
  const ko = read('entry/src/main/resources/ko_KR/element/string.json');
  const base = read('entry/src/main/resources/base/element/string.json');
  const en = new Map(read('entry/src/main/resources/en_US/element/string.json').map(r => [r.name, r.value]));
  assert.equal(ko.length, 597); assert.equal(new Set(ko.map(r => r.name)).size, 597);
  assert.deepEqual(ko.map(r => r.name).sort(), base.map(r => r.name).sort());
  const technical = /\b(?:Jellyfin|CineIsle|HarmonyOS|OpenHarmony|Intro Skipper|Quick Connect|Jellyscrub|SRT|ASS|SSA|BIF|HTTP|HTTPS|API|AMOLED|PINs?|MB|MiB|Wi-Fi|PiP|MPV)\b/g;
  const tokens = s => (s.match(technical) || []).map(s => s === 'PINs' ? 'PIN' : s).sort();
  for (const r of ko) {
    const source = en.get(r.name); assert.ok(r.value.trim(), r.name); assert.ok(!/[\u3400-\u9fff]/.test(r.value), r.name);
    assert.deepEqual(r.value.match(/%(?:\d+\$)?[dsf%]/g), source.match(/%(?:\d+\$)?[dsf%]/g), r.name);
    assert.equal(r.value.split('\n').length, source.split('\n').length, r.name);
    assert.deepEqual(tokens(r.value), tokens(source), r.name);
    if (!['version', 'subtitle_chip'].includes(r.name)) { assert.match(r.value, /[가-힣]/, r.name); assert.notEqual(r.value, source, r.name); }
  }
  assert.deepEqual(read('AppScope/resources/ko_KR/element/string.json'), [{ name: 'app_name', value: 'CineIsle' }]);
});
test('Korean wording preserves destructive scope, retained data and unconfirmed outcomes', () => {
  const ko = values();
  assert.equal(ko.settings, '설정'); assert.equal(ko.username, '사용자 이름'); assert.equal(ko.play, '재생');
  assert.match(ko.server_delete_confirm, /영구적으로/); assert.match(ko.server_delete_confirm, /모든 사용자/); assert.match(ko.server_delete_confirm, /파일은 유지/);
  assert.match(ko.remove_account_confirm, /로그인 정보만/); assert.match(ko.remove_account_confirm, /서버 콘텐츠는 삭제되지/);
  assert.match(ko.download_location_hint, /앱을 삭제하면 이 파일도 삭제/);
  assert.match(ko.change_queued_blocked, /서버에서 확인하지 못/); assert.match(ko.change_queued_blocked, /자동 업로드는 일시 중지/);
  assert.match(ko.caption_scope, /시스템/); assert.match(ko.caption_scope, /다른 앱/); assert.match(ko.caption_scope, /초안을 버립니다/);
  assert.match(ko.caption_color_hint, /#RRGGBB/); assert.match(ko.caption_color_hint, /#AARRGGBB/);
  assert.match(ko.ui_language_hint, /한국어/); assert.match(ko.ui_language_hint, /인터페이스만/); assert.match(ko.ui_language_hint, /별도로/);
});
test('explicit Korean saves its full global token and survives cold reconstruction', async () => {
  await L.attach(context); await L.save('ko-KR', () => true);
  assert.deepEqual(disk(), { choice_v1: 'ko-KR' }); assert.equal(preferred, 'ko-KR'); assert.equal(calls.at(-1), 'ko-KR');
  prefs.state.instances.clear(); Object.assign(L, { store: undefined, loading: undefined, value: 'system', persisted: '', applied: '' });
  locale = 'fr-CA'; await L.attach(context); assert.equal(L.snapshot(), 'ko-KR'); assert.equal(calls.at(-1), 'ko-KR');
});
test('explicit Korean remains stable across system locale changes', async () => {
  await L.attach(context); await L.save('ko-KR', () => true); const count = calls.length;
  locale = 'pt-BR'; L.systemChanged(); assert.equal(calls.length, count); assert.equal(L.snapshot(), 'ko-KR'); assert.equal(preferred, 'ko-KR');
});
test('system follow applies Korean and later French without rewriting the saved choice', async () => {
  locale = 'ko-Kore-KR'; await L.attach(context); assert.equal(calls.at(-1), 'ko-KR');
  locale = 'fr-CA'; L.systemChanged(); assert.equal(calls.at(-1), 'fr-FR');
  assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default'); assert.equal(prefs.state.calls.some(r => r[0] === 'put'), false);
});
test('failed flush retains the previously confirmed Korean setting', async () => {
  await L.attach(context); await L.save('ko-KR', () => true); prefs.state.failFlush = 1;
  await assert.rejects(L.save('en-US', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'ko-KR'); assert.equal(disk().choice_v1, 'ko-KR'); assert.equal(preferred, 'ko-KR');
});
test('native application failure rolls Korean back to the previous English setting', async () => {
  await L.attach(context); await L.save('en-US', () => true); failApply = 1;
  await assert.rejects(L.save('ko-KR', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('page ownership revoked during persistence cannot publish Korean', async () => {
  await L.attach(context); await L.save('en-US', () => true);
  let owner = true; const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const pending = L.save('ko-KR', () => owner); await new Promise(setImmediate); owner = false; gate.resolve();
  await assert.rejects(pending, /ui_language_cancelled/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
test('malformed Korean token is retained until an explicit valid repair', async () => {
  const store = await prefs.api.getPreferences(context, { name: 'ui_language' }); await store.put('choice_v1', 'ko'); await store.flush();
  await assert.rejects(L.attach(context), /ui_language_invalid/); assert.equal(disk().choice_v1, 'ko');
  await L.save('ko-KR', () => true); assert.equal(disk().choice_v1, 'ko-KR'); assert.equal(L.snapshot(), 'ko-KR');
});
test('queued Korean and English writes serialize through the real preference service', async () => {
  await L.attach(context); const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const first = L.save('ko-KR', () => true), second = L.save('en-US', () => true); await new Promise(setImmediate);
  assert.equal(prefs.state.calls.filter(r => r[0] === 'put').length, 1); gate.resolve(); await Promise.all([first, second]);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(disk().choice_v1, 'en-US'); assert.equal(preferred, 'en-US');
});
(async () => {
  for (const [name, run] of tests) { reset(); await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} Korean language regressions passed. Native system locale, glyphs and layout remain separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
