let specialtyReportStarted=false;
async function loadSourceSpecialtyReport() {
  if(specialtyReportStarted)return;specialtyReportStarted=true;
  window.specialtySourceLoading=true;
  const frame=document.getElementById('report-iframe'),status=document.getElementById('status');
  const doc=frame.contentDocument;
  const button=doc.getElementById('download-btn');if(button)button.disabled=true;
  const unavailable=message=>{
    status.textContent=message+' No sample data has been substituted.';
    doc.querySelectorAll('td[id],.value[id],.bar-value[id]').forEach(element=>element.textContent='Unavailable');
    for(const id of ['meps-executive-narrative','county-age-insight','economic-insight','growth-insight','income-map-insight','population-map-insight','report-data-coverage','county-age-source','meps-demand-status']){
      const element=doc.getElementById(id);if(element)element.textContent='Unavailable: '+message;
    }
    doc.querySelectorAll('[id$="placeholder"],[id$="placeholder-text"]').forEach(element=>element.textContent='Map unavailable');
  };
  try {
    const params=new URLSearchParams(location.search);
    const address=params.get('address')||document.getElementById('address-input').value;
    const radii=normalizeRadii((params.get('radii')||'1,3,5').split(','));
    if(radii.length!==3||radii.some(radius=>radius>20))throw new Error('Choose three distinct radii between 1 and 20 miles.');
    status.textContent='Resolving the selected address…';
    const locationResponse=await fetch('/api/report-location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});
    const site=await locationResponse.json();if(!locationResponse.ok)throw new Error(site.error||'Address lookup unavailable.');
    window.specialtyReportPlaceId=site.placeId;document.getElementById('address-input').value=site.address;
    status.textContent='Loading trade-area boundaries and Census sources…';
    await loadBlockGroupData();
    const membership=getBlockGroupsByRadius(site.latitude,site.longitude,radii);
    if(!membership.allGeoids.length)throw new Error('Boundary coverage is unavailable for this location; the current boundary source supports Texas.');
    const counties=[...new Set(membership.allGeoids.map(id=>id.slice(0,5)))];
    const source=await Promise.all(counties.map(async countyFips=>{
      const response=await fetch('/api/specialty-demographics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({countyFips}),signal:AbortSignal.timeout(120000)});
      const result=await response.json();if(!response.ok||!result.success)throw new Error('Census sources could not be loaded.');return result;
    }));
    const current=Object.assign({},...source.map(item=>item.current));
    const demographicsByRadius=Object.fromEntries(radii.map(radius=>{
      const ids=membership.byRadius[`${radius}mile`],area=aggregateAcs(current,ids);
      return [`${radius}mile`,{...area,sourceCoverage:{matched:ids.filter(id=>current[id]).length,total:ids.length},employment:{},housing:{},income:{}}];
    }));
    const payload=buildReportPayload({...site,radiiMiles:radii,demographicsByRadius});
    payload.reportType='physician-specialty-demand-assessment';
    status.textContent='Rendering source-backed demographics, MEPS specialty estimates and Google context…';
    renderReportPayload(doc,frame.contentWindow,payload);
    const census=await renderCensusSections(doc,payload,source,membership);
    await window.specialtyDemandReady;
    for(const id of ['report-date','footer-date']){const element=doc.getElementById(id);if(element)element.textContent=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
    window.liveReportPayload=payload;window.specialtyCensusResult=census;
    status.textContent='Report loaded from Census, MEPS and Google sources.'+
      (census.errors.length?' Some Census requests were unavailable; affected metrics are marked in the report.':'')+
      (!doc.getElementById('growth-projections-page')?.hidden && !Number.isFinite(census.growth.future)?' Matched historical coverage is incomplete; affected projections show Unavailable.':'');
    window.specialtySourceLoading=false;if(button)button.disabled=false;
  }catch(error){unavailable(error.message);window.specialtySourceLoading=false;if(button)button.disabled=false;}
}
const specialtyFrame=document.getElementById('report-iframe');
function fitSpecialtyReport(){specialtyFrame.contentDocument?.documentElement.style.setProperty('--report-preview-scale',String(Math.min(1,specialtyFrame.clientWidth/816)));}
specialtyFrame.addEventListener('load',()=>{fitSpecialtyReport();loadSourceSpecialtyReport();});
new ResizeObserver(fitSpecialtyReport).observe(specialtyFrame);
if(specialtyFrame.contentDocument?.readyState==='complete'&&specialtyFrame.contentDocument.getElementById('pdf-root'))loadSourceSpecialtyReport();
