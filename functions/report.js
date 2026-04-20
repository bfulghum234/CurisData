const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

const DEFAULT_RADIUS_LADDER = [20, 30, 40, 50];
const DEFAULT_MIN_LOCAL_NPIS = 20;
const DEFAULT_MIN_LOCAL_REIMBURSEMENT_ROWS = 500;
const DEFAULT_POLL_INTERVAL_MS = 1200;
const DEFAULT_POLL_TIMEOUT_MS = 45000;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS
  });
}

function getErrorStatus(error) {
  const message = String(error?.message || "");
  if (
    message.includes("Request body must be valid JSON") ||
    message.includes("must be a finite number") ||
    message.includes("must be between") ||
    message.includes("must include at least one radius") ||
    message.includes("must be positive") ||
    message.includes("stateCode must be")
  ) {
    return 400;
  }

  return 500;
}

function parseJsonBody(request) {
  return request.json().catch(() => {
    throw new Error("Request body must be valid JSON.");
  });
}

function asFiniteNumber(value, fieldName) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }
  return numeric;
}

function asOptionalFiniteNumber(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return asFiniteNumber(value, fieldName);
}

function normalizeStateCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error("stateCode must be a 2-letter state abbreviation.");
  }
  return normalized;
}

function normalizeRadiusOptions(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_RADIUS_LADDER;
  const uniqueSorted = [...new Set(
    source.map((radius, index) => asFiniteNumber(radius, `radiusOptions[${index}]`))
  )].sort((a, b) => a - b);

  if (!uniqueSorted.length) {
    throw new Error("radiusOptions must include at least one radius.");
  }

  for (const radius of uniqueSorted) {
    if (radius <= 0 || radius > 250) {
      throw new Error("radiusOptions values must be between 0 and 250 miles.");
    }
  }

  return uniqueSorted;
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function coerceBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return Boolean(value);
}

function getSnowflakeConfig(env) {
  const account = String(env.SNOWFLAKE_ACCOUNT || "").trim();
  const token = String(env.SNOWFLAKE_TOKEN || env.SNOWFLAKE_PAT || "").trim();

  if (!account) {
    throw new Error("Missing SNOWFLAKE_ACCOUNT environment variable.");
  }

  if (!token) {
    throw new Error("Missing SNOWFLAKE_TOKEN or SNOWFLAKE_PAT environment variable.");
  }

  return {
    account,
    token,
    tokenType: String(
      env.SNOWFLAKE_TOKEN_TYPE || "PROGRAMMATIC_ACCESS_TOKEN"
    ).trim(),
    warehouse: String(env.SNOWFLAKE_WAREHOUSE || "").trim(),
    role: String(env.SNOWFLAKE_ROLE || "").trim(),
    database: String(env.SNOWFLAKE_DATABASE || "").trim(),
    schema: String(env.SNOWFLAKE_SCHEMA || "").trim(),
    timeoutMs: asOptionalFiniteNumber(
      env.SNOWFLAKE_SQL_API_TIMEOUT_MS,
      DEFAULT_POLL_TIMEOUT_MS,
      "SNOWFLAKE_SQL_API_TIMEOUT_MS"
    ),
    pollIntervalMs: asOptionalFiniteNumber(
      env.SNOWFLAKE_SQL_API_POLL_INTERVAL_MS,
      DEFAULT_POLL_INTERVAL_MS,
      "SNOWFLAKE_SQL_API_POLL_INTERVAL_MS"
    )
  };
}

