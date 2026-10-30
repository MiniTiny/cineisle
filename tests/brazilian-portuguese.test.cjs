// Real policy and durable preference service; SDK fixtures are not native UI acceptance.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const h = require('./feature-regression.test.cjs');
const prefs = require('./preferences-platform.cjs').install(h.platform, h.directory);
const { LanguagePreferences: L } = h.load('service/LanguagePreferences.ets');
const { effectiveUiLanguage, validUiLanguage, UI_LANGUAGES, uiLanguageCaption } = h.load('utils/UiLanguage.ts');
const tests = []; const test = (name, run) => tests.push([name, run]);
let system = 'zh-Hans', locale = 'zh-Hans-CN', preferred = 'default', failApply = 0, failLocale = 0;
const calls = [];
const context = { ...h.context, getApplicationContext: () => ({ setLanguage(value) {
  calls.push(value); if (failApply-- > 0) throw Error('native apply failed');
} }) };
Object.assign(h.platform.get('@ohos.i18n').System, {
  getSystemLanguage: () => system,
  getSystemLocale: () => { if (failLocale-- > 0) throw Error('locale read failed'); return locale; },
  getAppPreferredLanguage: () => preferred,
  setAppPreferredLanguage: value => { preferred = value; }
});
function reset() {
  h.reset(); prefs.reset(); fs.rmSync(path.join(h.directory, 'ui_language.fixture.json'), { force: true });
  Object.assign(L, { context: undefined, store: undefined, loading: undefined, writes: Promise.resolve(), value: 'system', persisted: '', applied: '', issue: '' });
  system = 'zh-Hans'; locale = 'zh-Hans-CN'; preferred = 'default'; failApply = failLocale = 0; calls.length = 0;
}
const read = p => JSON.parse(fs.readFileSync(p)).string;
const disk = () => JSON.parse(fs.readFileSync(path.join(h.directory, 'ui_language.fixture.json')));

