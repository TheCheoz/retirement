import { COTIZACION_OBLIGATORIA, BONIFICACION_A_PCT, BONIFICACION_A_TOPE_UTM, TRAMOS_IMPUESTO, APV_TOPE_UF_ANUAL } from './constants.js';

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
  // Trata null y string vacío (campo borrado en la UI) como "auto" para no propagar NaN.
  if (aporteAFPManual != null && aporteAFPManual !== '') return aporteAFPManual;
  return imponibleDesdeLiquido(sueldoLiquido, factorImponible) * COTIZACION_OBLIGATORIA;
}

// Bonificación estatal anual del Régimen A: 15% del aporte, tope 6 UTM/año.
export function bonificacionA(aporteAnualA, utm) {
  return Math.min(BONIFICACION_A_PCT * aporteAnualA, BONIFICACION_A_TOPE_UTM * utm);
}

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

// Devuelve las 3 proyecciones aplicando ∓ajusteEscenario al retorno.
export function escenarios(inputs) {
  const d = inputs.ajusteEscenario;
  return {
    pesimista: proyectar(inputs, -d),
    realista: proyectar(inputs, 0),
    optimista: proyectar(inputs, +d),
  };
}

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
