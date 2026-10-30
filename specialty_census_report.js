const ACS_INCOME_BOUNDS=[0,10000,15000,20000,25000,30000,35000,40000,45000,50000,60000,75000,100000,125000,150000,200000,Infinity];
const ACS_HOME_BOUNDS=[0,10000,15000,20000,25000,30000,35000,40000,50000,60000,70000,80000,90000,100000,125000,150000,175000,200000,250000,300000,400000,500000,750000,1000000,1500000,2000000,Infinity];
const ACS_RENT_BOUNDS=[0,100,150,200,250,300,350,400,450,500,550,600,650,700,750,800,900,1000,1250,1500,2000,2500,3000,3500,Infinity];
function acsField(table,index){return `${table}_${String(index).padStart(3,'0')}E`;}
function sumAcs(records,ids,fields) {
  if(!ids.length) return NaN;
  let total=0;
  for(const id of new Set(ids)) for(const field of fields) {
    const value=records[id]?.[field];
    if(typeof value!=='number'||!Number.isFinite(value)||value<0) return NaN;
    total+=value;
  }
  return total;
}
function groupedMedian(counts,bounds) {
  if(counts.some(value=>!Number.isFinite(value)||value<0)) return NaN;
  const total=counts.reduce((sum,value)=>sum+value,0);
  if(!(total>0)) return NaN;
  let cumulative=0;
  for(let i=0;i<counts.length;i++) {
    if(cumulative+counts[i]>=total/2 && counts[i]>0) {
      if(!Number.isFinite(bounds[i+1])) return NaN;
      return bounds[i]+(total/2-cumulative)/counts[i]*(bounds[i+1]-bounds[i]);
    }
    cumulative+=counts[i];
  }
  return NaN;
}
function projectAcs(current,prior) {
  if(!Number.isFinite(current)||!Number.isFinite(prior)||!(prior>0)||current<0) return {future:NaN,cagr:NaN,change:NaN};
  const cagr=(current/prior)**(1/5)-1;
  const future=current*(1+cagr)**5;
  return {future,cagr,change:future-current};
}
function aggregateAcs(records,ids) {
  const sum=(table,indices)=>sumAcs(records,ids,indices.map(index=>acsField(table,index)));
  const range=(start,end)=>Array.from({length:end-start+1},(_,i)=>start+i);
  const ratio=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?100*a/b:NaN;
  const population=sum('B01001',[1]),households=sum('B11001',[1]);
  const incomeBins=range(2,17).map(index=>sum('B19001',[index]));
  const education=sum('B15003',[1]);
  let perCapitaIncome=NaN;
  if(population>0) {
    let totalIncome=0,valid=true;
    for(const id of ids){const r=records[id];if(r?.B01001_001E===0)continue;if(!Number.isFinite(r?.B19301_001E)||!Number.isFinite(r?.B01001_001E)) {valid=false;break;}totalIncome+=r.B19301_001E*r.B01001_001E;}
    if(valid)perCapitaIncome=totalIncome/population;
  }
  return {population,households,families:sum('B11001',[2]),householdSize:households>0?sum('B11002',[1])/households:NaN,
    medianIncome:groupedMedian(incomeBins,ACS_INCOME_BOUNDS),incomeBins,perCapitaIncome,
    housingUnits:sum('B25001',[1]),homeValue:groupedMedian(range(2,27).map(i=>sum('B25075',[i])),ACS_HOME_BOUNDS),
    rent:groupedMedian(range(3,26).map(i=>sum('B25063',[i])),ACS_RENT_BOUNDS),
    employment:[ratio(sum('B23025',[2]),sum('B23025',[1])),ratio(sum('B23025',[5]),sum('B23025',[3])),
      ratio(sum('B15003',range(22,25)),education),ratio(sum('B15003',range(17,25)),education),ratio(sum('C24010',[3,39]),sum('C24010',[1]))],
    ages:[[3,6,27,30],[7,12,31,36],[13,16,37,40],[17,19,41,43],[20,25,44,49]].map(([a,b,c,d])=>sum('B01001',[...range(a,b),...range(c,d)]))};
}

