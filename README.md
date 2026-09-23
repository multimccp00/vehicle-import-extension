# Vehicle Import Cost Estimator

A Manifest V3 Chrome extension that estimates the landed cost of importing a used vehicle into Portugal. It reads a supported listing, looks up missing CO₂ data in the EEA vehicle catalogue, and estimates ISV, customs duty, import VAT, transport, and the total cost.

Current extension version: `0.2.11`

## What it does

- Reads vehicle details from AutoScout24 and mobile.de listings.
- Extracts make, model, price, engine displacement, fuel type, first-registration date, and listed CO₂ data where available.
- Uses generic matching that normalizes accents, punctuation, spacing, and case without manufacturer-specific aliases.
- Queries the official EEA Discodata catalogue when a listing omits CO₂. The request runs in the extension service worker, so no server, API key, or account is required.
- Shows a CO₂ range when several compatible EEA variants exist. The user never has to select a variant.
- Applies Portugal ISV rules, including NEDC/WLTP handling, diesel surcharge, qualifying plug-in hybrid treatment, and used-vehicle reductions.
- Treats exclusively electric vehicles as ISV-exempt and does not require engine displacement for that path.
- Estimates customs duty and import VAT for non-EU origin countries.

## Requirements

- Google Chrome or another Chromium browser with Manifest V3 support.
- Node.js 18 or later only when running tests or rebuilding the optional local catalogue.
- Internet access only when the extension needs the online EEA catalogue for a listing without CO₂ data.

## Install on a clean machine

1. Copy or clone this repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder that contains `manifest.json`.
6. Open a supported listing and click the extension icon.

The popup should show `Extension build 0.2.11`. No command, background server, API key, or account is needed after installation.

For a ready-to-load build, use the latest versioned folder under `output/` when one is included with the project.

## Supported sites

- `autoscout24.com`, `autoscout24.de`, and `autoscout24.pt`
- `mobile.de` and `suchen.mobile.de`

## Development and test

Run the complete test suite from the project root:

```text
npm test
```

The suite covers calculator rules, page parsing, generic matching, EEA query construction and timeouts, electric-vehicle treatment, and NEDC-only EEA results.

## Optional local EEA catalogue build

The bundled `data/catalogue.json` deliberately contains no demo vehicle records and must not be treated as complete vehicle coverage. The online EEA lookup supplies data when CO₂ is missing.

To build a local catalogue from an EEA passenger-car CSV:

```text
node scripts/build-catalogue.mjs path/to/eea-passenger-cars.csv data/catalogue.json
```

The EEA data includes commercial name, type, variant, CO₂, fuel, engine capacity, power, and registration year. Check the EEA dataset licence and attribution requirements before redistributing a generated catalogue.

## Demo plan

A five-minute demo can follow this sequence:

1. Open a supported listing with the extension loaded and show the extracted vehicle facts.
2. Show a listing with a CO₂ value and explain that the extension uses it directly.
3. Show a listing without CO₂ and explain the EEA lookup and automatic range result.
4. Change the origin country or transport cost and show the estimate update.
5. Show an exclusively electric listing and the ISV-exempt result.
6. Close with the limitation below: this is an estimate, not a tax declaration.

## AI prompt reflection

The project used AI as a pair-programming assistant for scoped changes, tests, and documentation. Outputs were reviewed and verified with the automated test suite.

### Prompts that worked well

1. **"Work only inside this workspace. Remove manufacturer-specific aliases and make vehicle matching generic and data-driven. Keep EEA lookup and Portugal ISV calculations."**
   - Clear constraints prevented unrelated changes and made the matching work testable.
2. **"Trace the no-engine path for electric vehicles, check the current Portuguese ISV treatment, add a regression test, and rebuild the extension."**
   - It connected a concrete symptom to a legal rule and required verification rather than guessing.
3. **"Run the exact AutoScout parsing shape through the EEA lookup and matcher, then report the extracted model, number of records, and CO₂ range."**
   - A realistic input exposed the malformed structured-data model and validated the final path end to end.

### Prompts that did not work well

1. **"Can you check this?"**
   - The request did not say whether to diagnose, change code, or validate a particular result, so the investigation initially had too much scope.
2. **"Still not working."**
   - The symptom alone did not reveal whether parsing, EEA access, or matching had failed. A screenshot and the extension version made the issue actionable.
3. **"Make it work with the EEA catalogue."**
   - This was too broad. The useful follow-up named the specific listing, extracted values, expected result, and acceptable timeout.

## Limitations and privacy

- This project provides an estimate. Verify final ISV with the Portuguese authorities and the vehicle's Certificate of Conformity or homologation record.
- EEA results can contain several variants; the extension intentionally reports a range instead of guessing a single variant.
- An unavailable EEA service prevents a CO₂-based estimate for listings that omit CO₂.
- The extension reads the active supported listing and sends matching details to the EEA catalogue only when it needs to find missing CO₂. It does not use a separate backend or API key.
