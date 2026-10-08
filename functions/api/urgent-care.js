const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
export async function onRequest({ request, env }) {
  const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  let input;
  try { input = await request.json(); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
  const { latitude, longitude, radiusMiles } = input;
  if (![latitude, longitude, radiusMiles].every(value => typeof value === 'number' && Number.isFinite(value)) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || radiusMiles <= 0 || radiusMiles * 1609.344 > 50000) {
    return reply({ error: 'Invalid coordinates or radius (maximum 31 miles).' }, 400);
  }
  if (!env.GOOGLE_MAPS_API_KEY) return reply({ error: 'Google Places is not configured.' }, 503);
  try {
    let pageToken;
    const places = [];
    for (let page = 0; page < 3; page++) {
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (pageToken) await new Promise(resolve => setTimeout(resolve, 3000));
        const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
        url.search = new URLSearchParams({ key: env.GOOGLE_MAPS_API_KEY,
          query: 'urgent care', location: `${latitude},${longitude}`, radius: String(Math.round(radiusMiles * 1609.344)),
          ...(pageToken ? { pagetoken: pageToken } : {}) });
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
        result = await response.json();
        if (result.status !== 'INVALID_REQUEST' || !pageToken) break;
      }
      if (result.status !== 'OK' && result.status !== 'ZERO_RESULTS') {
        console.warn('Urgent care search status:', result.status, 'page:', page + 1);
        throw new Error('Search unavailable');
      }
      places.push(...(result.results || []));
      pageToken = result.next_page_token;
      if (!pageToken) break;
    }
    return reply({ success: true, attribution: 'Google Maps', fetchedAt: new Date().toISOString(),
      searchLimitReached: Boolean(pageToken), locations: places.map(place => ({
        id: place.place_id, name: place.name, address: place.formatted_address,
        lat: place.geometry?.location?.lat, lng: place.geometry?.location?.lng
      })) });
  } catch (error) {
    console.warn('Urgent care request failed:', error.name);
    return reply({ success: false, error: 'Google urgent care search unavailable. No sample data substituted.' }, 502);
  }
}
