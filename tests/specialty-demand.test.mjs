import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ window: {}, renderReportPayload() {} });
vm.runInContext(fs.readFileSync('specialty_demand_integration.js', 'utf8'), context);
const aggregate = (geoids, records) => context.aggregateMepsDemand(geoids, records, 25);
const record = (value, warnings = []) => ({ visits: Array(25).fill(value), warnings, quality: {} });

test('MEPS aggregation adds 25 specialties without counting duplicate GEOIDs', () => {
  const result = aggregate(['010010201001', '010010201002', '010010201001'], {
    '010010201001': record(12.4), '010010201002': record(5.2)
  });
  assert.equal(result.expected, 2);
  assert.equal(result.matched, 2);
  assert.equal(result.complete, true);
  assert.equal(result.totals.length, 25);
  assert.ok(result.totals.every(value => Math.abs(value - 17.6) < 1e-10));
});

test('missing, invalid and empty coverage is unavailable rather than a zero estimate', () => {
  assert.equal(aggregate(['missing'], {}).complete, false);
  assert.equal(aggregate([], {}).complete, false);
  assert.equal(aggregate(['bad'], { bad: record(NaN) }).complete, false);
  assert.equal(aggregate(['bad'], { bad: record(-1) }).matched, 0);
});

test('source sample warnings and reconstruction flags survive aggregation', () => {
  const source = record(1, ['True', 'False']);
  source.quality = { acs_suppression_flag: 'True', reconstruction_weight_basis: 'decennial', geography_context_flag: 'False' };
  const result = aggregate(['a'], { a: source });
  assert.equal(result.warnings[0], true);
  assert.equal(result.warnings[1], false);
  assert.equal(result.quality.length, 2);
});

test('imported national snapshot has 25 specialties and Tarrant coverage', () => {
  const manifest = JSON.parse(fs.readFileSync('reports/meps-v2.9.1/manifest.json', 'utf8'));
  const records = JSON.parse(fs.readFileSync('reports/meps-v2.9.1/48439.json', 'utf8'));
  assert.equal(manifest.specialties.length, 25);
  assert.equal(manifest.blockGroups, 239781);
  assert.equal(Object.keys(records).length, 1246);
  const result = aggregate(Object.keys(records), records);
  assert.equal(result.complete, true);
  assert.ok(result.totals.every(value => value > 0));
});

test('specialty summary precedes the full table and nearest urgent care page stays removed', () => {
  const template = fs.readFileSync('specialty_demand_report_template.html', 'utf8');
  const headings = [...template.matchAll(/<h[12][^>]*>(.*?)<\/h[12]>/g)].map(match => match[1]);
  assert.equal(headings[0], 'Physician Specialty Demand Assessment');
  assert.equal(headings[1], 'Executive Summary');
  assert.equal(headings[2], 'Curis Physician Specialty Demand');
  assert.equal(headings[3], 'Demographic Profile');
  assert.equal(headings.filter(heading => heading === 'Executive Summary').length, 1);
  assert.ok(!template.includes('<h2>Nearest Urgent Care Centers</h2>'));
  assert.ok(!template.includes('<h3>Competitive Landscape</h3>'));
  assert.ok(template.includes('<h2>Healthcare Market Context</h2>'));
  assert.ok(template.indexOf('id="report-data-coverage"') > template.indexOf('id="county-age-insight"'));
  assert.ok(!template.includes('id="curis-total-demand"'));
});

test('executive findings rank largest-radius values and leave sample warnings in table notes', () => {
  const small = { complete: true, totals: [10, 20, 30], warnings: [false, false, true], quality: [] };
  const large = { complete: true, totals: [500, 900, 200], warnings: [false, false, true], quality: [] };
  const summary = context.buildMepsExecutiveSummary(['A', 'B', 'C'], [1, 5], [small, large]);
  assert.equal(summary.top.name, 'B');
  assert.equal(summary.top.visits, 900);
  assert.ok(summary.findings[0].includes('B (900); A (500); C (200)'));
  assert.ok(summary.findings[1].includes('20 modeled annual visits'));
  assert.ok(!summary.findings.join(' ').includes('sample support warning'));
  assert.equal(context.buildMepsExecutiveSummary(['A', 'B', 'C'], [5], [{ ...large, complete: false }]), null);
});

test('county comparisons use population shares and percentage-point differences', () => {
  const rows = context.compareCountyAges({ population: 200, ages: [40, 50, 60, 20, 30] },
    { population: 1000, ages: [250, 250, 250, 100, 150] });
  assert.equal(rows[0].share, 20);
  assert.equal(rows[0].countyShare, 25);
  assert.equal(rows[0].difference, -5);
  assert.equal(rows[4].difference, 0);
  assert.equal(context.compareCountyAges({ population: 0, ages: [0,0,0,0,0] }, { population: 1, ages: [1,0,0,0,0] }), null);
  assert.equal(context.compareCountyAges({ population: 100, ages: [1,2,3,4,5] }, { population: 100, ages: [20,20,20,20,20] }), null);
});

test('imported Tarrant age groups reconcile to the published county population', () => {
  const data = JSON.parse(fs.readFileSync('reports/acs2024-age/48439.json', 'utf8'));
  const totals = [0,0,0,0,0];
  for (const record of Object.values(data.blockGroups)) record.ages.forEach((value, index) => totals[index] += value);
  assert.deepEqual(totals, data.county.ages);
  assert.equal(totals.reduce((sum, value) => sum + value, 0), 2167390);
  const template = fs.readFileSync('specialty_demand_report_template.html', 'utf8');
  assert.ok(template.includes('id="county-age-insight"'));
  assert.equal((template.match(/id="county-age-heading"/g) || []).length, 1);
  assert.ok(!template.includes('The age distribution provides a quick view of likely urgent care'));
});
