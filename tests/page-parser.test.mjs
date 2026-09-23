import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageSnapshot } from '../src/page-parser.js';

test('parses a live mobile.de-style page snapshot directly', () => {
  const vehicle = parsePageSnapshot({
    title: 'Cupra Ateca in Itzehoe für 40.190 € | mobile.de',
    text: 'Hubraum\n1.984 cm³\nKraftstoffart\nBenzin\nCO₂-Emissionen (komb.)2\n192 g/km\nWLTP\nFirst Registration\n10/2021',
    url: 'https://suchen.mobile.de/fahrzeuge/details.html?id=443079361',
    hostname: 'suchen.mobile.de',
    jsonLd: []
  });
  assert.deepEqual({ make: vehicle.make, model: vehicle.model, price: vehicle.price, engineCc: vehicle.engineCc, co2: vehicle.co2GPerKm }, {
    make: 'Cupra', model: 'Ateca', price: 40190, engineCc: 1984, co2: 192
  });
  assert.equal(vehicle.firstRegistrationDate, '10/2021');
  assert.equal(vehicle.firstRegistrationYear, 2021);
});

test('normalizes comma-separated engine displacement', () => {
  const vehicle = parsePageSnapshot({
    title: 'Toyota Corolla 1.8 PHEV in Filderstadt für 14.900 € | mobile.de',
    text: 'Engine displacement\n1,395 cm³\nFuel\nPlug-in hybrid (petrol/electric)\nFirst registration\n03/2021',
    url: 'https://suchen.mobile.de/auto-inserat/example.html',
    hostname: 'suchen.mobile.de',
    jsonLd: []
  });
  assert.equal(vehicle.engineCc, 1395);
  assert.equal(vehicle.firstRegistrationDate, '03/2021');
  assert.equal(vehicle.isPlugInHybrid, true);
});

test('prefers the model-rich AutoScout title over an incomplete structured name', () => {
  const vehicle = parsePageSnapshot({
    title: 'Audi TT III 2015 Coupe Coupe 2.0 tfsi Design for € 24,999 | AutoScout24',
    text: 'Engine displacement\n1,984 cc\nFuel type\nGasoline\nFirst registration\n01/2016',
    url: 'https://www.autoscout24.com/offer/example',
    hostname: 'www.autoscout24.com',
    jsonLd: [{ '@type': 'Vehicle', brand: { name: 'Audi' }, name: 'Audi for € 24,999' }]
  });
  assert.equal(vehicle.make, 'Audi');
  assert.equal(vehicle.model, 'TT III 2015 Coupe Coupe 2.0 tfsi Design');
  assert.equal(vehicle.engineCc, 1984);
  assert.equal(vehicle.firstRegistrationYear, 2016);
});


test('uses the adjacent descriptive listing line instead of a generic location title', () => {
  const vehicle = parsePageSnapshot({
    title: 'Volkswagen Golf in Senftenberg | mobile.de',
    text: 'Volkswagen Golf\nR 2.0 TSI 4Motion Bi-Xenon Navi PDC\n22.990 EUR\nHubraum\n1.984 cm³\nKraftstoffart\nBenzin\nErstzulassung\n06/2016',
    url: 'https://suchen.mobile.de/fahrzeuge/details.html?id=example',
    hostname: 'suchen.mobile.de',
    jsonLd: [{ '@type': 'Vehicle', brand: { name: 'Volkswagen' }, name: 'Volkswagen Golf' }]
  });
  assert.equal(vehicle.make, 'Volkswagen');
  assert.equal(vehicle.model, 'Golf R 2.0 TSI 4Motion Bi-Xenon Navi PDC');
});
