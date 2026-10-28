export async function onRequestPost({request,env={}}) {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
  try {
    const {address}=await request.json();
    if(typeof address!=='string'||address.trim().length<5||address.length>300) return new Response(JSON.stringify({error:'Enter a valid report address.'}),{status:400,headers});
    if(!env.GOOGLE_MAPS_API_KEY)throw new Error('Address lookup unavailable.');
    const url=new URL('https://maps.googleapis.com/maps/api/geocode/json');url.searchParams.set('address',address);url.searchParams.set('key',env.GOOGLE_MAPS_API_KEY);
    const result=await(await fetch(url,{signal:AbortSignal.timeout(20000)})).json();
    const place=result.results?.[0];if(result.status!=='OK'||!place)throw new Error('The address could not be located.');
    return new Response(JSON.stringify({address:place.formatted_address,latitude:place.geometry.location.lat,longitude:place.geometry.location.lng,
      placeId:place.place_id,stateCode:place.address_components.find(component=>component.types.includes('administrative_area_level_1'))?.short_name}),{headers});
  }catch(error){return new Response(JSON.stringify({error:'Address lookup unavailable or address not found.'}),{status:502,headers});}
}
