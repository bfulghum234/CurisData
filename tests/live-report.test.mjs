import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await fs.readFile(new URL('../report_integration.js', import.meta.url), 'utf8');
const mapHtml = await fs.readFile(new URL('../demo_report_map.html', import.meta.url), 'utf8');
const snapshotStart = mapHtml.indexOf('function populateDemographicSnapshot(data)');
const snapshotSource = mapHtml.slice(snapshotStart, mapHtml.indexOf('</script>', snapshotStart));
function runtime(extra = {}) {
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, ...extra });
  vm.runInContext(source, context);
  return context;
}

test('map capture uses the rendered viewport and produces an embedded PNG', async () => {
  const element = { clientWidth: 800, clientHeight: 500, querySelectorAll: () => [{ decode: async () => {} }] };
  let captured;
  const context = runtime({ map: { getDiv: () => element }, requestAnimationFrame: callback => callback(),
    html2canvas: async (target, options) => {
      captured = { target, options };
      return { toDataURL: type => `data:${type};base64,captured` };
    } });
  assert.equal(await context.generateMapSnapshot(), 'data:image/png;base64,captured');
  assert.equal(captured.target, element);
  assert.equal(captured.options.width, 800);
  assert.equal(captured.options.height, 500);
  assert.equal(captured.options.useCORS, true);
  assert.equal(captured.options.allowTaint, false);
  element.clientWidth = 0;
  await assert.rejects(context.generateMapSnapshot(), /must be visible/);
});

test('thematic classes join normalized block groups and distinguish missing data from zero population', () => {
  const context = runtime();
  const features = [
    { properties: { GEOID: '484390001001' } }, { properties: { GEOID20: '484390001002' } },
    { properties: { GEOID: '484390001003' } }, { properties: { GEOID: '484390001004' } }
  ];
  const records = new Map([
    ['484390001001', { population: 0, medianIncome: 0 }],
    ['484390001002', { population: 250, medianIncome: 50000 }],
    ['484390001003', { population: 1000, medianIncome: 100000 }]
  ]);
  const population = context.buildThematicClasses(features, records, 'population', ['#aaa', '#bbb']);
  assert.equal(population.matched, 3);
  assert.equal(population.valueFor(features[0]), 0);
  assert.equal(population.colorFor(null), '#d9d9d9');
  assert.equal(population.legend.at(-1).label, 'No source data');
  const income = context.buildThematicClasses(features, records, 'medianIncome', ['#aaa', '#bbb']);
  assert.equal(income.matched, 2);
  assert.equal(income.valueFor(features[0]), null);
  assert.ok(income.legend[0].label.includes('$50,000'));
});

test('nearest care map numbers table order, fits the site and ten rows, and cleans up', async () => {
  const markers = [], points = [];
  let ready, removed = false, captured;
  const container = { style: {}, remove() { removed = true; } };
  class Overlay { setMap() {} }
  const context = runtime({ document: { createElement: () => container, body: { appendChild() {} } },
    map: { getMapTypeId: () => 'roadmap' }, google: { maps: {
      Map: class { fitBounds(bounds, padding) { assert.equal(padding, 60); ready(); } },
      Marker: class extends Overlay { constructor(options) { super(); markers.push(options); } },
      Circle: Overlay, Size: class {}, Point: class {}, SymbolPath: { CIRCLE: 'circle' },
      RenderingType: { RASTER: 'raster' },
      LatLngBounds: class { extend(position) { points.push(position); } },
      event: { addListenerOnce(target, event, callback) { ready = callback; }, removeListener() {}, clearInstanceListeners() {} }
    } } });
  context.capture = element => { captured = element; return 'data:image/png;base64,nearest'; };
  vm.runInContext('generateMapSnapshot = capture', context);
  const locations = Array.from({ length: 12 }, (_, index) => ({ name: `Care ${index}`, lat: 32 + index / 100, lng: -97 }));
  const result = await context.generateNearestUrgentCareSnapshot({ location: { latitude: 32, longitude: -97, address: 'Site' },
    tradeArea: { radiiMiles: [1, 3, 5] }, competition: { urgentCare: { locations } } });
  assert.equal(result, 'data:image/png;base64,nearest');
  markers.slice(1).forEach((marker, index) => assert.ok(decodeURIComponent(marker.icon.url).includes(`>${index + 1}</text>`)));
  assert.equal(points.length, 11);
  assert.equal(markers[1].title, '1. Care 0');
  assert.equal(markers[10].title, '10. Care 9');
  assert.equal(markers[0].icon.url, 'images/selected-address-star.svg');
  assert.equal(captured, container);
  assert.equal(removed, true);
});

