const { test } = require('node:test');
const assert = require('node:assert/strict');
const { monthlyRate, growYear, taxableFromNet, monthlyAfpContribution, bonusA, marginalRate, taxSavingsB, project, scenarios, estimatedPension, toReal } = require('../js/engine.js');

test('monthlyRate: 12 compounded months reconstruct the annual rate', () => {
  const m = monthlyRate(0.06);
  assert.ok(Math.abs(Math.pow(1 + m, 12) - 1.06) < 1e-9);
});

test('growYear: with no contributions, grows exactly the annual rate', () => {
  const balance = growYear(1000000, 0, 0.06);
  assert.ok(Math.abs(balance - 1060000) < 0.01);
});

test('growYear: with a monthly contribution accumulates 12 contributions plus interest', () => {
  const balance = growYear(0, 100000, 0); // rate 0 => exactly 12 contributions
  assert.equal(Math.round(balance), 1200000);
});

test('taxableFromNet: applies the factor', () => {
  assert.equal(taxableFromNet(1000000, 1.22), 1220000);
});

test('monthlyAfpContribution: 10% of taxable when there is no override', () => {
  assert.equal(monthlyAfpContribution({ netSalary: 1000000, taxableFactor: 1.22, afpContributionManual: null }), 122000);
});

test('monthlyAfpContribution: honors the manual override', () => {
  assert.equal(monthlyAfpContribution({ netSalary: 1000000, taxableFactor: 1.22, afpContributionManual: 90000 }), 90000);
});

test('monthlyAfpContribution: empty string (cleared field) is treated as auto, not NaN', () => {
  const r = monthlyAfpContribution({ netSalary: 1000000, taxableFactor: 1.22, afpContributionManual: '' });
  assert.equal(r, 122000);
});

test('bonusA: 15% of the annual contribution below the cap', () => {
  // annual contribution 600,000 => 15% = 90,000; cap 6 UTM*67,000 = 402,000 => no cap
  assert.equal(bonusA(600000, 67000), 90000);
});

test('bonusA: capped at 6 UTM', () => {
  // annual contribution 5,000,000 => 15% = 750,000; cap 6*67,000 = 402,000 => capped
  assert.equal(bonusA(5000000, 67000), 402000);
});

test('marginalRate: exempt taxable (below 13.5 UTM) => 0%', () => {
  // 13.5 UTM * 67,000 = 904,500; we use 800,000 => exempt
  assert.equal(marginalRate(800000, 67000), 0.0);
});

test('marginalRate: taxable in the 8% bracket', () => {
  // between 30 and 50 UTM => 30*67,000=2,010,000 .. 50*67,000=3,350,000; we use 2,500,000
  assert.equal(marginalRate(2500000, 67000), 0.08);
});

test('taxSavingsB: contribution * marginal rate', () => {
  // taxable 2,500,000 => 8%; annual contribution 600,000 => saving 48,000
  assert.equal(taxSavingsB(600000, 2500000, 67000, 38000), 48000);
});

test('taxSavingsB: contribution capped at the 600 UF annual cap', () => {
  // cap = 600*38,000 = 22,800,000; contribution 30,000,000 => uses 22,800,000
  // taxable in 8% => saving = 22,800,000 * 0.08 = 1,824,000
  assert.equal(taxSavingsB(30000000, 2500000, 67000, 38000), 1824000);
});

const baseInputs = {
  currentAge: 60, retirementAge: 62, lifeExpectancy: 85,
  netSalary: 1000000, taxableFactor: 1.22, afpContributionManual: null,
  afpBalance: 0, afpReturn: 0,
  apvRegime: 'both', apvContributionA: 0, apvContributionB: 0, apvBalance: 0, apvReturn: 0,
  apvFixed: true, reinvestB: false,
  etfBalance: 0, etfContribution: 0, etfReturn: 0,
  utm: 67000, uf: 38000, inflation: 0, salaryGrowth: 0, scenarioAdjustment: 0,
};

test('project: one row per year from currentAge to retirementAge inclusive', () => {
  const r = project(baseInputs);
  assert.equal(r.series.length, 3); // 60, 61, 62
  assert.equal(r.series[0].age, 60);
  assert.equal(r.series.at(-1).age, 62);
});

