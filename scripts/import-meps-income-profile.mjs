import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const project=process.argv[2];if(!project)throw new Error('Supply the MEPS project root.');
const source=path.join(project,'data/raw/census/national-2020-2024/state-48');
const bytes=await fs.readFile(path.join(source,'C17002.dat'));
const receipt=JSON.parse(await fs.readFile(path.join(source,'C17002-source.json'),'utf8'));
const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha256!==receipt.extract_sha256)throw new Error('Income source hash mismatch.');
const [header,...lines]=bytes.toString('utf8').trim().split(/\r?\n/);const fields=header.split('|');const rows=new Map();
for(const line of lines){const values=line.split('|'),id=values[0].split('US')[1];const bins=Array.from({length:8},(_,i)=>Number(values[fields.indexOf(`C17002_E${String(i+1).padStart(3,'0')}`)]));if(bins.every(value=>Number.isFinite(value)&&value>=0)&&bins.slice(1).reduce((sum,n)=>sum+n,0)===bins[0])rows.set(id,bins);}
const records={};let tractFallbacks=0,noPopulation=0;
const counties=[...new Set([...rows.keys()].filter(id=>id.length===12).map(id=>id.slice(0,5)))];
for(const county of counties){const ages=JSON.parse(await fs.readFile(`reports/acs2024-age/${county}.json`,'utf8'));
 for(const [id,population] of Object.entries(ages.blockGroups)){
  let income=rows.get(id),basis='block-group';
  if(!(income?.[0]>0)){
   if(population.population===0){records[id]={share:null,basis:'no-population',denominator:0};noPopulation++;continue;}
   income=rows.get(id.slice(0,11));basis='parent-tract';
  }
  if(income?.[0]>0){records[id]={share:100*income[7]/income[0],basis,denominator:income[0]};if(basis==='parent-tract')tractFallbacks++;}
  else records[id]={share:null,basis:'unavailable',denominator:null};
 }
}
await fs.mkdir('reports/acs2024-income',{recursive:true});
await fs.writeFile('reports/acs2024-income/48.json',JSON.stringify({table:'C17002',period:'2020–2024',measure:'Share at or above 200% of the poverty threshold',universe:'Population for whom poverty status is determined',sourceSha256:sha256,sourceUrl:receipt.url,records}));
console.log(JSON.stringify({blockGroups:Object.keys(records).length,tractFallbacks,noPopulation,unavailable:Object.values(records).filter(record=>record.basis==='unavailable').length}));
