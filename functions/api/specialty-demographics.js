const series = (table, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${table}_${String(from + i).padStart(3, '0')}E`);
const employment = ['B23025_001E','B23025_002E','B23025_003E','B23025_005E',
  'B15003_001E', ...series('B15003',17,25), 'C24010_001E','C24010_003E','C24010_039E'];
const common = ['B01001_001E','B11001_001E','B11001_002E','B19301_001E', ...series('B19001',1,17)];
const currentFields = [...common, ...series('B01001',2,49), 'B19013_001E','B11002_001E','B25001_001E', ...series('B25075',1,27), ...series('B25063',1,27), ...employment];
const priorFields = [...common, ...series('B01001',2,49)];
const requests = new Map();
async function census(year, fields, geography, key) {
  const identity = JSON.stringify([year,fields,geography]);
  const existing = requests.get(identity);
  if (existing && Date.now() - existing.at < 3600000) return existing.promise;
  const promise = (async () => {
    const url = new URL(`https://api.census.gov/data/${year}/acs/acs5`);
    url.searchParams.set('get', ['NAME', ...fields].join(','));
    for (const [name,value] of Object.entries(geography)) url.searchParams.set(name,value);
    if (key) url.searchParams.set('key',key);
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`Census ${year} source unavailable (${response.status}).`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !Array.isArray(rows[0])) throw new Error(`Invalid Census ${year} response.`);
    return rows.slice(1).map(row => Object.fromEntries(rows[0].map((field,index) => [field,row[index]])));
  })();
  requests.set(identity,{at:Date.now(),promise});
  try { return await promise; } catch(error) { requests.delete(identity); throw error; }
}
export async function onRequestPost({request,env={}}) {
  const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
  try {
    const body = await request.json();
    if (!/^\d{5}$/.test(body.countyFips || '')) return new Response(JSON.stringify({error:'A five-digit countyFips is required.'}),{status:400,headers});
    const state=body.countyFips.slice(0,2), county=body.countyFips.slice(2);
    const key=env.CENSUS_API_KEY || '';
    const errors=[];
    async function read(year,fields,geography) {
      try { return await census(year,fields,geography,key); }
      catch(error) { errors.push(`ACS ${year}: source request failed or unavailable.`); return []; }
    }
    async function blockGroups(year,fields) {
      const parts=[];
      for(let i=0;i<fields.length;i+=40) parts.push(fields.slice(i,i+40));
      const batches=await Promise.all(parts.map(part=>read(year,part,{'for':'block group:*','in':`state:${state} county:${county} tract:*`})));
      const records={};
      for(const rows of batches) for(const row of rows) {
        const id=row.state+row.county+row.tract+row['block group'];
        records[id] ||= {};
        for(const field of fields) if(Object.hasOwn(row,field)) {
          const value=row[field] === null || row[field] === '' ? NaN : Number(row[field]);
          records[id][field]=Number.isFinite(value)&&value>=0?value:null;
        }
      }
      return records;
    }
    const [current,prior,countyRows,stateRows,nationalRows]=await Promise.all([
      blockGroups(2024,currentFields),blockGroups(2019,priorFields),
      read(2024,['B19013_001E'],{'for':`county:${county}`,'in':`state:${state}`}),
      read(2024,['B19013_001E'],{'for':`state:${state}`}),
      read(2024,employment,{'for':'us:*'})
    ]);
    return new Response(JSON.stringify({success:true,countyFips:body.countyFips,current,prior,
      county:countyRows[0]||null,state:stateRows[0]||null,national:nationalRows[0]||null,
      currentPeriod:'2020–2024',priorPeriod:'2015–2019',fetchedAt:new Date().toISOString(),errors}),{headers});
  } catch(error) { return new Response(JSON.stringify({success:false,error:'Demographic sources could not be loaded.'}),{status:502,headers}); }
}
