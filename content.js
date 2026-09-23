(() => {
  const numberFrom = (value) => {
    if (!value) return undefined;
    const normalized = String(value).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  };

  const displacementFrom = (value) => {
    if (value == null || value === '') return undefined;
    const raw = String(value).trim().replace(/\s/g, '');
    const grouped = raw.match(/^\d{1,2}[.,]\d{3}$/);
    return grouped ? Number(raw.replace(/[.,]/g, '')) : numberFrom(raw);
  };

  const text = [document.title || '', document.body?.innerText || ''].join('\n');
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .flatMap((node) => {
      try {
        const parsed = JSON.parse(node.textContent);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch { return []; }
    });

  const structured = jsonLd.find((item) => {
    const types = Array.isArray(item?.['@type']) ? item['@type'] : [item?.['@type']];
    return types.some((type) => ['Product', 'Vehicle', 'Car'].includes(type));
  }) || {};
  const brand = typeof structured.brand === 'object' ? structured.brand.name : structured.brand;
  const listingNameFromTitle = (value) => String(value || '')
    .replace(/\s*\|\s*[^|]+$/, '')
    .replace(/\s+-\s*AutoScout24.*$/i, '')
    .replace(/\s+\S+\s*(?:€|EUR)\s*[\d.,\s]+$/i, '')
    .replace(/\s+in\s+.+?\s+für\s+.*$/i, '')
    .trim();
  const titleName = listingNameFromTitle(document.title);
  const productName = titleName || structured.name || document.querySelector('h1')?.textContent?.trim();

  const find = (patterns) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1]?.trim();
    }
    return undefined;
  };

  const co2Value = structured.emissions?.co2Emission || find([
    /(?:CO2|CO₂|carbon dioxide)[\s\S]{0,80}?(\d{2,3})\s*g\s*\/?\s*km/i,
    /(\d{2,3})\s*g\s*CO2\s*\/?\s*km/i
  ]);
  const engineValue = structured.vehicleEngine?.engineDisplacement || find([
    /(?:engine displacement|cubic capacity|displacement|Hubraum)[^\d]{0,20}(\d[\d\s.,]*)\s*(?:cc|cm3|cm³)/i,
    /(\d[\d\s.,]*)\s*(?:cc|cm3|cm³)/i
  ]);
  const registrationValue = structured.releaseDate || find([
    /(?:first registration|registration|Erstzulassung|EZ|FR)[^\d]{0,80}?((?:\d{1,2}[./-])?\d{1,2}[./-]\d{4}|\d{4})/i
  ]);
  const priceValue = structured.offers?.price || text.match(/(\d[\d.\s]*(?:,\d{2})?)\s*(?:€|EUR)/i)?.[1] || find([
    /(?:€|EUR)\s*([\d.\s]+(?:,\d{2})?)/i,
    /([\d.\s]+(?:,\d{2})?)\s*(?:€|EUR)/i
  ]);
  const fuelValue = structured.vehicleEngine?.fuelType || find([
    /(?:fuel type|fuel|Kraftstoff)[^\n:]{0,20}[:\s-]+([^\n]+)/i
  ]);

  const parseYear = (value) => {
    const match = String(value || '').match(/(19|20)\d{2}/);
    return match ? Number(match[0]) : undefined;
  };

  function extractVehicle() {
    const name = String(productName || '').replace(/\s+/g, ' ').trim();
    const words = name.split(' ');
    const detectedMake = brand || words[0];
    const modelFromName = (value) => {
      const source = String(value || '').replace(/\s+/g, ' ').trim();
      if (!source) return '';
      if (detectedMake && source.toLowerCase().startsWith(String(detectedMake).toLowerCase())) {
        return source.slice(String(detectedMake).length).trim();
      }
      return detectedMake ? '' : source.split(' ').slice(1).join(' ') || source;
    };
    const detectedModel = modelFromName(titleName)
      || modelFromName(structured.name)
      || words.slice(1).join(' ') || name;
    const isPlugInHybrid = /plug[\s-]?in|phev|\biv\b|\bgte\b|tfs[ií]?\s*-?e|e-?hybrid/i.test(`${name} ${fuelValue || ''}`);
    return {
      make: detectedMake,
      model: detectedModel,
      price: numberFrom(priceValue),
      currency: priceValue?.includes('€') || priceValue?.includes('EUR') || /(?:€|EUR)/i.test(text) ? 'EUR' : undefined,
      fuelType: fuelValue,
      isPlugInHybrid,
      engineCc: displacementFrom(engineValue),
      co2GPerKm: numberFrom(co2Value),
      co2Standard: text.match(/WLTP/i) ? 'WLTP' : text.match(/NEDC/i) ? 'NEDC' : undefined,
      firstRegistrationDate: registrationValue,
      firstRegistrationYear: parseYear(registrationValue),
      sourceUrl: location.href,
      sourceSite: location.hostname,
      extractedAt: new Date().toISOString()
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_VEHICLE') sendResponse(extractVehicle());
  });
})();
