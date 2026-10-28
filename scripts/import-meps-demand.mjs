import fs from 'node:fs';
import fsp from 'node:fs/promises';
import readline from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';

const source = process.argv[2];
if (!source) throw new Error('Supply the MEPS national-v2.9.1-wide export directory.');
const destination = 'reports/meps-v2.9.1';
if (fs.existsSync(destination)) throw new Error('Destination already exists; preserve the imported snapshot.');
const mapping = JSON.parse(await fsp.readFile(path.join(source, 'specialty-columns.json'), 'utf8'));
const specialties = Object.keys(mapping);
if (specialties.length !== 25) throw new Error('Expected 25 specialties.');
function parse(line) {
  const cells = []; let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value); value = ''; }
    else value += char;
  }
  cells.push(value); return cells;
}
const csvPath = path.join(source, 'blockgroup-specialty-wide.csv');
const hash = crypto.createHash('sha256');
let columns, count = 0;
const counties = new Map();
const stream = fs.createReadStream(csvPath);
stream.on('data', chunk => hash.update(chunk));
for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
  if (!columns) { columns = parse(line); continue; }
  if (!line) continue;
  const cells = parse(line);
  const field = name => cells[columns.indexOf(name)];
  const geoid = field('geography_id');
  if (!/^\d{12}$/.test(geoid) || field('scenario') !== 'standard') throw new Error('Invalid source key/scenario.');
  const visits = specialties.map(name => {
    const raw = field(mapping[name].estimated_visits);
    const number = Number(raw);
    if (raw === '' || !Number.isFinite(number) || number < 0) throw new Error('Invalid visits: ' + geoid);
    return number;
  });
  const county = geoid.slice(0, 5);
  if (!counties.has(county)) counties.set(county, {});
  const records = counties.get(county);
  if (records[geoid]) throw new Error('Duplicate GEOID: ' + geoid);
  records[geoid] = { visits,
    warnings: specialties.map(name => field(mapping[name].recent_sample_warning)),
    quality: Object.fromEntries(['geography_context_flag', 'demographic_input_status', 'acs_suppression_flag', 'reconstruction_weight_basis'].map(name => [name, field(name)])) };
  count++;
}
if (count !== 239781 || counties.size !== 3144) throw new Error('Unexpected national coverage.');
await fsp.mkdir(destination, { recursive: true });
for (const [county, records] of counties) await fsp.writeFile(`${destination}/${county}.json`, JSON.stringify(records));
await fsp.writeFile(`${destination}/manifest.json`, JSON.stringify({ release: 'national-v2.9.1', specialties,
  blockGroups: count, counties: counties.size, sourceSha256: hash.digest('hex'),
  acsPeriod: '2020–2024', utilizationReferenceYear: 2024,
  measure: 'Modeled annual resident-generated visits; not observed local visits or unmet need.',
  allocation: 'Whole intersecting block groups; no fractional allocation.',
  sourceFile: 'blockgroup-specialty-wide.csv' }, null, 2));
console.log(`Imported ${count} block groups, ${counties.size} counties, ${specialties.length} specialties.`);
