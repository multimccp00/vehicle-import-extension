import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('extracts facts from the mobile.de detail-page shape', () => {
  const source = fs.readFileSync(new URL('../content.js', import.meta.url), 'utf8');
  let listener;
  const context = {
    document: {
      title: 'Cupra Ateca in Itzehoe für 40.190 € | mobile.de',
      body: { innerText: 'Hubraum\n1,984 cm³\nKraftstoffart\nBenzin\nCO₂-Emissionen (komb.)2\n192 g/km\nWLTP\nFirst Registration\n10/2021' },
      querySelectorAll: () => [],
      querySelector: () => null
    },
    location: { href: 'https://suchen.mobile.de/fahrzeuge/details.html?id=443079361' },
    chrome: { runtime: { onMessage: { addListener: (handler) => { listener = handler; } } } },
    Date,
    console
  };
  vm.runInNewContext(source, context);
  let extracted;
  listener({ type: 'GET_VEHICLE' }, {}, (value) => { extracted = value; });
  assert.equal(extracted.make, 'Cupra');
  assert.equal(extracted.model, 'Ateca');
  assert.equal(extracted.price, 40190);
  assert.equal(extracted.engineCc, 1984);
  assert.equal(extracted.co2GPerKm, 192);
  assert.equal(extracted.fuelType, 'Benzin');
  assert.equal(extracted.firstRegistrationDate, '10/2021');
  assert.equal(extracted.firstRegistrationYear, 2021);
});
