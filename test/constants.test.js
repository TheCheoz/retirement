const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  MANDATORY_CONTRIBUTION, BONUS_A_PCT, BONUS_A_CAP_UTM,
  APV_CAP_UF_ANNUAL, TAX_BRACKETS, DEFAULTS,
} = require('../js/constants.js');

test('mandatory AFP contribution is 10%', () => {
  assert.equal(MANDATORY_CONTRIBUTION, 0.10);
});

test('bonus A: 15% capped at 6 UTM', () => {
  assert.equal(BONUS_A_PCT, 0.15);
  assert.equal(BONUS_A_CAP_UTM, 6);
});

test('APV cap with tax benefit: 600 UF annual', () => {
  assert.equal(APV_CAP_UF_ANNUAL, 600);
});

test('tax brackets cover from 0 and are ordered', () => {
  assert.equal(TAX_BRACKETS[0].from, 0);
  for (let i = 1; i < TAX_BRACKETS.length; i++) {
    assert.equal(TAX_BRACKETS[i].from, TAX_BRACKETS[i - 1].to);
  }
});

test('DEFAULTS includes all base inputs', () => {
  for (const k of ['currentAge','retirementAge','lifeExpectancy','netSalary',
    'taxableFactor','utm','uf','inflation','salaryGrowth','scenarioAdjustment']) {
    assert.ok(k in DEFAULTS, `missing default ${k}`);
  }
});
