const savedSample = {
  address: '601 Bailey Ave, Fort Worth, TX 76107, USA',
  date: 'October 29, 2026',
  narrative: 'This assessment compares 25 physician specialties across 1-, 3-, and 5-mile radii around the selected location. General practice has the largest modeled annual visit volume in the 5-mile trade area, at approximately 108,484 resident-generated visits. The following page presents all specialty estimates side by side.',
  findings: [
    'Largest modeled visit volumes: General practice (108,484); Family practice (80,799); Pediatrics (73,933) annual visits in the 5-mile trade area.',
    'General practice accounts for 6,701 modeled annual visits in the 1-mile area and 108,484 in the 5-mile area. These nested areas overlap and are not additive.'
  ],
  rows: [
    ['Allergy/immunology', '1,245', '7,662', '16,365'], ['Cardiology', '2,111', '13,171', '28,448'],
    ['Dermatology', '2,884', '14,967', '28,801'], ['ENT', '1,028', '6,323', '13,372'],
    ['Endocrinology/metabolism', '1,087', '7,305', '16,163'], ['Family practice', '5,323', '35,962', '80,799'],
    ['Gastroenterology', '1,437', '9,054', '19,555'], ['General practice', '6,701', '47,505', '108,484'],
    ['General surgery', '736', '4,744', '10,325'], ['Gynecology/obstetrics', '3,360', '22,783', '47,636'],
    ['Hematology *', '125', '832', '1,831'], ['Internal medicine', '2,468', '15,356', '33,420'],
    ['Nephrology', '685', '5,384', '13,149'], ['Neurology', '1,183', '8,074', '18,286'],
    ['Oncology', '2,065', '13,674', '30,540'], ['Ophthalmology', '4,321', '27,174', '58,510'],
    ['Orthopedics', '3,468', '21,303', '45,116'], ['Pediatrics', '2,853', '29,076', '73,933'],
    ['Physical medicine/rehabilitation *', '291', '1,675', '3,468'], ['Plastic surgery *', '165', '960', '1,979'],
    ['Psychiatry', '3,908', '27,007', '61,313'], ['Pulmonary', '390', '2,422', '5,212'],
    ['Radiology *', '361', '2,406', '5,139'], ['Rheumatology', '627', '4,047', '8,763'], ['Urology', '1,321', '7,535', '15,489']
  ],
  demographics: {
    'demo-pop-1mi': '15,876', 'demo-pop-3mi': '126,594', 'demo-pop-5mi': '293,529',
    'demo-hh-1mi': '9,141', 'demo-hh-3mi': '50,566', 'demo-hh-5mi': '109,463',
    'demo-fam-1mi': '3,320', 'demo-fam-3mi': '25,718', 'demo-fam-5mi': '62,702',
    'demo-hhsize-1mi': '1.73', 'demo-hhsize-3mi': '2.30', 'demo-hhsize-5mi': '2.55',
    'age-0-17-1mi': '1,691', 'age-0-17-3mi': '24,104', 'age-0-17-5mi': '67,573', 'age-0-17-pct-5mi': '23.0%', 'county-age-0-17': '25.4%', 'county-gap-0-17': '-2.4',
    'age-18-34-1mi': '6,051', 'age-18-34-3mi': '40,364', 'age-18-34-5mi': '83,501', 'age-18-34-pct-5mi': '28.4%', 'county-age-18-34': '24.3%', 'county-gap-18-34': '+4.1',
    'age-35-54-1mi': '3,544', 'age-35-54-3mi': '29,575', 'age-35-54-5mi': '72,556', 'age-35-54-pct-5mi': '24.7%', 'county-age-35-54': '26.6%', 'county-gap-35-54': '-1.9',
    'age-55-64-1mi': '1,862', 'age-55-64-3mi': '15,255', 'age-55-64-5mi': '31,950', 'age-55-64-pct-5mi': '10.9%', 'county-age-55-64': '11.4%', 'county-gap-55-64': '-0.5',
    'age-65plus-1mi': '2,728', 'age-65plus-3mi': '17,296', 'age-65plus-5mi': '37,949', 'age-65plus-pct-5mi': '12.9%', 'county-age-65plus': '12.3%', 'county-gap-65plus': '+0.6'
  },
  market: {
    'report-market-medical-clinics-count': '1,233', 'report-market-medical-clinics-density': '420.1',
    'report-market-physicians-count': '3,547', 'report-market-physicians-density': '1,208.4',
    'report-market-hospitals-count': '80', 'report-market-hospitals-density': '27.3',
    'report-market-pharmacies-count': '75', 'report-market-pharmacies-density': '25.6',
    'report-market-medical-labs-count': '24', 'report-market-medical-labs-density': '8.2'
  },
  economics: {
    'income-under25k': '20,008', 'income-under25k-pct': '18.3%', 'income-25k-50k': '22,650', 'income-25k-50k-pct': '20.7%',
    'income-50k-75k': '20,037', 'income-50k-75k-pct': '18.3%', 'income-75k-100k': '13,085', 'income-75k-100k-pct': '12.0%',
    'income-100k-150k': '15,857', 'income-100k-150k-pct': '14.5%', 'income-150k-plus': '17,826', 'income-150k-plus-pct': '16.3%',
    'median-income-1mi': '$95,456', 'median-income-3mi': '$73,058', 'median-income-5mi': '$64,737', 'county-median-income': '$84,207', 'state-median-income': '$78,476',
    'county-name': 'Tarrant County, Texas', 'state-name': 'Texas',
    'emp-labor-force-local': '62.0%', 'emp-labor-force-usa': '63.5% (U.S.)', 'emp-unemployment-local': '4.7%', 'emp-unemployment-usa': '5.2% (U.S.)',
    'emp-bachelors-local': '29.5%', 'emp-bachelors-usa': '35.7% (U.S.)', 'emp-hs-local': '75.4%', 'emp-hs-usa': '89.6% (U.S.)',
    'emp-mgmt-local': '34.0%', 'emp-mgmt-usa': '42.6% (U.S.)', 'housing-median-value': '$241,279', 'housing-median-rent': '$1,433', 'housing-total-units': '124,323'
  }
};

