import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeState, decodeState } from '../js/persistence.js';

test('encode/decode son inversos (round-trip)', () => {
  const inputs = { edadActual: 30, sueldoLiquido: 1000000, retornoETF: 0.06 };
  const encoded = encodeState(inputs);
  assert.equal(typeof encoded, 'string');
  assert.deepEqual(decodeState(encoded), inputs);
});

test('decodeState: string inválido devuelve null', () => {
  assert.equal(decodeState('no-es-base64-valido-#%&'), null);
});

test('decodeState: vacío devuelve null', () => {
  assert.equal(decodeState(''), null);
});
