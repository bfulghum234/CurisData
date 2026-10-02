# CurisData Static Site

This scaffold is intentionally shaped more like `spaitialintel`:

- main landing pages live at the repo root
- Cloudflare Pages Functions live in `functions/`
- supporting static folders like `images/` and `legal/` sit beside the homepage
- no framework build step is required

## Recommended Structure

```text
.
|-- functions/
|   `-- api/
|       `-- health.js
|-- images/
|   `-- .gitkeep
|-- legal/
|   |-- privacy.html
|   `-- terms.html
|-- .dev.vars.example
|-- .gitignore
|-- 404.html
|-- _headers
|-- index.html
|-- package.json
|-- README.md
|-- script.js
|-- style.css
`-- wrangler.toml
```

## Why This Matches Better

`spaitialintel` uses a flat repo-root static site layout instead of a nested `public/` directory. That keeps deployment simple in Cloudflare Pages and makes it easy to add new standalone HTML pages later.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start local Pages development:

   ```bash
   npm run dev
   ```

3. Visit the local URL Wrangler prints.

The homepage is served from `index.html` and the sample API route is available at `/api/health`.

## Cloudflare Pages Deployment

Create a GitHub repository, push this project, and connect it to Cloudflare Pages with:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `.`
- Root directory: `/`

Cloudflare Pages will deploy the root static files and pick up `functions/` automatically.

## Environment Variables

Use `.dev.vars.example` as a local template if you later need secrets or runtime configuration for Pages Functions.

### Report data in R2

The mapping interface loads its GeoJSON and demographic CSV files through the
same-origin `/data/<filename>` Pages Function. That Function reads the objects
directly from the `demographic-files` R2 bucket using the `REPORT_DATA_BUCKET`
binding declared in `wrangler.toml`. This avoids browser CORS and Cloudflare
Access redirects without copying large data files into Git.

Because this Pages project is managed by Wrangler, Cloudflare disables manual
binding edits in the dashboard. Commit and deploy `wrangler.toml` to apply the
binding; after deployment, the dashboard will show `REPORT_DATA_BUCKET` as a
Wrangler-managed binding to `demographic-files`.

### Places Aggregate cache

`POST /api/places-aggregate` proxies count-only Google Places Aggregate queries
without exposing the server request logic to the browser. Successful responses
are cached for 28 days, inside Google's 30-day limit for temporarily caching POI
counts used to calculate a CurisData value. Cache keys include the normalized
coordinates, radius, place types, and other filters, so only identical queries
share an entry.

The endpoint uses a `PLACES_CACHE` Workers KV binding when one is configured.
Otherwise, production automatically uses Cloudflare's built-in edge Cache API,
which requires no additional binding. If neither cache is available (for
example, in a basic unit-test runtime), the endpoint still returns live Google
data and reports `cache.status` as `unavailable`.

Example request:

```json
{
  "latitude": 32.752,
  "longitude": -97.356,
  "radiusMiles": 5,
  "includedPrimaryTypes": ["hospital"]
}
```

The endpoint returns Google Maps attribution, the data refresh and expiration
timestamps, its active cache backend, and a cache status of `hit`, `miss`, or
`unavailable`.

### AI neighborhood summaries

`POST /api/neighborhood-summary` retrieves Google's AI-powered neighborhood
summary for a Place ID. It requests only the Place Details fields needed for
the summary and returns the summary exactly as Google supplies it, including
the required disclosure and content-reporting link when available.

Example request:

```json
{
  "placeId": "ChIJMyK3f-hzToYRlstOM8gDzd4"
}
```

Google's Places policies permit Place IDs to be retained, but do not permit the
generated neighborhood-summary content to be persistently cached. Therefore,
this endpoint fetches the summary live for each request and sends
`Cache-Control: no-store`. It does not use the aggregate-data KV/edge cache.
The eventual interface must display the returned summary in full along with
Google's `disclosureText` and `flagContentUri`.

## GitHub Setup

```bash
git add .
git commit -m "Initial static site scaffold"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
