export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isElectricVehicle(vehicle) {
  const fuel = normalize(vehicle?.fuelType);
  return Boolean(fuel)
    && !fuel.includes('hybrid')
    && /\b(?:electric|electricity|elektrisch|elektro|eletrico|bev)\b/.test(fuel);
}

function makeMatches(a, b) {
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function fuelMatches(a, b) {
  if (!a || !b) return true;
  const x = normalize(a); const y = normalize(b);
  const knownFuel = /(diesel|gasoleo|petrol|gasoline|benzin|hybrid|electric|elektro)/.test(y);
  if (!knownFuel) return true;
  if (x.includes('hybrid') || x.includes('electric') || x.includes('elektro')) return y.includes('hybrid') || y.includes('electric') || y.includes('elektro');
  if (x.includes('diesel') || x.includes('gasoleo')) return y.includes('diesel') || y.includes('gasoleo');
  if (x.includes('petrol') || x.includes('gasoline') || x.includes('benzin')) return y.includes('petrol') || y.includes('gasoline') || y.includes('benzin');
  return x === y;
}

function modelMatches(vehicleModel, catalogueModel) {
  if (!vehicleModel || !catalogueModel) return true;
  if (catalogueModel.includes(vehicleModel) || vehicleModel.includes(catalogueModel)) return true;
  const vehicleTokens = new Set(vehicleModel.split(/\s+/));
  const catalogueTokens = catalogueModel.split(/\s+/).filter((token) => token.length > 1);
  if (!catalogueTokens.length || !vehicleTokens.has(catalogueTokens[0])) return false;
  const catalogueNumbers = catalogueTokens.filter((token) => /^\d+$/.test(token));
  return catalogueNumbers.every((token) => vehicleTokens.has(token));
}

export function matchVehicle(vehicle, catalogue) {
  if (isElectricVehicle(vehicle)) {
    return {
      confidence: 'exempt', isvExempt: true, co2Min: 0, co2Max: 0,
      testTypes: [], records: [], source: 'Portugal ISV electric-vehicle exemption'
    };
  }
  if (vehicle.co2GPerKm) {
    return {
      confidence: 'exact', co2Min: vehicle.co2GPerKm, co2Max: vehicle.co2GPerKm,
      testTypes: vehicle.co2Standard ? [vehicle.co2Standard] : ['unknown'], records: [], source: 'listing'
    };
  }
  const make = normalize(vehicle.make);
  const model = normalize(vehicle.model);
  const year = Number(vehicle.firstRegistrationYear);
  if (!make && !model && !vehicle.engineCc && !year) {
    return { confidence: 'unknown', records: [], source: 'catalogue', reason: 'No vehicle identity was extracted from the page.' };
  }
  const candidates = catalogue.filter((record) => {
    const recordMake = normalize(record.make);
    const recordModel = normalize(record.commercialName || record.model);
    const makeOk = makeMatches(make, recordMake);
    const modelOk = modelMatches(model, recordModel);
    const engineOk = !vehicle.engineCc || !record.engineCc || Math.abs(Number(record.engineCc) - Number(vehicle.engineCc)) <= 50;
    const fuelOk = fuelMatches(vehicle.fuelType, record.fuelType);
    const yearOk = !year || !record.registrationYear || Math.abs(Number(record.registrationYear) - year) <= 2;
    return makeOk && modelOk && engineOk && fuelOk && yearOk && Number.isFinite(Number(record.co2Wltp ?? record.co2Nedc));
  });
  const values = [...new Set(candidates.map((record) => ({
    value: Number(record.co2Wltp ?? record.co2Nedc),
    testType: record.co2Wltp != null ? 'WLTP' : 'NEDC'
  })).map((entry) => JSON.stringify(entry)))].map((entry) => JSON.parse(entry));
  if (!values.length) return { confidence: 'unknown', records: [], source: 'catalogue' };
  const co2 = values.map((entry) => entry.value);
  return {
    confidence: values.length === 1 ? 'catalogue' : 'range',
    co2Min: Math.min(...co2), co2Max: Math.max(...co2),
    testTypes: [...new Set(values.map((entry) => entry.testType))],
    records: candidates,
    source: 'vehicle catalogue'
  };
}