async function renderCensusSections(doc,payload,source,membership) {
  const radii=payload.tradeArea.radiiMiles;
  const current=Object.assign({},...source.map(item=>item.current));
  const prior=Object.assign({},...source.map(item=>item.prior));
  const areas=radii.map(radius=>aggregateAcs(current,membership.byRadius[`${radius}mile`]||[]));
  const historical=radii.map(radius=>aggregateAcs(prior,membership.byRadius[`${radius}mile`]||[]));
  const max=areas.at(-1),old=historical.at(-1);
  const fmt=value=>Number.isFinite(value)?Math.round(value).toLocaleString('en-US'):'Unavailable';
  const pct=value=>Number.isFinite(value)?`${value.toFixed(1)}%`:'Unavailable';
  const money=value=>Number.isFinite(value)?`$${fmt(value)}`:'Unavailable';
  const set=(id,text)=>{const el=doc.getElementById(id);if(el)el.textContent=text;};
  const change=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&b>0?pct((a/b-1)*100):'Unavailable';
  ['1mi','3mi','5mi'].forEach((slot,index)=>{
    const area=areas[index],before=historical[index];if(!area)return;
    for(const [id,value] of [[`demo-pop-${slot}`,area.population],[`demo-hh-${slot}`,area.households],[`demo-fam-${slot}`,area.families]])set(id,fmt(value));
    set(`demo-hhsize-${slot}`,Number.isFinite(area.householdSize)?area.householdSize.toFixed(2):'Unavailable');
    set(`median-income-${slot}`,money(area.medianIncome));
    const forecast=projectAcs(area.population,before.population);
    set(`proj-pop-${slot}-current`,fmt(area.population));set(`pop-proj-${slot}`,fmt(forecast.future));set(`pop-change-${slot}`,fmt(forecast.change));set(`pop-cagr-${slot}`,pct(forecast.cagr*100));
    const forecastRow=doc.getElementById(`proj-pop-${slot}-current`)?.parentElement;
    if(forecastRow)forecastRow.firstElementChild.textContent=`${radii[index]}-Mile`;
  });
  const sumBins=(a,b)=>{const values=max.incomeBins.slice(a,b);return values.every(Number.isFinite)?values.reduce((sum,n)=>sum+n,0):NaN;};
  [['under25k',0,4],['25k-50k',4,9],['50k-75k',9,11],['75k-100k',11,12],['100k-150k',12,14],['150k-plus',14,16]].forEach(([label,a,b])=>{
    const value=sumBins(a,b);set(`income-${label}`,fmt(value));set(`income-${label}-pct`,max.households>0?pct(value/max.households*100):'Unavailable');
  });
  const validMedian=value=>value!==null&&value!==undefined&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):NaN;
  const county=source.length===1?source[0].county:null;
  const states=[...new Set(source.map(item=>item.countyFips.slice(0,2)))];
  const state=states.length===1?source[0].state:null;
  const countyIncome=validMedian(county?.B19013_001E),stateIncome=validMedian(state?.B19013_001E);
  set('county-median-income',money(countyIncome));set('county-name',county?.NAME||'County benchmark unavailable');
  set('state-median-income',money(stateIncome));set('state-name',state?.NAME||'State benchmark unavailable');
  const incomeValues=[...areas.map(area=>area.medianIncome),countyIncome,stateIncome];
  const ceiling=Math.max(0,...incomeValues.filter(Number.isFinite));
  ['bar-median-income-1mi','bar-median-income-3mi','bar-median-income-5mi','bar-county-income','bar-state-income'].forEach((id,index)=>{
    const bar=doc.getElementById(id);if(bar)bar.style.height=Number.isFinite(incomeValues[index])&&ceiling>0?`${incomeValues[index]/ceiling*200}px`:'0px';
  });
  let national={employment:Array(5).fill(NaN)};
  if(source[0]?.national) national=aggregateAcs({'us':Object.fromEntries(Object.entries(source[0].national).map(([key,value])=>[key,value!==null&&value!==''&&Number(value)>=0?Number(value):null]))},['us']);
  ['labor-force','unemployment','bachelors','hs','mgmt'].forEach((key,index)=>{set(`emp-${key}-local`,pct(max.employment[index]));set(`emp-${key}-usa`,`${pct(national.employment[index])} (U.S.)`);});
  set('housing-median-value',money(max.homeValue));set('housing-median-rent',money(max.rent));set('housing-total-units',fmt(max.housingUnits));
  for(const [label,key,format] of [['hh','households',fmt],['fam','families',fmt],['med-inc','medianIncome',money],['per-capita','perCapitaIncome',money]]) {
    const forecast=projectAcs(max[key],old[key]);set(`${label}-proj-current`,format(max[key]));set(`${label}-proj-future`,format(forecast.future));set(`${label}-proj-change`,change(forecast.future,max[key]));
    if(label==='per-capita'){set('per-capita-current',format(max[key]));set('per-capita-future',format(forecast.future));set('per-capita-change',change(forecast.future,max[key]));}
  }
  const ageKeys=['0-17','18-34','35-54','55-64','65plus'];
  const agePredictions=max.ages.map((value,index)=>projectAcs(value,old.ages[index]).future);
  const futureAgeTotal=agePredictions.every(Number.isFinite)?agePredictions.reduce((sum,value)=>sum+value,0):NaN;
  ageKeys.forEach((key,index)=>{
    const currentShare=max.population>0?100*max.ages[index]/max.population:NaN;
    const futureShare=futureAgeTotal>0?100*agePredictions[index]/futureAgeTotal:NaN;
    set(`age-shift-${key}-curr`,pct(currentShare));set(`age-shift-${key}-proj`,pct(futureShare));set(`age-shift-${key}-trend`,Number.isFinite(futureShare)?`${(futureShare-currentShare).toFixed(1)} pp`:'Unavailable');
  });
  const comparison=Number.isFinite(max.medianIncome)&&countyIncome>0?`The estimated median household income is ${money(max.medianIncome)}, ${Math.abs(max.medianIncome/countyIncome*100-100).toFixed(1)}% ${max.medianIncome>=countyIncome?'above':'below'} ${county.NAME} (${money(countyIncome)}).`:'A complete household income comparison is unavailable for this trade area.';
  set('economic-insight',`${comparison} Labor force participation is ${pct(max.employment[0])}; unemployment is ${pct(max.employment[1])}. These measures describe residents and do not establish practice revenue or payer mix.`);
  const growth=projectAcs(max.population,old.population);
  set('growth-insight',Number.isFinite(growth.future)?`Continuing the annualized change between ACS 2015–2019 and 2020–2024 produces a 2029 population scenario of ${fmt(growth.future)}, versus the 2024 baseline of ${fmt(max.population)} (${change(growth.future,max.population)}). This is a trend continuation scenario, not an observed future population or validated forecast.`:'The historical block-group coverage needed for a matched growth comparison is incomplete. Future population, household, income and age-shift results are unavailable wherever the required baseline or history is missing.');
  set('report-forecast-note','Historical comparison: ACS 2015–2019 versus 2020–2024; scenario horizon: 2029. Exact GEOID matching only; no allocation across changed boundaries. Income projections are nominal (not inflation-adjusted).');
  set('forecast-max-label',`Metric (${radii.at(-1)}-Mile)`);
  const coverage=radii.map((radius,index)=>`${radius}-mile ${membership.byRadius[`${radius}mile`].filter(id=>current[id]).length}/${membership.byRadius[`${radius}mile`].length} current block groups`).join('; ');
  set('report-data-coverage',`Demographics: Census ACS 2020–2024, retrieved ${source[0]?.fetchedAt?.slice(0,10)||'date unavailable'}. ${coverage}. Whole intersecting block groups are included. Suppressed or missing source values make the affected metric unavailable.`);
  set('economic-source-note','ACS 2020–2024: B19001/B19301 income, B23025 employment, B15003 education, C24010 occupation, B25001/B25075/B25063 housing. Local medians are interpolated from summed distribution bins; county/state income medians are published B19013 estimates. Open-ended median bins are unavailable. Rates use summed numerators and matching denominators. Per-capita income uses resident-population weights.');
  set('income-map-insight',`The map compares the share of people at or above 200% of the poverty threshold in the selected ${radii.at(-1)}-mile trade area. It uses the ACS income-to-poverty bands used by the MEPS project, not average or median dollar income.`);
  set('population-map-insight',`The map shows ACS 2020–2024 resident counts by block group intersecting the ${radii.at(-1)}-mile trade area. Whole-block-group counts describe population distribution, not population density or unique patients.`);
  await renderSourceChoropleths(doc,payload,current,membership);
  return {areas,historical,growth,errors:source.flatMap(item=>item.errors||[])};
}

