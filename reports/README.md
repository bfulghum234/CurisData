# Report generation

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
