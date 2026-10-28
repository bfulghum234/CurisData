export async function onRequestGet({request,env={}}) {
  try {
    const params=new URL(request.url).searchParams;
    const lat=Number(params.get('lat')),lng=Number(params.get('lng')),zoom=Number(params.get('zoom'));
    if(!params.has('lat')||!params.has('lng')||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180||!Number.isInteger(zoom)||zoom<1||zoom>20)
      return new Response('Invalid map bounds.',{status:400});
    if(!env.GOOGLE_MAPS_API_KEY)throw new Error('Map configuration unavailable');
    const url=new URL('https://maps.googleapis.com/maps/api/staticmap');
    for(const [key,value] of Object.entries({center:`${lat},${lng}`,zoom,size:'640x540',scale:2,maptype:'roadmap',key:env.GOOGLE_MAPS_API_KEY}))url.searchParams.set(key,String(value));
    const light=params.get('theme')==='light';
    for(const style of light ? [
      'element:geometry|color:0xeeeeee','element:labels.text.fill|color:0x555b60','element:labels.text.stroke|color:0xffffff',
      'feature:poi|visibility:off','feature:transit|visibility:off','feature:water|element:geometry|color:0xd4dfe3',
      'feature:road.local|element:geometry|color:0xffffff','feature:road.local|element:labels|visibility:off',
      'feature:road.arterial|element:geometry|color:0xc5c9cb','feature:road.highway|element:geometry|color:0xaeb5b8',
      'feature:road.highway|element:labels.text.fill|color:0x454b4e','feature:administrative.locality|element:labels.text.fill|color:0x303a3f'
    ] : [
      'element:geometry|color:0x192a33','element:labels.text.fill|color:0xb7c9cf','element:labels.text.stroke|color:0x12212b',
      'feature:poi|visibility:off','feature:transit|visibility:off','feature:water|element:geometry|color:0x0b1721',
      'feature:road.local|element:geometry|color:0x344850','feature:road.local|element:labels|visibility:off',
      'feature:road.arterial|element:geometry|color:0x64747a','feature:road.highway|element:geometry|color:0xb0a075',
      'feature:road.highway|element:labels.text.fill|color:0xffedb5','feature:administrative.locality|element:labels.text.fill|color:0xf3fff8'
    ])url.searchParams.append('style',style);
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Basemap unavailable');
    return new Response(response.body,{headers:{'Content-Type':response.headers.get('content-type'),'Cache-Control':'no-store'}});
  }catch{return new Response('Basemap temporarily unavailable.',{status:503});}
}
