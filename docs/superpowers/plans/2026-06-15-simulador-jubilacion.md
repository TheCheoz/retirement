# Simulador de Jubilación (Chile) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir una app web de una sola pantalla (HTML + CDN, sin build) que proyecte ahorro previsional y pensión estimada en Chile, con escenarios pesimista/realista/optimista en vivo.

**Architecture:** Motor de cálculo en JS puro (ESM, sin DOM) separado de la UI. Alpine.js maneja la reactividad de los inputs, Chart.js dibuja la banda de escenarios, Tailwind da los estilos. Persistencia en localStorage + URL hash. Los módulos puros se testean con `node --test`; la app se abre directo en el navegador.

**Tech Stack:** HTML5, Alpine.js (CDN), Chart.js (CDN), Tailwind CSS (CDN), Node 20 `node --test` para tests del motor (zero deps, sin build).

---

## Estructura de archivos

```
retirement/
├── index.html              UI: estructura + Alpine + CDN de libs
├── tests.html              Runner visual de tests en navegador
├── css/app.css             Ajustes puntuales sobre Tailwind
└── js/
    ├── constants.js        Topes legales, tramos de impuesto, defaults
    ├── engine.js           Motor: capitalización, AFP, APV A/B, proyección, escenarios, pensión
    ├── persistence.js      Serialización localStorage + URL (funciones puras)
    ├── store.js            Factory de estado Alpine (une inputs → engine → resultados)
    └── chart.js            Wrapper Chart.js (banda de 3 escenarios)
└── test/
    ├── constants.test.js
    ├── engine.test.js
    └── persistence.test.js
```

**Nota de testing:** `constants.js`, `engine.js` y `persistence.js` son ESM puros sin DOM → se testean con `node --test`. `store.js`, `chart.js` e `index.html` se verifican abriendo el navegador.

---

### Task 1: Constantes y defaults

**Files:**
- Create: `js/constants.js`
- Test: `test/constants.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// test/constants.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/constants.test.js`
Expected: FAIL — `Cannot find module '../js/constants.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/constants.js
export const COTIZACION_OBLIGATORIA = 0.10;
export const BONIFICACION_A_PCT = 0.15;
export const BONIFICACION_A_TOPE_UTM = 6;
export const APV_TOPE_UF_ANUAL = 600;

// Impuesto Único de 2ª Categoría — tramos mensuales en UTM (factor = tasa marginal).
// Valores de referencia; ajustables si cambia la normativa.
export const TRAMOS_IMPUESTO = [
  { desde: 0,    hasta: 13.5,     factor: 0.0 },
  { desde: 13.5, hasta: 30,       factor: 0.04 },
  { desde: 30,   hasta: 50,       factor: 0.08 },
  { desde: 50,   hasta: 70,       factor: 0.135 },
  { desde: 70,   hasta: 90,       factor: 0.23 },
  { desde: 90,   hasta: 120,      factor: 0.304 },
  { desde: 120,  hasta: 310,      factor: 0.35 },
  { desde: 310,  hasta: Infinity, factor: 0.40 },
];

export const DEFAULTS = {
  edadActual: 30,
  edadRetiro: 65,
  expectativaVida: 85,
  sueldoLiquido: 1000000,
  factorImponible: 1.22,
  aporteAFPManual: null,      // null => se deriva del líquido
  saldoAFP: 10000000,
  retornoAFP: 0.04,
  apvRegimen: 'ambas',        // 'A' | 'B' | 'ambas'
  aporteAPV_A: 50000,
  aporteAPV_B: 50000,
  saldoAPV: 2000000,
  retornoAPV: 0.04,
  apvFijo: false,             // false => crece con el sueldo
  reinvertirB: false,
  saldoETF: 0,
  aporteETF: 0,
  retornoETF: 0.06,
  utm: 67000,
  uf: 38000,
  inflacion: 0.03,
  crecimientoSueldo: 0.04,
  ajusteEscenario: 0.02,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/constants.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add js/constants.js test/constants.test.js
git commit -m "feat: add legal constants and input defaults"
```

---

### Task 2: Capitalización mensual de una categoría

**Files:**
- Create: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// test/engine.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `Cannot find module '../js/engine.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/engine.js