function normalizeBenchmarkRequest(body) {
  const latitude = asFiniteNumber(
    body.latitude ?? body.lat ?? body.location?.latitude ?? body.location?.lat,
    "latitude"
  );
  const longitude = asFiniteNumber(
    body.longitude ?? body.lng ?? body.lon ?? body.location?.longitude ?? body.location?.lng,
    "longitude"
  );

  if (latitude < -90 || latitude > 90) {
    throw new Error("latitude must be between -90 and 90.");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("longitude must be between -180 and 180.");
  }

  const radiusOptions = normalizeRadiusOptions(
    body.radiusOptions ?? body.ticBenchmark?.radiusOptions
  );

  const minRadius = radiusOptions[0];
  const maxRadius = radiusOptions[radiusOptions.length - 1];
  const minLocalNpis = asOptionalFiniteNumber(
    body.minLocalNpis ?? body.ticBenchmark?.minLocalNpis,
    DEFAULT_MIN_LOCAL_NPIS,
    "minLocalNpis"
  );
  const minLocalReimbursementRows = asOptionalFiniteNumber(
    body.minLocalReimbursementRows ?? body.ticBenchmark?.minLocalReimbursementRows,
    DEFAULT_MIN_LOCAL_REIMBURSEMENT_ROWS,
    "minLocalReimbursementRows"
  );

  if (minLocalNpis < 1 || minLocalReimbursementRows < 1) {
    throw new Error("minLocalNpis and minLocalReimbursementRows must be positive.");
  }

  return {
    latitude,
    longitude,
    stateCode: normalizeStateCode(
      body.stateCode ?? body.state ?? body.location?.stateCode ?? body.location?.state
    ),
    radiusOptions,
    minRadius,
    maxRadius,
    minLocalNpis,
    minLocalReimbursementRows,
    includeDebugSql: coerceBoolean(body.includeDebugSql, false),
    address: body.address ? String(body.address).trim() : null
  };
}

function buildRadiusValuesClause(radiusOptions) {
  return radiusOptions
    .map((radius) => `        (${radius})`)
    .join(",\n");
}

