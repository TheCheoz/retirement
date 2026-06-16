import { COTIZACION_OBLIGATORIA } from './constants.js';

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

// Calcula el sueldo imponible multiplicando el sueldo líquido por el factor imponible.
export function imponibleDesdeLiquido(sueldoLiquido, factorImponible) {
  return sueldoLiquido * factorImponible;
}

// Aporte obligatorio mensual a la AFP. Si hay override manual, se usa tal cual.
export function aporteAFPMensual({ sueldoLiquido, factorImponible, aporteAFPManual }) {
  if (aporteAFPManual != null) return aporteAFPManual;
  return imponibleDesdeLiquido(sueldoLiquido, factorImponible) * COTIZACION_OBLIGATORIA;
}
