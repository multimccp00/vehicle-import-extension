import test from 'node:test';
import assert from 'node:assert/strict';
import { matchVehicle } from '../src/matcher.js';

test('finds a CO₂ range when the listing omits CO₂', () => {
  const result = matchVehicle({
    make: 'Sünrise-Motors',
    model: 'Comet 1.4 TSI Plus',
    engineCc: 1395,
    fuelType: 'Hybrid (Benzin/Elektro)',
    firstRegistrationYear: 2021
  }, [
    { make: 'Sunrise Motors', commercialName: 'Comet', engineCc: 1395, fuelType: 'plug-in hybrid', co2Wltp: 23, registrationYear: 2021 },
    { make: 'Sunrise Motors', commercialName: 'Comet', engineCc: 1395, fuelType: 'plug-in hybrid', co2Wltp: 30, registrationYear: 2021 }
  ]);
  assert.equal(result.confidence, 'range');
  assert.equal(result.co2Min, 23);
  assert.equal(result.co2Max, 30);
});

test('does not invent a manufacturer alias when labels differ', () => {
  const result = matchVehicle({
    make: 'Example Motors',
    model: 'Roadster 1.5',
    engineCc: 1498,
    fuelType: 'Petrol',
    firstRegistrationYear: 2020
  }, [
    { make: 'Example Auto', commercialName: 'Roadster 1.5', engineCc: 1498, fuelType: 'Petrol', co2Wltp: 125, registrationYear: 2020 }
  ]);
  assert.equal(result.confidence, 'unknown');
});

test('recognizes an electric vehicle without engine displacement as ISV exempt', () => {
  const result = matchVehicle({
    make: 'Example Motors', model: 'Spark', fuelType: 'Electric', firstRegistrationYear: 2021
  }, []);
  assert.equal(result.confidence, 'exempt');
  assert.equal(result.isvExempt, true);
});

test('matches a catalogue commercial name when engine displacement is present', () => {
  const result = matchVehicle({
    make: 'Audi', model: 'TT III 2015 Coupe 2.0 TFSI Design', engineCc: 1984,
    fuelType: 'Gasoline', firstRegistrationYear: 2016
  }, [
    { make: 'AUDI', commercialName: 'TT', engineCc: 1984, fuelType: 'Petrol', co2Nedc: 162, registrationYear: 2016 }
  ]);
  assert.equal(result.confidence, 'catalogue');
  assert.equal(result.co2Min, 162);
  assert.equal(result.co2Max, 162);
});


test('matches a composite catalogue make label without an alias table', () => {
  const result = matchVehicle({ make: 'Example Motors', model: 'Roadster', engineCc: 1984, fuelType: 'Petrol', firstRegistrationYear: 2016 }, [
    { make: 'Example Motors Group', commercialName: 'Roadster', engineCc: 1984, fuelType: 'Petrol', co2Nedc: 159, registrationYear: 2016 }
  ]);
  assert.equal(result.co2Min, 159);
});
