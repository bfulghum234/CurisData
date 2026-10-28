/* Specialty-only adapter. The Urgent Care report keeps its existing renderer. */
function aggregateMepsDemand(geoids, records, specialtyCount) {
  const unique = [...new Set(geoids)];
  const totals = Array(specialtyCount).fill(0);
  const warnings = Array(specialtyCount).fill(false);
  let matched = 0;
  const quality = new Set();
  for (const geoid of unique) {
    const record = records[geoid];
    if (!record || record.visits.length !== specialtyCount || record.visits.some(value => !Number.isFinite(value) || value < 0)) continue;
    matched++;
    record.visits.forEach((value, index) => {
      totals[index] += value;
      warnings[index] ||= String(record.warnings?.[index]).toLowerCase() === 'true';
    });
    for (const [key, value] of Object.entries(record.quality || {})) {
      if (value && !['false', 'none', 'published_2020_2024_acs'].includes(String(value).toLowerCase())) quality.add(`${key}: ${value}`);
    }
  }
  return { totals, warnings, matched, expected: unique.length, complete: unique.length > 0 && matched === unique.length, quality: [...quality] };
}

function buildMepsExecutiveSummary(specialties, radii, summaries) {
  const largest = summaries[summaries.length - 1];
  const maxRadius = radii[radii.length - 1];
  if (!largest?.complete) return null;
  const ranked = specialties.map((name, index) => ({ name, index, visits: largest.totals[index] }))
    .sort((a, b) => b.visits - a.visits || a.name.localeCompare(b.name));
  const number = value => Math.round(value).toLocaleString('en-US');
  const top = ranked[0];
  const findings = [
    `Largest modeled visit volumes: ${ranked.slice(0, 3).map(item => `${item.name} (${number(item.visits)})`).join('; ')} annual visits in the ${maxRadius}-mile trade area.`
  ];
  if (radii.length > 1 && summaries[0].complete) findings.push(
    `${top.name} accounts for ${number(summaries[0].totals[top.index])} modeled annual visits in the ${radii[0]}-mile area and ${number(top.visits)} in the ${maxRadius}-mile area. These nested areas overlap and are not additive.`
  );
  if (summaries.some(summary => !summary.complete)) findings.push('Some smaller-radius estimates have incomplete coverage and are unavailable in the table.');
  return {
    top, maxRadius,
    narrative: `This assessment compares ${specialties.length} physician specialties across ${radii.join('-, ')}-mile radii around the selected location. ${top.name} has the largest modeled annual visit volume in the ${maxRadius}-mile trade area, at approximately ${number(top.visits)} resident-generated visits. The following page presents all specialty estimates side by side.`,
    findings
  };
}

function renderMepsExecutive(doc, manifest, radii, summaries) {
  const narrative = doc.getElementById('meps-executive-narrative');
  if (!narrative) return;
  const summary = manifest && buildMepsExecutiveSummary(manifest.specialties, radii, summaries);
  narrative.textContent = summary?.narrative || 'Specialty demand findings are unavailable until complete MEPS coverage is available for the largest trade area.';
  for (const [id, value] of Object.entries({
    'meps-exec-count': summary ? String(manifest.specialties.length) : '—',
    'meps-exec-radius': summary ? `${summary.maxRadius}-mile` : '—',
    'meps-exec-leading-visits': summary ? Math.round(summary.top.visits).toLocaleString('en-US') : '—',
    'meps-exec-leading-name': summary ? summary.top.name : 'Annual resident-generated visits'
  })) {
    const element = doc.getElementById(id); if (element) element.textContent = value;
  }
  const list = doc.getElementById('meps-executive-findings');
  list.replaceChildren();
  for (const finding of summary?.findings || ['Review the specialty table for coverage and source availability.']) {
    const item = doc.createElement('li'); item.textContent = finding; list.appendChild(item);
  }
}

function compareCountyAges(area, county) {
  const valid = record => record && record.population > 0 && record.ages?.length === 5 &&
    record.ages.every(value => Number.isFinite(value) && value >= 0) &&
    Math.abs(record.ages.reduce((sum, value) => sum + value, 0) - record.population) < 0.01;
  if (!valid(area) || !valid(county)) return null;
  return area.ages.map((value, index) => {
    const share = 100 * value / area.population;
    const countyShare = 100 * county.ages[index] / county.population;
    return { share, countyShare, difference: share - countyShare };
  });
}

