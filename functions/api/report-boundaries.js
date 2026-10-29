// Census ACS 2024 geometry matches the report's 2020–2024 ACS vintage.
const SOURCE='https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_ACS2024/MapServer/10/query';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/geo+json','Cache-Control':status===200?'public, max-age=86400':'no-store'}});
export async function onRequestGet({request,waitUntil}) {
  const url=new URL(request.url),bounds=(url.searchParams.get('bbox')||'').split(',').map(Number);
  if(bounds.length!==4||bounds.some(n=>!Number.isFinite(n))||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||bounds[0]<-180||bounds[2]>180||bounds[1]<-85||bounds[3]>85||bounds[2]-bounds[0]>4||bounds[3]-bounds[1]>2)return json({error:'Invalid report boundary bounds.'},400);
  const cache=globalThis.caches?.default;
  if(cache){const hit=await cache.match(request);if(hit)return hit;}
  try {
    const query=async params=>{
      const target=new URL(SOURCE);for(const [key,value] of Object.entries(params))target.searchParams.set(key,String(value));
      const response=await fetch(target,{signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw new Error('Boundary source unavailable');const body=await response.json();if(body.error)throw new Error('Boundary query failed');return body;
    };
    const index=await query({f:'json',geometry:bounds.join(','),geometryType:'esriGeometryEnvelope',inSR:4326,spatialRel:'esriSpatialRelIntersects',returnIdsOnly:true});
    if(!Array.isArray(index.objectIds)||index.exceededTransferLimit)throw new Error('Incomplete boundary index');
    const ids=[...new Set(index.objectIds)].sort((a,b)=>a-b);if(ids.length>15000)throw new Error('Report area is too large');
    const features=[];
    for(let offset=0;offset<ids.length;offset+=100){
      const batch=ids.slice(offset,offset+100),data=await query({f:'geojson',objectIds:batch.join(','),outFields:'GEOID',returnGeometry:true,outSR:4326});
      if(data.exceededTransferLimit||!Array.isArray(data.features)||data.features.length!==batch.length)throw new Error('Incomplete boundary geometry');
      features.push(...data.features);
    }
    if(features.some(feature=>!/^\d{12}$/.test(feature.properties?.GEOID)||!['Polygon','MultiPolygon'].includes(feature.geometry?.type))||new Set(features.map(feature=>feature.properties.GEOID)).size!==features.length)throw new Error('Invalid boundary records');
    const result=json({type:'FeatureCollection',features,source:{name:'Census TIGERweb ACS 2024',vintage:2024,count:features.length}});
    if(cache){const write=cache.put(request,result.clone());if(waitUntil)waitUntil(write);else await write;}
    return result;
  }catch{return json({error:'Census block-group boundaries are unavailable or incomplete. Please retry.'},502);}
}
