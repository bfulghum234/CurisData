import fs from 'node:fs';
import fsp from 'node:fs/promises';
import readline from 'node:readline';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.argv[2];
if (!root) throw new Error('Supply the MEPS project root.');
const target = 'reports/acs2024-age';
if (fs.existsSync(target)) throw new Error('Preserve existing imported snapshot.');
const names = new Map();
const countyCsv = await fsp.readFile(path.join(root, 'exports/national-v2.9.1-wide/county-specialty-wide.csv'), 'utf8');
for (const line of countyCsv.split(/\r?\n/).slice(1)) {
  const match = line.match(/^(\d{5}),"([^"]+)"/);
  if (match) names.set(match[1], match[2]);
}
const sourceRoot = path.join(root, 'data/raw/census/national-2020-2024');
const states = (await fsp.readdir(sourceRoot)).filter(name => /^state-\d{2}$/.test(name));
await fsp.mkdir(target, { recursive: true });
const sources = []; let countyCount = 0, bgCount = 0;
const bands = [[3,6,27,30],[7,12,31,36],[13,16,37,40],[17,19,41,43],[20,25,44,49]];
for (const state of states) {
  const directory = path.join(sourceRoot, state);
  const receipt = JSON.parse(await fsp.readFile(path.join(directory, 'B01001-source.json'), 'utf8'));
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(path.join(directory, 'B01001.dat'));
  stream.on('data', chunk => hash.update(chunk));
  const counties = new Map(); let headers;
  for await (const line of readline.createInterface({ input: stream, crlfDelay: Infinity })) {
    if (!headers) { headers = line.split('|'); continue; }
    const cells = line.split('|'); const geo = cells[0].replaceAll('"', '');
    if (!/^(0500000US\d{5}|1500000US\d{12})$/.test(geo)) continue;
    const id = geo.split('US')[1];
    const get = index => {
      const raw = cells[headers.indexOf(`B01001_E${String(index).padStart(3, '0')}`)];
      return raw?.trim() ? Number(raw) : NaN;
    };
    const population = get(1);
    const ages = bands.map(([a,b,c,d]) => [...Array(b-a+1)].map((_,i)=>get(a+i)).concat([...Array(d-c+1)].map((_,i)=>get(c+i))).reduce((sum,n)=>sum+n,0));
    if (!Number.isFinite(population) || population < 0 || ages.some(n => !Number.isFinite(n) || n < 0)) continue;
    if (ages.reduce((sum,n)=>sum+n,0) !== population) throw new Error('Age totals do not reconcile: ' + id);
    const fips = id.slice(0,5);
    if (!counties.has(fips)) counties.set(fips, { county: null, blockGroups: {} });
    const result = counties.get(fips);
    if (id.length === 5) { result.county = { name: names.get(id) || `County ${id}`, population, ages }; countyCount++; }
    else { result.blockGroups[id] = { population, ages }; bgCount++; }
  }
  const sha256 = hash.digest('hex');
  if (sha256 !== receipt.extract_sha256) throw new Error('Source hash mismatch: ' + state);
  for (const [fips, data] of counties) await fsp.writeFile(`${target}/${fips}.json`, JSON.stringify(data));
  sources.push({ state, sha256, url: receipt.url, retrievedUtc: receipt.retrieved_utc });
}
await fsp.writeFile(`${target}/manifest.json`, JSON.stringify({ table: 'B01001', period: '2020–2024', universe: 'Total resident population', ageGroups: ['0-17','18-34','35-54','55-64','65+'], countyCount, bgCount, sources }, null, 2));
console.log(JSON.stringify({ counties: countyCount, blockGroups: bgCount, states: states.length }));
