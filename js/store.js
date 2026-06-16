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
