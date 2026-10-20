// Public font metadata and atomic configuration files; no native font matching/rendering claim.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const h = require('./feature-regression.test.cjs');
const { assFontConfiguration } = h.load('utils/AssFontConfig.ts');
let config, lookup;
h.platform.set('@ohos.font', { getUIFontConfig: () => config, getFontByName: name => lookup(name),
  getSystemFontList() { throw Error('empty font enumeration must not be required'); } });
const { AssFonts } = h.load('service/AssFonts.ets');
const tests = [], test = (name, fn) => tests.push([name, fn]);
const metadata = () => ({ fontDir: ['/system/fonts/', '/system/fonts/', '/product/fonts/'],
  generic: [{ family: 'System Sans', alias: [{ name: 'System-Sans', weight: 0 }], adjust: [] }],
  fallbackGroups: [{ fontSetName: '', fallback: [{ language: 'zh-Hans', family: 'System CJK' }] }] });
function fixture() {
  h.reset(); config = metadata();
  const font = path.join(h.directory, 'font-fixture.ttf'); fs.writeFileSync(font, 'not a rendered font');
  lookup = name => ({ path: name === 'System Sans' ? font : '', family: name });
  return font;
}
test('public directories are deduplicated and only a private cache is configured', () => {
  const xml = assFontConfiguration(metadata(), '/private/cache/ass-fonts');
  assert.equal(xml.match(/<dir>/g).length, 2); assert.ok(xml.includes('<cachedir>/private/cache/ass-fonts</cachedir>'));
  assert.ok(xml.includes('<family>System-Sans</family>')); assert.ok(xml.includes('<family>sans-serif</family>'));
  assert.ok(!/<include|DOCTYPE|ENTITY/.test(xml));
});
test('platform family names and cache paths cannot become XML instructions', () => {
  const value = metadata(); value.generic[0].family = '</family><include>/private/x</include>&"';
  value.generic[0].alias[0].name = 'A&<B>';
  const xml = assFontConfiguration(value, '/private/A&B/cache');
  assert.ok(xml.includes('&lt;include&gt;')); assert.ok(xml.includes('/private/A&amp;B/cache'));
  assert.ok(!xml.includes('<include>'));
});
test('the platform fallback order ranks Arabic before incidental mathematical glyph coverage', () => {
  const value = metadata(); value.fallbackGroups[0].fallback = [
    { language: 'und-Arab', family: 'System Arabic' }, { language: 'und-Hebr', family: 'System Hebrew' },
    { language: 'und-Math', family: 'Math Symbols' }];
  value.fallbackGroups.push({ fontSetName: 'Specific Serif', fallback: [{ language: 'und-Arab', family: 'Arabic Serif' }] });
  const xml = assFontConfiguration(value, '/private/cache');
  const defaults = xml.slice(xml.indexOf('<alias><family>sans-serif</family>'));
  assert.ok(defaults.indexOf('System Arabic') < defaults.indexOf('Math Symbols'));
  assert.ok(defaults.indexOf('System Hebrew') < defaults.indexOf('Math Symbols'));
  assert.ok(xml.includes('<family>Specific Serif</family><accept><family>Arabic Serif</family>'));
});
test('relative, traversal and control-character directories are rejected', () => {
  for (const directory of ['relative/fonts', '/system/../private', '/system/./fonts', '/system/\0fonts', '/system/\nfonts']) {
    const value = metadata(); value.fontDir = [directory];
    assert.throws(() => assFontConfiguration(value, '/private/cache'), /ass_font_configuration_invalid/);
    assert.throws(() => assFontConfiguration(metadata(), directory), /ass_font_configuration_invalid/);
  }
});
test('missing or excessive platform metadata is rejected before writing any file', () => {
  for (const value of [{ ...metadata(), fontDir: [] }, { ...metadata(), generic: [] },
    { ...metadata(), fontDir: Array(33).fill('/fonts') }]) {
    assert.throws(() => assFontConfiguration(value, '/private/cache'), /ass_font_configuration_invalid/);
  }
});
test('actual service resolves declared families without font enumeration and reuses its unchanged file', () => {
  const expected = fixture(), first = AssFonts.prepare(h.directory);
  assert.equal(first.path, expected); assert.equal(first.family, 'System Sans');
  const content = fs.readFileSync(first.configuration, 'utf8'), modified = fs.statSync(first.configuration).mtimeMs;
  const second = AssFonts.prepare(h.directory);
  assert.equal(second.configuration, first.configuration); assert.equal(fs.readFileSync(second.configuration, 'utf8'), content);
  assert.equal(fs.statSync(second.configuration).mtimeMs, modified); assert.ok(!fs.existsSync(second.configuration + '.tmp'));
});
test('lookup failures and absent primary faces fall through to declared fallback families', () => {
  const expected = fixture(); lookup = name => { if (name === 'System Sans') throw Error('not enumerated'); return { path: expected }; };
  const value = AssFonts.prepare(h.directory); assert.equal(value.path, expected); assert.equal(value.family, 'System CJK');
});
test('unavailable fonts fail before publishing a configuration', () => {
  fixture(); lookup = () => ({ path: '' });
  assert.throws(() => AssFonts.prepare(h.directory), /ass_font_unavailable/);
  assert.ok(!fs.existsSync(path.join(h.directory, 'ass-fonts')));
});
test('failed config replacement preserves the previous complete configuration', () => {
  fixture(); const first = AssFonts.prepare(h.directory), previous = fs.readFileSync(first.configuration, 'utf8');
  config.generic[0].alias.push({ name: 'NewAlias', weight: 0 });
  const file = h.platform.get('@ohos.file.fs'), rename = file.renameSync;
  file.renameSync = () => { throw Error('disk fault'); };
  try { assert.throws(() => AssFonts.prepare(h.directory), /disk fault/); }
  finally { file.renameSync = rename; }
  assert.equal(fs.readFileSync(first.configuration, 'utf8'), previous);
  AssFonts.prepare(h.directory); assert.ok(fs.readFileSync(first.configuration, 'utf8').includes('NewAlias'));
});
(async () => {
  for (const [name, fn] of tests) { await fn(); console.log('PASS ' + name); }
  console.log(tests.length + ' ASS font configuration tests passed. Fixtures do not prove platform font matching or native rendering.');
})().catch(error => { console.error(error); process.exitCode = 1; });
