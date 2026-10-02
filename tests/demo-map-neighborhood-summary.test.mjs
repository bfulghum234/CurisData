import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../demo_report_map.html", import.meta.url), "utf8");

test("replaces the Trends tab with the AI neighborhood summary", () => {
  assert.match(html, />AI Neighborhood Summary<\/button>/);
  assert.match(html, /id="neighborhood-summary-tab"/);
  assert.doesNotMatch(html, /id="trends-tab"/);
  assert.doesNotMatch(html, />Trends<\/button>/);
});

test("loads summaries through the server endpoint using a Place ID", () => {
  assert.match(html, /fetch\('\/api\/neighborhood-summary'/);
  assert.match(html, /JSON\.stringify\(\{ placeId \}\)/);
  assert.match(html, /placeId: 'ChIJMyK3f-hzToYRlstOM8gDzd4'/);
});

test("includes Google's disclosure and content reporting controls", () => {
  assert.match(html, /id="neighborhood-summary-disclosure"/);
  assert.match(html, /id="neighborhood-summary-report"/);
  assert.match(html, />Google Maps<\/span>/);
});

test("temporarily hides the Layers and AI Assistant controls", () => {
  assert.match(html, /<details hidden[^>]*>\s*<summary>Layers<\/summary>/);
  assert.match(html, /<details hidden[^>]*>\s*<summary>AI Assistant<\/summary>/);
});

test("guides report creation through four numbered steps", () => {
  for (const step of ["location-step", "specialty-step", "trade-area-step", "report-step"]) {
    assert.match(html, new RegExp(`id="${step}"`));
  }
  assert.match(html, /Set Location &amp; Continue/);
  assert.match(html, /Use This Trade Area &amp; Continue/);
  assert.match(html, /id="run-report-button"[^>]*disabled>Run Report<\/button>/);
  assert.match(html, /function handleSpecialtySelection\(specialty\)/);
  assert.match(html, /function confirmTradeArea\(\)/);
});

test("allows only one report specialty at a time", () => {
  const specialtyInputs = [...html.matchAll(/class="specialty-checkbox"[^>]+/g)].map(match => match[0]);
  assert.equal(specialtyInputs.length, 4);
  for (const input of specialtyInputs) {
    assert.match(input, /type="radio"/);
    assert.match(input, /name="reportSpecialty"/);
  }
  assert.match(html, /clearUrgentCares\(\);[\s\S]*clearHospitals\(\);[\s\S]*clearDermatologists\(\);[\s\S]*clearAutism\(\);/);
});

test("uses one shared outline healthcare marker for every specialty", () => {
  const sharedMarkers = html.match(/url: 'images\/healthcare-marker\.svg'/g) || [];
  assert.equal(sharedMarkers.length, 4);
  assert.doesNotMatch(html, /url: 'images\/(urgentcare|hosp|dermatology|autism)\.png'/);
  assert.match(html, /scaledSize: new google\.maps\.Size\(42, 48\)/);
  assert.match(html, /anchor: new google\.maps\.Point\(21, 48\)/);
});

test("uses a prominent branded star for the selected report address", () => {
  assert.match(html, /url: 'images\/selected-address-star\.svg'/);
  assert.match(html, /scaledSize: new google\.maps\.Size\(72, 72\)/);
  assert.match(html, /anchor: new google\.maps\.Point\(36, 36\)/);
  assert.doesNotMatch(html, /maps\.google\.com\/mapfiles\/ms\/icons\/red-dot\.png/);
});

test("switches specialties without cleanup errors or misleading status text", () => {
  assert.match(html, /function clearAutism\(\) \{\s*autismMarkers\.forEach/);
  assert.doesNotMatch(html, /autismMarkers\.push\.forEach/);
  assert.doesNotMatch(html, /setStatus\(["'](?:Hospitals|Dermatologists|autism) cleared/);
  assert.match(html, /function handleSpecialtySelection\(specialty\) \{\s*selectedSpecialtyType = specialty;/);
  assert.match(html, /Unable to load urgent care locations/);
});

test("shows runtime endpoint attempts only for configuration failures", () => {
  assert.match(html, /setStatus\(`Error: \$\{error\.message\}`,[ ]*true\)/);
  assert.match(html, /function setStatus\(msg, includeDebug = false\)/);
  assert.match(html, /includeDebug && runtimeConfigDebug\.length/);
});

test("keeps diagnostic status hidden from the production interface", () => {
  assert.match(html, /#status \{\s*display: none;/);
  assert.match(html, /<div id="status" hidden aria-live="polite"><\/div>/);
});

test("places Run Report in the workflow instead of the snapshot header", () => {
  const panelHeader = html.match(/<div class="panel-header">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || "";
  assert.doesNotMatch(panelHeader, /Run Report/);
  assert.match(html, /id="report-step"[\s\S]*?class="btn-run-report"/);
});
