import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../demo_report_map.html', import.meta.url), 'utf8');

test('offers a separate live specialty-demand explorer on the map', () => {
  assert.match(html, /id="live-specialty-select" onchange="updateLiveSpecialtyLayer\(\)"/);
  assert.match(html, /Explore Specialty Demand/);
  assert.match(html, /No thematic layer/);
  assert.match(html, /SPECIALTY_DEMAND_OPTIONS\.forEach/);
});

test('loads national boundaries and modeled specialty visits for the selected trade area', () => {
  assert.match(html, /loadNationalReportBoundaries\(selectedLocationContext\.lat, selectedLocationContext\.lng, maxRadius\)/);
  assert.match(html, /getBlockGroupsByRadius\([\s\S]*?\[maxRadius\]/);
  assert.match(html, /reports\/meps-v2\.9\.1\/manifest\.json/);
  assert.match(html, /reports\/meps-v2\.9\.1\/\$\{countyFips\}\.json/);
  assert.match(html, /annualVisits: visits/);
});

test('renders six demand classes with a legend and click details', () => {
  assert.match(html, /const LIVE_SPECIALTY_COLORS = Object\.freeze\(\[/);
  assert.match(html, /map\.data\.addGeoJson/);
  assert.match(html, /renderLiveSpecialtyLegend\(specialty, thresholds, values\)/);
  assert.match(html, /modeled annual visits/);
  assert.match(html, /map\.data\.addListener\('click'/);
});

test('refreshes the thematic layer when location or trade-area radii change', () => {
  const refreshCalls = html.match(/queueLiveSpecialtyLayerRefresh\(\)/g) || [];
  assert.ok(refreshCalls.length >= 3);
  assert.match(html, /setTimeout\(\(\) => updateLiveSpecialtyLayer\(\{ fitMap: false \}\), 300\)/);
});
