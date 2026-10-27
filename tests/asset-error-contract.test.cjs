const f = require('./asset-error-fixture.cjs'), { assert } = f, tests = [], test = (name, action) => tests.push({ name, action });
const messages = { 'lock-query': ['lock_storage_failed', '安全存储不可用，保持锁定；请恢复系统安全存储后重启应用'], 'lock-remove': ['lock_storage_failed', '安全存储不可用，保持锁定；请恢复系统安全存储后重启应用'], 'session-query': ['session_read_failed', '无法读取安全登录凭据，请解锁设备后重试'], 'session-remove': ['session_clear_failed', '无法清除安全登录凭据'] };
for (const operation of Object.keys(messages)) for (const value of [24000002, 24000001, 24000003, '24000002', 'missing-code', 'general', 'success']) test(operation + ' preserves ' + typeof value + ' ' + value, async check => {
  const state = await f.invoke(operation, value);
  check(() => {
    const successful = value === 24000002 || value === 'success';
    assert.ok(state.calls['asset-' + (operation.endsWith('query') ? 'query' : 'remove')] >= 1);
    if (!successful) { assert.equal(state.error?.message, messages[operation][0]); assert.equal(state.message, messages[operation][1]); assert.deepEqual(state.after, state.before); }
    else assert.ifError(state.error);
    if (operation === 'lock-query') { assert.equal(state.locked, value !== 24000002); assert.equal(state.enabled, value !== 24000002); assert.equal(state.fault, !successful); assert.equal(state.initialized, successful); }
    if (operation === 'lock-remove') { assert.equal(state.enabled, !successful); assert.equal(state.locked, !successful); assert.equal(state.fault, false); assert.equal(state.stored, !successful); }
    if (operation === 'session-query') { assert.equal(state.result?.userId, value === 'success' ? 'user' : undefined); assert.deepEqual(state.after, state.before); }
    if (operation === 'session-remove') { assert.equal(state.stored, !successful); assert.equal(state.partStored, !successful); }
  });
});
f.run(tests).catch(error => { console.error(error); process.exitCode = 1; });