test('Brazilian Portuguese is one explicit choice and other Portuguese persisted tokens stay unsupported', () => {
  assert.equal(validUiLanguage('pt-BR'), true);
  assert.equal(UI_LANGUAGES.filter(x => x === 'pt-BR').length, 1);
  assert.equal(uiLanguageCaption('pt-BR', 'System'), 'Português (Brasil)');
  for (const value of ['pt', 'PT-BR', 'pt_BR', '../pt-BR', ' pt-BR']) assert.equal(validUiLanguage(value), false, value);
});
test('Brazilian regions remain distinct from the independent Portugal pack', () => {
  for (const value of ['pt-BR', 'pt_BR', 'PT_br', 'pt-Latn-BR', ' pt_Latn_BR ', 'pt-BR-u-nu-latn']) {
    assert.equal(effectiveUiLanguage('system', value), 'pt-BR', value);
  }
  for (const value of ['por-BR', 'en-BR', 'pt-BRA']) {
    assert.equal(effectiveUiLanguage('system', value), 'en-US', value);
  }
  assert.equal(effectiveUiLanguage('pt-BR', 'pt-PT'), 'pt-BR');
  assert.equal(effectiveUiLanguage('system', 'it-CH'), 'it-IT');
  assert.equal(effectiveUiLanguage('system', 'zh-Hant-CN'), 'zh-TW');
});
test('all597 keys preserve parameters, literal percentages, newlines and technical identities', () => {
  const base = read('entry/src/main/resources/base/element/string.json');
  const en = new Map(read('entry/src/main/resources/en_US/element/string.json').map(x => [x.name, x.value]));
  const pt = read('entry/src/main/resources/pt_BR/element/string.json');
  assert.equal(pt.length, 597); assert.equal(new Set(pt.map(x => x.name)).size, 597);
  assert.deepEqual(pt.map(x => x.name).sort(), base.map(x => x.name).sort());
  const sameWords = new Set(['downloads', 'version', 'subtitle_chip', 'runtime_minutes', 'trailer', 'ok']);
  const technical = /\b(?:Jellyfin|CineIsle|HarmonyOS|OpenHarmony|Intro Skipper|Quick Connect|Jellyscrub|SRT|ASS|SSA|BIF|HTTP|HTTPS|API|AMOLED|PINs?|MB|MiB|Wi-Fi|PiP|MPV)\b/g;
  const tokens = s => (s.match(technical) || []).map(x => x === 'PINs' ? 'PIN' : x).sort();
  for (const x of pt) {
    const source = en.get(x.name); assert.ok(x.value.trim(), x.name);
    assert.ok(!/[\u3400-\u9fff]/.test(x.value), x.name);
    assert.deepEqual(x.value.match(/%(?:\d+\$)?[dsf%]/g), source.match(/%(?:\d+\$)?[dsf%]/g), x.name);
    assert.equal(x.value.split('\n').length, source.split('\n').length, x.name);
    assert.deepEqual(tokens(x.value), tokens(source), x.name);
    if (!sameWords.has(x.name)) assert.notEqual(x.value, source, x.name);
  }
  assert.equal(read('AppScope/resources/pt_BR/element/string.json')[0].value, 'CineIsle');
});
test('destructive scope, retained files, unconfirmed uploads and actual backend limits keep their meaning', () => {
  const m = Object.fromEntries(read('entry/src/main/resources/pt_BR/element/string.json').map(x => [x.name, x.value]));
  assert.match(m.server_delete_confirm, /permanentemente/); assert.match(m.server_delete_confirm, /todos os usuários/);
  assert.match(m.server_delete_confirm, /serão mantidos/); assert.match(m.remove_account_confirm, /não será excluído/);
  assert.match(m.change_queued_blocked, /não confirmadas pelo servidor/); assert.match(m.change_queued_blocked, /pausados/);
  assert.match(m.sync_cache_write_failed, /alterações foram mantidas/);
  assert.ok(!/envio.*(?:concluído|sucesso|confirmado)/i.test(m.sync_cache_write_failed));
  assert.match(m.caption_scope, /outros apps/); assert.match(m.player_relative_volume_hint, /sistema estiver silenciado/);
  assert.match(m.mpv_options_hint, /pode haver/); assert.match(m.mpv_options_hint, /software/); assert.match(m.mpv_options_hint, /efetivos/);
  assert.match(m.ui_language_hint, /português do Brasil/); assert.match(m.ui_language_hint, /só a interface/);
});
test('system-follow uses the full locale when the system language omits its region', async () => {
  system = 'pt'; locale = 'pt-Latn-BR'; await L.attach(context);
  assert.equal(calls.at(-1), 'pt-BR'); assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default');
  locale = 'pt-Latn-PT'; L.systemChanged(); assert.equal(calls.at(-1), 'pt-PT');
  locale = 'pt-BR'; L.systemChanged(); assert.equal(calls.at(-1), 'pt-BR');
  assert.equal(prefs.state.calls.some(x => x[0] === 'put'), false);
});
test('a full-locale read failure is visible and the next foreground update can recover', async () => {
  failLocale = 1; await assert.rejects(L.attach(context), /ui_language_apply_failed/);
  assert.equal(L.snapshot(), 'system'); assert.equal(calls.length, 0);
  locale = 'pt-BR'; await L.attach(context); assert.equal(calls.at(-1), 'pt-BR'); assert.equal(L.issue, '');
});
test('explicit Brazilian choice survives a cold preference reconstruction and system-region changes', async () => {
  await L.attach(context); await L.save('pt-BR', () => true);
  assert.deepEqual(disk(), { choice_v1: 'pt-BR' }); assert.equal(preferred, 'pt-BR');
  prefs.state.instances.clear(); Object.assign(L, { store: undefined, loading: undefined, value: 'system', persisted: '', applied: '' });
  locale = 'pt-PT'; await L.attach(context); assert.equal(L.snapshot(), 'pt-BR'); assert.equal(calls.at(-1), 'pt-BR');
  const count = calls.length; locale = 'it-IT'; L.systemChanged(); assert.equal(calls.length, count);
});
test('returning to system restores its native default and keeps regional choice distinct', async () => {
  await L.attach(context); await L.save('pt-BR', () => true); locale = 'pt-PT'; await L.save('system', () => true);
  assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default'); assert.equal(calls.at(-1), 'pt-PT');
});
test('native application failure restores the previous explicit choice and durable record', async () => {
  await L.attach(context); await L.save('fr-FR', () => true); failApply = 1;
  await assert.rejects(L.save('pt-BR', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'fr-FR'); assert.equal(preferred, 'fr-FR'); assert.equal(disk().choice_v1, 'fr-FR');
});
test('flush failure retains the prior global preference instead of publishing Brazilian success', async () => {
  await L.attach(context); await L.save('en-US', () => true); prefs.state.failFlush = 1;
  await assert.rejects(L.save('pt-BR', () => true), /ui_language_save_failed/);
  assert.equal(L.snapshot(), 'en-US'); assert.equal(preferred, 'en-US'); assert.equal(disk().choice_v1, 'en-US');
});
test('revoked page ownership during persistence cannot publish a new global language', async () => {
  await L.attach(context); let owner = true; const gate = h.deferred(); prefs.state.flushWait = gate.promise;
  const saving = L.save('pt-BR', () => owner); await new Promise(setImmediate); owner = false; gate.resolve();
  await assert.rejects(saving, /ui_language_cancelled/); assert.equal(L.snapshot(), 'system'); assert.equal(preferred, 'default');
});
test('an unsupported Portuguese record stays intact until an explicit supported repair', async () => {
  const store = await prefs.api.getPreferences(context, { name: 'ui_language' }); await store.put('choice_v1', 'pt-AO'); await store.flush();
  await assert.rejects(L.attach(context), /ui_language_invalid/); assert.equal(disk().choice_v1, 'pt-AO');
  await L.save('pt-BR', () => true); assert.equal(L.snapshot(), 'pt-BR'); assert.equal(disk().choice_v1, 'pt-BR');
});

(async () => {
  for (const [name, run] of tests) { reset(); await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} Brazilian Portuguese regressions passed. Native locale, glyph and layout acceptance remain separate.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
