const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};

const CACHE_SCHEMA_VERSION = 1;
const CACHE_TTL_SECONDS = 28 * 24 * 60 * 60;
const GOOGLE_ENDPOINT = "https://areainsights.googleapis.com/v1:computeInsights";
const METERS_PER_MILE = 1609.344;
const MIN_RADIUS_METERS = 23;
const MAX_RADIUS_METERS = 50000;
const MAX_TYPES_PER_FILTER = 50;
const TYPE_PATTERN = /^[a-z0-9_]+$/;
const ALLOWED_OPERATING_STATUSES = new Set([
  "OPERATING_STATUS_OPERATIONAL",
  "OPERATING_STATUS_PERMANENTLY_CLOSED",
  "OPERATING_STATUS_TEMPORARILY_CLOSED"
]);
const ALLOWED_PRICE_LEVELS = new Set([
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE"
]);

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}

function asFiniteNumber(value, name) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${name} must be a finite number.`);
  }
  return number;
}

function normalizeCoordinate(value, name, min, max) {
  const number = asFiniteNumber(value, name);
  if (number < min || number > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return Number(number.toFixed(6));
}

function normalizeRadius(body) {
  const source = body.radiusMeters ?? (
    body.radiusMiles === undefined ? undefined : Number(body.radiusMiles) * METERS_PER_MILE
  );
  const radius = Math.round(asFiniteNumber(source, "radiusMeters or radiusMiles"));
  if (radius < MIN_RADIUS_METERS || radius > MAX_RADIUS_METERS) {
    throw new Error(
      `radius must be between ${MIN_RADIUS_METERS} and ${MAX_RADIUS_METERS} meters.`
    );
  }
  return radius;
}

function normalizeTypeList(value, name) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }

  const normalized = [...new Set(value.map((item) => String(item).trim().toLowerCase()))]
    .filter(Boolean)
    .sort();

  if (normalized.length > MAX_TYPES_PER_FILTER) {
    throw new Error(`${name} cannot contain more than ${MAX_TYPES_PER_FILTER} types.`);
  }
  if (normalized.some((item) => !TYPE_PATTERN.test(item))) {
    throw new Error(`${name} contains an invalid Google place type.`);
  }
  return normalized;
}

function normalizeEnumList(value, name, allowedValues) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array.`);
  }
  const normalized = [...new Set(value.map((item) => String(item).trim().toUpperCase()))]
    .filter(Boolean)
    .sort();
  if (normalized.some((item) => !allowedValues.has(item))) {
    throw new Error(`${name} contains an unsupported value.`);
  }
  return normalized;
}

function normalizeOptionalRating(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const rating = asFiniteNumber(value, name);
  if (rating < 1 || rating > 5) {
    throw new Error(`${name} must be between 1 and 5.`);
  }
  return Number(rating.toFixed(1));
}

function normalizeRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Request body must be a JSON object.");
  }

  const includedTypes = normalizeTypeList(body.includedTypes, "includedTypes");
  const includedPrimaryTypes = normalizeTypeList(
    body.includedPrimaryTypes,
    "includedPrimaryTypes"
  );
  if (!includedTypes.length && !includedPrimaryTypes.length) {
    throw new Error("At least one includedTypes or includedPrimaryTypes value is required.");
  }

  const minRating = normalizeOptionalRating(body.minRating, "minRating");
  const maxRating = normalizeOptionalRating(body.maxRating, "maxRating");
  if (minRating !== null && maxRating !== null && minRating > maxRating) {
    throw new Error("minRating cannot be greater than maxRating.");
  }

  return {
    latitude: normalizeCoordinate(
      body.latitude ?? body.lat ?? body.location?.latitude ?? body.location?.lat,
      "latitude",
      -90,
      90
    ),
    longitude: normalizeCoordinate(
      body.longitude ?? body.lng ?? body.location?.longitude ?? body.location?.lng,
      "longitude",
      -180,
      180
    ),
    radiusMeters: normalizeRadius(body),
    includedTypes,
    excludedTypes: normalizeTypeList(body.excludedTypes, "excludedTypes"),
    includedPrimaryTypes,
    excludedPrimaryTypes: normalizeTypeList(
      body.excludedPrimaryTypes,
      "excludedPrimaryTypes"
    ),
    operatingStatus: normalizeEnumList(
      body.operatingStatus ?? ["OPERATING_STATUS_OPERATIONAL"],
      "operatingStatus",
      ALLOWED_OPERATING_STATUSES
    ),
    priceLevels: normalizeEnumList(body.priceLevels, "priceLevels", ALLOWED_PRICE_LEVELS),
    minRating,
    maxRating
  };
}