function buildTicBenchmarkSql(request) {
  const radiusValuesClause = buildRadiusValuesClause(request.radiusOptions);

  return `with params as (
    select
        ${request.latitude}::float as origin_latitude,
        ${request.longitude}::float as origin_longitude,
        '${escapeSqlString(request.stateCode)}'::text as state_code,
        ${request.minRadius}::float as min_radius_miles,
        ${request.maxRadius}::float as max_radius_miles,
        ${request.minLocalNpis}::number as min_local_npis,
        ${request.minLocalReimbursementRows}::number as min_local_reimbursement_rows,
        'expanded_uc_adaptive_radius'::text as report_type
),
radius_options as (
    select column1::float as radius_miles
    from values
${radiusValuesClause}
),
distance_scored_zips as (
    select
        z.zip5,
        z.latitude,
        z.longitude,
        r.radius_miles,
        round(
            3959 * acos(
                least(
                    1,
                    greatest(
                        -1,
                        cos(radians(p.origin_latitude)) * cos(radians(z.latitude)) *
                        cos(radians(z.longitude) - radians(p.origin_longitude)) +
                        sin(radians(p.origin_latitude)) * sin(radians(z.latitude))
                    )
                )
            ),
            2
        ) as distance_miles
    from SPATIALINTEL_WORK.PUBLIC.V_ZIP_CENTROIDS z
    cross join radius_options r
    cross join params p
    where z.latitude is not null
      and z.longitude is not null
),
candidate_trade_area_zips as (
    select
        zip5,
        radius_miles
    from distance_scored_zips
    where distance_miles <= radius_miles
),
expanded_uc_rates as (
    select distinct
        regexp_replace(trim(vr.npi_number), '[^0-9]', '') as npi,
        vr.payer_slug,
        vr.network_name,
        vr.billing_class,
        vr.billing_code,
        vr.negotiated_rate
    from PRICEMEDIC_CORE_HOSPITAL__HEALTH_SYSTEM_RATES.SNAPSHOT_FEB_2026.V_PROVIDER_RATES vr
    join params p
        on vr.npi_state = p.state_code
    where vr.billing_code_type in ('CPT', 'HCPCS')
      and vr.negotiated_rate is not null
      and vr.negotiated_rate > 0
      and coalesce(vr.negotiation_arrangement, 'ffs') = 'ffs'
      and vr.billing_code in (
          '99202', '99203', '99204', '99205',
          '99212', '99213', '99214', '99215',
          '87426', '87804', '87880', '94640', '71045',
          '81002', '81003', '87086',
          '10060', '10120',
          '12001', '12002', '12004', '12005', '12006', '12007',
          '12011', '12013', '12014', '12015', '12016', '12017', '12018',
          '73030', '73080', '73110', '73562', '73610', '73630',
          '29125', '29515',
          '96372'
      )
),
candidate_local_npis as (
    select distinct
        c.radius_miles,
        g.npi
    from candidate_trade_area_zips c
    join SPATIALINTEL_WORK.PUBLIC.V_NPPES_GEO_BRIDGE g
        on g.practice_zip5 = c.zip5
    join params p
        on g.practice_state = p.state_code
),
candidate_local_rates as (
    select
        c.radius_miles,
        eur.*
    from candidate_local_npis c
    join expanded_uc_rates eur
        on eur.npi = c.npi
),
radius_summary as (
    select
        radius_miles,
        count(distinct npi) as local_npi_count,
        count(*) as local_reimbursement_rows
    from candidate_local_rates
    group by 1
),
selected_radius as (
    select
        rs.radius_miles
    from radius_summary rs
    cross join params p
    where rs.local_npi_count >= p.min_local_npis
       or rs.local_reimbursement_rows >= p.min_local_reimbursement_rows
    qualify row_number() over (order by rs.radius_miles) = 1
),
fallback_radius as (
    select
        coalesce(
            (select radius_miles from selected_radius),
            (select max(radius_miles) from radius_options)
        ) as radius_miles
),
local_trade_area_zips as (
    select
        c.zip5,
        c.radius_miles
    from candidate_trade_area_zips c
    join fallback_radius fr
        on fr.radius_miles = c.radius_miles
),
local_npis as (
    select distinct
        g.npi
    from local_trade_area_zips z
    join SPATIALINTEL_WORK.PUBLIC.V_NPPES_GEO_BRIDGE g
        on g.practice_zip5 = z.zip5
    join params p
        on g.practice_state = p.state_code
),
state_npis as (
    select distinct
        g.npi
    from SPATIALINTEL_WORK.PUBLIC.V_NPPES_GEO_BRIDGE g
    join params p
        on g.practice_state = p.state_code
),
local_rates as (
    select
        eur.*
    from expanded_uc_rates eur
    join local_npis l
        on l.npi = eur.npi
),
state_rates as (
    select
        eur.*
    from expanded_uc_rates eur
    join state_npis s
        on s.npi = eur.npi
),
local_rollup_by_payer as (
    select
        payer_slug,
        network_name,
        billing_class,
        count(*) as local_reimbursement_count,
        count(distinct npi) as local_npi_count,
        avg(negotiated_rate) as local_avg_negotiated_rate,
        median(negotiated_rate) as local_median_negotiated_rate
    from local_rates
    group by 1, 2, 3
),
state_rollup_by_payer as (
    select
        payer_slug,
        network_name,
        billing_class,
        count(*) as state_reimbursement_count,
        count(distinct npi) as state_npi_count,
        avg(negotiated_rate) as state_avg_negotiated_rate,
        median(negotiated_rate) as state_median_negotiated_rate
    from state_rates
    group by 1, 2, 3
),
local_totals as (
    select
        billing_class,
        count(*) as local_total_rate_rows_all_payers
    from local_rates
    group by 1
),
selected_zip_count as (
    select count(*) as zip_count
    from local_trade_area_zips
)
select
    case
        when lower(coalesce(l.billing_class, 'unknown')) = 'professional'
            then 'Professional expanded UC adaptive trade area benchmark'
        when lower(coalesce(l.billing_class, 'unknown')) = 'institutional'
            then 'Institutional expanded UC adaptive trade area benchmark'
        else 'Other expanded UC adaptive trade area benchmark'
    end as report_section,
    p.report_type,
    p.state_code,
    fr.radius_miles as selected_radius_miles,
    zc.zip_count as selected_zip_count,
    l.billing_class,
    l.payer_slug,
    l.network_name,
    l.local_npi_count,
    l.local_reimbursement_count,
    round(l.local_avg_negotiated_rate, 2) as local_avg_negotiated_rate,
    round(l.local_median_negotiated_rate, 2) as local_median_negotiated_rate,
    s.state_npi_count,
    s.state_reimbursement_count,
    round(s.state_avg_negotiated_rate, 2) as state_avg_negotiated_rate,
    round(s.state_median_negotiated_rate, 2) as state_median_negotiated_rate,
    round(l.local_avg_negotiated_rate - s.state_avg_negotiated_rate, 2) as avg_rate_delta,
    case
        when s.state_avg_negotiated_rate is null or s.state_avg_negotiated_rate = 0 then null
        else round((l.local_avg_negotiated_rate / s.state_avg_negotiated_rate) - 1, 4)
    end as avg_rate_pct_vs_state,
    case
        when s.state_reimbursement_count is null or s.state_reimbursement_count = 0 then null
        else round(l.local_reimbursement_count / s.state_reimbursement_count, 4)
    end as local_share_of_state_rate_rows,
    case
        when lt.local_total_rate_rows_all_payers is null or lt.local_total_rate_rows_all_payers = 0 then null
        else round(l.local_reimbursement_count / lt.local_total_rate_rows_all_payers, 4)
    end as local_payer_mix_share
from local_rollup_by_payer l
join params p
    on true
cross join fallback_radius fr
cross join selected_zip_count zc
left join state_rollup_by_payer s
    on s.payer_slug = l.payer_slug
   and coalesce(s.network_name, '') = coalesce(l.network_name, '')
   and coalesce(s.billing_class, '') = coalesce(l.billing_class, '')
left join local_totals lt
    on coalesce(lt.billing_class, '') = coalesce(l.billing_class, '')
order by
    billing_class,
    local_payer_mix_share desc nulls last,
    local_avg_negotiated_rate desc nulls last,
    payer_slug,
    network_name;`;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSnowflakeHeaders(config) {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${config.token}`,
    "X-Snowflake-Authorization-Token-Type": config.tokenType
  };
}

async function fetchSnowflakeJson(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 202) {
    const message = payload.message || `Snowflake request failed with status ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return { response, payload };
}

async function submitStatement(config, sqlText) {
  const url = `https://${config.account}.snowflakecomputing.com/api/v2/statements?async=true&nullable=true`;
  const body = {
    statement: sqlText,
    timeout: Math.ceil(config.timeoutMs / 1000),
    parameters: {
      AUTOCOMMIT: "TRUE"
    }
  };

  if (config.role) body.role = config.role;
  if (config.warehouse) body.warehouse = config.warehouse;
  if (config.database) body.database = config.database;
  if (config.schema) body.schema = config.schema;

  return fetchSnowflakeJson(url, {
    method: "POST",
    headers: buildSnowflakeHeaders(config),
    body: JSON.stringify(body)
  });
}

async function pollStatementResult(config, statementHandle) {
  const startedAt = Date.now();
  const baseUrl = `https://${config.account}.snowflakecomputing.com/api/v2/statements/${statementHandle}`;

  while (Date.now() - startedAt < config.timeoutMs) {
    const { response, payload } = await fetchSnowflakeJson(baseUrl, {
      method: "GET",
      headers: buildSnowflakeHeaders(config)
    });

    if (response.status === 200) {
      return payload;
    }

    if (response.status === 202 || payload.code === "333334") {
      await sleep(config.pollIntervalMs);
      continue;
    }

    const message = payload.message || "Snowflake statement did not complete successfully.";
    const error = new Error(message);
    error.payload = payload;
    throw error;
  }

  throw new Error(`Snowflake statement polling exceeded ${config.timeoutMs}ms.`);
}

async function fetchAdditionalPartitions(config, statementHandle, partitionInfo) {
  const rows = [];
  const totalPartitions = Array.isArray(partitionInfo) ? partitionInfo.length : 0;

  for (let partition = 1; partition < totalPartitions; partition += 1) {
    const url =
      `https://${config.account}.snowflakecomputing.com/api/v2/statements/${statementHandle}?partition=${partition}`;
    const { payload } = await fetchSnowflakeJson(url, {
      method: "GET",
      headers: buildSnowflakeHeaders(config)
    });

    if (Array.isArray(payload.data)) {
      rows.push(...payload.data);
    }
  }

  return rows;
}

function mapSnowflakeRows(result) {
  const columns = result?.resultSetMetaData?.rowType?.map((column) => column.name) || [];
  const rows = Array.isArray(result?.data) ? [...result.data] : [];

  return rows.map((row) => {
    const mapped = {};
    columns.forEach((columnName, index) => {
      mapped[columnName] = row[index];
    });
    return mapped;
  });
}

function coerceField(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function normalizeBenchmarkRows(rows) {
  return rows.map((row) => ({
    reportSection: row.REPORT_SECTION,
    reportType: row.REPORT_TYPE,
    stateCode: row.STATE_CODE,
    selectedRadiusMiles: coerceField(row.SELECTED_RADIUS_MILES),
    selectedZipCount: coerceField(row.SELECTED_ZIP_COUNT),
    billingClass: row.BILLING_CLASS,
    payerSlug: row.PAYER_SLUG,
    networkName: row.NETWORK_NAME,
    localNpiCount: coerceField(row.LOCAL_NPI_COUNT),
    localReimbursementCount: coerceField(row.LOCAL_REIMBURSEMENT_COUNT),
    localAvgNegotiatedRate: coerceField(row.LOCAL_AVG_NEGOTIATED_RATE),
    localMedianNegotiatedRate: coerceField(row.LOCAL_MEDIAN_NEGOTIATED_RATE),
    stateNpiCount: coerceField(row.STATE_NPI_COUNT),
    stateReimbursementCount: coerceField(row.STATE_REIMBURSEMENT_COUNT),
    stateAvgNegotiatedRate: coerceField(row.STATE_AVG_NEGOTIATED_RATE),
    stateMedianNegotiatedRate: coerceField(row.STATE_MEDIAN_NEGOTIATED_RATE),
    avgRateDelta: coerceField(row.AVG_RATE_DELTA),
    avgRatePctVsState: coerceField(row.AVG_RATE_PCT_VS_STATE),
    localShareOfStateRateRows: coerceField(row.LOCAL_SHARE_OF_STATE_RATE_ROWS),
    localPayerMixShare: coerceField(row.LOCAL_PAYER_MIX_SHARE)
  }));
}

function buildBenchmarkSummary(rows, request) {
  const selectedRadiusMiles = rows.length ? rows[0].selectedRadiusMiles : request.maxRadius;
  const selectedZipCount = rows.length ? rows[0].selectedZipCount : 0;
  const billingClasses = [...new Set(rows.map((row) => row.billingClass).filter(Boolean))];
  const topPayers = rows
    .slice()
    .sort((a, b) => (b.localPayerMixShare || 0) - (a.localPayerMixShare || 0))
    .slice(0, 5)
    .map((row) => ({
      payerSlug: row.payerSlug,
      networkName: row.networkName,
      billingClass: row.billingClass,
      localPayerMixShare: row.localPayerMixShare,
      localAvgNegotiatedRate: row.localAvgNegotiatedRate,
      avgRatePctVsState: row.avgRatePctVsState
    }));

  return {
    address: request.address,
    stateCode: request.stateCode,
    requestedLatitude: request.latitude,
    requestedLongitude: request.longitude,
    radiusOptions: request.radiusOptions,
    selectedRadiusMiles,
    selectedZipCount,
    billingClasses,
    payerRowCount: rows.length,
    topPayers
  };
}

async function executeTicBenchmark(request, env) {
  const config = getSnowflakeConfig(env);
  const sqlText = buildTicBenchmarkSql(request);
  const initial = await submitStatement(config, sqlText);
  const statementHandle = initial.payload.statementHandle;

  if (!statementHandle) {
    throw new Error("Snowflake did not return a statement handle.");
  }

  let result = initial.payload;
  if (initial.response.status === 202 || !Array.isArray(initial.payload.data)) {
    result = await pollStatementResult(config, statementHandle);
  }

  const extraRows = await fetchAdditionalPartitions(
    config,
    statementHandle,
    result?.resultSetMetaData?.partitionInfo
  );

  if (extraRows.length) {
    result.data = [...(result.data || []), ...extraRows];
  }

  const mappedRows = mapSnowflakeRows(result);
  const normalizedRows = normalizeBenchmarkRows(mappedRows);

  return {
    statementHandle,
    sqlText,
    rowCount: normalizedRows.length,
    summary: buildBenchmarkSummary(normalizedRows, request),
    rows: normalizedRows
  };
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: JSON_HEADERS
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await parseJsonBody(request);
    const benchmarkRequest = normalizeBenchmarkRequest(body);
    const benchmark = await executeTicBenchmark(benchmarkRequest, env);

    return jsonResponse({
      success: true,
      generatedAt: new Date().toISOString(),
      ticBenchmark: {
        summary: benchmark.summary,
        rows: benchmark.rows,
        rowCount: benchmark.rowCount,
        statementHandle: benchmark.statementHandle,
        ...(benchmarkRequest.includeDebugSql ? { sql: benchmark.sqlText } : {})
      }
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message,
      details: error.payload || null
    }, getErrorStatus(error));
  }
}
