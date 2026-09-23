const EU_COUNTRIES = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);

function bandValue(value, bands) {
  return bands.find((band) => value <= band.max) || bands[bands.length - 1];
}

function component(value, bands) {
  const band = bandValue(value, bands);
  return value * band.rate - band.deduction;
}

function registrationDate(value) {
  if (!value) return undefined;
  const raw = String(value).trim();
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  match = raw.match(/^(\d{1,2})[./-](\d{4})$/);
  if (match) return new Date(Date.UTC(Number(match[2]), Number(match[1]) - 1, 1));
  return undefined;
}

function isPlugInHybridVehicle(vehicle) {
  if (vehicle?.isPlugInHybrid === true) return true;
  return /plug[\s-]?in|phev|\biv\b|\bgte\b|tfs[ií]?\s*-?e|e-?hybrid/i.test(
    [vehicle?.make, vehicle?.model, vehicle?.fuelType].filter(Boolean).join(' ')
  );
}

function ageReduction(firstRegistrationYear, currentYear, originCountry, table, firstRegistrationDate, currentDate = new Date()) {
  if (!firstRegistrationYear || !EU_COUNTRIES.has(originCountry)) return 0;
  const registered = registrationDate(firstRegistrationDate);
  let age;
  if (registered && currentDate instanceof Date && !Number.isNaN(registered.valueOf())) {
    const elapsedYears = (currentDate.getTime() - registered.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
    // Portugal's table changes immediately after each completed whole-year boundary.
    // ceil keeps exactly six years in the 52% band, but six years plus one day in 60%.
    age = Math.max(0, Math.ceil(elapsedYears));
  } else {
    age = Math.max(0, currentYear - Number(firstRegistrationYear));
  }
  const row = table.find((item) => age <= item.maxAge) || table[table.length - 1];
  return row.reduction;
}

export function calculatePortugalSingle({ vehicle, originCountry, purchasePrice = 0, transportCost = 0, otherCosts = 0, co2, isvExempt = false, rules, currentYear = new Date().getFullYear(), currentDate = new Date() }) {
  if (isvExempt) {
    const nonEu = !EU_COUNTRIES.has(originCountry);
    const customs = nonEu ? (purchasePrice + transportCost) * rules.import.customsDutyRate : 0;
    const importVat = nonEu ? (purchasePrice + transportCost + customs) * rules.import.importVatRate : 0;
    return {
      displacement: 0, environmental: 0, dieselSurcharge: 0, propulsionRate: 1,
      grossIsv: 0, reduction: 0, isv: 0, customs, importVat,
      total: purchasePrice + transportCost + otherCosts + customs + importVat
    };
  }
  const displacement = component(Number(vehicle.engineCc || 0), rules.isv.displacement);
  const fuel = /diesel|gasoleo/i.test(vehicle.fuelType || '') ? 'diesel' : 'petrol';
  const test = vehicle.co2Standard === 'NEDC' ? 'nedc' : 'wltp';
  const environmental = component(Number(co2 || 0), rules.isv.environmental[test][fuel]);
  const dieselSurcharge = fuel === 'diesel' ? rules.isv.dieselSurcharge : 0;
  const plugInHybrid = isPlugInHybridVehicle(vehicle) && Number(co2) < 50;
  const propulsionRate = plugInHybrid ? (rules.isv.plugInHybridRate || 0.25) : 1;
  const grossIsv = Math.max(rules.isv.minimum, (displacement + environmental + dieselSurcharge) * propulsionRate);
  const reduction = ageReduction(vehicle.firstRegistrationYear, currentYear, originCountry, rules.isv.ageReduction, vehicle.firstRegistrationDate, currentDate);
  const isv = Math.max(rules.isv.minimum, grossIsv * (1 - reduction));
  const nonEu = !EU_COUNTRIES.has(originCountry);
  const customs = nonEu ? (purchasePrice + transportCost) * rules.import.customsDutyRate : 0;
  const importVat = nonEu ? (purchasePrice + transportCost + customs + isv) * rules.import.importVatRate : 0;
  const total = purchasePrice + transportCost + otherCosts + customs + importVat + isv;
  return { displacement, environmental, dieselSurcharge, propulsionRate, grossIsv, reduction, isv, customs, importVat, total };
}

export function calculatePortugalRange({ vehicle, match, ...inputs }) {
  if (match?.isvExempt) {
    const low = calculatePortugalSingle({ vehicle, isvExempt: true, co2: 0, ...inputs });
    return {
      status: 'exempt', low, high: low, isvExempt: true,
      warning: 'This vehicle is exclusively electric and is exempt from Portuguese ISV.'
    };
  }
  if (!match?.co2Min || !match?.co2Max) return { status: 'unknown', warning: 'A reliable CO₂ value could not be found.' };
  const low = calculatePortugalSingle({ vehicle, co2: match.co2Min, ...inputs });
  const high = calculatePortugalSingle({ vehicle, co2: match.co2Max, ...inputs });
  return {
    status: match.co2Min === match.co2Max ? 'exact' : 'range',
    low, high,
    co2Min: match.co2Min,
    co2Max: match.co2Max,
    warning: match.co2Min === match.co2Max
      ? undefined
      : 'This model may have variants with different CO₂ emissions. The estimate uses the lowest and highest plausible catalogue matches.'
  };
}
