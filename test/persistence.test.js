const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encodeState, decodeState } = require('../js/persistence.js');

test('encode/decode are inverses (round-trip)', () => {
  const inputs = { currentAge: 30, netSalary: 1000000, etfReturn: 0.06 };
  const encoded = encodeState(inputs);
  assert.equal(typeof encoded, 'string');
  assert.deepEqual(decodeState(encoded), inputs);
});

test('decodeState: invalid string returns null', () => {
  assert.equal(decodeState('not-valid-base64-#%&'), null);
});

test('decodeState: empty returns null', () => {
  assert.equal(decodeState(''), null);
});