async function renderCountyAgeBenchmark(doc, radii, membership) {
  const note = doc.getElementById('county-age-source');
  if (!note) return;
  const groups = ['0-17', '18-34', '35-54', '55-64', '65plus'];
  const labels = ['0–17', '18–34', '35–54', '55–64', '65+'];
  const set = (id, text) => { const element = doc.getElementById(id); if (element) element.textContent = text; };
  try {
    const fips = [...new Set(membership.allGeoids.map(id => id.slice(0, 5)))];
    if (!fips.length) throw new Error('No trade-area block groups are available.');
    const files = await Promise.all(fips.map(async county => {
      const response = await fetch(`reports/acs2024-age/${county}.json`);
      if (!response.ok) throw new Error('County age data is unavailable.');
      return response.json();
    }));
    if (files.some(file => !file.county)) throw new Error('A county benchmark is missing.');
    const county = { population: 0, ages: Array(5).fill(0) };
    for (const file of files) {
      county.population += file.county.population;
      file.county.ages.forEach((value, index) => county.ages[index] += value);
    }
    const records = Object.assign({}, ...files.map(file => file.blockGroups));
    const areas = radii.map(radius => {
      const ids = [...new Set(membership.byRadius[`${radius}mile`] || [])];
      if (!ids.length || ids.some(id => !records[id])) return null;
      const area = { population: 0, ages: Array(5).fill(0) };
      for (const id of ids) { area.population += records[id].population; records[id].ages.forEach((value, index) => area.ages[index] += value); }
      return area;
    });
    const largest = areas[areas.length - 1];
    const comparison = compareCountyAges(largest, county);
    const countyName = files.map(file => file.county.name).join(' + ');
    set('county-age-heading', files.length === 1 ? `${countyName} %` : 'Combined Counties %');
    set('county-age-gap-heading', `${radii.at(-1)}-Mile vs County (pp)`);
    const count = value => value.toLocaleString('en-US');
    const gap = value => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
    groups.forEach((group, index) => {
      // Existing template IDs describe its first three radius slots, not the configured radius values.
      ['1mi', '3mi', '5mi'].forEach((slot, radiusIndex) => set(`age-${group}-${slot}`, areas[radiusIndex] ? count(areas[radiusIndex].ages[index]) : 'Unavailable'));
      set(`age-${group}-pct-5mi`, comparison ? `${comparison[index].share.toFixed(1)}%` : 'Unavailable');
      set(`county-age-${group}`, comparison ? `${comparison[index].countyShare.toFixed(1)}%` : 'Unavailable');
      set(`county-gap-${group}`, comparison ? gap(comparison[index].difference) : 'Unavailable');
      set(`chart-age-${group}`, largest ? count(largest.ages[index]) : 'Unavailable');
      const bar = doc.getElementById(`bar-age-${group}`);
      if (bar) bar.style.height = largest && Math.max(...largest.ages) > 0 ? `${largest.ages[index] / Math.max(...largest.ages) * 200}px` : '0px';
    });
    ['1mi', '3mi', '5mi'].forEach((slot, index) => set(`radius-label-${slot}`, String(radii[index] || '—')));
    if (!comparison) throw new Error('Complete age coverage is unavailable for the largest trade area.');
    const dominant = comparison.reduce((best, row, index) => row.share > comparison[best].share ? index : best, 0);
    const description = index => {
      const row = comparison[index];
      const direction = Math.abs(row.difference) < 0.05 ? 'essentially equal to' : `${Math.abs(row.difference).toFixed(1)} percentage points ${row.difference > 0 ? 'above' : 'below'}`;
      return `Ages ${labels[index]} represent ${row.share.toFixed(1)}% of residents, ${direction} the county share of ${row.countyShare.toFixed(1)}%.`;
    };
    set('county-age-insight', `In the ${radii.at(-1)}-mile trade area, ages ${labels[dominant]} form the largest age group (${comparison[dominant].share.toFixed(1)}%). ${description(0)} ${description(4)} These differences describe the resident age mix; compare them with the MEPS specialty visit estimates when evaluating service alignment.`);
    note.textContent = `Age profile and benchmark: Census ACS 2020–2024, B01001, from the MEPS project source files. Benchmark: ${countyName}${files.length > 1 ? ' (combined resident population of intersected counties)' : ''}. Trade-area residents: ${areas.map((area, index) => `${radii[index]}-mile ${area ? count(area.population) : 'Unavailable'}`).join('; ')}. Whole intersecting block groups are included. Differences are percentage points (pp), not tests of statistical significance.`;
    return { population: largest.population };
  } catch (error) {
    set('county-age-insight', 'A county comparison is unavailable until matching trade-area and county age data are complete.');
    note.textContent = error.message + ' No sample county comparison has been substituted.';
    for (const group of groups) { set(`county-age-${group}`, 'Unavailable'); set(`county-gap-${group}`, 'Unavailable'); }
  }
}

