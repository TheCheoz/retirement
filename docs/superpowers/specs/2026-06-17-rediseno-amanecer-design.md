# Rediseño visual "Amanecer" — Simulador de Jubilación

Fecha: 2026-06-17
Estado: aprobado (concepto, paleta/tipografía, layout y enfoque técnico)

## Objetivo

Dar un rediseño creativo a la página. Pasar del dashboard oscuro genérico
(estilo GitHub: fondo `#0d1117`, tarjetas `#161b22`, acentos azul/verde) a una
identidad propia, cálida y motivadora, dirigida a una persona joven en Chile que
recién empieza a ahorrar para su jubilación. Mensaje rector: *"tu futuro se ve
bien"*.

Es un rediseño **solo de presentación**: no cambia ninguna matemática del motor,
ni el contrato de persistencia, ni los tests.

## Dirección de diseño: "Amanecer"

El sujeto mira un horizonte largo. La metáfora central es un **amanecer**: el
ahorro es una línea que crece hacia la luz. Esto reemplaza el "número grande con
etiqueta" templado por una tesis emocional.

- **Héroe (tesis):** lo primero que se ve es la pensión mensual proyectada, en
  grande, con una frase cálida que cambia según el monto. El rango
  pesimista–optimista aparece como una banda de luz bajo el número.
- **Riesgo estético (uno, justificable):** el gráfico deja de ser un line chart
  neutro y se vuelve **horizonte de amanecer** — cielo en degradado cálido, los
  tres escenarios como bandas translúcidas de luz (alba → sol → día pleno), y el
  año de retiro marcado como un sol naciente. El dato sigue siendo riguroso.

## Lenguaje visual

### Paleta "papel/amanecer" (CSS variables)

| Rol           | Token              | Valor      | Uso                          |
|---------------|--------------------|------------|------------------------------|
| Fondo         | `--bg`             | `#FBF6EE`  | lienzo (hueso cálido)        |
| Superficie    | `--surface`        | `#FFFCF7`  | tarjetas, controles          |
| Borde         | `--border`         | `#EADFCE`  | bordes suaves                |
| Tinta         | `--ink`            | `#2A2320`  | texto (casi-negro cálido)    |
| Tinta suave   | `--ink-soft`       | `#8A7E72`  | etiquetas, secundario        |
| Ámbar (sol)   | `--sol`            | `#E8923A`  | **realista** / acento estrella |
| Terracota     | `--terracota`      | `#C75D43`  | **pesimista** / énfasis      |
| Verde brote   | `--brote`          | `#6FA368`  | **optimista** / crecimiento  |

Mapeo emocional de escenarios: pesimista = alba (terracota), realista = sol
(ámbar), optimista = día pleno (verde).

### Tipografía (Google Fonts vía `<link>`)

- **Display → Fraunces:** serif "soft old-style", soleada y con carácter. Número
  héroe y titulares.
- **Cuerpo/UI → Hanken Grotesk:** grotesca amable, legible en formularios densos,
  con cifras tabulares (`tnum`).

Se evita deliberadamente Inter (default de todo dashboard). Las fuentes cargan por
red como los demás CDN; si se abre sin internet, caen a fuentes de sistema.

## Layout (una columna centrada, lectura de arriba hacia abajo)

1. **Kicker** pequeño: "Simulador · Chile".
2. **Héroe:** etiqueta "Tu pensión proyectada a los {edadRetiro}", número héroe
   gigante (Fraunces, `tnum`), frase cálida según monto, rango como banda de luz.
3. **Gráfico** "horizonte de amanecer", full-width.
4. **KPIs secundarios** como chips suaves: saldo final, bono A acumulado, ahorro
   tributario B acumulado.
5. **Toggle** discreto "Ver en pesos de hoy (real)".
6. **Controles colapsables:** botón prominente "Ajustar mis datos" que despliega
   los paneles actuales (Perfil, Ingresos, AFP, APV, ETF, Supuestos) reordenados
   en una "hoja" cálida con grilla limpia. **Abiertos por defecto en desktop,
   cerrados en móvil.**
7. **Acciones:** Reset · Guardar · Compartir.

Micro-interacción: transición suave del número al recalcular, respetando el
debounce existente. Sin count-up exagerado.

## Enfoque técnico (respeta `file://`, sin build, motor intacto)

- **Sin build, sin ES modules.** Tailwind/Chart.js/Alpine siguen por CDN. Se
  añade `<link>` a Google Fonts (mismo patrón de red, con fallback de sistema).
- **`css/app.css`:** tokens como CSS variables + capa pequeña de clases
  semánticas (`.hero`, `.kpi-chip`, `.field`, `.sheet`, etc.). Layout con
  utilidades Tailwind. No se acopla a `tailwind.config` para no arriesgar el
  render en `file://`.
- **`index.html`:** se reestructura el markup al layout de arriba. Se conservan
  intactos: `x-data="simulador()"`, el orden de `<script>`, y el handshake del
  gráfico (`window.__resultadoActual` + polling de `Chart`).
- **`js/chart.js`:** se reestiliza a "amanecer" (degradado de cielo, bandas
  translúcidas por escenario, marca del año de retiro). El contrato de
  `initChart` / `updateChart` no cambia.
- **`js/store.js`:** se agrega solo estado de UI nuevo — `controlesAbiertos` y un
  getter para la frase cálida por tramos. No se toca `recalcular`, ni el guard de
  validación, ni el manejo de campos vacíos (`''`).
- **Idioma:** strings y comentarios en español. No se tocan `engine.js`,
  `constants.js`, `persistence.js` ni los tests.

## Fuera de alcance (YAGNI)

Dark mode, animaciones elaboradas, cambios de copy más allá de la frase héroe,
responsive más allá de un breakpoint limpio móvil/desktop.

## Criterios de éxito

- La página abre por `file://` (doble clic) y por HTTP, con render correcto.
- El motor, la persistencia y los tests siguen pasando sin cambios.
- El héroe (pensión + frase + rango) es lo primero y domina la composición.
- El gráfico comunica la metáfora de amanecer sin perder rigor del dato.
- La identidad no se lee como un dashboard templado: paleta cálida propia y
  tipografía con carácter (Fraunces + Hanken Grotesk, sin Inter).
