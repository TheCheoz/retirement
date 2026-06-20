// engine.js — UMD: classic <script> in the browser (defines window.RetirementEngine)
// and a CommonJS module in Node. Depends on constants.
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./constants.js'));
  } else {
    root.RetirementEngine = factory(root.RetirementConstants);
  }
})(typeof self !== 'undefined' ? self : this, function (C) {
  const {
    MANDATORY_CONTRIBUTION, HEALTH_CONTRIBUTION, BONUS_A_PCT, BONUS_A_CAP_UTM,
    TAX_BRACKETS, APV_CAP_UF_ANNUAL,
  } = C;

  // Monthly rate equivalent to a compounded annual rate.
  function monthlyRate(annualRate) {
    return Math.pow(1 + annualRate, 1 / 12) - 1;
  }

  // Grows a balance over one year, adding `monthlyContribution` each month
  // and compounding monthly at `annualRate`.
  function growYear(initialBalance, monthlyContribution, annualRate) {
    const m = monthlyRate(annualRate);
    let balance = initialBalance;
    for (let i = 0; i < 12; i++) {
      balance = balance * (1 + m) + monthlyContribution;
    }
    return balance;
  }

  // Taxable salary = net salary times the taxable factor.
  function taxableFromNet(netSalary, taxableFactor) {
    return netSalary * taxableFactor;
  }

  // Monthly mandatory AFP contribution. A manual override is used as-is.
  function monthlyAfpContribution({ netSalary, taxableFactor, afpContributionManual }) {
    // Treat null and empty string (a cleared UI field) as "auto" to avoid propagating NaN.
    if (afpContributionManual != null && afpContributionManual !== '') return afpContributionManual;
    return taxableFromNet(netSalary, taxableFactor) * MANDATORY_CONTRIBUTION;
  }

  // Régimen A annual state bonus: 15% of the contribution, capped at 6 UTM/year.
  function bonusA(annualContributionA, utm) {
    return Math.min(BONUS_A_PCT * annualContributionA, BONUS_A_CAP_UTM * utm);
  }

  // Marginal rate of the second-category income tax from the monthly taxable income.
  function marginalRate(monthlyTaxable, utm) {
    const inUTM = monthlyTaxable / utm;
    for (const b of TAX_BRACKETS) {
      if (inUTM > b.from && inUTM <= b.to) return b.rate;
    }
    return 0;
  }

  // Régimen B annual tax saving: contribution (capped at 600 UF) * marginal rate.
  function taxSavingsB(annualContributionB, monthlyTaxable, utm, uf) {
    const annualCap = APV_CAP_UF_ANNUAL * uf;
    const base = Math.min(annualContributionB, annualCap);
    return base * marginalRate(monthlyTaxable, utm);
  }

  // Projects savings year by year from currentAge to retirementAge (inclusive).
  // `adjustment` shifts the annual return of EVERY category (for scenarios).
  // Returns { series:[{age, afpBalance, apvBalance, etfBalance, total}], total,
  //           accumulatedBonusA, accumulatedSavingsB }.
  function project(inputs, adjustment = 0) {
    const years = inputs.retirementAge - inputs.currentAge;
    let afpBalance = inputs.afpBalance;
    let apvBalance = inputs.apvBalance;
    let etfBalance = inputs.etfBalance;
    let accumulatedBonusA = 0;
    let accumulatedSavingsB = 0;

    let netSalary = inputs.netSalary;
    let contributionA = inputs.apvContributionA;
    let contributionB = inputs.apvContributionB;

    const usesA = inputs.apvRegime === 'A' || inputs.apvRegime === 'both';
    const usesB = inputs.apvRegime === 'B' || inputs.apvRegime === 'both';

    const series = [{
      age: inputs.currentAge,
      afpBalance, apvBalance, etfBalance, total: afpBalance + apvBalance + etfBalance,
    }];

    for (let i = 0; i < years; i++) {
      const factor = inputs.taxableFactor;
      const monthlyTaxable = taxableFromNet(netSalary, factor);
      const afpContribution = monthlyAfpContribution({ netSalary, taxableFactor: factor, afpContributionManual: inputs.afpContributionManual });

      // APV contributions can start later than currentAge (apvStartAge): until that
      // age only the existing APV balance compounds. Null/undefined => start now.
      const apvActive = inputs.apvStartAge == null || (inputs.currentAge + i) >= inputs.apvStartAge;
      const apvA = (usesA && apvActive) ? contributionA : 0;
      const apvB = (usesB && apvActive) ? contributionB : 0;

      afpBalance = growYear(afpBalance, afpContribution, inputs.afpReturn + adjustment);
      apvBalance = growYear(apvBalance, apvA + apvB, inputs.apvReturn + adjustment);
      etfBalance = growYear(etfBalance, inputs.etfContribution, inputs.etfReturn + adjustment);

      // Annual APV benefits
      if (usesA && apvActive) {
        const bonus = bonusA(apvA * 12, inputs.utm);
        accumulatedBonusA += bonus;
        apvBalance += bonus; // the A bonus is deposited into the fund
      }
      if (usesB && apvActive) {
        const saving = taxSavingsB(apvB * 12, monthlyTaxable, inputs.utm, inputs.uf);
        accumulatedSavingsB += saving;
        if (inputs.reinvestB) apvBalance += saving;
      }

      series.push({
        age: inputs.currentAge + i + 1,
        afpBalance, apvBalance, etfBalance, total: afpBalance + apvBalance + etfBalance,
      });

      // Annual growth for next year
      netSalary *= (1 + inputs.salaryGrowth);
      if (!inputs.apvFixed) {
        contributionA *= (1 + inputs.salaryGrowth);
        contributionB *= (1 + inputs.salaryGrowth);
      }
    }

    return {
      series,
      total: series.at(-1).total,
      // Pension is funded only by the pension savings (AFP + APV); the ETF is for
      // personal goals, not retirement, so it's excluded from the pension estimate.
      pensionBalance: afpBalance + apvBalance,
      accumulatedBonusA,
      accumulatedSavingsB,
    };
  }

  // Returns the 3 projections applying ∓scenarioAdjustment to the return.
  function scenarios(inputs) {
    const d = inputs.scenarioAdjustment;
    return {
      pessimistic: project(inputs, -d),
      realistic: project(inputs, 0),
      optimistic: project(inputs, +d),
    };
  }

  // Estimated monthly pension as a programmed withdrawal (Retiro Programado): the
  // initial monthly amount, balance / expected months, net of the 7% health levy.
  // This is the *initial* draw of a programmed withdrawal, not a fixed annuity
  // (Renta Vitalicia) — it runs higher than an annuity by design.
  function estimatedPension(finalBalance, retirementAge, lifeExpectancy) {
    const months = (lifeExpectancy - retirementAge) * 12;
    if (months <= 0) return 0;
    return (finalBalance / months) * (1 - HEALTH_CONTRIBUTION);
  }

  // Converts a nominal series to today's pesos by discounting inflation.
  function toReal(series, inflation, currentAge) {
    return series.map((p) => ({
      ...p,
      total: p.total / Math.pow(1 + inflation, p.age - currentAge),
    }));
  }

  return {
    monthlyRate, growYear, taxableFromNet, monthlyAfpContribution,
    bonusA, marginalRate, taxSavingsB, project, scenarios,
    estimatedPension, toReal,
  };
});
