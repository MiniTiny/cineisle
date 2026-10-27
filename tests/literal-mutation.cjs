const assert = require('node:assert/strict');
function replaceLiteral(source, old, replacement, message = 'Stale or ambiguous mutation') {
  assert.equal(typeof source, 'string'); assert.equal(typeof old, 'string'); assert.equal(typeof replacement, 'string');
  assert.ok(old.length > 0, 'Empty mutation anchor');
  assert.equal(source.split(old).length, 2, message);
  // Recipe text is literal source, not JavaScript's $&, $`, $' or $$ syntax.
  return source.replace(old, () => replacement);
}
module.exports = { replaceLiteral };