test('report preserves a captured map instead of replacing it with an interactive map', () => {
  const elements = new Map();
  const doc = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { textContent: '', style: {}, removeAttribute() {}, classList: { toggle() {} } });
    return elements.get(id);
  } };
  const context = runtime();
  const payload = context.buildReportPayload({ address: '601 Bailey Ave', latitude: 32.75, longitude: -97.36,
    radiiMiles: [1, 3, 5], demographicsByRadius: {}, coverMapImageUrl: 'data:image/png;base64,captured' });
  let rebuilt = false;
  context.renderReportPayload(doc, { populateFacilityTable() {}, initReportMap() { rebuilt = true; } }, payload);
  assert.equal(rebuilt, false);
  assert.equal(doc.getElementById('report-map-image').src, payload.maps.coverImageUrl);
  assert.equal(doc.getElementById('report-map-image').style.display, 'block');
  assert.equal(doc.getElementById('report-map-embed').style.display, 'none');
  assert.equal(doc.getElementById('map-placeholder-text').style.display, 'none');
  const image = doc.getElementById('report-map-image');
  image.naturalWidth = 800;
  image.naturalHeight = 500;
  image.parentElement = { style: {} };
  image.onload();
  assert.equal(image.parentElement.style.width, 'min(100%, 608px)');
  assert.equal(image.parentElement.style.height, 'auto');
  assert.equal(image.style.height, 'auto');
  assert.equal(image.style.position, 'static');
});

test('missing geographic coverage fails rather than inventing demographics', async () => {
  const context = runtime();
  vm.runInContext('getBlockGroupsByRadius = () => ({ byRadius: { "1mile": [], "3mile": [], "5mile": [] }, allGeoids: [] })', context);
  await assert.rejects(context.fetchMultiRadiusDataFromCSV(32.75, -97.36, [1, 3, 5]), /No source block groups/);
});

test('facility search paginates, deduplicates, filters by radius, and sorts nearest first', async () => {
  const point = (lat, lng) => ({ lat: () => lat, lng: () => lng });
  const place = (id, lat) => ({ place_id: id, geometry: { location: point(lat, -97.36) } });
  const near = place('near', 32.751), far = place('far', 32.76), outside = place('outside', 33.0);
  class MapStub {}
  const context = runtime({
    window: { addEventListener() {}, map: new MapStub() },
    google: { maps: { Map: MapStub, places: { PlacesService: class {
      textSearch(request, callback) {
        callback([outside, far], 'OK', { hasNextPage: true, nextPage() { callback([near, far], 'OK', null); } });
      }
    } } } },
    setTimeout(callback, delay) { return delay === 3000 ? setTimeout(callback, 0) : setTimeout(callback, delay); }
  });
  const results = await context.fetchNearbyPlaces(32.75, -97.36, 1, 'urgent_care');
  assert.deepEqual(Array.from(results, place => place.place_id), ['near', 'far']);
});

test('an upstream facility error cannot become a zero competitor count', async () => {
  class MapStub {}
  const context = runtime({ window: { addEventListener() {}, map: new MapStub() },
    google: { maps: { Map: MapStub, places: { PlacesService: class {
      textSearch(request, callback) { callback(null, 'REQUEST_DENIED', null); }
    } } } } });
  await assert.rejects(context.fetchNearbyPlaces(32.75, -97.36, 5, 'urgent_care'), /REQUEST_DENIED/);
});

test('missing market counts remain unavailable while a true zero remains valid', async () => {
  const context = runtime({ fetch: async (url, request) => {
    const types = JSON.parse(request.body).includedPrimaryTypes;
    return { ok: true, json: async () => ({ success: true, count: types[0] === 'doctor' ? null : 0 }) };
  } });
  const result = await context.collectReportMarketContext(32.75, -97.36, 5, 1000);
  assert.equal(result.categories.find(category => category.key === 'physicians').available, false);
  assert.equal(result.categories.find(category => category.key === 'hospitals').count, 0);
});

test('five-year population forecast uses source CAGR rather than a fixed growth rate or historical change', () => {
  const context = runtime();
  const result = context.aggregateFromPerGeoid(['484390001001'], new Map([
    ['484390001001', { population: 1000, households: 400, families: 200, CAGR_pop: 0.02, change_pop: 500 }]
  ]));
  assert.equal(result.pop_proj, Math.round(1000 * 1.02 ** 5));
  assert.equal(result.change_pop, result.pop_proj - 1000);
  assert.ok(Number.isNaN(result.medianIncome));
  assert.ok(Number.isNaN(result.employment['Unemployment Rate'].local));
});

