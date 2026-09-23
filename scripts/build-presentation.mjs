import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "E:/Personal_Stuff/Projetos/vehicle-import-extension";
const SKILL_DIR = "C:/Users/migue/.codex/plugins/cache/openai-primary-runtime/presentations/26.915.20218/skills/presentations";
const RUNTIME_PYTHON = "C:/Users/migue/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const TMP_DIR = path.join(workspaceDir, "tmp", "presentation-build");
const FINAL_PPTX = path.join(workspaceDir, "output", "presentation", "vehicle-import-estimator-demo-0.2.11.pptx");
const screenshotPath = "C:/Users/migue/AppData/Local/Temp/codex-clipboard-3082cfa1-2158-4a19-b7ab-692e8949955e.png";

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href,
);
const family = resolvePresentationFont();
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const colors = { bg: "#202020", ink: "#F7F7F2", muted: "#A8A8A4", yellow: "#E6F000", charcoal: "#202020" };
const referenceNotes = "Sources: Project README.md and source code, Vehicle Import Estimator v0.2.11. Workshop requirements: AI Tools - Kickoff Session.pdf, page 15.";

function textbox(slide, text, left, top, width, height, { size = 24, color = colors.ink, bold = false, align = "left" } = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left, top, width, height },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = text;
  box.text.style = { typeface: family, fontSize: size, color, bold, align, autoFit: "shrinkText" };
  return box;
}

function base(slide, number, title) {
  slide.background.fill = colors.bg;
  textbox(slide, String(number).padStart(2, "0"), 72, 54, 64, 30, { size: 15, color: colors.yellow, bold: true });
  textbox(slide, title, 72, 98, 1090, 68, { size: 42, bold: true });
  textbox(slide, "Vehicle Import Estimator  |  Portugal", 72, 676, 650, 20, { size: 13, color: colors.muted });
}

function notes(slide, extra = "") {
  slide.speakerNotes.textFrame.setText(`${referenceNotes}${extra ? `\n${extra}` : ""}`);
}

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = colors.bg;
  textbox(slide, "AI WORKSHOP PROJECT", 78, 72, 500, 24, { size: 16, color: colors.yellow, bold: true });
  textbox(slide, "Vehicle Import\nEstimator", 78, 150, 790, 190, { size: 66, bold: true });
  textbox(slide, "A Chrome extension that estimates Portuguese vehicle-import costs from a marketplace listing.", 82, 385, 850, 74, { size: 27, color: colors.muted });
  textbox(slide, "5-minute product demo  |  Extension v0.2.11", 82, 590, 720, 28, { size: 18, color: colors.yellow, bold: true });
  textbox(slide, "multimccp00/vehicle-import-extension", 82, 642, 700, 24, { size: 16, color: colors.ink });
  notes(slide, "Cover slide. State the problem in one sentence, then open the extension.");
}

// 2. Problem
{
  const slide = presentation.slides.add();
  base(slide, 2, "The import-cost decision starts with an incomplete listing");
  textbox(slide, "A marketplace advert rarely exposes every value needed for an import estimate.", 72, 215, 1030, 54, { size: 28, color: colors.muted });
  textbox(slide, "Price and first registration date usually appear", 90, 340, 1040, 42, { size: 25, bold: true });
  textbox(slide, "CO₂ is often missing, while engine data and fuel labels vary by marketplace", 90, 414, 1070, 42, { size: 25, bold: true });
  textbox(slide, "The buyer still needs a clear cost range before deciding to import", 90, 488, 1070, 42, { size: 25, bold: true });
  notes(slide, "Explain that the tool estimates only when it can do so safely. It avoids asking the buyer to guess a variant.");
}

