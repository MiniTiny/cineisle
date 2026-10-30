// Production Read runs through actual N-API; host drawing is intentionally unavailable.
const assert = require('node:assert/strict');
const { native } = require('./native-entry-build.cjs').build();
const tests = [], test = (name, run) => tests.push([name, run]);
const request = () => ({ width: 100, maxLines: 4, intrinsic: false, shadows: [],
  runs: [{ text: '😀\nA', family: '', size: 20, baseline: 0, color: 0xffffffff,
    bold: false, italic: false, underline: false, strike: false }],
  paragraphs: [{ start: 0, end: 3, kind: 'quote' }], paragraphStyle: { size: 20, color: 0xffffffff } });
const denied = value => assert.throws(() => native.renderCaption(value), /caption_argument_invalid/);
const admitted = value => assert.rejects(native.renderCaption(value), /caption_native_unavailable/);
for (const kind of ['start', 'center', 'end', 'bullet', 'quote']) test('native paragraph kind ' + kind, async () => {
  const value = request(); value.paragraphs[0].kind = kind; await admitted(value);
});
for (const bad of [null, undefined, {}, 'quote', 1, true]) test('native rejects nonarray paragraphs ' + String(bad), () => {
  const value = request(); value.paragraphs = bad; denied(value);
});
for (const bad of [null, {}, { start: 0, end: 3 }, { start: 0, end: 3, kind: 'QUOTE' },
  { start: 0, end: 3, kind: 'unknown' }, { start: 0, end: 3, kind: 1 },
  { start: -1, end: 3, kind: 'quote' }, { start: .1, end: 3, kind: 'quote' },
  { start: NaN, end: 3, kind: 'quote' }, { start: 0, end: Infinity, kind: 'quote' },
  { start: 0, end: 5, kind: 'quote' }, { start: 3, end: 3, kind: 'quote' },
  { start: 1, end: 3, kind: 'quote' }, { start: 0, end: 1, kind: 'quote' },
  { start: '0', end: 3, kind: 'quote' }]) test('native rejects paragraph range/kind ' + JSON.stringify(bad), () => {
  const value = request(); value.paragraphs = [bad]; denied(value);
});
for (const count of [4095, 4096, 4097]) test('native paragraph span count ' + count, async () => {
  const value = request(); value.paragraphs = Array.from({ length: count }, () => ({ start: 0, end: 3, kind: 'quote' }));
  if (count > 4096) denied(value); else await admitted(value);
});
for (const [size, valid] of [[.009, false], [.01, true], [8192, true], [8192.1, false], [0, false], [NaN, false], [Infinity, false], ['20', false]]) test('native paragraph base font size ' + size, async () => {
  const value = request(); value.paragraphStyle.size = size; if (valid) await admitted(value); else denied(value);
});
for (const [color, valid] of [[0, true], [4294967295, true], [-1, false], [4294967296, false], [.5, false], [NaN, false], ['1', false]]) test('native paragraph default marker color ' + color, async () => {
  const value = request(); value.paragraphStyle.color = color; if (valid) await admitted(value); else denied(value);
});
test('native paragraph ranges use aggregate UTF16 units across separately styled runs', async () => {
  const value = request(), run = value.runs[0];
  value.runs = [{ ...run, text: '😀' }, { ...run, text: '\nA' }]; await admitted(value);
  value.paragraphs = [{ start: 3, end: 4, kind: 'end' }]; await admitted(value);
  value.paragraphs = [{ start: 2, end: 4, kind: 'end' }]; denied(value);
});
test('native captures each run text once before validating ranges in that same string', async () => {
  const value = request(); let reads = 0;
  Object.defineProperty(value.runs[0], 'text', { get() { reads++; return reads === 1 ? '😀\nA' : 'bad'; } });
  await admitted(value); assert.equal(reads, 1);
});
test('legacy calls and explicit empty paragraph lists retain native admission', async () => {
  const value = request(); delete value.paragraphs; delete value.paragraphStyle; await admitted(value);
  value.paragraphs = []; await admitted(value);
  value.paragraphs = [{ start: 0, end: 3, kind: 'quote' }]; denied(value);
});
(async () => {
  for (const [name, run] of tests) { await run(); console.log('PASS ' + name); }
  console.log(`${tests.length} native paragraph argument tests passed. Production validation executed;host drawing is blocked and does not prove geometry/paint/ABI.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
