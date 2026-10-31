// Expected code units come from independent Android framework and fixed Media3 execution.
const assert = require('node:assert/strict'), fs = require('node:fs');
const h = require('./feature-regression.test.cjs');
const { inlineSubtitle } = h.load('utils/InlineSubtitle.ts');
const { subtitleEntities } = h.load('utils/SubtitleEntities.ts');
const { parseSubtitles } = h.load('utils/Playback.ts');
const reference = JSON.parse(fs.readFileSync('tests/fixtures/srt-entity-context-android.json'));
const tests = [], test = (name, run) => tests.push([name, run]);
function units(content, html) {
  const result = [];
  for (const run of content?.runs?.length ? content.runs : [{ text: content?.text || '' }]) {
    for (let i = 0; i < run.text.length; ++i) {
      const unit = { codeUnit: run.text.charCodeAt(i), color: parseInt((run.color || '#FFFFFFFF').slice(1), 16) >>> 0,
        underline: !!run.underline };
      if (html) Object.assign(unit, { bold: !!run.bold, italic: !!run.italic });
      result.push(unit);
    }
  }
  return result;
}
for (const row of reference.cases) {
  test('Android entity/context HTML ' + row.id, () => assert.deepEqual(units(inlineSubtitle(row.source), true), row.htmlUnits));
  test('Media3 entity/context SRT ' + row.id, () => {
    // Java's UTF8 encoder replaces physical isolated surrogates before SubripParser reads bytes.
    // Numeric references contain valid ASCII and reach the parser unchanged.
    const source = row.srtInputEncoding === 'valid-utf8' ? row.source : row.source.replace(/[\uDC00-\uDFFF]/g, '?');
    const cue = parseSubtitles('1\n00:00 --> 00:10\n' + source + '\n\n')[0];
    assert.deepEqual(units(cue, false), row.srtUnits);
  });
}
for (const row of reference.qualifiedCases) test('Android qualified root/child ' + row.id, () =>
  assert.deepEqual(units(inlineSubtitle(row.source), true), row.htmlUnits));
for (const row of reference.attributes) test('Android terminated attribute ' + row.id, () => {
  const actual = subtitleEntities(row.source);
  assert.deepEqual(Array.from({ length: actual.length }, (_, i) => actual.charCodeAt(i)), row.units);
});
test('long zero-prefixed and repeated malformed references consume bounded input once', () => {
  const start = Date.now();
  assert.equal(inlineSubtitle('A&#' + '0'.repeat(100000) + '65B').text, 'AAB');
  assert.equal(subtitleEntities('A&#' + '0'.repeat(100000) + '65;B'), 'AAB');
  const raw = '&&notKnown;'.repeat(20000); assert.equal(inlineSubtitle(raw).text, raw);
  assert.ok(Date.now() - start < 2000, 'entity scanning must remain linear');
});
(async () => {
  let failed = 0;
  for (const [name, run] of tests) {
    try { await run(); console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
  }
  if (failed) throw Error(`${failed}/${tests.length} entity/context cases failed`);
  console.log(`${tests.length} SRT entity/context regressions passed. Native drawing is separate acceptance.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
