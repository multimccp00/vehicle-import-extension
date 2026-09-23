import { detectDestination, COUNTRY_NAMES } from './src/destination.js';
import { isElectricVehicle, matchVehicle } from './src/matcher.js';
import { calculatePortugalRange } from './src/calculator.js';
import { parsePageSnapshot } from './src/page-parser.js';

const $ = (id) => document.getElementById(id);
const money = (value) => value == null ? '—' : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
let vehicle = {};
let catalogue = [];
let rules;
let destination;
let match;
let catalogueLookupStatus = '';

async function lookupEeaFromServiceWorker(currentVehicle) {
  const response = await chrome.runtime.sendMessage({ type: 'LOOKUP_EEA', vehicle: currentVehicle });
  if (response?.error) throw new Error(response.error);
  return response?.records || [];
}

async function activeVehicle() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return {};
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        title: document.title,
        text: document.body?.innerText || '',
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent),
        url: location.href,
        hostname: location.hostname
      })
    });
    return parsePageSnapshot(result?.result || {});
  } catch (error) {
    return { extractionError: error?.message || 'The active tab could not be read.' };
  }
}

function renderFacts() {
  const facts = [
    ['Make / model', [vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Not found'],
    ['Price', vehicle.price ? `${vehicle.price} ${vehicle.currency || ''}` : 'Not found'],
    ['Engine', vehicle.engineCc ? `${vehicle.engineCc} cc` : 'Not found'],
    ['Fuel', vehicle.fuelType || 'Not found'],
    ['CO₂', match?.isvExempt
      ? 'Exclusively electric (ISV exempt)'
      : vehicle.co2GPerKm
      ? `${vehicle.co2GPerKm} g/km ${vehicle.co2Standard || ''}`
      : match?.confidence === 'range'
        ? `${match.co2Min}–${match.co2Max} g/km (catalogue)`
        : match?.confidence === 'catalogue'
          ? `${match.co2Min} g/km (catalogue)`
          : 'Not listed'],
    ['First registration', vehicle.firstRegistrationDate || vehicle.firstRegistrationYear || 'Not found']
  ];
  const container = $('vehicle-facts');
  container.replaceChildren(...facts.map(([key, value]) => {
    const wrapper = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = key;
    const detail = document.createElement('dd'); detail.textContent = value;
    wrapper.append(term, detail);
    return wrapper;
  }));
}

function renderDestination() {
  $('destination-value').textContent = COUNTRY_NAMES[destination.countryCode] || destination.countryCode;
  $('destination-source').textContent = destination.source === 'manual' ? 'Saved manual destination' : `Detected from ${destination.source}`;
  $('destination-select').value = destination.countryCode;
}

function renderEstimate() {
  match = matchVehicle(vehicle, catalogue);
  const cataloguePlugIn = match.records?.some((record) => /plug[\s-]?in|phev/i.test(`${record.fuelType || ''} ${record.commercialName || ''}`));
  vehicle.isPlugInHybrid = vehicle.isPlugInHybrid || cataloguePlugIn;
  const badge = $('match-badge');
  const lookupPending = catalogueLookupStatus.includes('searching');
  badge.className = `badge ${lookupPending || match.confidence === 'range' ? 'warn' : match.confidence === 'unknown' ? 'error' : ''}`;
  badge.textContent = lookupPending ? 'Searching…' : match.confidence === 'range' ? 'CO₂ range' : match.confidence === 'unknown' ? 'No match' : match.confidence === 'exempt' ? 'ISV exempt' : 'Matched';
  const warning = $('match-warning');
  if (match.confidence === 'exempt') {
    warning.classList.remove('hidden');
    warning.textContent = 'This vehicle is exclusively electric and is exempt from Portuguese ISV. The estimate includes applicable import costs but no ISV.';
  } else if (match.confidence === 'range') {
    warning.classList.remove('hidden');
    warning.textContent = `The listing does not provide CO₂. The extension searched its vehicle catalogue and found variants from ${match.co2Min}–${match.co2Max} g/km ${match.testTypes.join('/')} . The estimate uses that range because variants can differ.`;
  } else if (match.confidence === 'unknown') {
    warning.classList.remove('hidden');
    const lookupNote = lookupPending
      ? ' The extension is searching the EEA catalogue for compatible records.'
      : catalogueLookupStatus.includes('unavailable')
      ? ' The EEA lookup was unavailable; check the connection and retry.'
      : catalogueLookupStatus.includes('no records')
        ? ' The EEA lookup returned no compatible records.'
        : '';
    warning.textContent = `The listing does not provide CO₂, and no compatible catalogue records were found.${lookupNote} The CO₂-dependent ISV and total cannot be estimated safely.`;
  } else warning.classList.add('hidden');

  if (destination.countryCode !== 'PT' || match.confidence === 'unknown') {
    $('total-value').textContent = 'Not available';
    $('breakdown').innerHTML = '<div><span>Portugal calculator</span><strong>Required</strong></div>';
    return;
  }
  const catalogueTestTypes = [...new Set(match.testTypes || [])];
  const calculationVehicle = {
    ...vehicle,
    co2Standard: vehicle.co2Standard || (catalogueTestTypes.length === 1 ? catalogueTestTypes[0] : undefined)
  };
  const result = calculatePortugalRange({
    vehicle: calculationVehicle,
    match,
    rules,
    originCountry: $('origin-country').value,
    purchasePrice: Number(vehicle.price || 0),
    transportCost: Number($('transport-cost').value || 0),
    otherCosts: Number($('other-costs').value || 0)
  });
  $('total-value').textContent = result.status === 'range' ? `${money(result.low.total)} – ${money(result.high.total)}` : money(result.low.total);
  const low = result.low; const high = result.high;
  const rows = [
    ['ISV', result.status === 'range' ? `${money(low.isv)} – ${money(high.isv)}` : money(low.isv)],
    ['Customs duty', result.status === 'range' ? `${money(low.customs)} – ${money(high.customs)}` : money(low.customs)],
    ['Import VAT', result.status === 'range' ? `${money(low.importVat)} – ${money(high.importVat)}` : money(low.importVat)],
    ['Transport', money(Number($('transport-cost').value || 0))]
  ];
  $('breakdown').innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join('');
}

async function init() {
  $('build-version').textContent = `Extension build ${chrome.runtime.getManifest().version}`;
  [vehicle, rules, destination] = await Promise.all([
    activeVehicle(),
    fetch(chrome.runtime.getURL('data/portugal-rules.json')).then((r) => r.json()),
    detectDestination()
  ]);
  const catalogueData = await fetch(chrome.runtime.getURL('data/catalogue.json')).then((r) => r.json());
  catalogue = catalogueData.records || [];
  $('page-status').textContent = vehicle.extractionError
    ? `Could not read the active tab: ${vehicle.extractionError}`
    : vehicle.make || vehicle.model
      ? `Detected from ${vehicle.sourceSite || 'current page'}`
      : 'No vehicle details found on the active tab';
  renderDestination();
  renderEstimate();
  renderFacts();
  $('versions').textContent = `Rules: ${rules.version} · Catalogue: ${catalogueData.version}`;

  if (!vehicle.co2GPerKm && vehicle.make && !isElectricVehicle(vehicle)) {
    catalogueLookupStatus = ' · EEA lookup: searching';
    renderEstimate();
    $('versions').textContent = `Rules: ${rules.version} · Catalogue: ${catalogueData.version}${catalogueLookupStatus}`;
    try {
      const onlineRecords = await lookupEeaFromServiceWorker(vehicle);
      catalogue = [...catalogue, ...onlineRecords];
      catalogueLookupStatus = onlineRecords.length ? ` · EEA lookup: ${onlineRecords.length} records` : ' · EEA lookup: no records';
    } catch (error) {
      catalogueLookupStatus = ` · EEA lookup unavailable: ${error.message}`;
    }
    renderEstimate();
    renderFacts();
  }
  $('versions').textContent = `Rules: ${rules.version} · Catalogue: ${catalogueData.version}${catalogueLookupStatus}`;
}

$('change-destination').addEventListener('click', () => $('destination-editor').classList.toggle('hidden'));
$('save-destination').addEventListener('click', async () => {
  await chrome.storage.local.set({ destinationOverride: $('destination-select').value });
  destination = await detectDestination(); renderDestination(); renderEstimate();
  $('destination-editor').classList.add('hidden');
});
['origin-country', 'transport-cost', 'other-costs'].forEach((id) => $(id).addEventListener('input', renderEstimate));
init();