test('project: with no return or growth, AFP accumulates 12*contribution per year', () => {
  const r = project(baseInputs);
  // AFP contribution = 10% * 1,220,000 = 122,000/mo => 1,464,000/yr, 2 years of contributions
  assert.equal(Math.round(r.total), Math.round(122000 * 12 * 2));
});

test('project: salary growth raises the AFP contribution in year 2', () => {
  const r = project({ ...baseInputs, salaryGrowth: 0.10 });
  // year1 contribution 122,000, year2 contribution 134,200 => total = (122000+134200)*12
  assert.equal(Math.round(r.total), Math.round((122000 + 134200) * 12));
});

test('project: pensionBalance excludes the ETF (AFP + APV only)', () => {
  const r = project({ ...baseInputs, etfBalance: 9000000, etfContribution: 100000 });
  // ETF must not inflate the pension fund; pensionBalance stays AFP+APV.
  assert.equal(Math.round(r.pensionBalance), Math.round(122000 * 12 * 2));
  assert.ok(r.total > r.pensionBalance); // total still includes the ETF
});

test('project: apvStartAge delays APV contributions (less than starting now)', () => {
  const apvIn = {
    ...baseInputs, currentAge: 30, retirementAge: 65,
    apvRegime: 'A', apvContributionA: 50000, apvReturn: 0.04,
  };
  const now = project(apvIn);                          // APV from age 30
  const delayed = project({ ...apvIn, apvStartAge: 35 }); // APV from age 35
  assert.ok(delayed.pensionBalance < now.pensionBalance);
  assert.ok(delayed.accumulatedBonusA < now.accumulatedBonusA);
});

test('project: apvStartAge >= retirementAge => no APV contributed at all', () => {
  const apvIn = {
    ...baseInputs, currentAge: 30, retirementAge: 65,
    apvRegime: 'A', apvContributionA: 50000, apvReturn: 0.04, apvBalance: 0,
  };
  const none = project({ ...apvIn, apvStartAge: 65 });
  const noApv = project({ ...apvIn, apvContributionA: 0 });
  assert.equal(Math.round(none.pensionBalance), Math.round(noApv.pensionBalance));
  assert.equal(none.accumulatedBonusA, 0);
});

test('scenarios: realistic uses the base return', () => {
  const r = scenarios({ ...baseInputs, afpReturn: 0.04, scenarioAdjustment: 0.02 });
  const direct = project({ ...baseInputs, afpReturn: 0.04 });
  assert.equal(Math.round(r.realistic.total), Math.round(direct.total));
});

test('scenarios: optimistic > realistic > pessimistic with contributions and return', () => {
  const r = scenarios({ ...baseInputs, afpBalance: 10000000, afpReturn: 0.05, scenarioAdjustment: 0.02 });
  assert.ok(r.optimistic.total > r.realistic.total);
  assert.ok(r.realistic.total > r.pessimistic.total);
});

test('scenarios: the applied adjustment is ±scenarioAdjustment', () => {
  const r = scenarios({ ...baseInputs, afpBalance: 10000000, afpReturn: 0.05, scenarioAdjustment: 0.02 });
  const opt = project({ ...baseInputs, afpBalance: 10000000, afpReturn: 0.05 }, 0.02);
  assert.equal(Math.round(r.optimistic.total), Math.round(opt.total));
});

test('estimatedPension: balance / expected months, net of 7% health', () => {
  // balance 120,000,000; (85-65)*12 = 240 months => 500,000 gross; 465,000 net
  assert.equal(Math.round(estimatedPension(120000000, 65, 85)), 465000);
});

test('estimatedPension: 0 expected months => 0 (no division by zero)', () => {
  assert.equal(estimatedPension(120000000, 85, 85), 0);
});

test('toReal: discounts inflation by years from today', () => {
  const series = [
    { age: 30, total: 1000000 },
    { age: 31, total: 1000000 },
  ];
  const r = toReal(series, 0.10, 30);
  assert.equal(Math.round(r[0].total), 1000000);          // year 0
  assert.equal(Math.round(r[1].total), Math.round(1000000 / 1.1)); // year 1
});