async function renderSpecialtyMarketContext(doc, payload, population = null) {
  const radius = payload.tradeArea.maxRadiusMiles;
  const context = payload.marketContext?.categories?.length === 5 && payload.marketContext.categories.every(category => category.available)
    ? { ...payload.marketContext, population, categories: payload.marketContext.categories.map(category => ({
        ...category, densityPer100k: population > 0 ? category.count / population * 100000 : null
      })) }
    : await collectReportMarketContext(payload.location.latitude, payload.location.longitude, radius, population);
  populateHealthcareMarketContext(doc, context);
  // The shared renderer treats null as zero; avoid a misleading zero density when coverage is missing.
  if (!(population > 0)) for (const category of context.categories) setIfExists(doc, `report-market-${category.key}-density`, '—');
  const note = doc.getElementById('report-market-context-note');
  if (note) {
    const dates = [...new Set(context.categories.filter(category => category.available && category.fetchedAt)
      .map(category => new Date(category.fetchedAt).toISOString().slice(0, 10)))];
    note.textContent += (population > 0
      ? ` Density denominator: ${population.toLocaleString('en-US')} residents, ACS 2020–2024, whole intersecting block groups; this population extends beyond the circular listing search area.`
      : ' Population coverage is unavailable; density has not been calculated.') +
      (dates.length ? ` Counts retrieved: ${dates.join(', ')}; source cache refreshes after 28 days.` : '');
  }
  return context;
}

