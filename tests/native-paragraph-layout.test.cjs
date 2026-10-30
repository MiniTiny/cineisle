const assert = require('node:assert/strict');
const { native } = require('./native-entry-build.cjs').build({ captionParagraph: true });
const tests = [], test = (name, run) => tests.push([name, run]);
const run = text => ({ text, family: 'monospace', size: 100, baseline: 0, color: 0xffffffff,
  background: 0, bold: false, italic: false, underline: false, strike: false });
const inspect = (runs, maxLines = 20) => native.inspectCaptionParagraphs({ width: 1000, maxLines,
  intrinsic: true, runs, shadows: [], paragraphs: [{ start: 0, end: runs.reduce((n, r) => n + r.text.length, 0), kind: 'center' }],
  paragraphStyle: { size: 100, color: 0xffffffff } });
const texts = parts => parts.map(p => p.runs.map(r => r.text).join(''));
test('production splitter retains original newline and UTF16 positions across styled runs', () => {
  const parts = inspect([run('😀'), { ...run('\n'), size: 20, color: 0xffff0000, underline: true }, run('A')]);
  assert.deepEqual(texts(parts), ['😀\n', 'A']);
  assert.deepEqual(parts.map(p => p.start), [0, 3]);
  assert.deepEqual(parts[0].runs, [
    { text: '😀', units: 2, size: 100, color: 0xffffffff, underline: false },
    { text: '\n', units: 1, size: 20, color: 0xffff0000, underline: true }
  ]);
  assert.equal(parts[1].run, 2); assert.equal(parts[1].byte, 0);
});
test('UTF8 byte cursor and UTF16 paragraph offsets remain separate after supplementary text', () => {
  const parts = inspect([run('😀\né\nZ')]);
  assert.deepEqual(texts(parts), ['😀\n', 'é\n', 'Z']);
  assert.deepEqual(parts.map(p => p.start), [0, 3, 5]);
  assert.deepEqual(parts.map(p => p.byte), [0, 5, 8]);
});
test('terminal blank paragraph inherits actual newline style without visible placeholder', () => {
  const parts = inspect([run('A'), { ...run('\n'), size: 20, underline: true }]);
  assert.deepEqual(texts(parts), ['A\n', '\n']);
  assert.equal(parts[1].start, 2); assert.equal(parts[1].runs[0].size, 20);
  assert.equal(parts[1].runs[0].underline, true); assert.equal(parts[1].run, 2);
});
test('explicit blank paragraphs each retain one original separator', () => {
  const parts = inspect([run('\n\nA\n')]);
  assert.deepEqual(texts(parts), ['\n', '\n', 'A\n', '\n']);
  assert.deepEqual(parts.map(p => p.start), [0, 1, 2, 4]);
});
for (const limit of [1, 2, 999, 1000]) test('logical paragraph allocation shares global maxLines ' + limit, () => {
  const parts = inspect([run('A\n'.repeat(1500))], limit);
  assert.equal(parts.length, limit); assert.equal(parts.at(-1).start, (limit - 1) * 2);
});
test('4MiB newline input produces at most1000 owned fragments', () => {
  const parts = inspect([run('\n'.repeat(4 * 1024 * 1024))], 1000);
  assert.equal(parts.length, 1000); assert.equal(texts(parts).join('').length, 1000);
});
// Independent API26 app-context observations: A\n has the virtual row [1,2), and \n has [0,1).
// Some SDKs report the following [units,units) position. Real body rows must never be discarded.
for (const [name, start, end, width, units, expected] of [
  ['API26 glyph-newline terminal row', 1, 2, 0, 2, true],
  ['API26 newline terminal row', 0, 1, 0, 1, true],
  ['following UTF16 position', 2, 2, 0, 2, true],
  ['visible body glyph', 0, 2, 60, 2, false],
  ['real earlier blank line', 0, 0, 0, 2, false],
  ['body content before terminal separator', 0, 2, 0, 2, false],
  ['Unicode final separator', 2, 3, 0, 3, true]
]) test(name, () => assert.equal(native.inspectTerminalParagraphRow({ start, end, width, units }), expected));
for (const [name, fn] of tests) { fn(); console.log('PASS ' + name); }
console.log(`${tests.length} native paragraph splitting/range tests passed. Production code executed;host Drawing is blocked and does not prove geometry or pixels.`);