function buildGoogleRequest(query) {
  const typeFilter = {};
  for (const field of [
    "includedTypes",
    "excludedTypes",
    "includedPrimaryTypes",
    "excludedPrimaryTypes"
  ]) {
    if (query[field].length) typeFilter[field] = query[field];
  }

  const filter = {
    locationFilter: {
      circle: {
        latLng: {
          latitude: query.latitude,
          longitude: query.longitude
        },
        radius: query.radiusMeters
      }
    },
    typeFilter
  };

  if (query.operatingStatus.length) filter.operatingStatus = query.operatingStatus;
  if (query.priceLevels.length) filter.priceLevels = query.priceLevels;
  if (query.minRating !== null || query.maxRating !== null) {
    filter.ratingFilter = {};
    if (query.minRating !== null) filter.ratingFilter.minRating = query.minRating;
    if (query.maxRating !== null) filter.ratingFilter.maxRating = query.maxRating;
  }

  return {
    insights: ["INSIGHT_COUNT"],
    filter
  };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function buildCacheKey(query) {
  const digest = await sha256(JSON.stringify(query));
  return `places-aggregate:v${CACHE_SCHEMA_VERSION}:${digest}`;
}

async function fetchGoogleCount(query, apiKey) {
  const response = await fetch(GOOGLE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey
    },
    body: JSON.stringify(buildGoogleRequest(query))
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || `Google Places Aggregate request failed (${response.status}).`
    );
    error.status = response.status;
    error.googleStatus = payload?.error?.status || null;
    throw error;
  }

  const count = Number(payload.count);
  if (!Number.isFinite(count) || count < 0) {
    throw new Error("Google Places Aggregate returned an invalid count.");
  }
  return count;
}

function buildStoredValue(query, count, fetchedAt) {
  return {
    schemaVersion: CACHE_SCHEMA_VERSION,
    count,
    query,
    fetchedAt,
    expiresAt: new Date(Date.parse(fetchedAt) + CACHE_TTL_SECONDS * 1000).toISOString(),
    attribution: "Google Maps"
  };
}

function buildSuccessPayload(value, cacheStatus) {
  return {
    success: true,
    count: value.count,
    query: value.query,
    fetchedAt: value.fetchedAt,
    expiresAt: value.expiresAt,
    attribution: value.attribution,
    cache: {
      status: cacheStatus,
      ttlDays: 28
    }
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 16384) {
      return jsonResponse({ success: false, error: "Request body is too large." }, 413);
    }

    const body = await request.json().catch(() => {
      throw new Error("Request body must be valid JSON.");
    });
    const query = normalizeRequest(body);
    const cacheKey = await buildCacheKey(query);
    const cache = env.PLACES_CACHE;

    if (cache) {
      const cached = await cache.get(cacheKey, { type: "json" });
      if (cached?.schemaVersion === CACHE_SCHEMA_VERSION) {
        return jsonResponse(buildSuccessPayload(cached, "hit"));
      }
    }

    const apiKey = String(env.GOOGLE_MAPS_API_KEY || "").trim();
    if (!apiKey) {
      return jsonResponse({
        success: false,
        error: "Google Maps API key is not configured."
      }, 503);
    }

    const count = await fetchGoogleCount(query, apiKey);
    const storedValue = buildStoredValue(query, count, new Date().toISOString());

    if (cache) {
      const write = cache.put(cacheKey, JSON.stringify(storedValue), {
        expirationTtl: CACHE_TTL_SECONDS
      }).catch((error) => {
        console.error("Unable to write Places Aggregate cache entry:", error);
      });
      if (typeof context.waitUntil === "function") context.waitUntil(write);
      else await write;
    }

    return jsonResponse(buildSuccessPayload(storedValue, cache ? "miss" : "unavailable"));
  } catch (error) {
    const clientError = /must|required|cannot|invalid|unsupported/i.test(error.message);
    return jsonResponse({
      success: false,
      error: error.message,
      ...(error.googleStatus ? { googleStatus: error.googleStatus } : {})
    }, clientError ? 400 : (error.status >= 400 && error.status < 600 ? error.status : 502));
  }
}