test('server report search filters outside locations and keeps genuine zero results', async () => {
  const context = runtime({ fetch: async () => ({ ok: true, json: async () => ({ success: true, locations: [
    { id: 'outside', name: 'Outside', lat: 34, lng: -97.36 },
    { id: 'near', name: 'Near', lat: 32.751, lng: -97.36 },
    { id: 'near', name: 'Near', lat: 32.751, lng: -97.36 }
  ] }) }) });
  const places = await context.fetchReportUrgentCare(32.75, -97.36, 5);
  assert.equal(places.length, 1);
  assert.equal(places[0].id, 'near');
});

test('managed live report never inserts a sample map before its data loads', async () => {
  const html = await fs.readFile(new URL('../demographic_report_template.html', import.meta.url), 'utf8');
  const start = html.indexOf('async function renderPreviewPlaceholderMaps()');
  const end = html.indexOf('setTimeout(renderPreviewPlaceholderMaps', start);
  const context = vm.createContext({
    getPreviewParams: () => new URLSearchParams('managed=1'),
    document: new Proxy({}, { get() { throw new Error('Live report attempted sample map injection'); } })
  });
  vm.runInContext(html.slice(start, end), context);
  await context.renderPreviewPlaceholderMaps();
});

test('missing CSV records are filled from real Census responses and marked as lacking history', async () => {
  const context = runtime({ window: { addEventListener() {}, runtimeConfig: {} }, URLSearchParams,
    fetch: async url => {
      const fields = new URL(url).searchParams.get('get').split(',');
      return { ok: true, json: async () => [
        [...fields, 'state', 'county', 'tract', 'block group'],
        [...fields.map(field => field === 'B01003_001E' ? '100' : '1'), '48', '439', '000100', '1']
      ] };
    }
  });
  vm.runInContext('demographicDataByGeoid = new Map()', context);
  await context.fillMissingCensusDemographics(['484390001001']);
  const records = context.getCSVDataForGeoids(['484390001001']);
  assert.equal(records.get('484390001001').population, 100);
  assert.equal(records.get('484390001001').currentCensusOnly, true);
  assert.equal(records.get('484390001001').age_0_17, 8);
});

test('report and mapping snapshot display the same forecasts despite incomplete historical coverage', () => {
  const createDocument = () => {
    const elements = new Map();
    return { getElementById(id) {
      if (!elements.has(id)) elements.set(id, { textContent: '', style: {}, removeAttribute() {}, classList: { toggle() {} } });
      return elements.get(id);
    } };
  };
  for (const radii of [[1, 3, 5], [2, 4, 8]]) {
    const reportDoc = createDocument(), mapDoc = createDocument();
    const context = runtime({ document: mapDoc });
    vm.runInContext(snapshotSource, context);
    const demographics = Object.fromEntries(radii.map((radius, index) => {
      const data = context.aggregateFromPerGeoid(['historical', 'current-only'], new Map([
        ['historical', { population: 1000 * radius, households: 400 * radius, families: 200 * radius,
          medianIncome: 65000 + radius * 1000, medianIncomePrior: 55000, CAGR_pop: index === 0 ? -0.01 : 0.02,
          CAGR_hh: 0.015, CAGR_fam: 0.01 }],
        ['current-only', { population: 100 * radius, households: 40 * radius, families: 20 * radius,
          medianIncome: 75000, currentCensusOnly: true }]
      ]));
      data.sourceCoverage = { matched: 2, total: 3, currentOnly: 1 };
      return [`${radius}mile`, data];
    }));
    const payload = context.buildReportPayload({ address: '601 Bailey Ave., Fort Worth, TX 76107',
      radiiMiles: radii, demographicsByRadius: demographics });
    context.renderReportPayload(reportDoc, { populateFacilityTable() {} }, payload);
    radii.forEach((radius, index) => {
      context.populateDemographicSnapshot(demographics[`${radius}mile`]);
      const suffix = ['1mi', '3mi', '5mi'][index];
      assert.equal(reportDoc.getElementById(`pop-proj-${suffix}`).textContent, mapDoc.getElementById('outlook-pop-fy').textContent);
      if (index === 2) {
        for (const [reportId, mapId] of [
          ['hh-proj-current', 'outlook-hh-cy'], ['hh-proj-future', 'outlook-hh-fy'],
          ['hh-proj-change', 'outlook-hh-growth'], ['med-inc-proj-current', 'outlook-income-cy'],
          ['med-inc-proj-future', 'outlook-income-fy'], ['med-inc-proj-change', 'outlook-income-growth']
        ]) assert.equal(reportDoc.getElementById(reportId).textContent, mapDoc.getElementById(mapId).textContent, reportId);
        assert.equal(parseFloat(reportDoc.getElementById('exec-growth').textContent), parseFloat(mapDoc.getElementById('outlook-pop-growth').textContent));
        assert.notEqual(reportDoc.getElementById('age-shift-0-17-proj').textContent, 'Unavailable');
      }
    });
  }
});
