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
  ]
};

function setText(doc, id, value) {
  const element = doc.getElementById(id);
  if (element) element.textContent = value;
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
  setText(doc, 'specialty-neighborhood-status', 'This saved sample focuses on the population-based specialty demand measures below.');
  setText(doc, 'meps-demand-status', 'Saved sample data: MEPS national v2.9.1 utilization reference 2024; ACS 2020-2024. Values are fixed for this Fort Worth example and are not recalculated when opened.');

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
    page.hidden = ![0, 1, 2, 9, 10].includes(index);
  });
}

const savedSampleFrame = document.getElementById('report-iframe');
savedSampleFrame.addEventListener('load', () => populateSavedSample(savedSampleFrame.contentDocument));
