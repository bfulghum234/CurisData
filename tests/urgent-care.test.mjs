import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = (await fs.readFile(new URL('../functions/api/urgent-care.js', import.meta.url), 'utf8')).replace('export async function', 'async function');
const request = body => new Request('https://example.com/api/urgent-care', { method: 'POST', body: JSON.stringify(body) });
const location = { latitude: 32.753079934041, longitude: -97.362923890503, radiusMiles: 5 };
function handler(fetch) {
  const context = vm.createContext({ Request, Response, URL, URLSearchParams, AbortSignal, fetch,
    console: { warn() {} }, setTimeout: callback => { callback(); } });
  vm.runInContext(source, context);
  return context.onRequest;
}

test('facility endpoint keeps the original query when requesting later pages', async () => {
  const urls = [];
  const run = handler(async url => {
    urls.push(new URL(url));
    return Response.json(urls.length === 1
      ? { status: 'OK', results: [{ place_id: 'one', name: 'One', geometry: { location: { lat: 32.75, lng: -97.36 } } }], next_page_token: 'next' }
      : { status: 'OK', results: [{ place_id: 'two', name: 'Two', geometry: { location: { lat: 32.76, lng: -97.36 } } }] });
  });
  const response = await run({ request: request(location), env: { GOOGLE_MAPS_API_KEY: 'test-key' } });
  const result = await response.json();
  assert.equal(result.locations.length, 2);
  assert.equal(urls[1].searchParams.get('query'), 'urgent care');
  assert.equal(urls[1].searchParams.get('pagetoken'), 'next');
  assert.equal(result.searchLimitReached, false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('invalid location cannot trigger upstream requests', async () => {
  const run = handler(() => { throw new Error('Unexpected fetch'); });
  const response = await run({ request: request({ ...location, latitude: 100 }), env: {} });
  assert.equal(response.status, 400);
});

test('upstream failure remains an error without returning credentials or invented locations', async () => {
  const run = handler(async () => Response.json({ status: 'REQUEST_DENIED', error_message: 'secret-test-key' }));
  const response = await run({ request: request(location), env: { GOOGLE_MAPS_API_KEY: 'secret-test-key' } });
  assert.equal(response.status, 502);
  const body = await response.text();
  assert.doesNotMatch(body, /secret-test-key|locations/);
});
