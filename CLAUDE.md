# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page retirement simulator for Chile ("Simulador de Jubilación"). It projects savings across AFP, APV (regímenes A and B), and ETFs year by year to retirement, showing pessimistic/realistic/optimistic scenarios, an estimated monthly pension, and accumulated state/tax benefits.

**Language:** the code is in English — identifiers, function names, and comments. User-facing strings stay in Spanish, since the UI is Spanish (a Chilean audience). Tax/legal terms that are proper nouns keep their Chilean names (AFP, APV, UTM, UF, Régimen A/B).

There is **no build step and no dependencies installed locally**. Tailwind, Chart.js, and Alpine.js are loaded from CDNs. The app is designed to run by opening `index.html` directly (`file://`, double-click) as well as over HTTP.

## Commands

```bash
# Run all engine/persistence/constants tests (Node's built-in test runner)
node --test test/

# Run a single test file
node --test test/engine.test.js

# Run the app: open index.html in a browser (no server needed)
open index.html

# Run the browser-side test page (validates the same engine in-browser)
open tests.html
```

There is no `npm test` script, no linter, and no `package.json` dependencies — `package.json` only holds name/version.

## Architecture

The critical constraint shaping everything: **the app must work from `file://`**, so there are no ES modules (which `file://` blocks via CORS). Instead:

- **`js/constants.js`, `js/engine.js`, `js/persistence.js`** are **UMD** modules — a `<script>` in the browser (defining `window.RetirementConstants` / `RetirementEngine` / `RetirementPersistence`) and `require`-able CommonJS in Node. This dual nature is what lets the same pure logic be unit-tested with `node --test` while also running in the browser.
- **`js/store.js`, `js/chart.js`** are **browser-only** classic scripts (no UMD) — they touch `window`, Alpine, and Chart.js.
- Script load order in `index.html` matters and follows dependencies: `constants → engine → persistence → store → chart`. These are plain `<script>` (not `defer`) so they run before Alpine (loaded with `defer`) boots.

Data flow:

1. **`engine.js`** is the pure calculation core. `project(inputs, adjustment)` runs the year-by-year projection (monthly compounding via `growYear`); `scenarios(inputs)` calls it three times applying `±scenarioAdjustment` to every return rate. Also computes Régimen A bonus (15% of contribution, capped at 6 UTM/yr) and Régimen B tax savings (marginal rate from `TAX_BRACKETS`, contribution capped at 600 UF). No DOM, no side effects.
2. **`store.js`** defines `window.simulator()`, the Alpine component bound in `index.html` via `x-data="simulator()"`. It holds `inputs`, watches them (debounced 200ms), calls `scenarios`, optionally deflates to "pesos de hoy" (`realView` → `toReal`), persists state, and **dispatches a `result-updated` DOM event**.
3. **`chart.js`** (`window.RetirementChart`) listens for `result-updated` to redraw. Because Chart.js loads via `defer` and may not be ready when the first result is computed, the store also stashes the latest result on `window.__currentResult`, and the inline script in `index.html` polls for `Chart` then seeds the first draw from that global. Preserve this handshake when touching chart init.
4. **`persistence.js`** handles three stores: `localStorage` (current state + saved scenarios), and the URL `#hash` (base64-encoded inputs, for sharing). `encodeState`/`decodeState` are unicode-safe and work in both browser (`btoa`/`atob`) and Node (`Buffer`).

Default inputs live in `constants.js` `DEFAULTS`; `store.js` merges `DEFAULTS ← localStorage ← URL hash` on init.

## Conventions and gotchas

- **Input validation is a guard, not an error.** `recompute()` in `store.js` silently returns (keeping the last valid result) when inputs are nonsensical (e.g. `retirementAge <= currentAge`, non-positive UTM/UF). Don't convert these into thrown errors or visible failures.
- **Empty number fields** (a cleared input) arrive as `''`, not `null`. Engine code treats `null` and `''` the same to avoid propagating `NaN` (see `monthlyAfpContribution`). Follow this when adding new numeric inputs.
- **Tax/legal constants** (`TAX_BRACKETS`, caps, `MANDATORY_CONTRIBUTION`) are reference values in `constants.js` and may need updating if Chilean regulations change.
- When changing engine math, update both `test/*.test.js` (Node) and the checks in `tests.html` (browser) — they exercise the same functions.

## Project docs

Design spec and implementation plan are under `docs/superpowers/`. The `.superpowers/` directory is gitignored scratch state.
