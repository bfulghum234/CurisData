const ALLOWED_FILES = new Map([
  ["bgZTCA_TX.geojson", "application/geo+json; charset=utf-8"],
  ["bgZTCA_TX.json", "application/json; charset=utf-8"],
  ["texas_blockgroup_demographics_2022.csv", "text/csv; charset=utf-8"],
  ["ACS_pct_values_by_blockgroup.csv", "text/csv; charset=utf-8"],
  ["zipTexas.json", "application/json; charset=utf-8"]
]);

function jsonResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestGet({ env, params }) {
  const filename = String(params.filename || "");
  const contentType = ALLOWED_FILES.get(filename);

  if (!contentType) {
    return jsonResponse({ error: "Data file not found" }, 404);
  }

  if (!env.REPORT_DATA_BUCKET) {
    return jsonResponse(
      { error: "Report data bucket is not configured" },
      503
    );
  }

  try {
    const object = await env.REPORT_DATA_BUCKET.get(filename);

    if (!object) {
      return jsonResponse({ error: "Data file not found in R2" }, 404);
    }

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Content-Type-Options": "nosniff"
    });
    object.writeHttpMetadata?.(headers);
    headers.set("Content-Type", headers.get("Content-Type") || contentType);
    if (object.httpEtag) headers.set("ETag", object.httpEtag);

    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error(`Unable to load ${filename}:`, error);
    return jsonResponse({ error: "Unable to read report data from R2" }, 502);
  }
}