function setText(doc, id, value) {
  const element = doc.getElementById(id);
  if (element) element.textContent = value;
}

function setValues(doc, values) {
  Object.entries(values).forEach(([id, value]) => setText(doc, id, value));
}

function setBar(doc, id, value) {
  const element = doc.getElementById(id);
  if (element) element.style.height = `${value}%`;
}

function addSavedCoverMap(doc) {
  const target = doc.getElementById('report-map-embed');
  const placeholder = doc.getElementById('map-placeholder-text');
  if (!target) return;
  target.innerHTML = `
    <svg viewBox="0 0 640 540" width="100%" height="100%" role="img" aria-label="Fort Worth trade area map with 1, 3, and 5-mile rings">
      <image href="images/demo/bailey-light-basemap.png" width="640" height="540" preserveAspectRatio="xMidYMid slice"></image>
      <g fill="none" stroke="#102c23" stroke-width="8" stroke-opacity="0.8">
        <circle cx="320" cy="270" r="238"></circle><circle cx="320" cy="270" r="143"></circle><circle cx="320" cy="270" r="48"></circle>
      </g>
      <g fill="none" stroke="#3df2a1" stroke-width="4">
        <circle cx="320" cy="270" r="238"></circle><circle cx="320" cy="270" r="143"></circle><circle cx="320" cy="270" r="48"></circle>
      </g>
      <polygon points="320,252 325,264 338,264 328,272 332,285 320,277 308,285 312,272 302,264 315,264" fill="#3df2a1" stroke="#fff" stroke-width="3" stroke-linejoin="round"></polygon>
      <text x="12" y="22" font-size="12" font-weight="700" fill="#fff" stroke="#12212b" stroke-width="3" paint-order="stroke">Site ★ · 1, 3, 5-mile rings</text>
    </svg>`;
  if (placeholder) placeholder.hidden = true;
}

