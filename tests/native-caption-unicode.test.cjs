// Production N-API Read and paragraph splitter. Host Drawing remains fail-fast.
const assert = require('node:assert/strict');
const { native } = require('./native-entry-build.cjs').build({ captionParagraph: true });
const run = text => ({ text, family: '', size: 20, baseline: 0, color: 0xffffffff, bold: false, italic: false, underline: false, strike: false });
const inspect = text => native.inspectCaptionParagraphs({ width: 400, maxLines: 4, intrinsic: false,
  runs: [run(text)], shadows: [], paragraphs: [{ start: 0, end: text.length, kind: 'quote' }],
  paragraphStyle: { size: 20, color: 0xffffffff } });
let count = 0;
for (const [raw, expected] of [
  ['A\uDC00\uDC00B', 'A\uFFFD\uFFFDB'], ['A\uD7BF\uDFFFB', 'A\uD7BF\uFFFDB'],
  ['\uD800A\uDFFF', '\uFFFDA\uFFFD'], ['\uD800\uD800\uDC00', '\uFFFD\uD800\uDC00'],
  ['A\uDBFF\uDFFFB', 'A\uDBFF\uDFFFB'], ['中文😀é', '中文😀é']
]) {
  const parts = inspect(raw); assert.equal(parts[0].runs[0].text, expected); assert.equal(parts[0].runs[0].units, raw.length);
  const split = inspect(raw + '\nZ'); assert.deepEqual(split.map(p => p.start), [0, raw.length + 1]);
  assert.equal(split[0].runs[0].text, expected + '\n'); assert.equal(split[1].runs[0].text, 'Z'); count += 2;
}
assert.throws(() => inspect('A\0B'), /caption_text_invalid/); count++;
const maximum = 4 * 1024 * 1024, n = Math.floor(maximum / 3);
for (const length of [n - 1, n, n + 1]) {
  const raw = '\uDC00'.repeat(length);
  if (length * 3 > maximum) assert.throws(() => inspect(raw), /caption_text_too_large/);
  else { const value = inspect(raw)[0].runs[0]; assert.equal(value.units, length); assert.equal(value.text, '\uFFFD'.repeat(length)); }
  count++;
}
console.log(`${count} native UTF16/admission checks passed; host drawing was not exercised.`);
