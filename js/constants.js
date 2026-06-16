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
  aporteAFPManual: null,
  saldoAFP: 10000000,
  retornoAFP: 0.04,
  apvRegimen: 'ambas',
  aporteAPV_A: 50000,
  aporteAPV_B: 50000,
  saldoAPV: 2000000,
  retornoAPV: 0.04,
  apvFijo: false,
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
