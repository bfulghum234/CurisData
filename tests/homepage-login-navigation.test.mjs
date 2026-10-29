import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const homepage = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

test('successful homepage login opens mapping and reports in a new tab', () => {
  assert.match(homepage, /window\.open\("about:blank", "_blank"\)/);
  assert.match(homepage, /mappingWindow\.sessionStorage\.setItem\("runtimeConfig", runtimeConfig\)/);
  assert.match(homepage, /mappingWindow\.location\.replace\(getDemoReportUrl\(\)\)/);
  assert.doesNotMatch(homepage, /window\.location\.assign\(getDemoReportUrl\(\)\)/);
});

test('failed login closes the reserved mapping tab and keeps the homepage open', () => {
  assert.match(homepage, /if \(!response\.ok\) \{\s*mappingWindow\?\.close\(\)/);
  assert.match(homepage, /Please allow pop-ups for this site/);
});
