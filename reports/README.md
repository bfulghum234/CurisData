# Report generation

## Physician Specialty Demand Assessment

Both `specialty_demand_preview.html` and `specialty_demand_live.html` now use the
same source-backed loader. The default address is a selectable example location,
not a sample-data mode. Enter another Texas address and three radii to regenerate.
No frozen map images, fabricated data, assumed growth rates, or sample fallback
payloads are used in these specialty pages. The Urgent Care report is unchanged.

`specialty_report_loader.js` resolves the address with Google Geocoding, loads the
existing Texas block-group boundaries, and requests Census sources through
`functions/api/specialty-demographics.js`. API credentials remain server-side.
Current figures use ACS 2020–2024; historical comparisons use ACS 2015–2019.
The server batches fewer than 50 variables/request and shares public Census
responses in memory for one hour. Errors omit the affected fields instead of
substituting source values or zeros.

`specialty_census_report.js` sums additive counts and derives rates from matching
numerators/denominators. Local income, home-value and cash-rent medians interpolate
summed distribution bins; open-ended median bins return Unavailable. Published
county/state income medians use B19013. Per-capita income is population weighted;
household size uses population in households (B11002) divided by households.
Employment/education benchmarks use the same ACS release nationally.

The growth page is temporarily hidden on screen and excluded from print sheets;
its markup and calculations remain available for a later revision.
The growth page extends the annualized 2019-to-2024 change to a labeled 2029 trend
scenario. Each metric requires all selected GEOIDs and its source variables in
both periods. Missing/suppressed history returns Unavailable; no crosswalk or
boundary-change allocation is invented. Exact GEOID matches do not independently
validate unchanged boundaries. Income trends are nominal, not inflation-adjusted.

Cover, income and population maps are generated SVGs from actual selected Census
block-group geometry, current source values, selected site and radius rings.
They contain no saved sample images. Income-map missing values are gray. Map
legends report classification cutoffs and source coverage. A dark Google road
basemap includes highway shields, major roads, water and city labels on the cover. The thematic maps use a light gray road
basemap and stronger green fills so light data classes retain their green hue.
The cover omits block-group boundaries. `functions/api/report-basemap.js` keeps the Static Maps
key server-side; the raster and overlays use the same Web Mercator center, zoom
and dimensions. Google attribution remains visible. If the road source is
unavailable, the boundary map explicitly identifies the missing basemap.

`specialty_demand_integration.js` retains the 25-specialty MEPS page and dynamic
executive findings. `reports/meps-v2.9.1/` is a county-sharded copy of the MEPS
project's national v2.9.1 wide block-group export. The manifest records its source
SHA-256 and specialty mapping; import with `scripts/import-meps-demand.mjs` to a
fresh destination. It retains visits, sample warnings and reconstruction flags.
The matched county age benchmark is `reports/acs2024-age/`, imported by
`scripts/import-meps-age-benchmarks.mjs` with verified state-partition hashes.
Multi-county age benchmarks pool the full populations of intersected counties.

Google neighborhood context is fetched live, displayed in full with attribution,
disclosure and reporting link, and is not stored/cached by the application.
Healthcare Market Context uses the existing 28-day count cache and matched ACS
resident denominator. Both count dates and the whole-block-group versus circular
search geography difference appear in notes. Missing categories stay unavailable.

MEPS describes modeled resident-generated historical use, not observed local
visits, unmet clinical need or practice workload. Radii overlap; specialty counts
may overlap and must not be summed into unique totals. Missing source metrics
remain Unavailable. Current boundary coverage supports Texas.

Run `node scripts/live-report-preview.mjs` and open
`http://127.0.0.1:8788/specialty_demand_preview.html` for the connected report.

## Urgent Care live Bailey test
Open `/urgent_care_live.html` to generate the 1-, 3-, and 5-mile report for
601 Bailey Ave., Fort Worth, TX 76107. It uses the same `collectLiveReportPayload`
collector as the production report button. Opening the report template directly
also opens this live test; the frozen sample remains at `/urgent_care_preview.html`.

For a local preview against the deployed source endpoints, run
`node scripts/live-report-preview.mjs` and open
`http://127.0.0.1:8788/urgent_care_live.html`. This server listens only on loopback
and reads the deployed runtime configuration in memory without saving keys.

The live report fetches the connected 2022 ACS files, actual Census county/state
income benchmarks, Google urgent care listings, and healthcare category counts.
Missing demographic CSV records are supplemented from the Census 2022 ACS API.
These current-only records improve the baseline coverage but do not supply invented
historical values. Report forecasts display the same calculated values as the
mapping snapshot, including when historical coverage is incomplete.
Category counts retain the existing server's 28-day cache and refresh metadata.
Curis demand requires its configured CSV; unavailable sources are shown explicitly.
The report includes demographic join coverage and whole-block-group methodology.
Five-year forecasts are modeled from source annual growth rates. Google search
results are radius-filtered and distance-sorted, with a note when the 60-result
search cap is reached. None of these paths substitutes saved sample figures.

All report modes build the same versioned payload with `buildReportPayload` in
`report_integration.js`. The HTML template renders that payload through
`renderReportPayload`; iframe callers use the small `populateReportTemplate`
wrapper to wait for the template document.

## Payload contract (version 1)

```js
{
  schemaVersion: 1,
  reportType: "urgent-care-site-assessment",
  generatedAt: "ISO-8601 timestamp",
  location: {
    address: "...",
    latitude: 0,
    longitude: 0,
    stateCode: "TX"
  },
  tradeArea: {
    radiiMiles: [1, 3, 5],
    maxRadiusMiles: 5
  },
  demographics: {
    byRadius: { "1mile": {}, "3mile": {}, "5mile": {} }
  },
  healthcareDemand: null,
  competition: {
    urgentCare: {
      count: 0,
      locations: []
    }
  },
  maps: {
    coverImageUrl: "",
    zoom: 12
  }
}
```

Data collection and fallback logic belongs before `buildReportPayload`.
Template code should read only from the normalized payload rather than from
page controls or collector-specific objects.

## TiC status

The specialty report replaces its income thematic with four maps: family
practice, dermatology, pediatrics and oncology. Each maps modeled annual visits
per 1,000 total residents using MEPS county shards and matching ACS 2020–2024
population from `reports/acs2024-age/`. The maps share pooled quantile thresholds
rounded up to tens, geographic extent, and color scale. Totals use the largest
trade area. Areas without residents are off-white; missing data are gray.

Transparency-in-Coverage/Snowflake reporting is intentionally disabled in both
the browser workflow and `functions/report.js`. Its implementation remains in
place for a future product phase, but current report runs do not issue TiC API
or Snowflake requests.