function basemapViewport(bounds) {
  const world=([lng,lat])=>{const sine=Math.sin(Math.max(-85,Math.min(85,lat))*Math.PI/180);return [(lng+180)/360,0.5-Math.log((1+sine)/(1-sine))/(4*Math.PI)];};
  const sw=world([bounds[0],bounds[1]]),ne=world([bounds[2],bounds[3]]);
  const center=[(sw[0]+ne[0])/2,(sw[1]+ne[1])/2];
  const zoom=Math.max(1,Math.min(20,Math.floor(Math.log2(Math.min(616/(256*Math.max(ne[0]-sw[0],1e-8)),516/(256*Math.max(sw[1]-ne[1],1e-8)))))));
  return {zoom,longitude:center[0]*360-180,latitude:Math.atan(Math.sinh(Math.PI*(1-2*center[1])))*180/Math.PI,
    point:coordinate=>{const value=world(coordinate);return [320+(value[0]-center[0])*256*2**zoom,270+(value[1]-center[1])*256*2**zoom];}};
}

async function renderSourceChoropleths(doc,payload,records,membership) {
  const features=blockGroupData.features.filter(feature=>membership.allGeoids.includes(normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20)));
  const colors=['#edf8e9','#c7e9c0','#a1d99b','#74c476','#31a354','#006d2c'];
  const svgNS='http://www.w3.org/2000/svg';
  const make=(name,attrs)=>{const node=doc.createElementNS(svgNS,name);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
  const bounds=turf.bbox(turf.circle([payload.location.longitude,payload.location.latitude],payload.tradeArea.maxRadiusMiles,{units:'miles'}));
  const viewport=basemapViewport(bounds),point=viewport.point;
  const backgrounds=Object.fromEntries(await Promise.all(['light'].map(async theme=>{
   try {
    const response=await fetch(`/api/report-basemap?lat=${viewport.latitude}&lng=${viewport.longitude}&zoom=${viewport.zoom}&theme=${theme}`);
    if(!response.ok)throw new Error('Basemap unavailable');
    const blob=await response.blob();
    const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    return [theme,image];
   }catch{return [theme,null];}
  })));
  const defaultSpecialtyNames=['Family practice','Dermatology','Pediatrics','Oncology'];
  const specialtyNames=(Array.isArray(payload.thematicMapSpecialties)&&payload.thematicMapSpecialties.length
    ?payload.thematicMapSpecialties:defaultSpecialtyNames).slice(0,4);
  for(let index=0;index<4;index++){
    const title=doc.getElementById('specialty-map-title-'+index);
    const section=title?.closest('section');
    if(section)section.hidden=index>=specialtyNames.length;
    if(title&&specialtyNames[index])title.textContent=specialtyNames[index];
  }
  let meps={},populations={},manifest={specialties:[]};
  try{
    const load=async url=>{const response=await fetch(url);if(!response.ok)throw new Error('Specialty source unavailable');return response.json();};
    manifest=await load('reports/meps-v2.9.1/manifest.json');
    const counties=[...new Set(membership.allGeoids.map(id=>id.slice(0,5)))];
    for(const [visits,ages] of await Promise.all(counties.map(county=>Promise.all([load('reports/meps-v2.9.1/'+county+'.json'),load('reports/acs2024-age/'+county+'.json')])))){Object.assign(meps,visits);Object.assign(populations,ages.blockGroups);}
  }catch{}
  const getValue=(feature,metric)=>{const id=normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20);if(!specialtyNames.includes(metric))return records[id]?.[metric];const population=populations[id]?.population,visits=meps[id]?.visits?.[manifest.specialties.indexOf(metric)];return population>0&&Number.isFinite(visits)&&visits>=0?1000*visits/population:NaN;};
  const pooled=features.flatMap(feature=>specialtyNames.map(name=>getValue(feature,name))).filter(Number.isFinite).sort((a,b)=>a-b);
  const sharedThresholds=Array.from({length:5},(_,i)=>Math.ceil((pooled[Math.floor((i+1)*pooled.length/6)]||0)/10)*10);
  for(const [containerId,placeholderId,legendId,metric] of [...specialtyNames.map((name,i)=>['specialty-map-'+i,null,null,name]),['thematic-pop-map','pop-map-placeholder','pop-legend','B01001_001E'],['report-map-embed','map-placeholder-text',null,null]]) {
    const specialty=specialtyNames.includes(metric);
    const container=doc.getElementById(containerId);if(!container)continue;
    const background=backgrounds.light;
    const values=features.map(feature=>getValue(feature,metric)).filter(value=>Number.isFinite(value)&&value>=0).sort((a,b)=>a-b);
    const thresholds=specialty?sharedThresholds:Array.from({length:5},(_,i)=>values[Math.floor((i+1)*values.length/6)]);
    const svg=make('svg',{viewBox:'0 0 640 540',width:'100%',height:'100%',role:'img','aria-label':metric?`ACS 2020–2024 ${metric==='B01001_001E'?'population':metric+' annual visits per 1,000 residents'} by block group over a light gray road map`:'Selected site and trade-area boundaries over a light gray road map'});
    svg.style.display='block';
    svg.appendChild(make('rect',{width:640,height:540,fill:'#eeeeee'}));
    if(background)svg.appendChild(make('image',{href:background,width:640,height:540}));
    let matched=0;
    for(const feature of metric ? features : []) {
      const value=getValue(feature,metric);
      const valid=Number.isFinite(value)&&value>=0;if(valid)matched++;
      const noPopulation=specialty&&populations[normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20)]?.population===0;
      const color=metric?(valid?colors[thresholds.filter(t=>value>t).length]:noPopulation?'#f4f4f4':'#d5dadd'):'#e0ece5';
      const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[];
      const d=polygons.map(polygon=>polygon.map(ring=>ring.map((coordinate,index)=>`${index?'L':'M'}${point(coordinate).map(v=>v.toFixed(2)).join(',')}`).join(' ')+'Z').join(' ')).join(' ');
      const path=make('path',{d,fill:color,'fill-opacity':valid?0.72:1,stroke:'none','fill-rule':'evenodd'});
      const title=make('title',{});title.textContent=`${normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20)}: ${valid?(specialty?value.toFixed(1)+' visits per 1,000 residents':Math.round(value).toLocaleString('en-US')):noPopulation?'No resident population':'Unavailable'}`;path.appendChild(title);svg.appendChild(path);
    }
    for(const radius of payload.tradeArea.radiiMiles) {
      const ring=turf.circle([payload.location.longitude,payload.location.latitude],radius,{units:'miles'}).geometry.coordinates[0];
      const d=ring.map((coordinate,index)=>`${index?'L':'M'}${point(coordinate).join(',')}`).join(' ')+'Z';
      svg.appendChild(make('path',{d,fill:'none',stroke:metric?'#fff':'#102c23','stroke-width':6,'stroke-opacity':0.8}));
      svg.appendChild(make('path',{d,fill:'none',stroke:metric?'#07935c':'#3df2a1','stroke-width':3.5}));
      const labelPoint=point(turf.destination([payload.location.longitude,payload.location.latitude],radius,90,{units:'miles'}).geometry.coordinates);
      const label=make('text',{x:labelPoint[0]+7,y:labelPoint[1]-7,fill:'#70ffc0','font-size':13,'font-weight':700,'paint-order':'stroke',stroke:'#102c23','stroke-width':4});label.textContent=`${radius} mi`;svg.appendChild(label);
    }
    const center=point([payload.location.longitude,payload.location.latitude]);
    const starPoints=Array.from({length:10},(_,index)=>{
      const angle=-Math.PI/2+index*Math.PI/5,radius=index%2?5:12;
      return `${center[0]+Math.cos(angle)*radius},${center[1]+Math.sin(angle)*radius}`;
    }).join(' ');
    const star=make('polygon',{points:starPoints,fill:'#3df2a1',stroke:'#fff','stroke-width':2,'stroke-linejoin':'round'});
    const starTitle=make('title',{});starTitle.textContent=payload.location.address;star.appendChild(starTitle);svg.appendChild(star);
    const caption=make('text',{x:12,y:20,'font-size':11,fill:'#fff','paint-order':'stroke',stroke:'#12212b','stroke-width':3});caption.textContent=`Site ★ · ${payload.tradeArea.radiiMiles.join(', ')}-mile rings${background?'':' · Road basemap unavailable'}`;svg.appendChild(caption);
    container.replaceChildren(svg);container.style.height='100%';
    if(container.parentElement){container.parentElement.style.height='auto';container.parentElement.style.aspectRatio='640 / 540';}
    const placeholder=doc.getElementById(placeholderId);if(placeholder)placeholder.style.display='none';
    if(specialty){const i=specialtyNames.indexOf(metric),column=manifest.specialties.indexOf(metric);const totals=features.map(feature=>meps[normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20)]?.visits?.[column]);doc.getElementById('specialty-map-total-'+i).textContent=totals.every(value=>Number.isFinite(value)&&value>=0)?Math.round(totals.reduce((a,b)=>a+b,0)).toLocaleString('en-US')+' annual visits · '+payload.tradeArea.maxRadiusMiles+'-mile trade area':'Total unavailable: incomplete coverage';const empty=features.filter(feature=>populations[normalizeGeoid(feature.properties.GEOID||feature.properties.GEOID20)]?.population===0).length;doc.getElementById('specialty-map-coverage-'+i).textContent=matched+'/'+features.length+' block groups with rates · '+empty+' without residents';}
    if(legendId){const legend=doc.getElementById(legendId);legend.replaceChildren();legend.style.flexWrap='wrap';
      for(let i=0;i<6;i++){const item=doc.createElement('span');item.style.cssText=`border-left:14px solid ${colors[i]};padding-left:4px;font-size:10px`;const lower=i?thresholds[i-1]:0,upper=thresholds[i];item.textContent=values.length?`${Math.round(lower).toLocaleString('en-US')}${upper!==undefined?'–'+Math.round(upper).toLocaleString('en-US'):'+'}`:'Unavailable';legend.appendChild(item);}
      const coverage=doc.createElement('span');
      coverage.textContent=`Gray: unavailable · ${matched}/${features.length} block groups with values · ACS 2020–2024`;
      legend.appendChild(coverage);}
  }
  const sharedLegend=doc.getElementById('specialty-map-legend');if(sharedLegend){sharedLegend.replaceChildren();for(let i=0;i<6;i++){const item=doc.createElement('span');item.style.cssText='border-left:14px solid '+colors[i]+';padding-left:4px;font-size:10px';item.textContent=pooled.length?(i?'> '+sharedThresholds[i-1]:'0')+(i<5?'–'+sharedThresholds[i]:''):'Unavailable';sharedLegend.appendChild(item);}const units=doc.createElement('span');units.style.fontSize='10px';units.textContent='Annual visits per 1,000 residents · shared scale';sharedLegend.appendChild(units);}
  const coverImage=doc.getElementById('report-map-image');if(coverImage){coverImage.removeAttribute('src');coverImage.style.display='none';}
}