async function renderMepsDemand(doc, payload) {
  const body = doc.getElementById('meps-specialty-rows');
  const note = doc.getElementById('meps-demand-status');
  if (!body || !note) return;
  try {
    const getJson = async url => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`MEPS source unavailable (${response.status}).`);
      return response.json();
    };
    const manifest = await getJson('reports/meps-v2.9.1/manifest.json');
    if (manifest.specialties.length !== 25) throw new Error('Expected 25 specialties in the MEPS source.');
    if (!blockGroupData) await loadBlockGroupData();
    const radii = normalizeRadii(payload.tradeArea.radiiMiles);
    const membership = getBlockGroupsByRadius(payload.location.latitude, payload.location.longitude, radii);
    const counties = [...new Set(membership.allGeoids.map(geoid => geoid.slice(0, 5)))];
    const records = Object.assign({}, ...await Promise.all(counties.map(county => getJson(`reports/meps-v2.9.1/${county}.json`))));
    const summaries = radii.map(radius => aggregateMepsDemand(membership.byRadius[`${radius}mile`] || [], records, 25));
    const heading = doc.getElementById('meps-specialty-headings');
    heading.replaceChildren();
    for (const label of ['Physician specialty', ...radii.map(radius => `${radius}-Mile Visits`)]) {
      const cell = doc.createElement('th'); cell.textContent = label; heading.appendChild(cell);
    }
    body.replaceChildren();
    manifest.specialties.forEach((name, index) => {
      const row = doc.createElement('tr');
      const label = doc.createElement('td');
      label.textContent = name + (summaries.some(summary => summary.warnings[index]) ? ' *' : '');
      row.appendChild(label);
      summaries.forEach(summary => {
        const cell = doc.createElement('td');
        cell.textContent = summary.complete ? Math.round(summary.totals[index]).toLocaleString('en-US') : 'Unavailable';
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    const coverage = summaries.map((summary, index) => `${radii[index]}-mile: ${summary.matched}/${summary.expected} block groups`).join('; ');
    const flagged = manifest.specialties.filter((name, index) => summaries.some(summary => summary.warnings[index]));
    const warnings = flagged.length ? ` * Recent-year MEPS sample support warnings: ${flagged.join('; ')}.` : '';
    const quality = [...new Set(summaries.flatMap(summary => summary.quality))];
    note.textContent = `Source: MEPS national v2.9.1; utilization reference 2024; ACS 2020–2024. Coverage: ${coverage}.${warnings}` +
      (quality.length ? ` Source flags: ${quality.join('; ')}.` : '') +
      (summaries.some(summary => !summary.complete) ? ' Incomplete coverage: affected radius estimates are unavailable.' : '');
    renderMepsExecutive(doc, manifest, radii, summaries);
    const ageBenchmark = await renderCountyAgeBenchmark(doc, radii, membership);
    await renderSpecialtyMarketContext(doc, payload, ageBenchmark?.population);
    return { manifest, radii, summaries };
  } catch (error) {
    body.replaceChildren();
    const row = doc.createElement('tr'); const cell = doc.createElement('td');
    cell.colSpan = 4; cell.textContent = 'Specialty demand unavailable'; row.appendChild(cell); body.appendChild(row);
    note.textContent = error.message + ' No urgent care demand or sample estimates have been substituted.';
    renderMepsExecutive(doc, null);
    await renderSpecialtyMarketContext(doc, payload);
    return { error: error.message };
  }
}

async function renderGoogleNeighborhood(doc, payload) {
  const status = doc.getElementById('specialty-neighborhood-status');
  const copy = doc.getElementById('specialty-neighborhood-copy');
  const meta = doc.getElementById('specialty-neighborhood-meta');
  if (!status || !copy || !meta) return;
  copy.hidden = true; meta.hidden = true; status.hidden = false;
  status.textContent = 'Loading neighborhood context from Google Maps…';
  try {
    let placeId = payload.location.placeId || window.specialtyReportPlaceId;
    if (!placeId && window.google?.maps?.Geocoder) {
      placeId = await new Promise((resolve, reject) => {
        new google.maps.Geocoder().geocode({ address: payload.location.address }, (results, resultStatus) => {
          if (resultStatus === 'OK' && results?.[0]?.place_id) resolve(results[0].place_id);
          else reject(new Error('The report address could not be resolved for neighborhood context.'));
        });
      });
    }
    if (!placeId) throw new Error('Neighborhood context is unavailable for this address.');
    const response = await fetch('/api/neighborhood-summary', {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placeId })
    });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error('Google neighborhood context is temporarily unavailable.');
    const summary = result.neighborhoodSummary;
    const text = section => section?.content?.text || section?.text || '';
    const overview = text(summary?.overview), description = text(summary?.description);
    if (!result.available || (!overview && !description)) throw new Error('Google does not currently provide neighborhood context for this address.');
    for (const [id, value] of [['specialty-neighborhood-overview', overview], ['specialty-neighborhood-description', description]]) {
      const element = doc.getElementById(id); element.textContent = value; element.hidden = !value;
    }
    doc.getElementById('specialty-neighborhood-disclosure').textContent = text(summary.disclosureText) || 'Summarized with Gemini';
    const reportLink = doc.getElementById('specialty-neighborhood-report');
    const flagUrl = summary.flagContentUri;
    reportLink.hidden = true;
    if (flagUrl && /^https:\/\//i.test(flagUrl)) { reportLink.href = flagUrl; reportLink.hidden = false; }
    status.hidden = true; copy.hidden = false; meta.hidden = false;
    return { available: true };
  } catch (error) {
    status.textContent = error.message;
    return { available: false };
  }
}

const renderBaseSpecialtyReport = renderReportPayload;
window.renderReportPayload = function(doc, reportWindow, payload, options) {
  const result = renderBaseSpecialtyReport(doc, reportWindow, payload, options);
  const download = doc.getElementById('download-btn');
  if (download) download.disabled = true;
  window.specialtyDemandReady = Promise.all([
    renderMepsDemand(doc, payload), renderGoogleNeighborhood(doc, payload)
  ]).then(([demand]) => demand).finally(() => { if (download && !window.specialtySourceLoading) download.disabled = false; });
  return result;
};
