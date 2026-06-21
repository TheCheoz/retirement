// constants.js — UMD: works as a classic <script> in the browser (defines
// window.RetirementConstants) and as a CommonJS module in Node (module.exports).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RetirementConstants = api;
})(typeof self !== 'undefined' ? self : this, function () {
  const MANDATORY_CONTRIBUTION = 0.10;
  // Pensioners pay 7% of their pension toward health (FONASA/Isapre). The official
  // simulator reports the net (líquida) pension, so we discount it too. Reference value.
  const HEALTH_CONTRIBUTION = 0.07;
  const BONUS_A_PCT = 0.15;
  const BONUS_A_CAP_UTM = 6;
  const APV_CAP_UF_ANNUAL = 600;

  // Second-category income tax — monthly brackets in UTM (rate = marginal rate).
  // Reference values; update if the regulation changes.
  const TAX_BRACKETS = [
    { from: 0,    to: 13.5,     rate: 0.0 },
    { from: 13.5, to: 30,       rate: 0.04 },
    { from: 30,   to: 50,       rate: 0.08 },
    { from: 50,   to: 70,       rate: 0.135 },
    { from: 70,   to: 90,       rate: 0.23 },
    { from: 90,   to: 120,      rate: 0.304 },
    { from: 120,  to: 310,      rate: 0.35 },
    { from: 310,  to: Infinity, rate: 0.40 },
  ];

  const DEFAULTS = {
    currentAge: 30,
    sex: null,
    retirementAge: 65,
    lifeExpectancy: 85,
    targetPension: null,
    netSalary: 1000000,
    taxableFactor: 1.22,
    afpContributionManual: null,
    afpBalance: 5000000,
    afpReturn: 0.04,
    apvRegime: 'both',
    apvContributionA: 0,
    apvContributionB: 0,
    apvBalance: 0,
    apvReturn: 0.04,
    apvFixed: false,
    reinvestB: false,
    // Age at which APV contributions begin. null => from currentAge (no delay).
    apvStartAge: null,
    etfBalance: 0,
    etfContribution: 0,
    etfReturn: 0.06,
    utm: 67000,
    uf: 38000,
    inflation: 0.03,
    salaryGrowth: 0.02,
    scenarioAdjustment: 0.02,
  };

  return {
    MANDATORY_CONTRIBUTION, HEALTH_CONTRIBUTION, BONUS_A_PCT, BONUS_A_CAP_UTM,
    APV_CAP_UF_ANNUAL, TAX_BRACKETS, DEFAULTS,
  };
});
