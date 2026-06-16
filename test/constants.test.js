import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COTIZACION_OBLIGATORIA, BONIFICACION_A_PCT, BONIFICACION_A_TOPE_UTM,
  APV_TOPE_UF_ANUAL, TRAMOS_IMPUESTO, DEFAULTS,
} from '../js/constants.js';

test('cotización obligatoria AFP es 10%', () => {
  assert.equal(COTIZACION_OBLIGATORIA, 0.10);
});

test('bonificación A: 15% con tope 6 UTM', () => {
  assert.equal(BONIFICACION_A_PCT, 0.15);
  assert.equal(BONIFICACION_A_TOPE_UTM, 6);
});

test('tope APV con beneficio tributario: 600 UF anual', () => {
  assert.equal(APV_TOPE_UF_ANUAL, 600);
});

test('tramos de impuesto cubren desde 0 y están ordenados', () => {
  assert.equal(TRAMOS_IMPUESTO[0].desde, 0);
  for (let i = 1; i < TRAMOS_IMPUESTO.length; i++) {
    assert.equal(TRAMOS_IMPUESTO[i].desde, TRAMOS_IMPUESTO[i - 1].hasta);
  }
});

test('DEFAULTS trae todos los inputs base', () => {
  for (const k of ['edadActual','edadRetiro','expectativaVida','sueldoLiquido',
    'factorImponible','utm','uf','inflacion','crecimientoSueldo','ajusteEscenario']) {
    assert.ok(k in DEFAULTS, `falta default ${k}`);
  }
});
