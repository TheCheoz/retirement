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
