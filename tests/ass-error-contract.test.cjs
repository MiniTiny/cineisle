const f = require('./ass-error-contract-fixture.cjs').make(), { assert } = f;
const tests = [], test = (name, action) => tests.push({ name, action });
const cases = [
  ...[62, 63, 64, 65].map(bytes => ['bytes ' + bytes, 'ass_' + 'a'.repeat(bytes - 4), bytes < 64 ? 'ass_' + 'a'.repeat(bytes - 4) : 'ass_native_failed']),
  ['prefix alone', 'ass_', 'ass_'], ['empty', '', 'ass_native_failed'], ['prefix missing', 'other_failure', 'ass_native_failed'], ['embedded prefix', 'xass_ok', 'ass_native_failed'],
  ['uppercase', 'ass_A', 'ass_native_failed'], ['digit', 'ass_1', 'ass_native_failed'], ['hyphen', 'ass_x-y', 'ass_native_failed'],
  ['space', 'ass_x y', 'ass_native_failed'], ['unicode', 'ass_中😀', 'ass_native_failed'], ['nul suffix', 'ass_ok\0private', 'ass_ok']
];
for (const mode of ['lower', 'sync-create', 'sync-render', 'sync-close', 'async-create', 'async-render']) {
  for (const [label, input, expected] of cases) test(`${mode} ASS error ${label}`, async check => {
    const result = await f.invoke(mode, input);
    check(() => {
      assert.ifError(result.unexpected); assert.equal(result.result, expected);
      if (mode === 'async-create') assert.equal(result.inspection.creates, 1);
      if (mode === 'async-render') assert.equal(result.inspection.renders, 1);
    });
  });
}
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
