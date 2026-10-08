# Report generation

## Live Bailey test

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

Transparency-in-Coverage/Snowflake reporting is intentionally disabled in both
the browser workflow and `functions/report.js`. Its implementation remains in
place for a future product phase, but current report runs do not issue TiC API
or Snowflake requests.
