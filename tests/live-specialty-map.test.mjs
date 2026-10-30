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

test('offers an automatically scaled dot-density style', () => {
  assert.match(html, /id="live-specialty-mode" onchange="updateLiveSpecialtyLayer\(\)"/);
  assert.match(html, /value="dots">Dot density · auto-scaled/);
  assert.match(html, /function liveSpecialtyDotRatio\(totalVisits\)/);
  for (const rule of [
    'totalVisits <= 15000) return 1',
    'totalVisits <= 50000) return 5',
    'totalVisits <= 150000) return 10',
    'totalVisits <= 500000) return 50'
  ]) assert.ok(html.includes(rule));
  assert.match(html, /Math\.round\(feature\.properties\.annualVisits \/ dotRatio\)/);
  assert.match(html, /buildLiveSpecialtyDots\(mappedFeatures, specialty, requestId, status, dotRatio\)/);
  assert.match(html, /1 dot = \$\{dotRatio\.toLocaleString\(\)\}/);
});

test('draws deterministic dot-density points on a removable canvas overlay', () => {
  assert.match(html, /liveSpecialtySeed\(`\$\{specialty\}:\$\{feature\.properties\.GEOID\}`\)/);
  assert.match(html, /turf\.booleanPointInPolygon\(turf\.point\(candidate\), feature\)/);
  assert.match(html, /class LiveSpecialtyDotOverlay extends google\.maps\.OverlayView/);
  assert.match(html, /this\.getPanes\(\)\.overlayLayer\.appendChild\(this\.canvas\)/);
  assert.match(html, /liveSpecialtyDotOverlay\.setMap\(null\)/);
});
