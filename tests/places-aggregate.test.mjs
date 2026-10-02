import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../functions/api/places-aggregate.js", import.meta.url),
  "utf8"
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { onRequestPost } = await import(moduleUrl);

class MemoryKv {
  constructor() {
    this.values = new Map();
    this.lastPutOptions = null;
  }

  async get(key, options) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return options?.type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value, options) {
    this.values.set(key, value);
    this.lastPutOptions = options;
  }
}

class MemoryEdgeCache {
  constructor() {
    this.values = new Map();
  }

  async match(request) {
    const response = this.values.get(request.url);
    return response ? response.clone() : undefined;
  }

  async put(request, response) {
    this.values.set(request.url, response.clone());
  }
}

function makeRequest(body) {
  return new Request("https://www.curiscorp.com/api/places-aggregate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function callHandler(body, env) {
  const pending = [];
  const response = await onRequestPost({
    request: makeRequest(body),
    env,
    waitUntil(promise) {
      pending.push(promise);
    }
  });
  await Promise.all(pending);
  return { response, payload: await response.json() };
}

test("caches normalized aggregate counts for 28 days", async () => {
  const cache = new MemoryKv();
  const originalFetch = globalThis.fetch;
  let googleCalls = 0;
  globalThis.fetch = async () => {
    googleCalls += 1;
    return Response.json({ count: "127" });
  };

  try {
    const env = { PLACES_CACHE: cache, GOOGLE_MAPS_API_KEY: "test-key" };
    const body = {
      latitude: 32.752,
      longitude: -97.356,
      radiusMiles: 5,
      includedPrimaryTypes: ["hospital"]
    };

    const first = await callHandler(body, env);
    assert.equal(first.response.status, 200);
    assert.equal(first.payload.count, 127);
    assert.equal(first.payload.cache.status, "miss");
    assert.equal(first.payload.cache.backend, "kv");
    assert.equal(cache.lastPutOptions.expirationTtl, 28 * 24 * 60 * 60);

    const second = await callHandler(body, env);
    assert.equal(second.response.status, 200);
    assert.equal(second.payload.count, 127);
    assert.equal(second.payload.cache.status, "hit");
    assert.equal(second.payload.cache.backend, "kv");
    assert.equal(googleCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects requests without an included place type", async () => {
  const result = await callHandler({
    latitude: 32.752,
    longitude: -97.356,
    radiusMiles: 5
  }, { GOOGLE_MAPS_API_KEY: "test-key" });

  assert.equal(result.response.status, 400);
  assert.match(result.payload.error, /includedTypes or includedPrimaryTypes/);
});

test("uses the Cloudflare edge cache when KV is not bound", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let googleCalls = 0;
  globalThis.caches = { default: new MemoryEdgeCache() };
  globalThis.fetch = async () => {
    googleCalls += 1;
    return Response.json({ count: "9" });
  };

  try {
    const body = {
      latitude: 32.752,
      longitude: -97.356,
      radiusMiles: 2,
      includedPrimaryTypes: ["pharmacy"]
    };
    const env = { GOOGLE_MAPS_API_KEY: "test-key" };
    const first = await callHandler(body, env);
    const second = await callHandler(body, env);

    assert.equal(first.payload.cache.status, "miss");
    assert.equal(first.payload.cache.backend, "edge");
    assert.equal(second.payload.cache.status, "hit");
    assert.equal(second.payload.cache.backend, "edge");
    assert.equal(googleCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("continues without caching when the KV binding is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ count: "12" });
  try {
    const result = await callHandler({
      latitude: 32.752,
      longitude: -97.356,
      radiusMeters: 1609,
      includedTypes: ["pharmacy"]
    }, { GOOGLE_MAPS_API_KEY: "test-key" });

    assert.equal(result.response.status, 200);
    assert.equal(result.payload.cache.status, "unavailable");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
