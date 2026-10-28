import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('specialty_census_report.js','utf8'),context);

test('additive Census measures reject suppressed, missing and incomplete records',()=>{
  assert.equal(context.sumAcs({a:{x:0},b:{x:2}},['a','b'],['x']),2);
  assert.ok(Number.isNaN(context.sumAcs({a:{x:2},b:{x:null}},['a','b'],['x'])));
  assert.ok(Number.isNaN(context.sumAcs({a:{x:-666666666}},['a'],['x'])));
  assert.ok(Number.isNaN(context.sumAcs({a:{x:2}},['a','missing'],['x'])));
});
test('local medians are calculated from counts rather than averages of medians',()=>{
  assert.equal(context.groupedMedian([20,60,20],[0,10,20,30]),15);
  assert.ok(Number.isNaN(context.groupedMedian([1,9],[0,10,Infinity])));
  assert.ok(Number.isNaN(context.groupedMedian([0,0],[0,10,20])));
});
test('projection uses the matched five-year change and rejects missing history',()=>{
  const result=context.projectAcs(110,100);
  assert.ok(Math.abs(result.future-121)<1e-8);
  assert.ok(Math.abs(result.cagr-(1.1**0.2-1))<1e-8);
  assert.ok(Number.isNaN(context.projectAcs(110,NaN).future));
  assert.ok(Number.isNaN(context.projectAcs(110,0).future));
});
test('basemap and overlays share an exact Web Mercator viewport',()=>{
  const viewport=context.basemapViewport([-97.5,32.6,-97.2,32.9]);
  const center=viewport.point([viewport.longitude,viewport.latitude]);
  assert.ok(Math.abs(center[0]-320)<1e-8);
  assert.ok(Math.abs(center[1]-270)<1e-8);
  assert.ok(Number.isInteger(viewport.zoom));
  const southwest=viewport.point([-97.5,32.6]),northeast=viewport.point([-97.2,32.9]);
  assert.ok(southwest[0]>=12&&northeast[0]<=628);
  assert.ok(northeast[1]>=12&&southwest[1]<=528);
});
test('connected specialty pages contain no frozen or sample fallback paths',()=>{
  for(const file of ['specialty_demand_preview.html','specialty_demand_live.html','specialty_demand_report_template.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.doesNotMatch(html,/demoMaps=frozen|buildFortWorthFallbackPayload|frozenDemoMapAssets|pop2031|64\.2%|urgent care/i);
  }
  const template=fs.readFileSync('specialty_demand_report_template.html','utf8');
  assert.match(template,/2029 Trend Scenario/);
  assert.match(template,/id="economic-insight"/);
});
