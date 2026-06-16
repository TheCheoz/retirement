import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tasaMensual, crecerAnio, imponibleDesdeLiquido, aporteAFPMensual, bonificacionA, tasaMarginal, ahorroTributarioB, proyectar, escenarios, pensionEstimada, aReal } from '../js/engine.js';

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

const baseInputs = {
  edadActual: 60, edadRetiro: 62, expectativaVida: 85,
  sueldoLiquido: 1000000, factorImponible: 1.22, aporteAFPManual: null,
  saldoAFP: 0, retornoAFP: 0,
  apvRegimen: 'ambas', aporteAPV_A: 0, aporteAPV_B: 0, saldoAPV: 0, retornoAPV: 0,
  apvFijo: true, reinvertirB: false,
  saldoETF: 0, aporteETF: 0, retornoETF: 0,
  utm: 67000, uf: 38000, inflacion: 0, crecimientoSueldo: 0, ajusteEscenario: 0,
};

test('proyectar: una fila por año desde edadActual hasta edadRetiro inclusive', () => {
  const r = proyectar(baseInputs);
  assert.equal(r.serie.length, 3); // 60, 61, 62
  assert.equal(r.serie[0].edad, 60);
  assert.equal(r.serie.at(-1).edad, 62);
});

test('proyectar: sin retorno ni crecimiento, AFP acumula 12*aporte por año', () => {
  const r = proyectar(baseInputs);
  // aporte AFP = 10% * 1.220.000 = 122.000/mes => 1.464.000/año, 2 años de aportes
  assert.equal(Math.round(r.total), Math.round(122000 * 12 * 2));
});

test('proyectar: crecimiento de sueldo sube el aporte AFP del año 2', () => {
  const r = proyectar({ ...baseInputs, crecimientoSueldo: 0.10 });
  // año1 aporte 122.000, año2 aporte 134.200 => total = (122000+134200)*12
  assert.equal(Math.round(r.total), Math.round((122000 + 134200) * 12));
});

test('escenarios: realista usa el retorno base', () => {
  const r = escenarios({ ...baseInputs, retornoAFP: 0.04, ajusteEscenario: 0.02 });
  const directo = proyectar({ ...baseInputs, retornoAFP: 0.04 });
  assert.equal(Math.round(r.realista.total), Math.round(directo.total));
});

test('escenarios: optimista > realista > pesimista cuando hay aportes y retorno', () => {
  const r = escenarios({ ...baseInputs, saldoAFP: 10000000, retornoAFP: 0.05, ajusteEscenario: 0.02 });
  assert.ok(r.optimista.total > r.realista.total);
  assert.ok(r.realista.total > r.pesimista.total);
});

test('escenarios: el ajuste aplicado es ±ajusteEscenario', () => {
  const r = escenarios({ ...baseInputs, saldoAFP: 10000000, retornoAFP: 0.05, ajusteEscenario: 0.02 });
  const opt = proyectar({ ...baseInputs, saldoAFP: 10000000, retornoAFP: 0.05 }, 0.02);
  assert.equal(Math.round(r.optimista.total), Math.round(opt.total));
});

test('pensionEstimada: saldo dividido por meses esperados', () => {
  // saldo 120.000.000; (85-65)*12 = 240 meses => 500.000
  assert.equal(pensionEstimada(120000000, 65, 85), 500000);
});

test('pensionEstimada: 0 meses esperados => 0 (sin división por cero)', () => {
  assert.equal(pensionEstimada(120000000, 85, 85), 0);
});

test('aReal: descuenta inflación según años desde hoy', () => {
  const serie = [
    { edad: 30, total: 1000000 },
    { edad: 31, total: 1000000 },
  ];
  const r = aReal(serie, 0.10, 30);
  assert.equal(Math.round(r[0].total), 1000000);          // año 0
  assert.equal(Math.round(r[1].total), Math.round(1000000 / 1.1)); // año 1
});
