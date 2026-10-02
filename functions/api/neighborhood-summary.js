const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff"
};

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";
const GOOGLE_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "types",
  "neighborhoodSummary"
].join(",");
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,256}$/;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS
  });
}

function normalizePlaceId(value) {
  const placeId = String(value || "").trim();
  if (!placeId) throw new Error("placeId is required.");
  if (!PLACE_ID_PATTERN.test(placeId)) {
    throw new Error("placeId is invalid.");
  }
  return placeId;
}

async function fetchNeighborhoodSummary(placeId, apiKey) {
  const url = new URL(`${GOOGLE_PLACES_ENDPOINT}/${encodeURIComponent(placeId)}`);
  url.searchParams.set("languageCode", "en");
  url.searchParams.set("regionCode", "US");

  const response = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_FIELD_MASK
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || `Google Place Details request failed (${response.status}).`
    );
    error.status = response.status;
    error.googleStatus = payload?.error?.status || null;
    throw error;
  }

  return payload;
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

export async function onRequestPost({ request, env }) {
  try {
    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 4096) {
      return jsonResponse({ success: false, error: "Request body is too large." }, 413);
    }

    const body = await request.json().catch(() => {
      throw new Error("Request body must be valid JSON.");
    });
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Request body must be a JSON object.");
    }

    const placeId = normalizePlaceId(body.placeId);
    const apiKey = String(env.GOOGLE_MAPS_API_KEY || "").trim();
    if (!apiKey) {
      return jsonResponse({
        success: false,
        error: "Google Maps API key is not configured."
      }, 503);
    }

    const place = await fetchNeighborhoodSummary(placeId, apiKey);
    const neighborhoodSummary = place.neighborhoodSummary || null;

    return jsonResponse({
      success: true,
      available: Boolean(neighborhoodSummary),
      place: {
        id: place.id || placeId,
        displayName: place.displayName || null,
        formattedAddress: place.formattedAddress || null,
        types: Array.isArray(place.types) ? place.types : []
      },
      neighborhoodSummary,
      fetchedAt: new Date().toISOString(),
      attribution: "Google Maps",
      storage: {
        summary: "not-stored",
        placeId: "may-be-retained"
      }
    });
  } catch (error) {
    const clientError = /must|required|invalid/i.test(error.message);
    const upstreamStatus = Number(error.status);
    const status = clientError
      ? 400
      : (upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502);

    return jsonResponse({
      success: false,
      error: error.message,
      ...(error.googleStatus ? { googleStatus: error.googleStatus } : {})
    }, status);
  }
}
