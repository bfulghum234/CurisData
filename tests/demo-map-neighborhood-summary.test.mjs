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