// One cached county source shared by the snapshot and specialty report.
const nationalCountyCache=new Map();
function loadNationalCensusCounty(countyFips) {
  const cached=nationalCountyCache.get(countyFips);
  if(cached&&Date.now()-cached.at<900000)return cached.promise;
  const promise=(async()=>{
    const response=await fetch('/api/specialty-demographics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({countyFips}),signal:AbortSignal.timeout(120000)});
    const data=await response.json();if(!response.ok||!data.success)throw new Error('Census sources could not be loaded.');return data;
  })();
  const entry={at:Date.now(),promise};nationalCountyCache.set(countyFips,entry);
  promise.catch(()=>{if(nationalCountyCache.get(countyFips)===entry)nationalCountyCache.delete(countyFips);});
  return promise;
}
function buildNationalSnapshot(current,prior,ids,ageRecords) {
  const area=aggregateAcs(current,ids),old=aggregateAcs(prior,ids);
  const ageRows=ids.map(id=>ageRecords[id]);
  const validAges=ids.length>0&&ageRows.every(row=>Number.isFinite(row?.population)&&row.population>=0&&row.ages?.length===5&&row.ages.every(n=>Number.isFinite(n)&&n>=0));
  // Same matching ACS population/age release as the report; source gaps stay unavailable.
  const population=validAges?ageRows.reduce((sum,row)=>sum+row.population,0):area.population;
  const ages=validAges?Array.from({length:5},(_,i)=>ageRows.reduce((sum,row)=>sum+row.ages[i],0)):area.ages;
  const bins=(a,b)=>{const values=area.incomeBins.slice(a,b);return values.every(Number.isFinite)?values.reduce((sum,n)=>sum+n,0):NaN;};
  const income=Object.fromEntries([['Under $25,000',0,4],['$25,000 - $49,999',4,9],['$50,000 - $74,999',9,11],['$75,000 - $99,999',11,12],['$100,000 - $149,999',12,14],['$150,000+',14,16]].map(([label,a,b])=>[label,bins(a,b)]));
  return {...area,population,age_0_17:ages[0],age_18_34:ages[1],age_35_54:ages[2],age_55_64:ages[3],age_65plus:ages[4],income,housing:{medianValue:area.homeValue},
    pop_proj:projectAcs(population,old.population).future,hh_proj:projectAcs(area.households,old.households).future,med_inc_proj:projectAcs(area.medianIncome,old.medianIncome).future,CAGR_med_inc:projectAcs(area.medianIncome,old.medianIncome).cagr};
}
async function loadNationalSnapshot(latitude,longitude,radii) {
  await loadNationalReportBoundaries(latitude,longitude,Math.max(...radii));
  const membership=getBlockGroupsByRadius(latitude,longitude,radii);
  if(!membership.allGeoids.length)throw new Error('No U.S. block groups intersect this report area.');
  const counties=[...new Set(membership.allGeoids.map(id=>id.slice(0,5)))];
  const [source,ageFiles,demand]=await Promise.all([
    Promise.all(counties.map(loadNationalCensusCounty)),
    Promise.all(counties.map(async county=>{try{const response=await fetch('reports/acs2024-age/'+county+'.json');return response.ok?(await response.json()).blockGroups:{};}catch{return {};}})),
    Promise.all([loadSnapshotMepsFile('reports/meps-v2.9.1/manifest.json'),...counties.map(county=>loadSnapshotMepsFile('reports/meps-v2.9.1/'+county+'.json'))]).catch(()=>null)
  ]);
  const current=Object.assign({},...source.map(item=>item.current)),prior=Object.assign({},...source.map(item=>item.prior)),ages=Object.assign({},...ageFiles);
  const demandRecords=demand?Object.assign({},...demand.slice(1)):{};
  return Object.fromEntries(radii.map(radius=>{const ids=membership.byRadius[radius+'mile']||[];return [radius+'mile',{...buildNationalSnapshot(current,prior,ids,ages),topSpecialties:demand?rankSnapshotSpecialties(ids,demandRecords,demand[0].specialties):null}];}));
}

const snapshotMepsCache=new Map();
function loadSnapshotMepsFile(path) {
  if(!snapshotMepsCache.has(path)){
    const promise=fetch(path).then(async response=>{if(!response.ok)throw new Error('Specialty demand unavailable');return response.json();});
    snapshotMepsCache.set(path,promise);promise.catch(()=>snapshotMepsCache.delete(path));
  }
  return snapshotMepsCache.get(path);
}
function rankSnapshotSpecialties(ids,records,names) {
  const unique=[...new Set(ids)];
  if(!unique.length||names.length!==25||unique.some(id=>!records[id]||records[id].visits?.length!==25||records[id].visits.some(value=>!Number.isFinite(value)||value<0)))return null;
  return names.map((name,index)=>({name,visits:unique.reduce((sum,id)=>sum+records[id].visits[index],0),warning:unique.some(id=>String(records[id].warnings?.[index]).toLowerCase()==='true')})).sort((a,b)=>b.visits-a.visits||a.name.localeCompare(b.name)).slice(0,5);
}
