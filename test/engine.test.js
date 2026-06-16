import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasaMensual, crecerAnio } from '../js/engine.js';

test('tasaMensual: 12 meses compuestos reconstruyen la tasa anual', () => {
  const m = tasaMensual(0.06);
  assert.ok(Math.abs(Math.pow(1 + m, 12) - 1.06) < 1e-9);
});

test('crecerAnio: sin aportes, crece exactamente la tasa anual', () => {
  const saldo = crecerAnio(1000000, 0, 0.06);
  assert.ok(Math.abs(saldo - 1060000) < 0.01);
});

test('crecerAnio: con aporte mensual acumula 12 aportes más interés', () => {
  const saldo = crecerAnio(0, 100000, 0); // tasa 0 => 12 aportes exactos
  assert.equal(Math.round(saldo), 1200000);
});
