import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasaMensual, crecerAnio, imponibleDesdeLiquido, aporteAFPMensual, bonificacionA, tasaMarginal, ahorroTributarioB } from '../js/engine.js';

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

test('imponibleDesdeLiquido: aplica el factor', () => {
  assert.equal(imponibleDesdeLiquido(1000000, 1.22), 1220000);
});

test('aporteAFPMensual: 10% del imponible cuando no hay override', () => {
  assert.equal(aporteAFPMensual({ sueldoLiquido: 1000000, factorImponible: 1.22, aporteAFPManual: null }), 122000);
});

test('aporteAFPMensual: respeta el override manual', () => {
  assert.equal(aporteAFPMensual({ sueldoLiquido: 1000000, factorImponible: 1.22, aporteAFPManual: 90000 }), 90000);
});

test('bonificacionA: 15% del aporte anual bajo el tope', () => {
  // aporte anual 600.000 => 15% = 90.000; tope 6 UTM*67.000 = 402.000 => no aplica tope
  assert.equal(bonificacionA(600000, 67000), 90000);
});

test('bonificacionA: se corta en el tope de 6 UTM', () => {
  // aporte anual 5.000.000 => 15% = 750.000; tope 6*67.000 = 402.000 => se corta
  assert.equal(bonificacionA(5000000, 67000), 402000);
});

test('tasaMarginal: imponible exento (bajo 13.5 UTM) => 0%', () => {
  // 13.5 UTM * 67.000 = 904.500; usamos 800.000 => exento
  assert.equal(tasaMarginal(800000, 67000), 0.0);
});

test('tasaMarginal: imponible en tramo 8%', () => {
  // entre 30 y 50 UTM => 30*67.000=2.010.000 .. 50*67.000=3.350.000; usamos 2.500.000
  assert.equal(tasaMarginal(2500000, 67000), 0.08);
});

test('ahorroTributarioB: aporte * tasa marginal', () => {
  // imponible 2.500.000 => 8%; aporte anual 600.000 => ahorro 48.000
  assert.equal(ahorroTributarioB(600000, 2500000, 67000, 38000), 48000);
});

test('ahorroTributarioB: aporte se limita al tope de 600 UF anual', () => {
  // tope = 600*38.000 = 22.800.000; aporte 30.000.000 => se usa 22.800.000
  // imponible en 8% => ahorro = 22.800.000 * 0.08 = 1.824.000
  assert.equal(ahorroTributarioB(30000000, 2500000, 67000, 38000), 1824000);
});
