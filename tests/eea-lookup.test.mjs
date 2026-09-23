import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupEeaCatalogue } from '../src/eea-lookup.js';

test('queries EEA records for any make and maps variants to catalogue rows', async () => {
  let requestedUrl;
  const records = await lookupEeaCatalogue({
    make: 'Toyota', model: 'Corolla', engineCc: 1798, firstRegistrationYear: 2021
  }, async (url) => {
    requestedUrl = url;
    return { ok: true, async json() { return { results: [{ Make: 'Toyota', CommercialName: 'Corolla', EngineCc: 1798, FuelType: 'Petrol/Electric', Co2Wltp: null, Co2Nedc: 89, RegistrationYear: 2021 }] }; } };
  });
  assert.match(decodeURIComponent(requestedUrl), /Ec \(cm3\)/);
  assert.match(decodeURIComponent(requestedUrl), /Ewltp \(g\/km\)/);
  assert.match(decodeURIComponent(requestedUrl), /COALESCE\(\[Cn\], \[MMS\]\)/);
  assert.match(decodeURIComponent(requestedUrl), /\[Cn\] LIKE 'Corolla%'/);
  assert.equal(records[0].make, 'Toyota');
  assert.equal(records[0].co2Wltp, undefined);
  assert.equal(records[0].co2Nedc, 89);
  assert.equal(records[0].source, 'EEA online catalogue');
});

test('queries only the requested make without manufacturer-specific aliases', async () => {
  let requestedUrl;
  await lookupEeaCatalogue({ make: 'Example Motors', model: 'Roadster', engineCc: 1498, firstRegistrationYear: 2020 }, async (url) => {
    requestedUrl = url;
    return { ok: true, async json() { return { results: [] }; } };
  });
  const query = decodeURIComponent(requestedUrl);
  assert.match(query, /Example Motors/);
  assert.doesNotMatch(query, /\[Mk\]\s+LIKE[^)]*OR\s+\[Mk\]/i);
});

test('times out a stalled EEA request', async () => {
  await assert.rejects(
    lookupEeaCatalogue({ make: 'Example Motors', model: 'Roadster' }, async () => new Promise(() => {}), 5),
    /EEA lookup timed out after 5 ms/
  );
});


test('maps the legacy EEA CO₂ field as NEDC for historical records', async () => {
  let requestedUrl;
  const records = await lookupEeaCatalogue({ make: 'Example Motors', model: 'Roadster', engineCc: 1984, firstRegistrationYear: 2016 }, async (url) => {
    requestedUrl = url;
    return { ok: true, async json() { return { results: [{ Make: 'Example Motors Group', CommercialName: 'Roadster', EngineCc: 1984, FuelType: 'Petrol', Co2Wltp: null, Co2Nedc: null, Co2Legacy: 159, RegistrationYear: 2016 }] }; } };
  });
  assert.ok(decodeURIComponent(requestedUrl).includes('[E (g/km)] AS Co2Legacy'));
  assert.equal(records[0].co2Nedc, 159);
});
