// store.js — classic <script> (browser only). Defines window.simulator, the
// Alpine component. The model is ONE shared profile (`base`) plus a shared APV
// strategy (`apv`); the 3 chips are derived scenarios that differ only in how
// the APV is applied (off / now / delayed). So editing age, salary, AFP, etc.
// moves all three at once. The year-by-year math is delegated to RetirementEngine.
(function () {
  const { DEFAULTS } = window.RetirementConstants;
  const E = window.RetirementEngine;
  const {
    saveState, loadState, readStateFromHash, writeStateToHash,
  } = window.RetirementPersistence;

  const COLS = { A: '#2C7A6B', B: '#C26B45', C: '#4F9B62' };
  const KEYS = ['A', 'B', 'C'];

  // The three derived scenarios. `apv` = whether the shared APV strategy applies;
  // `delay` = years until APV contributions begin (relative to the shared age).
  const DEFS = {
    A: { name: 'Hoy', apv: false, delay: 0 },
    B: { name: 'Con APV', apv: true, delay: 0 },
    C: { name: 'Desde los 35', apv: true, delay: 5 },
  };

  // Maps the engine/UI field names (used in index.html bindings) to the shared
  // `apv` strategy keys, so s()/update() can route them.
  const APV_MAP = { apvRegime: 'regime', apvContributionA: 'aporteA', apvContributionB: 'aporteB' };

  // Chart canvas box (SVG user units).
  const X0 = 70, X1 = 980, Y0 = 20, Y1 = 330;

  function fmt(n) { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }

  // "Nice" axis maximum (1/2/2.5/5/10 × 10^k).
  function niceNum(x) {
    if (x <= 0) return 1;
    const exp = Math.floor(Math.log10(x));
    const f = x / Math.pow(10, exp);
    let nf;
    if (f <= 1) nf = 1; else if (f <= 2) nf = 2; else if (f <= 2.5) nf = 2.5;
    else if (f <= 5) nf = 5; else nf = 10;
    return nf * Math.pow(10, exp);
  }

  function fmtM(v) {
    if (v === 0) return '$0';
    return v >= 1e6 ? '$' + Math.round(v / 1e6) + 'M' : '$' + Math.round(v / 1e3) + 'K';
  }

  // The shared profile + shared APV strategy. Rates are fractions (afpReturn 0.04);
  // UF/UTM live in `indicadores`. APV-strategy fields don't live in `base`.
  function defaults() {
    const base = { ...DEFAULTS, afpReturn: 0.04, apvReturn: 0.04 };
    delete base.utm; delete base.uf;
    delete base.apvRegime; delete base.apvContributionA; delete base.apvContributionB;
    return {
      base,
      apv: { regime: 'A', aporteA: 50000, aporteB: 0 },
    };
  }

  function simulator() {
    const d = defaults();
    return {
      base: d.base,
      apv: d.apv,
      active: 'A',
      indicadores: { utm: DEFAULTS.utm, uf: DEFAULTS.uf },
      comparar: false,
      verReal: false,
      controlsOpen: typeof window !== 'undefined' && window.innerWidth >= 768,
      advOpen: false,
      screen: 'summary',
      wizardStep: 1,
      wiz: { goalType: null, idealPension: null, lifestyleSpending: null, afpEstimated: 0, afpManual: null },
      toast: '',
      view: {},
      indicators: { updated: false, date: '' },

      init() {
        const saved = readStateFromHash() || loadState();
        // version gates the saved-bundle shape; bump it when the model changes so
        // stale state is dropped instead of silently misread.
        if (saved && saved.version === 4 && saved.base) {
          this.base = saved.base;
          if (saved.apv) this.apv = saved.apv;
          if (saved.indicadores) this.indicadores = saved.indicadores;
          if (saved.active) this.active = saved.active;
          if (typeof saved.verReal === 'boolean') this.verReal = saved.verReal;
        }
        // Fresh visitor (no valid saved state, no shared link) starts in the wizard.
        this.screen = (saved && saved.version === 4) ? 'summary' : 'wizard';
        this.recompute();
        this.$watch('base', () => this.onChange(), { deep: true });
        this.$watch('apv', () => this.onChange(), { deep: true });
        this.$watch('indicadores', () => this.onChange(), { deep: true });
        this.$watch('active', () => this.recompute());
        this.$watch('comparar', () => this.recompute());
        this.$watch('verReal', () => this.recompute());
        this.fetchIndicators();
      },

      // Live UF/UTM. Network-only enhancement: on failure (offline / file://) the
      // defaults stay and nothing breaks.
      async fetchIndicators() {
        try {
          const res = await fetch('https://mindicador.cl/api');
          if (!res.ok) return;
          const data = await res.json();
          if (data.uf && data.uf.valor) this.indicadores.uf = Math.round(data.uf.valor);
          if (data.utm && data.utm.valor) this.indicadores.utm = Math.round(data.utm.valor);
          this.indicators = {
            updated: true,
            date: data.fecha ? new Date(data.fecha).toLocaleDateString('es-CL') : '',
          };
        } catch {
          // No network: keep the defaults.
        }
      },

      // --- read/mutation helpers ---
      // Merged editing target for the controls: shared base + the APV strategy
      // surfaced under its engine field names.
      s() {
        const m = {};
        for (const ek in APV_MAP) m[ek] = this.apv[APV_MAP[ek]];
        return { ...this.base, ...m };
      },
      // Routes an edit to the APV strategy or the shared base. Both propagate to
      // every scenario, which is the whole point.
      update(k, v) {
        if (k in APV_MAP) this.apv[APV_MAP[k]] = v;
        else this.base[k] = v;
      },
      updateInd(k, v) { this.indicadores[k] = v; },
      setActive(k) { this.active = k; this.comparar = false; },

      // Display name. A delayed-APV scenario shows its start age, derived live
      // from the shared age + delay.
      scenarioName(k) {
        const def = DEFS[k];
        return def.delay ? 'Desde los ' + (this.base.currentAge + def.delay) : def.name;
      },

      bundle() {
        const { base, apv, indicadores, active, verReal } = this;
        return { version: 4, base, apv, indicadores, active, verReal };
      },

      _debounce: null,
      onChange() {
        this.recompute();
        clearTimeout(this._debounce);
        this._debounce = setTimeout(() => saveState(this.bundle()), 250);
      },

      flash(m) {
        this.toast = m;
        clearTimeout(this._toast);
        this._toast = setTimeout(() => { this.toast = ''; }, 2200);
      },

      guardar() {
        saveState(this.bundle());
        this.flash('Escenario guardado');
      },

      compartir() {
        try {
          writeStateToHash(this.bundle());
          if (navigator.clipboard) navigator.clipboard.writeText(location.href);
          this.flash('Enlace copiado al portapapeles');
        } catch { this.flash('No se pudo compartir'); }
      },

      // --- wizard ---
      // Retirement age + life expectancy implied by the chosen sex (null until chosen).
      sexDefaults() { return this.base.sex ? E.defaultsForSex(this.base.sex) : null; },

      // One-line explanation of what the chosen goal does with the projection.
      goalHint() {
        return {
          ideal: 'Compararemos tu pensión proyectada con este monto y te diremos cuánto APV falta para alcanzarlo.',
          lifestyle: 'Calcularemos una pensión que cubra ese gasto mensual.',
          estimate: 'Solo te mostramos tu pensión proyectada, sin una meta que alcanzar.',
        }[this.wiz.goalType] || '';
      },

      nextStep() { this.wizardStep++; },
      prevStep() { if (this.wizardStep > 1) this.wizardStep--; },

      // Re-estimate the AFP balance from the current salary/age (call on salary input).
      recalcAfpEstimate() {
        this.wiz.afpEstimated = Math.round(E.estimateAfpBalance({
          netSalary: this.base.netSalary,
          taxableFactor: this.base.taxableFactor,
          currentAge: this.base.currentAge,
          afpReturn: this.base.afpReturn,
          salaryGrowth: this.base.salaryGrowth,
        }));
      },

      // Map wizard answers into the shared model, then show the summary.
      applyWizard() {
        const sexDefaults = E.defaultsForSex(this.base.sex);
        this.base.retirementAge = sexDefaults.retirementAge;
        this.base.lifeExpectancy = sexDefaults.lifeExpectancy;
        // 'estimate' just wants to see the projection — no target pension set.
        if (this.wiz.goalType === 'ideal') this.base.targetPension = +this.wiz.idealPension || null;
        else if (this.wiz.goalType === 'lifestyle') this.base.targetPension = +this.wiz.lifestyleSpending || null;
        else this.base.targetPension = null;
        const afp = (this.wiz.afpManual != null && this.wiz.afpManual !== '')
          ? +this.wiz.afpManual : this.wiz.afpEstimated;
        this.base.afpBalance = Math.round(afp || 0);
        this.screen = 'summary';
        this.recompute();
        saveState(this.bundle());
      },

      restartWizard() { this.wizardStep = 1; this.screen = 'wizard'; },

      // Goal gap vs the active scenario, in nominal pesos (matches the hero default).
      // null when no target set.
      goalInfo() {
        const t = this.base.targetPension;
        if (!t) return null;
        const scn = this._inputs(this.active);
        const proj = E.project(scn, 0);
        const projected = E.estimatedPension(proj.pensionBalance, scn.retirementAge, scn.lifeExpectancy);
        const gap = t - projected;
        // Tolerance so a rounding-hair gap (or the just-applied recommendation)
        // counts as met, instead of re-recommending what's already in place.
        const met = gap <= Math.max(1000, t * 0.005);
        const recommendedApv = met ? 0 : E.solveApvForTarget(scn, t);
        return {
          target: fmt(t), projectedReal: fmt(projected),
          met, recommendedApv, recommendedApvText: fmt(recommendedApv),
        };
      },

      // "Aplicar": adopt the recommended APV (Régimen A) and switch to the APV scenario.
      applyRecommendedApv() {
        const info = this.goalInfo();
        if (!info || !info.recommendedApv) return;
        this.apv.regime = 'A';
        this.apv.aporteA = info.recommendedApv;
        this.apv.aporteB = 0;
        this.active = 'B';
        this.flash('APV recomendado aplicado');
      },

      fmt,

      // Pill style for the nominal/inflation segmented toggle.
      segStyle(active) {
        return 'padding:9px 18px;border:none;border-radius:99px;cursor:pointer;font-family:Inter,sans-serif;font-size:13px;font-weight:600;white-space:nowrap;transition:all .15s;background:'
          + (active ? '#2C7A6B' : 'transparent') + ';color:' + (active ? '#fff' : '#57534A')
          + ';box-shadow:' + (active ? '0 2px 8px -2px rgba(44,122,107,0.5)' : 'none');
      },

      // Engine input for a scenario key: shared base + UF/UTM, with the APV
      // strategy applied (or zeroed) per the scenario definition.
      _inputs(k) {
        const def = DEFS[k];
        const inp = { ...this.base, utm: this.indicadores.utm, uf: this.indicadores.uf };
        if (def.apv) {
          inp.apvRegime = this.apv.regime;
          inp.apvContributionA = this.apv.aporteA;
          inp.apvContributionB = this.apv.aporteB;
          if (def.delay) inp.apvStartAge = this.base.currentAge + def.delay;
        } else {
          inp.apvRegime = 'none';
          inp.apvContributionA = 0;
          inp.apvContributionB = 0;
        }
        return inp;
      },

      _pension(proj, scn) {
        return E.estimatedPension(proj.pensionBalance, scn.retirementAge, scn.lifeExpectancy);
      },

      recompute() {
        const b = this.base;
        // Guard: skip on nonsensical inputs (keep the last good view).
        if (b.retirementAge <= b.currentAge) return;
        if (b.netSalary < 0 || this.indicadores.utm <= 0 || this.indicadores.uf <= 0) return;
        if (b.taxableFactor <= 0) return;
        this.view = this.renderVals();
      },

      // Nearest hover column to a pointer x (mouse or touch), in client coords.
      nearestCol(el, clientX) {
        const cols = this.view.hoverCols || [];
        if (!cols.length) return null;
        const r = el.getBoundingClientRect();
        const vx = (clientX - r.left) / r.width * 1000;
        let bi = 0;
        for (let i = 1; i < cols.length; i++) if (Math.abs(cols[i].x - vx) < Math.abs(cols[bi].x - vx)) bi = i;
        return bi;
      },

      // Overlay markup (guide line + dots) for the hovered chart column.
      // Built as a string because <template> can't run inside <svg>.
      hoverSvg(hi) {
        const col = this.view.hoverCols && this.view.hoverCols[hi];
        if (!col) return '';
        let s = `<line x1="${col.x}" x2="${col.x}" y1="${Y0 - 2}" y2="${Y1}" stroke="#C2BCAF" stroke-width="1" stroke-dasharray="4 4"/>`;
        col.pts.forEach((p) => { s += `<circle cx="${col.x}" cy="${p.cy}" r="4.5" fill="${p.color}" stroke="#fff" stroke-width="2"/>`; });
        return s;
      },

      // All template-bound derived data, computed from engine projections.
      renderVals() {
        const real = this.verReal;
        const active = this._inputs(this.active);

        const deflateFor = (scn, v, age) => {
          if (!real) return v;
          const yrs = (age == null) ? (scn.retirementAge - scn.currentAge) : (age - scn.currentAge);
          return v / Math.pow(1 + scn.inflation, Math.max(0, yrs));
        };
        const deflate = (v, age) => deflateFor(active, v, age);

        const { pessimistic: pesi, realistic: esp, optimistic: opt } = E.scenarios(active);
        const allEsp = {};
        KEYS.forEach((k) => { allEsp[k] = E.project(this._inputs(k), 0); });
        const penOf = (proj, scn) => this._pension(proj, scn);

        // ---- hero ----
        const heroAmount = fmt(deflate(penOf(esp, active), null));
        const rangeLow = fmt(deflate(penOf(pesi, active), null));
        const rangeHigh = fmt(deflate(penOf(opt, active), null));
        const tasaReemp = penOf(esp, active) / Math.max(1, active.netSalary);
        let statusWord, statusColor;
        if (tasaReemp < 0.45) { statusWord = 'podrías mejorar esto'; statusColor = '#C26B45'; }
        else if (tasaReemp < 0.7) { statusWord = 'vas bien encaminado'; statusColor = '#2C7A6B'; }
        else { statusWord = 'vas muy bien'; statusColor = '#4F9B62'; }
        const statusStyle = `font-family:'Newsreader',serif;font-style:italic;font-weight:500;font-size:26px;color:${statusColor}`;

        // ---- chips ----
        const chips = KEYS.map((k) => {
          const on = (k === this.active && !this.comparar);
          const scn = this._inputs(k);
          return {
            key: k, name: this.scenarioName(k),
            pension: fmt(deflateFor(scn, penOf(allEsp[k], scn), null)),
            style: `flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;padding:10px 24px;border-radius:24px;cursor:pointer;border:none;transition:all .15s;font-family:'Inter',sans-serif;background:${on ? '#fff' : 'transparent'};box-shadow:${on ? '0 4px 12px -6px rgba(31,29,24,0.28)' : 'none'}`,
            labelColor: `white-space:nowrap;color:${on ? '#1F1D18' : '#57534A'}`,
            valueColor: `white-space:nowrap;color:${on ? '#2C7A6B' : '#A39E92'}`,
          };
        });
        const cm = this.comparar;
        const compararStyle = `display:flex;align-items:center;gap:7px;margin-left:4px;padding:10px 20px;border-radius:24px;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;transition:all .15s;border:1px solid ${cm ? '#2C7A6B' : '#E0D9C9'};background:${cm ? '#2C7A6B' : '#F3EFE6'};color:${cm ? '#fff' : '#57534A'}`;

        // ---- chart geometry ----
        let datasets, minAge, maxAge;
        if (cm) {
          datasets = KEYS.map((k) => ({ scn: this._inputs(k), color: COLS[k], width: 3, opacity: 1, series: allEsp[k].series }));
          minAge = Math.min.apply(null, datasets.map((d) => d.scn.currentAge));
          maxAge = Math.max.apply(null, datasets.map((d) => d.scn.retirementAge));
        } else {
          datasets = [
            { scn: active, color: '#C26B45', width: 2, opacity: 0.9, series: pesi.series },
            { scn: active, color: '#4F9B62', width: 2, opacity: 0.9, series: opt.series },
            { scn: active, color: '#2C7A6B', width: 3.5, opacity: 1, series: esp.series },
          ];
          minAge = active.currentAge; maxAge = active.retirementAge;
        }
        const ageSpan = Math.max(1, maxAge - minAge);
        let maxVal = 0;
        datasets.forEach((d) => d.series.forEach((p) => { const v = deflateFor(d.scn, p.total, p.age); if (v > maxVal) maxVal = v; }));
        const niceMax = niceNum(maxVal * 1.05) || 1;
        const mapX = (age) => X0 + ((age - minAge) / ageSpan) * (X1 - X0);
        const mapY = (v) => Y1 - (v / niceMax) * (Y1 - Y0);

        const yTicks = [];
        for (let i = 0; i <= 5; i++) { const v = niceMax * i / 5; yTicks.push({ y: mapY(v).toFixed(1), label: fmtM(v) }); }
        const xTicks = [];
        const step = Math.max(2, Math.round(ageSpan / 8));
        for (let a = minAge; a <= maxAge; a += step) xTicks.push({ x: mapX(a).toFixed(1), label: String(a) });
        if (xTicks.length && +xTicks[xTicks.length - 1].label !== maxAge) xTicks.push({ x: mapX(maxAge).toFixed(1), label: String(maxAge) });

        const buildPath = (series, scn) => series.map((p, i) => (i ? 'L' : 'M') + mapX(p.age).toFixed(1) + ' ' + mapY(deflateFor(scn, p.total, p.age)).toFixed(1)).join(' ');
        const lines = datasets.map((d) => ({ d: buildPath(d.series, d.scn), color: d.color, width: d.width, opacity: d.opacity }));

        const hasBand = !cm;
        let bandPath = '';
        if (hasBand) {
          const fwd = opt.series.map((p, i) => (i ? 'L' : 'M') + mapX(p.age).toFixed(1) + ' ' + mapY(deflate(p.total, p.age)).toFixed(1)).join(' ');
          const bwd = pesi.series.slice().reverse().map((p) => 'L' + mapX(p.age).toFixed(1) + ' ' + mapY(deflate(p.total, p.age)).toFixed(1)).join(' ');
          bandPath = fwd + ' ' + bwd + ' Z';
        }
        const showDot = !cm;
        const lastEsp = esp.series[esp.series.length - 1];
        const dotX = mapX(active.retirementAge).toFixed(1);
        const dotY = mapY(deflate(lastEsp.total, lastEsp.age)).toFixed(1);

        const legend = cm
          ? KEYS.map((k) => ({ color: COLS[k], label: this.scenarioName(k) }))
          : [{ color: '#C26B45', label: 'Pesimista' }, { color: '#2C7A6B', label: 'Esperado' }, { color: '#4F9B62', label: 'Optimista' }];

        // SVG interior as a markup string. Alpine's <template x-for> can't run
        // inside <svg> (SVG-namespaced <template> has no .content), so we inject
        // the whole chart body via x-html. All values here are numbers/own colors.
        const svg = [];
        yTicks.forEach((t) => {
          svg.push(`<line x1="70" x2="980" y1="${t.y}" y2="${t.y}" stroke="#EFEBE1" stroke-width="1"/>`);
          svg.push(`<text x="58" y="${t.y}" text-anchor="end" dominant-baseline="middle" font-size="13" fill="#A39E92">${t.label}</text>`);
        });
        xTicks.forEach((t) => svg.push(`<text x="${t.x}" y="352" text-anchor="middle" font-size="13" fill="#A39E92">${t.label}</text>`));
        svg.push('<text x="525" y="374" text-anchor="middle" font-size="12.5" fill="#C2BCAF">Edad</text>');
        if (hasBand) svg.push(`<path d="${bandPath}" fill="#2C7A6B" fill-opacity="0.07" stroke="none"/>`);
        lines.forEach((ln) => svg.push(`<path d="${ln.d}" fill="none" stroke="${ln.color}" stroke-width="${ln.width}" stroke-linejoin="round" stroke-linecap="round" opacity="${ln.opacity}"/>`));
        if (showDot) svg.push(`<circle cx="${dotX}" cy="${dotY}" r="6.5" fill="#2C7A6B" stroke="#fff" stroke-width="2.5"/>`);
        const svgInner = svg.join('');

        // ---- hover columns: x + per-series y/value at each sampled age ----
        const dsLabels = cm ? KEYS.map((k) => this.scenarioName(k)) : ['Pesimista', 'Optimista', 'Esperado'];
        const refSeries = datasets.reduce((a, d) => (d.series.length > a.length ? d.series : a), datasets[0].series);
        const hoverCols = refSeries.map((rp) => {
          const age = rp.age;
          const pts = datasets.map((d, i) => {
            let best = d.series[0];
            for (const p of d.series) if (Math.abs(p.age - age) < Math.abs(best.age - age)) best = p;
            const v = deflateFor(d.scn, best.total, best.age);
            return { color: d.color, cy: +mapY(v).toFixed(1), amount: fmt(v), label: dsLabels[i] };
          });
          return { x: +mapX(age).toFixed(1), age, pts };
        });

        // ---- stats / compare ----
        const stats = [
          { label: 'Saldo final (esperado)', val: fmt(deflate(esp.total, active.retirementAge)) },
          { label: 'Bono estatal A acumulado', val: fmt(esp.accumulatedBonusA) },
          { label: 'Ahorro tributario B acum.', val: fmt(esp.accumulatedSavingsB) },
        ];
        const allPen = {}; KEYS.forEach((k) => { allPen[k] = penOf(allEsp[k], this._inputs(k)); });
        const bestVal = Math.max.apply(null, KEYS.map((k) => allPen[k]));
        const compareRows = KEYS.map((k) => {
          const scn = this._inputs(k);
          const best = allPen[k] === bestVal;
          // Full row style in one binding: Alpine's :style replaces the static
          // style attribute (wiping display:grid), so everything lives here.
          return {
            name: this.scenarioName(k), color: COLS[k], best,
            pension: fmt(deflateFor(scn, allPen[k], null)),
            saldo: fmt(deflateFor(scn, allEsp[k].total, scn.retirementAge)),
            rowStyle: `display:grid;grid-template-columns:1.5fr 1fr 1fr;align-items:center;padding:15px 16px;border-radius:14px;margin-bottom:2px;background:${best ? '#E9F2EF' : 'transparent'};box-shadow:${best ? 'inset 3px 0 0 #2C7A6B' : 'none'}`,
            pensionStyle: `text-align:right;font-family:'Space Grotesk',sans-serif;font-weight:600;font-size:19px;color:${best ? '#2C7A6B' : '#1F1D18'}`,
          };
        });

        return {
          heroAmount, statusWord, statusStyle, rangeLow, rangeHigh,
          chips, compararStyle,
          chartTitle: cm ? 'Acumulación comparada (esperado)' : 'Cómo crece tu ahorro',
          chartUnit: real ? 'pesos de hoy' : 'pesos nominales',
          svgInner, legend, hoverCols,
          stats, compareRows,
          activeName: this.scenarioName(this.active),
          activeHasApv: DEFS[this.active].apv,
          goal: this.goalInfo(),
        };
      },
    };
  }

  window.simulator = simulator;
})();