function populateSavedSample(doc) {
  // The report template is designed for a fixed-width preview; expand its canvas
  // inside the public iframe so its centered pages use the available viewport.
  doc.documentElement.style.width = '100%';
  doc.body.style.width = '100%';
  setText(doc, 'report-address', savedSample.address);
  setText(doc, 'report-date', savedSample.date);
  setText(doc, 'footer-date', savedSample.date);
  setText(doc, 'meps-executive-narrative', savedSample.narrative);
  setText(doc, 'meps-exec-count', '25');
  setText(doc, 'meps-exec-radius', '5-mile');
  setText(doc, 'meps-exec-leading-visits', '108,484');
  setText(doc, 'meps-exec-leading-name', 'General practice');
  setText(doc, 'specialty-neighborhood-status', 'Saved Google Maps neighborhood context');
  setText(doc, 'specialty-neighborhood-overview', 'Fort Worth\'s vibrant Cultural District surrounds world-class institutions like the Kimbell Art Museum, Modern Art Museum of Fort Worth, and the Fort Worth Botanic Garden.');
  setText(doc, 'specialty-neighborhood-description', 'Local dining ranges from Texas barbecue at Terry Black\'s Barbecue to specialty burgers at Rodeo Goat and Tex-Mex favorites at Chuy\'s. Essential shopping is available nearby at Montgomery Plaza, while Dickies Arena, Will Rogers Memorial Center, and Trinity Park offer major events and recreation.');
  const neighborhoodCopy = doc.getElementById('specialty-neighborhood-copy');
  if (neighborhoodCopy) neighborhoodCopy.hidden = false;
  setText(doc, 'meps-demand-status', 'Saved sample data: MEPS national v2.9.1 utilization reference 2024; ACS 2020-2024. Values are fixed for this Fort Worth example and are not recalculated when opened.');
  setValues(doc, savedSample.demographics);
  setValues(doc, savedSample.market);
  setValues(doc, savedSample.economics);
  setText(doc, 'county-age-heading', 'Tarrant County, TX %');
  setText(doc, 'county-age-gap-heading', '5-Mile vs County (pp)');
  setText(doc, 'county-age-insight', 'In the 5-mile trade area, ages 18-34 form the largest age group (28.4%). Ages 0-17 represent 23.0% of residents, 2.4 percentage points below the county share of 25.4%. Ages 65+ represent 12.9% of residents, 0.6 percentage points above the county share of 12.3%. These differences describe the resident age mix; compare them with the specialty visit estimates when evaluating service alignment.');
  setText(doc, 'report-data-coverage', 'Saved source coverage: Census ACS 2020-2024. 1-mile 14/14, 3-mile 88/88, and 5-mile 196/196 current block groups. Whole intersecting block groups are included.');
  setText(doc, 'county-age-source', 'Saved age profile and benchmark: Census ACS 2020-2024, B01001. Benchmark: Tarrant County, TX. Differences are percentage points, not tests of statistical significance.');
  setText(doc, 'report-market-context-note', 'Saved Google Maps healthcare listings for the 5-mile trade area: 5 of 5 categories loaded. Density is listings per 100,000 residents. Directory listings are not licensed-facility or clinician rosters.');
  setText(doc, 'economic-insight', 'The estimated median household income is $64,737, 23.1% below Tarrant County, Texas ($84,207). Labor force participation is 62.0%; unemployment is 4.7%. These measures describe residents and do not establish practice revenue or payer mix.');
  setText(doc, 'economic-source-note', 'Saved ACS 2020-2024 data: income, employment, education, occupation, and housing. Local medians are interpolated from summed distribution bins.');
  [['bar-age-0-17', 46], ['bar-age-18-34', 57], ['bar-age-35-54', 49], ['bar-age-55-64', 22], ['bar-age-65plus', 26], ['bar-median-income-1mi', 95], ['bar-median-income-3mi', 73], ['bar-median-income-5mi', 65], ['bar-county-income', 84], ['bar-state-income', 78]].forEach(([id, value]) => setBar(doc, id, value));
  setValues(doc, {'chart-age-0-17': '23.0%', 'chart-age-18-34': '28.4%', 'chart-age-35-54': '24.7%', 'chart-age-55-64': '10.9%', 'chart-age-65plus': '12.9%'});

  const findings = doc.getElementById('meps-executive-findings');
  if (findings) {
    findings.replaceChildren(...savedSample.findings.map(text => {
      const item = doc.createElement('li');
      item.textContent = text;
      return item;
    }));
  }

  const table = doc.getElementById('meps-specialty-rows');
  if (table) {
    table.replaceChildren(...savedSample.rows.map(row => {
      const tr = doc.createElement('tr');
      row.forEach(value => {
        const td = doc.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      return tr;
    }));
  }

  addSavedCoverMap(doc);
  doc.querySelectorAll('#pdf-root > .page').forEach((page, index) => {
    page.hidden = ![0, 1, 2, 3, 4, 5, 9, 10].includes(index);
  });
}

const savedSampleFrame = document.getElementById('report-iframe');
savedSampleFrame.addEventListener('load', () => populateSavedSample(savedSampleFrame.contentDocument));
