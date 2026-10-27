const f = require('./literal-mutation-fixture.cjs'), { assert } = f, { replaceLiteral } = require('./literal-mutation.cjs');
const tests = [], test = (name, action) => tests.push({ name, action });
const tokens = [['match', '$&'], ['prefix', '$`'], ['suffix', "$'"], ['dollar', '$$'], ['unicode', '中😀\0\n']];
for (const [label, value] of tokens) {
  test('literal helper replacement ' + label, async check => {
    const before = "const prefix = 'before';\nmodule.exports = ", old = "'sentinel'", after = ';\n', replacement = JSON.stringify(value);
    const expected = before + replacement + after, result = await f.execute(replaceLiteral(before + old + after, old, replacement), expected);
    check(() => { assert.ifError(result.unexpected); assert.equal(result.source, expected); assert.equal(result.output, value); });
  });
  test('literal pipeline target ' + label, async check => {
    const result = await f.target(value);
    check(() => { assert.ifError(result.unexpected); assert.equal(result.output, 'literal_original'); });
  });
}
test('literal helper replacement regex-template', async check => {
  const before = 'const min = 6, max = 12;\nmodule.exports = new RegExp(', after = ").test('abc123');\n";
  const old = '`^\\d{${min},${max}}$`', replacement = '`^.{${min},${max}}$`', expected = before + replacement + after;
  const result = await f.execute(replaceLiteral(before + old + after, old, replacement), expected);
  check(() => { assert.ifError(result.unexpected); assert.equal(result.source, expected); assert.equal(result.output, true); });
});
for (const [label, source, old, replacement] of [['missing', 'abc', 'x', 'y'], ['ambiguous', 'abcabc', 'abc', 'x'], ['empty', 'xy', '', 'y'], ['non-string-source', 4, 'a', 'b'], ['non-string-anchor', 'abc', null, 'b'], ['non-string-replacement', 'abc', 'a', 3]]) test('literal anchor refuses ' + label, async check => {
  let error; try { replaceLiteral(source, old, replacement); } catch (value) { error = value; }
  check(() => { assert.equal(error?.code, 'ERR_ASSERTION'); });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
