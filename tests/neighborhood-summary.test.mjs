import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../functions/api/neighborhood-summary.js", import.meta.url),
  "utf8"
);
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { onRequestPost } = await import(moduleUrl);

function makeRequest(body) {
  return new Request("https://www.curiscorp.com/api/neighborhood-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function callHandler(body, env = { GOOGLE_MAPS_API_KEY: "test-key" }) {
  const response = await onRequestPost({ request: makeRequest(body), env });
  return { response, payload: await response.json() };
}

test("returns Google's neighborhood summary unchanged without caching it", async () => {
  const originalFetch = globalThis.fetch;
  const summary = {
    overview: { text: "A walkable cultural district.", languageCode: "en" },
    description: { text: "Known for museums and restaurants.", languageCode: "en" },
    referencedPlaces: ["places/ChIJExample"],
    flagContentUri: "https://www.google.com/local/review/rap/report",
    disclosureText: { text: "Summarized with Gemini", languageCode: "en" }
  };
  let requestedUrl;
  let requestedHeaders;

  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return Response.json({
      id: "ChIJMyK3f-hzToYRlstOM8gDzd4",
      displayName: { text: "601 Bailey Ave", languageCode: "en" },
      formattedAddress: "601 Bailey Ave, Fort Worth, TX 76107, USA",
      types: ["street_address"],
      neighborhoodSummary: summary
    });
  };

  try {
    const result = await callHandler({ placeId: "ChIJMyK3f-hzToYRlstOM8gDzd4" });

    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get("Cache-Control"), "no-store, max-age=0");
    assert.equal(result.payload.available, true);
    assert.deepEqual(result.payload.neighborhoodSummary, summary);
    assert.equal(result.payload.storage.summary, "not-stored");
    assert.match(requestedUrl, /places\/ChIJMyK3f-hzToYRlstOM8gDzd4/);
    assert.match(requestedUrl, /languageCode=en/);
    assert.match(requestedHeaders["X-Goog-FieldMask"], /neighborhoodSummary/);
    assert.equal(requestedHeaders["X-Goog-Api-Key"], "test-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reports that a summary is unavailable when Google omits it", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    id: "ChIJMyK3f-hzToYRlstOM8gDzd4",
    formattedAddress: "601 Bailey Ave, Fort Worth, TX 76107, USA"
  });

  try {
    const result = await callHandler({ placeId: "ChIJMyK3f-hzToYRlstOM8gDzd4" });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.available, false);
    assert.equal(result.payload.neighborhoodSummary, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects an invalid Place ID before calling Google", async () => {
  const originalFetch = globalThis.fetch;
  let googleCalls = 0;
  globalThis.fetch = async () => {
    googleCalls += 1;
    return Response.json({});
  };

  try {
    const result = await callHandler({ placeId: "bad id" });
    assert.equal(result.response.status, 400);
    assert.match(result.payload.error, /placeId is invalid/);
    assert.equal(googleCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not expose the configured API key in upstream errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { status: "PERMISSION_DENIED", message: "Requests are not authorized." }
  }), {
    status: 403,
    headers: { "Content-Type": "application/json" }
  });

  try {
    const result = await callHandler({ placeId: "ChIJMyK3f-hzToYRlstOM8gDzd4" });
    assert.equal(result.response.status, 403);
    assert.equal(result.payload.googleStatus, "PERMISSION_DENIED");
    assert.doesNotMatch(JSON.stringify(result.payload), /test-key/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