// 3. Product flow and evidence screenshot
{
  const slide = presentation.slides.add();
  base(slide, 3, "A listing becomes an estimate in the browser");
  const imageBytes = await fs.readFile(screenshotPath).catch(() => null);
  if (imageBytes) {
    slide.images.add({ blob: imageBytes, contentType: "image/png", alt: "Vehicle Import Estimator shown beside an AutoScout24 listing", fit: "contain", position: { left: 705, top: 190, width: 500, height: 392 } });
  }
  textbox(slide, "1  Parse the active listing", 82, 235, 530, 42, { size: 26, bold: true });
  textbox(slide, "2  Use listed CO₂ when available", 82, 315, 530, 42, { size: 26, bold: true });
  textbox(slide, "3  Search the EEA catalogue when CO₂ is missing", 82, 395, 570, 66, { size: 26, bold: true });
  textbox(slide, "4  Show a CO₂ range and Portugal import estimate", 82, 500, 570, 66, { size: 26, bold: true });
  notes(slide, "The screenshot comes from the user-provided AutoScout24 example. The implementation runs as a Manifest V3 Chrome extension with a service worker for EEA requests.");
}

// 4. Matching
{
  const slide = presentation.slides.add();
  base(slide, 4, "Generic CO₂ matching without manufacturer rules");
  textbox(slide, "The matcher normalizes accents, punctuation, spacing, and case for every make and model.", 72, 216, 1080, 54, { size: 28, color: colors.muted });
  textbox(slide, "No make-alias table", 88, 354, 345, 40, { size: 27, bold: true, color: colors.yellow });
  textbox(slide, "No manufacturer branches", 468, 354, 395, 40, { size: 27, bold: true, color: colors.yellow });
  textbox(slide, "No variant selector", 902, 354, 290, 40, { size: 27, bold: true, color: colors.yellow });
  textbox(slide, "When compatible EEA records differ, the extension keeps the full range instead of inventing a single CO₂ figure.", 90, 470, 1060, 74, { size: 29, bold: true });
  notes(slide, "Point to src/matcher.js and src/eea-lookup.js if the audience asks for implementation detail. The range protects users from false precision.");
}

// 5. Portugal rules and verification
{
  const slide = presentation.slides.add();
  base(slide, 5, "Portugal ISV logic includes electric vehicles");
  textbox(slide, "Electric vehicles have no engine displacement. The calculator treats an exclusively electric vehicle as ISV-exempt while retaining the remaining landed-cost inputs.", 72, 218, 1090, 88, { size: 29, color: colors.muted });
  textbox(slide, "18 automated tests", 86, 385, 370, 54, { size: 36, bold: true, color: colors.yellow });
  textbox(slide, "cover catalogue ranges, registration-date reductions, cycle rules, plug-in hybrids, electric vehicles, EEA request timeouts, and live-page parsing.", 86, 461, 1060, 82, { size: 27, bold: true });
  notes(slide, "Verification evidence: npm test, 18 passing tests on 23 September 2026. Portugal ISV rules are represented in data/portugal-rules.json and calculator tests cover the electric-vehicle exemption.");
}

// 6. Demo agenda
{
  const slide = presentation.slides.add();
  base(slide, 6, "Five-minute demo");
  textbox(slide, "1. Load the unpacked extension in Chrome", 90, 224, 980, 38, { size: 27, bold: true });
  textbox(slide, "2. Open a supported vehicle listing", 90, 294, 980, 38, { size: 27, bold: true });
  textbox(slide, "3. Show parsed price, fuel, engine, and registration date", 90, 364, 1040, 38, { size: 27, bold: true });
  textbox(slide, "4. Show the automatic CO₂ range or a safe no-match result", 90, 434, 1060, 38, { size: 27, bold: true });
  textbox(slide, "5. Change transport cost or import origin and review the estimate", 90, 504, 1090, 38, { size: 27, bold: true });
  textbox(slide, "Repository: github.com/multimccp00/vehicle-import-extension", 90, 590, 1050, 28, { size: 20, color: colors.yellow, bold: true });
  notes(slide, "Close with the repository URL and README. The README contains clean-install steps, test command, limitations, demo plan, and AI prompt reflection.");
}

await fs.mkdir(TMP_DIR, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const candidatePath = path.join(TMP_DIR, "vehicle-import-estimator-demo-candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = { explicitTotalSlideCount: 6, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [] };
const fontPolicy = { basis: "design", families: [family] };
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "vehicle-import-estimator-demo-0.2.11.validation.json"),
});
console.log(JSON.stringify({ finalPath: FINAL_PPTX, font: family, validation: result }, null, 2));
