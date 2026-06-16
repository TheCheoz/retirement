# Simulador de Jubilación (Chile) — Documento de Diseño

**Fecha:** 2026-06-15
**Estado:** Aprobado para implementación

## Objetivo

Aplicación web de una sola pantalla que permita proyectar el ahorro previsional
y la pensión estimada de una persona en Chile, jugando con filtros en vivo
(AFP, APV Régimen A/B, ETFs) y comparando escenarios pesimista / realista /
optimista. Sin build, solo HTML + librerías por CDN.

## Alcance

**Incluye:**
- Proyección año a año del saldo acumulado (AFP + APV + ETF) hasta la edad de retiro.
- Estimación de pensión mensual aproximada (vista secundaria).
- Reglas SII para beneficio estatal APV Régimen A y beneficio tributario Régimen B.
- Tres escenarios simultáneos mediante un ajuste ±% sobre el retorno anual.
- Toggle de visualización nominal / real (pesos de hoy).
- Crecimiento de sueldo anual e inflación anual como parámetros.
- Guardar escenarios con nombre, compararlos y compartir vía URL.

**No incluye (YAGNI por ahora):**
- Impuesto a las ganancias de capital de ETFs.
- Modalidades de pensión avanzadas (renta vitalicia, tablas de mortalidad reales).
- Backend, cuentas de usuario o sincronización en la nube.

## Stack

- **Alpine.js** (CDN) — reactividad declarativa (`x-model`) sobre los inputs.
- **Chart.js** (CDN) — gráfico de banda con las 3 curvas de escenario.
- **Tailwind CSS** (CDN) — estilos sin escribir CSS.
- Sin paso de build. Todo se abre directo desde `index.html`.

## Arquitectura y archivos

```
retirement/
├── index.html          Estructura + Alpine (x-model en inputs), CDN de libs
├── css/
│   └── app.css         Ajustes puntuales sobre Tailwind
└── js/
    ├── engine.js       MOTOR de cálculo: proyección AFP/APV/ETF, reglas SII,
    │                    escenarios. JS puro, sin DOM. Funciones puras.
    ├── constants.js    Topes legales, tramos de impuesto, defaults (UTM/UF)
    ├── store.js        Estado Alpine: inputs, escenarios guardados, toggles
    ├── persistence.js  localStorage + serialización a URL (compartir)
    └── chart.js        Wrapper de Chart.js (banda de escenarios)
```

### Flujo de datos (unidireccional)

```
inputs (x-model) → store → engine.project(inputs) → resultados
                                                      ├→ tarjetas KPI
                                                      └→ chart (banda 3 escenarios)
                   store ⇄ persistence (localStorage + URL hash)
```

**Principio clave:** `engine.js` no toca el DOM ni conoce Alpine. Recibe un objeto
de inputs y devuelve un objeto de resultados (series año a año + totales). Es
testeable sin navegador y razonable de forma aislada.

## Modelo de cálculo

### Inputs principales
Edad actual, edad de retiro, expectativa de vida, sueldo líquido, factor imponible,
saldo inicial AFP, % retorno AFP, configuración APV (A/B/ambas con aportes y saldos),
% retorno APV, saldo y aporte ETF, % retorno ETF, valores UTM y UF, inflación anual,
crecimiento de sueldo anual, ajuste de escenario ±%.

### 1. Aporte AFP (desde el líquido)
- `imponible ≈ líquido × factor` (factor configurable, default **1.22**).
- `aporte_AFP = 10% × imponible`.
- El aporte AFP es **editable manualmente** (override directo).

### 2. APV Régimen A (bonificación estatal)
- `bono_anual = min(15% × aporte_anual_A, 6 × UTM)`.
- El bono se suma al fondo. Sin beneficio tributario.

### 3. APV Régimen B (beneficio tributario)
- Reduce la base de impuesto: `ahorro = aporte_anual_B × tasa_marginal`.
- `tasa_marginal` según el **Impuesto Único de 2ª Categoría** (tabla de tramos en
  UTM, calculada desde el imponible). Tabla vive en `constants.js`.
- Tope de aporte con beneficio: **600 UF/año**.
- El ahorro se muestra como **KPI de beneficio anual**. Toggle "reinvertir el ahorro
  en el fondo" (default: **off**).

### 4. Crecimiento y capitalización
- Capitalización **mensual**: `tasa_mensual = (1 + tasa_anual)^(1/12) − 1`, sumando el
  aporte cada mes.
