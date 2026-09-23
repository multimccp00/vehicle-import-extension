import fs from 'node:fs';

const input = process.argv[2];
const output = process.argv[3] || 'data/catalogue.json';
if (!input) {
  console.error('Usage: node scripts/build-catalogue.mjs <eea-csv> [output-json]');
  process.exit(1);
}

function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]; const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map((header) => header.trim());
  return rows.filter((line) => line.length === headers.length).map((line) => Object.fromEntries(headers.map((header, i) => [header, line[i].trim()])));
}

const aliases = {
  make: ['Make', 'make', 'Mk'], commercialName: ['Commercial name', 'CommercialName', 'MMS', 'Cn'],
  typeApprovalNumber: ['Type approval number', 'TAN', 'T'], type: ['Type', 'Va'], variant: ['Variant', 'Ve'], version: ['Version', 'Vf'],
  engineCc: ['Engine capacity (cm³)', 'Engine capacity', 'Ec', 'Ec (cm3)'], powerKw: ['Engine power (kW)', 'Engine power', 'Ep'],
  fuelType: ['Fuel type', 'Ft'], co2Wltp: ['Specific WLTP CO2 Emissions (g/km)', 'Specific CO2 Emissions (g/km)', 'Ewltp', 'Ewltp (g/km)'],
  co2Nedc: ['Specific NEDC CO2 Emissions (g/km)', 'Enedc', 'Enedc (g/km)'], registrationYear: ['Registration year', 'Year']
};
const valueFor = (row, names) => names.map((name) => row[name]).find((value) => value !== undefined && value !== '');
const numeric = (value) => value == null || value === '' ? undefined : Number(String(value).replace(',', '.'));
const records = parseCsv(fs.readFileSync(input, 'utf8')).map((row) => ({
  make: valueFor(row, aliases.make), commercialName: valueFor(row, aliases.commercialName),
  typeApprovalNumber: valueFor(row, aliases.typeApprovalNumber), type: valueFor(row, aliases.type),
  variant: valueFor(row, aliases.variant), version: valueFor(row, aliases.version),
  engineCc: numeric(valueFor(row, aliases.engineCc)), powerKw: numeric(valueFor(row, aliases.powerKw)),
  fuelType: valueFor(row, aliases.fuelType), co2Wltp: numeric(valueFor(row, aliases.co2Wltp)),
  co2Nedc: numeric(valueFor(row, aliases.co2Nedc)), registrationYear: numeric(valueFor(row, aliases.registrationYear)), source: 'EEA'
})).filter((record) => record.make && record.commercialName && (record.co2Wltp != null || record.co2Nedc != null));
fs.mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ version: new Date().toISOString().slice(0, 10), source: 'EEA passenger-car monitoring dataset', records }, null, 2));
console.log(`Wrote ${records.length} records to ${output}`);