// Tasa mensual equivalente a una tasa anual compuesta.
export function tasaMensual(tasaAnual) {
  return Math.pow(1 + tasaAnual, 1 / 12) - 1;
}

// Hace crecer un saldo durante un año, sumando `aporteMensual` cada mes
// y capitalizando mensualmente a `tasaAnual`.
export function crecerAnio(saldoInicial, aporteMensual, tasaAnual) {
  const m = tasaMensual(tasaAnual);
  let saldo = saldoInicial;
  for (let i = 0; i < 12; i++) {
    saldo = saldo * (1 + m) + aporteMensual;
  }
  return saldo;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add monthly compound growth primitives"
```

---

### Task 3: Aporte AFP e imponible desde el líquido

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { imponibleDesdeLiquido, aporteAFPMensual } from '../js/engine.js';

test('imponibleDesdeLiquido: aplica el factor', () => {
  assert.equal(imponibleDesdeLiquido(1000000, 1.22), 1220000);
});

test('aporteAFPMensual: 10% del imponible cuando no hay override', () => {
  assert.equal(aporteAFPMensual({ sueldoLiquido: 1000000, factorImponible: 1.22, aporteAFPManual: null }), 122000);
});

test('aporteAFPMensual: respeta el override manual', () => {
  assert.equal(aporteAFPMensual({ sueldoLiquido: 1000000, factorImponible: 1.22, aporteAFPManual: 90000 }), 90000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `imponibleDesdeLiquido is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
import { COTIZACION_OBLIGATORIA } from './constants.js';

export function imponibleDesdeLiquido(sueldoLiquido, factorImponible) {
  return sueldoLiquido * factorImponible;
}

// Aporte obligatorio mensual a la AFP. Si hay override manual, se usa tal cual.
export function aporteAFPMensual({ sueldoLiquido, factorImponible, aporteAFPManual }) {
  if (aporteAFPManual != null) return aporteAFPManual;
  return imponibleDesdeLiquido(sueldoLiquido, factorImponible) * COTIZACION_OBLIGATORIA;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: derive AFP contribution from net salary"
```

---

### Task 4: Bonificación estatal APV Régimen A

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { bonificacionA } from '../js/engine.js';

test('bonificacionA: 15% del aporte anual bajo el tope', () => {
  // aporte anual 600.000 => 15% = 90.000; tope 6 UTM*67.000 = 402.000 => no aplica tope
  assert.equal(bonificacionA(600000, 67000), 90000);
});

test('bonificacionA: se corta en el tope de 6 UTM', () => {
  // aporte anual 5.000.000 => 15% = 750.000; tope 6*67.000 = 402.000 => se corta
  assert.equal(bonificacionA(5000000, 67000), 402000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `bonificacionA is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
import { BONIFICACION_A_PCT, BONIFICACION_A_TOPE_UTM } from './constants.js';

// Bonificación estatal anual del Régimen A: 15% del aporte, tope 6 UTM/año.
export function bonificacionA(aporteAnualA, utm) {
  return Math.min(BONIFICACION_A_PCT * aporteAnualA, BONIFICACION_A_TOPE_UTM * utm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add APV regime A state bonus with 6 UTM cap"
```

---

### Task 5: Tasa marginal y ahorro tributario Régimen B

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { tasaMarginal, ahorroTributarioB } from '../js/engine.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `tasaMarginal is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
import { TRAMOS_IMPUESTO, APV_TOPE_UF_ANUAL } from './constants.js';

// Tasa marginal del Impuesto Único de 2ª Categoría según el imponible mensual.
export function tasaMarginal(imponibleMensual, utm) {
  const enUTM = imponibleMensual / utm;
  for (const t of TRAMOS_IMPUESTO) {
    if (enUTM > t.desde && enUTM <= t.hasta) return t.factor;
  }
  return 0;
}

// Ahorro tributario anual del Régimen B: aporte (topado a 600 UF) * tasa marginal.
export function ahorroTributarioB(aporteAnualB, imponibleMensual, utm, uf) {
  const topeAnual = APV_TOPE_UF_ANUAL * uf;
  const base = Math.min(aporteAnualB, topeAnual);
  return base * tasaMarginal(imponibleMensual, utm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add regime B marginal tax rate and tax saving"
```

---

### Task 6: Proyección año a año (todas las categorías)

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { proyectar } from '../js/engine.js';

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
  // año 60 es saldo inicial (0); aportes empiezan a acumularse al cierre de cada año
  assert.equal(Math.round(r.total), Math.round(122000 * 12 * 2));
});

test('proyectar: crecimiento de sueldo sube el aporte AFP del año 2', () => {
  const r = proyectar({ ...baseInputs, crecimientoSueldo: 0.10 });
  // año1 aporte 122.000, año2 aporte 134.200 => total = (122000+134200)*12
  assert.equal(Math.round(r.total), Math.round((122000 + 134200) * 12));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `proyectar is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
// Proyecta el ahorro año a año desde edadActual hasta edadRetiro (inclusive).
// `ajuste` desplaza el retorno anual de TODAS las categorías (para escenarios).
// Devuelve { serie:[{edad, saldoAFP, saldoAPV, saldoETF, total}], total,
//            bonoAcumuladoA, ahorroAcumuladoB }.
export function proyectar(inputs, ajuste = 0) {
  const anios = inputs.edadRetiro - inputs.edadActual;
  let saldoAFP = inputs.saldoAFP;
  let saldoAPV = inputs.saldoAPV;
  let saldoETF = inputs.saldoETF;
  let bonoAcumuladoA = 0;
  let ahorroAcumuladoB = 0;

  let sueldoLiquido = inputs.sueldoLiquido;
  let aporteA = inputs.aporteAPV_A;
  let aporteB = inputs.aporteAPV_B;

  const usaA = inputs.apvRegimen === 'A' || inputs.apvRegimen === 'ambas';
  const usaB = inputs.apvRegimen === 'B' || inputs.apvRegimen === 'ambas';

  const serie = [{
    edad: inputs.edadActual,
    saldoAFP, saldoAPV, saldoETF, total: saldoAFP + saldoAPV + saldoETF,
  }];

  for (let i = 0; i < anios; i++) {
    const factorImp = inputs.factorImponible;
    const imponibleMensual = imponibleDesdeLiquido(sueldoLiquido, factorImp);
    const aporteAFP = aporteAFPMensual({ sueldoLiquido, factorImponible: factorImp, aporteAFPManual: inputs.aporteAFPManual });

    const apvA = usaA ? aporteA : 0;
    const apvB = usaB ? aporteB : 0;

    saldoAFP = crecerAnio(saldoAFP, aporteAFP, inputs.retornoAFP + ajuste);
    saldoAPV = crecerAnio(saldoAPV, apvA + apvB, inputs.retornoAPV + ajuste);
    saldoETF = crecerAnio(saldoETF, inputs.aporteETF, inputs.retornoETF + ajuste);

    // Beneficios anuales del APV
    if (usaA) {
      const bono = bonificacionA(apvA * 12, inputs.utm);
      bonoAcumuladoA += bono;
      saldoAPV += bono; // el bono A se deposita en el fondo
    }
    if (usaB) {
      const ahorro = ahorroTributarioB(apvB * 12, imponibleMensual, inputs.utm, inputs.uf);
      ahorroAcumuladoB += ahorro;
      if (inputs.reinvertirB) saldoAPV += ahorro;
    }

    serie.push({
      edad: inputs.edadActual + i + 1,
      saldoAFP, saldoAPV, saldoETF, total: saldoAFP + saldoAPV + saldoETF,
    });

    // Crecimiento anual para el próximo año
    sueldoLiquido *= (1 + inputs.crecimientoSueldo);
    if (!inputs.apvFijo) {
      aporteA *= (1 + inputs.crecimientoSueldo);
      aporteB *= (1 + inputs.crecimientoSueldo);
    }
  }

  return {
    serie,
    total: serie.at(-1).total,
    bonoAcumuladoA,
    ahorroAcumuladoB,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (15 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add year-by-year multi-category projection"
```

---

### Task 7: Escenarios pesimista / realista / optimista

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { escenarios } from '../js/engine.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `escenarios is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
// Devuelve las 3 proyecciones aplicando ∓ajusteEscenario al retorno.
export function escenarios(inputs) {
  const d = inputs.ajusteEscenario;
  return {
    pesimista: proyectar(inputs, -d),
    realista: proyectar(inputs, 0),
    optimista: proyectar(inputs, +d),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add pessimistic/realistic/optimistic scenarios"
```

---

### Task 8: Pensión estimada y conversión nominal/real

**Files:**
- Modify: `js/engine.js`
- Test: `test/engine.test.js`

- [ ] **Step 1: Write the failing test (append)**

```javascript
import { pensionEstimada, aReal } from '../js/engine.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.js`
Expected: FAIL — `pensionEstimada is not a function`

- [ ] **Step 3: Write minimal implementation (append to engine.js)**

```javascript
// Pensión mensual estimada (retiro programado simplificado): saldo / meses esperados.
export function pensionEstimada(saldoFinal, edadRetiro, expectativaVida) {
  const meses = (expectativaVida - edadRetiro) * 12;
  if (meses <= 0) return 0;
  return saldoFinal / meses;
}

// Convierte una serie nominal a pesos de hoy descontando inflación.
export function aReal(serie, inflacion, edadActual) {
  return serie.map((p) => ({
    ...p,
    total: p.total / Math.pow(1 + inflacion, p.edad - edadActual),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/engine.test.js`
Expected: PASS (21 tests)

- [ ] **Step 5: Commit**

```bash
git add js/engine.js test/engine.test.js
git commit -m "feat: add pension estimate and real-terms conversion"
```

---

### Task 9: Persistencia (localStorage + URL)

**Files:**
- Create: `js/persistence.js`
- Test: `test/persistence.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// test/persistence.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/persistence.test.js`
Expected: FAIL — `Cannot find module '../js/persistence.js'`

- [ ] **Step 3: Write minimal implementation**

```javascript
// js/persistence.js
const KEY_STATE = 'retiro:estado';
const KEY_SCENARIOS = 'retiro:escenarios';

// --- Serialización para URL (funciones puras, testeables sin navegador) ---

// Codifica inputs a base64 (compatible navegador y Node).
export function encodeState(inputs) {
  const json = JSON.stringify(inputs);
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(json)));
  return Buffer.from(json, 'utf-8').toString('base64');
}

export function decodeState(encoded) {
  if (!encoded) return null;
  try {
    const json = typeof atob === 'function'
      ? decodeURIComponent(escape(atob(encoded)))
      : Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// --- localStorage (sólo navegador; no-ops si no existe) ---

export function saveState(inputs) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_STATE, JSON.stringify(inputs));
}

export function loadState() {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(KEY_STATE);
  return raw ? JSON.parse(raw) : null;
}

export function saveScenarios(list) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY_SCENARIOS, JSON.stringify(list));
}

export function loadScenarios() {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(KEY_SCENARIOS);
  return raw ? JSON.parse(raw) : [];
}

// --- URL hash ---

export function readStateFromHash() {
  if (typeof location === 'undefined') return null;
  return decodeState(location.hash.replace(/^#/, ''));
}

export function writeStateToHash(inputs) {
  if (typeof location === 'undefined') return;
  location.hash = encodeState(inputs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/persistence.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add js/persistence.js test/persistence.test.js
git commit -m "feat: add state persistence and URL sharing"
```

---

### Task 10: Runner de tests en navegador

**Files:**
- Create: `tests.html`

- [ ] **Step 1: Write tests.html (confirmación visual de que el motor corre en navegador)**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Tests — Motor del Simulador</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; background:#0d1117; color:#cdd; }
    .ok { color:#4ade80; } .fail { color:#f87171; }
    pre { background:#161b22; padding:1rem; border-radius:8px; }
  </style>
</head>
<body>
  <h1>Tests del motor (navegador)</h1>
  <pre id="out"></pre>
  <script type="module">
    import { bonificacionA, escenarios, pensionEstimada } from './js/engine.js';
    import { encodeState, decodeState } from './js/persistence.js';

    const out = document.getElementById('out');
    let pass = 0, fail = 0;
    function check(name, cond) {
      const line = (cond ? '✓ ' : '✗ ') + name;
      out.innerHTML += `<span class="${cond ? 'ok' : 'fail'}">${line}</span>\n`;
      cond ? pass++ : fail++;
    }

    check('bonificacionA respeta tope 6 UTM', bonificacionA(5000000, 67000) === 402000);
    check('pensionEstimada saldo/meses', pensionEstimada(120000000, 65, 85) === 500000);
    check('encode/decode round-trip', (() => {
      const o = { a: 1, b: 'x' }; return JSON.stringify(decodeState(encodeState(o))) === JSON.stringify(o);
    })());
    const e = escenarios({
      edadActual: 30, edadRetiro: 65, expectativaVida: 85, sueldoLiquido: 1000000,
      factorImponible: 1.22, aporteAFPManual: null, saldoAFP: 10000000, retornoAFP: 0.05,
      apvRegimen: 'ambas', aporteAPV_A: 50000, aporteAPV_B: 50000, saldoAPV: 2000000,
      retornoAPV: 0.04, apvFijo: false, reinvertirB: false, saldoETF: 0, aporteETF: 0,
      retornoETF: 0.06, utm: 67000, uf: 38000, inflacion: 0.03, crecimientoSueldo: 0.04,
      ajusteEscenario: 0.02,
    });
    check('optimista > realista > pesimista', e.optimista.total > e.realista.total && e.realista.total > e.pesimista.total);

    out.innerHTML += `\n${fail === 0 ? '<span class="ok">TODOS PASARON</span>' : '<span class="fail">HAY FALLOS</span>'} (${pass} ok, ${fail} fail)\n`;
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Run: abrir `tests.html` en el navegador (doble clic o `open tests.html`).
Expected: todas las líneas en verde con "TODOS PASARON".

- [ ] **Step 3: Commit**

```bash
git add tests.html
git commit -m "test: add in-browser engine test runner"
```

---

### Task 11: Estado Alpine (store)

**Files:**
- Create: `js/store.js`

- [ ] **Step 1: Write store.js**

```javascript
// js/store.js
import { DEFAULTS } from './constants.js';
import { escenarios, pensionEstimada, aReal } from './engine.js';
import { saveState, loadState, readStateFromHash, writeStateToHash,
         loadScenarios, saveScenarios } from './persistence.js';

export function simulador() {
  return {
    inputs: { ...DEFAULTS, ...(readStateFromHash() || loadState() || {}) },
    vistaReal: false,
    escenariosGuardados: loadScenarios(),
    resultado: null,
    pension: { pesimista: 0, realista: 0, optimista: 0 },

    init() {
      this.recalcular();
      // Recalcula y persiste ante cualquier cambio de inputs (con debounce simple).
      this.$watch('inputs', () => this.onChange(), { deep: true });
      this.$watch('vistaReal', () => this.recalcular());
    },

    _debounce: null,
    onChange() {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        this.recalcular();
        saveState(this.inputs);
        writeStateToHash(this.inputs);
      }, 200);
    },

    recalcular() {
      const e = escenarios(this.inputs);
      const conv = (esc) => this.vistaReal
        ? { ...esc, serie: aReal(esc.serie, this.inputs.inflacion, this.inputs.edadActual),
            total: aReal(esc.serie, this.inputs.inflacion, this.inputs.edadActual).at(-1).total }
        : esc;
      this.resultado = {
        pesimista: conv(e.pesimista), realista: conv(e.realista), optimista: conv(e.optimista),
      };
      this.pension = {
        pesimista: pensionEstimada(this.resultado.pesimista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
        realista: pensionEstimada(this.resultado.realista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
        optimista: pensionEstimada(this.resultado.optimista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
      };
      // chart.js escucha este evento para redibujar (Task 13)
      this.$dispatch('resultado-actualizado', this.resultado);
    },

    guardarEscenario() {
      const nombre = prompt('Nombre del escenario:');
      if (!nombre) return;
      this.escenariosGuardados.push({ nombre, inputs: { ...this.inputs } });
      saveScenarios(this.escenariosGuardados);
    },

    cargarEscenario(i) {
      this.inputs = { ...this.escenariosGuardados[i].inputs };
    },

    eliminarEscenario(i) {
      this.escenariosGuardados.splice(i, 1);
      saveScenarios(this.escenariosGuardados);
    },

    compartir() {
      writeStateToHash(this.inputs);
      navigator.clipboard.writeText(location.href);
      alert('URL copiada al portapapeles');
    },

    reset() {
      this.inputs = { ...DEFAULTS };
    },

    get fmt() {
      return (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n || 0);
    },
  };
}

window.simulador = simulador;
```

- [ ] **Step 2: Commit**

```bash
git add js/store.js
git commit -m "feat: add Alpine store wiring inputs to engine"
```

---

### Task 12: Wrapper de Chart.js (banda de escenarios)

**Files:**
- Create: `js/chart.js`

- [ ] **Step 1: Write chart.js**

```javascript
// js/chart.js  — se carga después de Chart.js (CDN, global `Chart`)
let chart = null;

export function initChart(canvas) {
  chart = new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#cdd' } } },
      scales: {
        x: { ticks: { color: '#9aa' }, title: { display: true, text: 'Edad', color: '#9aa' } },
        y: { ticks: { color: '#9aa', callback: (v) => '$' + (v / 1e6).toFixed(0) + 'M' } },
      },
    },
  });
  return chart;
}

export function updateChart(resultado) {
  if (!chart) return;
  const labels = resultado.realista.serie.map((p) => p.edad);
  const linea = (serie, color, fill) => ({
    label: '', data: serie.map((p) => Math.round(p.total)),
    borderColor: color, backgroundColor: color + '22', borderWidth: 2,
    pointRadius: 0, fill,
  });
  chart.data.labels = labels;
  chart.data.datasets = [
    { ...linea(resultado.optimista.serie, '#4ade80', false), label: 'Optimista' },
    { ...linea(resultado.realista.serie, '#60a5fa', '-1'), label: 'Realista' },
    { ...linea(resultado.pesimista.serie, '#f87171', '-1'), label: 'Pesimista' },
  ];
  chart.update();
}
```

- [ ] **Step 2: Commit**

```bash
git add js/chart.js
git commit -m "feat: add Chart.js scenario band wrapper"
```

---

### Task 13: index.html — estructura, controles y resultados

**Files:**
- Create: `index.html`
- Create: `css/app.css`

- [ ] **Step 1: Write css/app.css**

```css
/* css/app.css — ajustes sobre Tailwind */
[x-cloak] { display: none !important; }
body { background: #0d1117; color: #e6edf3; }
.field { @apply flex flex-col gap-1 text-sm; }
.field input, .field select {
  background:#161b22; border:1px solid #30363d; border-radius:6px;
  padding:.4rem .5rem; color:#e6edf3;
}
.field input.invalid { border-color:#f87171; }
.kpi { background:#161b22; border:1px solid #30363d; border-radius:10px; padding:1rem; }
```

- [ ] **Step 2: Write index.html**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Simulador de Jubilación · Chile</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link rel="stylesheet" href="css/app.css" />
  <script type="module">
    import './js/store.js';
    import { initChart, updateChart } from './js/chart.js';
    window.addEventListener('DOMContentLoaded', () => {
      const canvas = document.getElementById('grafico');
      window.addEventListener('chart-ready', () => initChart(canvas));
      document.addEventListener('resultado-actualizado', (e) => updateChart(e.detail));
      // Chart global ya disponible por defer; inicializamos tras Alpine init.
      setTimeout(() => { initChart(canvas); document.dispatchEvent(new CustomEvent('forzar-redibujo')); }, 0);
    });
  </script>
</head>
<body x-data="simulador()" x-init="init()" x-cloak class="min-h-screen">
  <div class="grid md:grid-cols-[340px_1fr] gap-4 p-4 max-w-7xl mx-auto">

    <!-- PANEL IZQUIERDO: CONTROLES -->
    <aside class="space-y-3">
      <h1 class="text-lg font-bold">Simulador de Jubilación 🇨🇱</h1>

      <details open class="kpi"><summary class="cursor-pointer font-semibold">Perfil</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field">Edad actual<input type="number" x-model.number="inputs.edadActual"></label>
          <label class="field">Edad retiro<input type="number" x-model.number="inputs.edadRetiro" :class="inputs.edadRetiro <= inputs.edadActual && 'invalid'"></label>
          <label class="field">Expectativa vida<input type="number" x-model.number="inputs.expectativaVida"></label>
        </div>
      </details>

      <details class="kpi"><summary class="cursor-pointer font-semibold">Ingresos</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field">Sueldo líquido<input type="number" x-model.number="inputs.sueldoLiquido"></label>
          <label class="field">Factor imponible<input type="number" step="0.01" x-model.number="inputs.factorImponible"></label>
          <label class="field">Aporte AFP (manual)<input type="number" placeholder="auto" x-model.number="inputs.aporteAFPManual"></label>
          <label class="field">Crec. sueldo %<input type="number" step="0.01" :value="inputs.crecimientoSueldo*100" @input="inputs.crecimientoSueldo=$event.target.value/100"></label>
        </div>
      </details>

      <details class="kpi"><summary class="cursor-pointer font-semibold">AFP</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field">Saldo inicial<input type="number" x-model.number="inputs.saldoAFP"></label>
          <label class="field">Retorno anual %<input type="number" step="0.01" :value="inputs.retornoAFP*100" @input="inputs.retornoAFP=$event.target.value/100"></label>
        </div>
      </details>

      <details class="kpi"><summary class="cursor-pointer font-semibold">APV</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field col-span-2">Régimen
            <select x-model="inputs.apvRegimen"><option value="A">A</option><option value="B">B</option><option value="ambas">Ambas</option></select>
          </label>
          <label class="field">Aporte A /mes<input type="number" x-model.number="inputs.aporteAPV_A"></label>
          <label class="field">Aporte B /mes<input type="number" x-model.number="inputs.aporteAPV_B"></label>
          <label class="field">Saldo inicial<input type="number" x-model.number="inputs.saldoAPV"></label>
          <label class="field">Retorno anual %<input type="number" step="0.01" :value="inputs.retornoAPV*100" @input="inputs.retornoAPV=$event.target.value/100"></label>
          <label class="field flex-row items-center gap-2"><input type="checkbox" x-model="inputs.apvFijo"> APV fijo</label>
          <label class="field flex-row items-center gap-2"><input type="checkbox" x-model="inputs.reinvertirB"> Reinvertir ahorro B</label>
        </div>
      </details>

      <details class="kpi"><summary class="cursor-pointer font-semibold">ETF</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field">Saldo inicial<input type="number" x-model.number="inputs.saldoETF"></label>
          <label class="field">Aporte /mes<input type="number" x-model.number="inputs.aporteETF"></label>
          <label class="field">Retorno anual %<input type="number" step="0.01" :value="inputs.retornoETF*100" @input="inputs.retornoETF=$event.target.value/100"></label>
        </div>
      </details>

      <details class="kpi"><summary class="cursor-pointer font-semibold">Supuestos</summary>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <label class="field">UTM<input type="number" x-model.number="inputs.utm"></label>
          <label class="field">UF<input type="number" x-model.number="inputs.uf"></label>
          <label class="field">Inflación %<input type="number" step="0.01" :value="inputs.inflacion*100" @input="inputs.inflacion=$event.target.value/100"></label>
          <label class="field">Ajuste escenario ±%<input type="number" step="0.01" :value="inputs.ajusteEscenario*100" @input="inputs.ajusteEscenario=$event.target.value/100"></label>
        </div>
      </details>

      <div class="flex gap-2">
        <button @click="reset()" class="kpi flex-1 text-sm">Reset</button>
        <button @click="guardarEscenario()" class="kpi flex-1 text-sm">Guardar</button>
        <button @click="compartir()" class="kpi flex-1 text-sm">Compartir</button>
      </div>
    </aside>

    <!-- PANEL DERECHO: RESULTADOS -->
    <main class="space-y-4">
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" x-model="vistaReal"> Ver en pesos de hoy (real)</label>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" x-show="resultado">
        <div class="kpi"><div class="text-xs text-gray-400">Saldo final (realista)</div>
          <div class="text-xl font-bold text-blue-400" x-text="fmt(resultado.realista.total)"></div>
          <div class="text-xs text-gray-500"><span x-text="fmt(resultado.pesimista.total)"></span> – <span x-text="fmt(resultado.optimista.total)"></span></div>
        </div>
        <div class="kpi"><div class="text-xs text-gray-400">Pensión mensual (est.)</div>
          <div class="text-xl font-bold text-green-400" x-text="fmt(pension.realista)"></div></div>
        <div class="kpi"><div class="text-xs text-gray-400">Bono estatal A acum.</div>
          <div class="text-lg font-bold" x-text="fmt(resultado.realista.bonoAcumuladoA)"></div></div>
        <div class="kpi"><div class="text-xs text-gray-400">Ahorro tributario B acum.</div>
          <div class="text-lg font-bold" x-text="fmt(resultado.realista.ahorroAcumuladoB)"></div></div>
      </div>

      <div class="kpi" style="height:380px"><canvas id="grafico"></canvas></div>

      <div class="kpi" x-show="escenariosGuardados.length">
        <div class="text-sm font-semibold mb-2">Escenarios guardados</div>
        <div class="flex flex-wrap gap-2">
          <template x-for="(e, i) in escenariosGuardados" :key="i">
            <span class="flex items-center gap-1 bg-gray-800 rounded-full px-3 py-1 text-sm">
              <button @click="cargarEscenario(i)" x-text="e.nombre"></button>
              <button @click="eliminarEscenario(i)" class="text-red-400">×</button>
            </span>
          </template>
        </div>
      </div>
    </main>
  </div>
</body>
</html>
```

- [ ] **Step 3: Verify in browser**

Run: `open index.html`
Expected: carga sin valores vacíos; las tarjetas KPI muestran montos; el gráfico dibuja 3 curvas; al cambiar "Edad retiro" o cualquier retorno, las tarjetas y el gráfico se actualizan en vivo.

- [ ] **Step 4: Commit**

```bash
git add index.html css/app.css
git commit -m "feat: add UI shell with controls, KPIs and chart"
```

---

### Task 14: Validación visual y verificación final

**Files:**
- Modify: `index.html` (ya incluye la clase `invalid` para edad retiro; añadir guardas numéricas)

- [ ] **Step 1: Añadir guarda de recálculo ante inputs inválidos en `js/store.js`**

En `recalcular()`, al inicio del método, insertar:

```javascript
    recalcular() {
      // Guarda: si los inputs no son válidos, no recalcula (mantiene último estado válido)
      if (this.inputs.edadRetiro <= this.inputs.edadActual) return;
      if (this.inputs.sueldoLiquido < 0 || this.inputs.utm <= 0 || this.inputs.uf <= 0) return;
      const e = escenarios(this.inputs);
      // ...resto igual
```

- [ ] **Step 2: Verify in browser (recorrido completo)**

Run: `open index.html`
Checklist manual:
- Abre con defaults y muestra gráfico + KPIs (no vacío).
- Cambiar "Edad retiro" a un valor menor que la edad actual → el input se marca rojo y el gráfico NO cambia (mantiene último válido).
- Subir "Retorno ETF" → suben los KPIs y la banda.
- Activar "Ver en pesos de hoy (real)" → los montos bajan (descuento de inflación).
- "Guardar" un escenario con nombre → aparece chip; recargar la página → el chip sigue ahí.
- "Compartir" → copia URL; abrir esa URL en pestaña nueva → reconstruye los mismos inputs.

- [ ] **Step 3: Run engine tests once more (regresión)**

Run: `node --test test/`
Expected: PASS (todos los tests de constants, engine, persistence).

- [ ] **Step 4: Commit**

```bash
git add index.html js/store.js
git commit -m "feat: add input validation guard and finalize UI"
```

---

## Self-Review (cobertura de la spec)

- Saldo acumulado + pensión mensual → Tasks 6, 8, 13 (KPIs). ✅
- APV A/B con reglas SII → Tasks 4, 5, 6. ✅
- Toggle nominal/real → Tasks 8, 11, 13. ✅
- Guardar + comparar + compartir URL → Tasks 9, 11, 13. ✅
- Layout panel lateral fijo → Task 13. ✅
- Banda simultánea de 3 escenarios → Tasks 7, 12, 13. ✅
- Inflación y crecimiento de sueldo → Tasks 1, 6, 8. ✅
- Stack Alpine + Chart.js + Tailwind CDN → Task 13. ✅
- Validación / no crashea → Task 14. ✅
- Testing del motor → Tasks 1–9 (node --test) + Task 10 (navegador). ✅

Consistencia de nombres verificada: `proyectar`, `escenarios`, `bonificacionA`, `ahorroTributarioB`, `tasaMarginal`, `pensionEstimada`, `aReal`, `encodeState`/`decodeState`, `simulador()`, `initChart`/`updateChart` se usan idénticos entre tasks.