- **Crecimiento de sueldo anual** (default **4%**): cada año el sueldo, el imponible y
  el aporte AFP crecen ese %. Esto también desplaza el tramo de impuesto del Régimen B.
- Los aportes de APV crecen al **mismo % del sueldo** por defecto, con toggle
  "mantener aporte APV fijo" para montos nominales constantes.
- ETF simple: aporte mensual + retorno compuesto, sin impuesto a ganancias.

### 5. Escenarios
- Realista = tasas base. Pesimista = tasa − Δ. Optimista = tasa + Δ (Δ = ajuste ±%).
- Δ se aplica al retorno anual de **todas** las categorías → genera las 3 curvas.

### 6. Pensión estimada (aproximada)
- `pensión_mensual ≈ saldo_final / meses_esperados`.
- `meses_esperados = (expectativa_vida − edad_retiro) × 12`.
- Expectativa default **85 años**, editable. Retiro programado simplificado,
  etiquetado explícitamente como "estimación".

### 7. Toggle nominal / real
- Se proyecta en nominal; en modo "real" se divide cada año por `(1 + inflación)^años`.
- Inflación default **3%**, editable.

## Componentes de UI (layout: panel lateral fijo)

### Panel izquierdo — controles (secciones colapsables)
1. **Perfil** — edad actual, edad de retiro, expectativa de vida.
2. **Ingresos** — sueldo líquido, factor imponible, aporte AFP (editable),
   % crecimiento sueldo.
3. **AFP** — saldo inicial, % retorno anual.
4. **APV** — toggle A / B / ambas; aporte mensual a cada una; saldo inicial;
   % retorno; toggle "APV fijo"; toggle "reinvertir ahorro B".
5. **ETF** — saldo inicial, aporte mensual, % retorno anual.
6. **Supuestos** — UTM, UF, inflación %, ajuste de escenario ±%.
7. **Vista** — switch nominal / real.

### Panel derecho — resultados (siempre visibles)
- **Tarjetas KPI:** saldo final (realista) con rango pesimista–optimista, pensión
  mensual estimada, beneficio estatal A acumulado, ahorro tributario B acumulado.
- **Gráfico de banda** (Chart.js): 3 curvas + área sombreada, eje X = edad/año.
- **Barra de escenarios guardados:** chips con nombre para comparar; botón guardar;
  botón compartir (copia URL).

### Responsivo
En móvil el panel izquierdo colapsa a un drawer/acordeón superior.

## Persistencia, comparación y compartir
- **Estado actual:** se guarda en `localStorage` con debounce en cada cambio; se
  recupera al recargar.
- **Escenarios guardados:** lista con nombre en `localStorage`; cada uno es un snapshot
  de todos los inputs. Al hacer clic se superpone su curva realista para comparar.
- **Compartir por URL:** inputs serializados (JSON → base64) en el `#hash`. Abrir esa
  URL reconstruye el escenario exacto. Sin servidor.
- **Botón Reset** a valores por defecto.

## Errores y validación
- Reglas: edad retiro > edad actual; numéricos ≥ 0; UTM/UF/% en rangos razonables.
- Input inválido → borde rojo + mensaje; el gráfico mantiene el último estado válido
  (no crashea).
- Defaults sensatos en todo: abre funcionando sin tocar nada.

## Testing
`engine.js` es JS puro, probado con casos conocidos:
- La bonificación A respeta el tope de 6 UTM.
- Tasa marginal correcta por tramo de impuesto.
- Capitalización compuesta vs. valor esperado.
- Escenarios pesimista/optimista = base ∓ Δ.
- Crecimiento de sueldo compuesto año a año.

Runner mínimo: `tests.html` abrible en el navegador (sin Node/build), que importa
`engine.js` y reporta pass/fail en pantalla.

## Decisiones tomadas durante el brainstorming
- Resultado: **saldo acumulado (principal) + pensión mensual (secundaria)**.
- APV: **cálculo automático según reglas SII**.
- Inflación/unidades: **toggle nominal / real**.
- Persistencia: **guardar + comparar + compartir por URL**.
- Layout: **panel lateral fijo (A)**.
- Escenarios: **banda simultánea (3 curvas a la vez)**.
- Stack: **Alpine.js + Chart.js + Tailwind por CDN**.
- Parámetros añadidos: **inflación anual** y **crecimiento de sueldo anual**.
