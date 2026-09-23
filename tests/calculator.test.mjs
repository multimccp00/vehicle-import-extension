import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePortugalRange } from '../src/calculator.js';

const rules = {
  isv: {
    minimum: 100, plugInHybridRate: .25, dieselSurcharge: 500,
    displacement: [{ max: 1000, rate: 1.09, deduction: 849.03 }, { max: 1250, rate: 1.18, deduction: 850.69 }, { max: 999999, rate: 5.61, deduction: 6194.88 }],
    environmental: { wltp: { diesel: [{ max: 110, rate: 1.72, deduction: 11.5 }, { max: 140, rate: 65.04, deduction: 7360.85 }, { max: 9999, rate: 282.35, deduction: 38271.32 }], petrol: [{ max: 110, rate: .44, deduction: 43.02 }, { max: 9999, rate: 233.81, deduction: 41910.96 }] }, nedc: { diesel: [{ max: 9999, rate: 268.42, deduction: 33447.9 }], petrol: [{ max: 99, rate: 4.62, deduction: 427 }, { max: 115, rate: 8.09, deduction: 750.99 }, { max: 145, rate: 52.56, deduction: 5903.94 }, { max: 175, rate: 61.24, deduction: 7140.17 }, { max: 195, rate: 155.97, deduction: 23627.27 }, { max: 9999, rate: 205.65, deduction: 33390.12 }] } },
    ageReduction: [
      { maxAge: 1, reduction: .1 }, { maxAge: 2, reduction: .2 }, { maxAge: 3, reduction: .28 },
      { maxAge: 4, reduction: .35 }, { maxAge: 5, reduction: .43 }, { maxAge: 6, reduction: .52 },
      { maxAge: 7, reduction: .6 }, { maxAge: 999, reduction: .8 }
    ]
  },
  import: { customsDutyRate: .1, importVatRate: .23 }
};

test('calculates a range without asking the user to choose a variant', () => {
  const result = calculatePortugalRange({
    vehicle: { engineCc: 1995, fuelType: 'diesel', co2Standard: 'WLTP', firstRegistrationYear: 2018 },
    originCountry: 'DE', purchasePrice: 18000, transportCost: 1200, otherCosts: 0,
    match: { co2Min: 124, co2Max: 137 }, rules, currentYear: 2026
  });
  assert.equal(result.status, 'range');
  assert.equal(result.co2Min, 124);
  assert.equal(result.co2Max, 137);
  assert.ok(result.low.total < result.high.total);
});

test('returns unknown when no CO2 match exists', () => {
  const result = calculatePortugalRange({ vehicle: { engineCc: 1600 }, match: { confidence: 'unknown' }, rules });
  assert.equal(result.status, 'unknown');
});

test('uses the exact registration date for Portugal age reduction', () => {
  const result = calculatePortugalRange({
    vehicle: { engineCc: 1498, fuelType: 'petrol', co2Standard: 'WLTP', firstRegistrationYear: 2020, firstRegistrationDate: '07/2020' },
    originCountry: 'DE', purchasePrice: 20950, transportCost: 1200,
    match: { co2Min: 99, co2Max: 99 }, rules, currentYear: 2026, currentDate: new Date('2026-09-22T00:00:00Z')
  });
  assert.equal(result.low.reduction, 0.60);
  assert.equal(Math.round(result.low.displacement * 100) / 100, 2208.90);
  assert.equal(Math.round(result.low.isv * 100) / 100, 883.78);
});

test('deducts a negative environmental component before applying the minimum', () => {
  const result = calculatePortugalRange({
    vehicle: { engineCc: 850, fuelType: 'petrol', co2Standard: 'WLTP', firstRegistrationYear: 2025 },
    originCountry: 'DE', match: { co2Min: 90, co2Max: 90 }, rules, currentYear: 2026
  });
  assert.equal(result.low.environmental < 0, true);
  assert.equal(result.low.grossIsv, 100);
});

test('uses NEDC when the matched catalogue says NEDC', () => {
  const result = calculatePortugalRange({
    vehicle: { engineCc: 1395, fuelType: 'petrol', co2Standard: 'NEDC', firstRegistrationYear: 2021, firstRegistrationDate: '03/2021' },
    originCountry: 'DE', match: { co2Min: 22, co2Max: 22 }, rules, currentYear: 2026, currentDate: new Date('2026-09-22T00:00:00Z')
  });
  assert.equal(result.low.environmental, -325.36);
  assert.equal(Math.round(result.low.isv * 100) / 100, 626.74);
});

test('applies the plug-in hybrid rate only when emissions qualify', () => {
  const result = calculatePortugalRange({
    vehicle: { make: 'Example Motors', model: 'Comet PHEV', engineCc: 1395, fuelType: 'Plug-in hybrid (petrol/electric)', co2Standard: 'WLTP', firstRegistrationYear: 2021, firstRegistrationDate: '03/2021' },
    originCountry: 'DE', match: { co2Min: 22, co2Max: 22 }, rules, currentYear: 2026, currentDate: new Date('2026-09-22T00:00:00Z')
  });
  assert.equal(result.low.propulsionRate, .25);
  assert.equal(Math.round(result.low.isv * 100) / 100, 191.73);
});

test('exempts an exclusively electric vehicle from ISV without engine displacement', () => {
  const result = calculatePortugalRange({
    vehicle: { make: 'Example Motors', model: 'Spark', fuelType: 'Electric', firstRegistrationYear: 2021 },
    originCountry: 'DE', purchasePrice: 25900, transportCost: 1200,
    match: { confidence: 'exempt', isvExempt: true }, rules, currentYear: 2026
  });
  assert.equal(result.status, 'exempt');
  assert.equal(result.low.displacement, 0);
  assert.equal(result.low.isv, 0);
  assert.equal(result.low.total, 27100);
});
