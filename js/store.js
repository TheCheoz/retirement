// store.js — script clásico (solo navegador). Define window.simulador,
// el componente Alpine que conecta inputs → motor → resultados.
(function () {
  const { DEFAULTS } = window.RetiroConstants;
  const { escenarios, pensionEstimada, aReal } = window.RetiroEngine;
  const {
    saveState, loadState, readStateFromHash, writeStateToHash,
    loadScenarios, saveScenarios,
  } = window.RetiroPersistence;

  function simulador() {
    return {
      inputs: { ...DEFAULTS, ...(readStateFromHash() || loadState() || {}) },
      vistaReal: false,
      escenariosGuardados: loadScenarios(),
      resultado: null,
      pension: { pesimista: 0, realista: 0, optimista: 0 },
      // Controles abiertos por defecto en desktop, cerrados en móvil (el héroe respira).
      controlesAbiertos: typeof window !== 'undefined' && window.innerWidth >= 768,

      init() {
        this.recalcular();
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
        // Guarda: si los inputs no son válidos, no recalcula (mantiene último estado válido)
        if (this.inputs.edadRetiro <= this.inputs.edadActual) return;
        if (this.inputs.sueldoLiquido < 0 || this.inputs.utm <= 0 || this.inputs.uf <= 0) return;
        if (this.inputs.factorImponible <= 0) return;
        const e = escenarios(this.inputs);
        const conv = (esc) => {
          if (!this.vistaReal) return esc;
          const serie = aReal(esc.serie, this.inputs.inflacion, this.inputs.edadActual);
          // Deflactor al horizonte de retiro para llevar los beneficios acumulados a pesos de hoy.
          const factor = Math.pow(1 + this.inputs.inflacion, this.inputs.edadRetiro - this.inputs.edadActual);
          return {
            ...esc,
            serie,
            total: serie.at(-1).total,
            bonoAcumuladoA: esc.bonoAcumuladoA / factor,
            ahorroAcumuladoB: esc.ahorroAcumuladoB / factor,
          };
        };
        this.resultado = {
          pesimista: conv(e.pesimista), realista: conv(e.realista), optimista: conv(e.optimista),
        };
        this.pension = {
          pesimista: pensionEstimada(this.resultado.pesimista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
          realista: pensionEstimada(this.resultado.realista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
          optimista: pensionEstimada(this.resultado.optimista.total, this.inputs.edadRetiro, this.inputs.expectativaVida),
        };
        if (typeof window !== 'undefined') window.__resultadoActual = this.resultado;
        this.$dispatch('resultado-actualizado', this.resultado);
      },

      guardarEscenario() {
        const nombre = prompt('Nombre del escenario:');
        if (!nombre) return;
        this.escenariosGuardados.push({ nombre, inputs: { ...this.inputs } });
        saveScenarios(this.escenariosGuardados);
      },

      cargarEscenario(i) {
        const e = this.escenariosGuardados[i];
        if (!e) return;
        this.inputs = { ...e.inputs };
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

      // Frase cálida según la pensión realista mostrada (sigue la vista real/nominal).
      get fraseCalida() {
        const p = this.pension.realista || 0;
        if (p < 300000) return 'es un comienzo — pequeños ajustes suman mucho';
        if (p < 600000) return 'vas tomando forma 🌤️';
        if (p < 1000000) return 'vas bien encaminado 🌱';
        if (p < 1800000) return 'se ve bien 😊';
        return 'tu futuro brilla ✨';
      },
    };
  }

  window.simulador = simulador;
})();
