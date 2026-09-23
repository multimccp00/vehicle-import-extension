function numberFrom(value) {
  if (value == null || value === '') return undefined;
  const normalized = String(value).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function displacementFrom(value) {
  if (value == null || value === '') return undefined;
  const raw = String(value).trim().replace(/\s/g, '');
  const grouped = raw.match(/^\d{1,2}[.,]\d{3}$/);
  return grouped ? Number(raw.replace(/[.,]/g, '')) : numberFrom(raw);
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1]?.trim();
  }
  return undefined;
}

function parseYear(value) {
  const match = String(value || '').match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
}

function listingNameFromTitle(value) {
  return String(value || '')
    .replace(/\s*\|\s*[^|]+$/, '')
    .replace(/\s+-\s*AutoScout24.*$/i, '')
    .replace(/\s+\S+\s*(?:€|EUR)\s*[\d.,\s]+$/i, '')
    .replace(/\s+in\s+.+?\s+für\s+.*$/i, '')
    .trim();
}

function modelFromName(value, make) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name) return '';
  if (make && name.toLowerCase().startsWith(String(make).toLowerCase())) {
    return name.slice(String(make).length).trim();
  }
  return make ? '' : name.split(' ').slice(1).join(' ') || name;
}

export function parsePageSnapshot(snapshot) {
  const title = snapshot.title || '';
  const text = [title, snapshot.text || ''].join('\n');
  const jsonLd = (snapshot.jsonLd || []).flatMap((raw) => {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch { return []; }
  });
  const structured = jsonLd.find((item) => {
    const types = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
    return types.some((type) => ['Product', 'Vehicle', 'Car'].includes(type));
  }) || {};
  const brand = typeof structured.brand === 'object' ? structured.brand.name : structured.brand;
  const titleName = listingNameFromTitle(title);
  const structuredName = String(structured.name || '').replace(/\s+/g, ' ').trim();
  const name = titleName || structuredName;
  const words = name.split(' ');
  const detectedMake = brand || words[0];
  const detectedModel = modelFromName(titleName, detectedMake)
    || modelFromName(structuredName, detectedMake)
    || words.slice(1).join(' ') || name;
  const co2Value = structured.emissions?.co2Emission || firstMatch(text, [
    /(?:CO2|CO₂|carbon dioxide)[\s\S]{0,80}?(\d{2,3})\s*g\s*\/?\s*km/i,
    /(\d{2,3})\s*g\s*CO2\s*\/?\s*km/i
  ]);
  const engineValue = structured.vehicleEngine?.engineDisplacement || firstMatch(text, [
    /(?:engine displacement|cubic capacity|displacement|Hubraum)[^\d]{0,20}(\d[\d\s.,]*)\s*(?:cc|cm3|cm³)/i,
    /(\d[\d\s.,]*)\s*(?:cc|cm3|cm³)/i
  ]);
  const registrationValue = structured.releaseDate || firstMatch(text, [
    /(?:first registration|registration|Erstzulassung|EZ|FR)[^\d]{0,80}?((?:\d{1,2}[./-])?\d{1,2}[./-]\d{4}|\d{4})/i
  ]);
  const priceValue = structured.offers?.price || text.match(/(\d[\d.\s]*(?:,\d{2})?)\s*(?:€|EUR)/i)?.[1] || firstMatch(text, [
    /(?:€|EUR)\s*([\d.\s]+(?:,\d{2})?)/i,
    /([\d.\s]+(?:,\d{2})?)\s*(?:€|EUR)/i
  ]);
  const fuelValue = structured.vehicleEngine?.fuelType || firstMatch(text, [
    /(?:fuel type|fuel|Kraftstoff)[^\n:]{0,20}[:\s-]+([^\n]+)/i
  ]);
  const isPlugInHybrid = /plug[\s-]?in|phev|\biv\b|\bgte\b|tfs[ií]?\s*-?e|e-?hybrid/i.test(`${name} ${fuelValue || ''}`);
  return {
    make: detectedMake,
    model: detectedModel,
    price: numberFrom(priceValue),
    currency: /(?:€|EUR)/i.test(text) ? 'EUR' : undefined,
    fuelType: fuelValue,
    isPlugInHybrid,
    engineCc: displacementFrom(engineValue),
    co2GPerKm: numberFrom(co2Value),
    co2Standard: text.match(/WLTP/i) ? 'WLTP' : text.match(/NEDC/i) ? 'NEDC' : undefined,
    firstRegistrationDate: registrationValue,
    firstRegistrationYear: parseYear(registrationValue),
    sourceUrl: snapshot.url,
    sourceSite: snapshot.hostname,
    extractedAt: new Date().toISOString()
  };
}
