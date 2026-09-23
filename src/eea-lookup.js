const EEA_ENDPOINT = 'https://discodata.eea.europa.eu/sql';
const EEA_TIMEOUT_MS = 10000;

const sqlString = (value) => String(value || '').replace(/'/g, "''");
const finiteNumber = (value) => {
  if (value == null || value === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export async function lookupEeaCatalogue(vehicle, fetchImpl = fetch, timeoutMs = EEA_TIMEOUT_MS) {
  const make = String(vehicle.make || '').trim();
  const model = String(vehicle.model || '').trim();
  const engine = finiteNumber(vehicle.engineCc);
  const year = finiteNumber(vehicle.firstRegistrationYear);
  if (!make || (!model && engine == null && year == null)) return [];

  const filters = [`[Mk] LIKE '%${sqlString(make)}%'`];
  const modelToken = model.split(/\s+/).find((token) => token.replace(/[^\p{Letter}\p{Number}]/gu, '').length > 1);
  if (modelToken) filters.push(`[Cn] LIKE '${sqlString(modelToken)}%'`);
  if (engine != null) filters.push(`[Ec (cm3)] BETWEEN ${Math.max(0, Math.round(engine - 100))} AND ${Math.round(engine + 100)}`);
  if (year != null) filters.push(`[Year] BETWEEN ${Math.max(2010, Math.round(year - 3))} AND ${Math.round(year + 3)}`);
  filters.push('([Ewltp (g/km)] IS NOT NULL OR [Enedc (g/km)] IS NOT NULL)');

  const query = [
    'SELECT TOP 100',
    '[Mk] AS Make, COALESCE([Cn], [MMS]) AS CommercialName, [Ec (cm3)] AS EngineCc, [Ft] AS FuelType,',
    '[Ewltp (g/km)] AS Co2Wltp, [Enedc (g/km)] AS Co2Nedc, [Year] AS RegistrationYear,',
    '[TAN] AS TypeApprovalNumber, [T] AS Type, [Va] AS Variant, [Vf] AS Version',
    'FROM [CO2Emission].[latest].[co2cars]',
    `WHERE ${filters.join(' AND ')}`
  ].join(' ');
  const url = `${EEA_ENDPOINT}?query=${encodeURIComponent(query)}&p=1&nrOfHits=100`;
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller?.abort();
      reject(new Error(`EEA lookup timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
  let response;
  try {
    response = await Promise.race([
      fetchImpl(url, controller ? { signal: controller.signal } : undefined),
      timeoutPromise
    ]);
  } catch (error) {
    if (error?.message === `EEA lookup timed out after ${timeoutMs} ms`) throw error;
    if (controller?.signal.aborted) throw new Error(`EEA lookup timed out after ${timeoutMs} ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`EEA lookup returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.errors?.length) throw new Error(payload.errors[0].error || 'EEA lookup failed');
  const mapped = (payload?.results || []).map((row) => ({
    make: row.Make,
    commercialName: row.CommercialName,
    engineCc: finiteNumber(row.EngineCc),
    fuelType: row.FuelType,
    co2Wltp: finiteNumber(row.Co2Wltp),
    co2Nedc: finiteNumber(row.Co2Nedc),
    registrationYear: finiteNumber(row.RegistrationYear),
    typeApprovalNumber: row.TypeApprovalNumber,
    type: row.Type,
    variant: row.Variant,
    version: row.Version,
    source: 'EEA online catalogue'
  })).filter((row) => row.make && row.commercialName && (row.co2Wltp != null || row.co2Nedc != null));
  const seen = new Set();
  return mapped.filter((row) => {
    const key = [row.make, row.commercialName, row.engineCc, row.fuelType, row.co2Wltp, row.co2Nedc, row.registrationYear, row.type, row.variant].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
