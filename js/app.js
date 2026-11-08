import {presets,getPreset} from './presets.js';
import {createStore} from './state.js';
import {AquariumRenderer} from './renderer.js';
import {createRealLightingController,createPreviewController} from './controllers.js';
import {formatTime,localMinutes} from './schedule.js';
import {createWeatherProvider,searchLocations,weatherLabel,locationKey} from './weather.js';
import {zonedParts,epochForZoned} from './astronomy.js';
import {apiWeatherAt,weatherStatus} from './weather-status.js';
const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{/* Storage may be blocked. */}
const store=createStore(storage);
const weatherProvider=createWeatherProvider({storage,onChange:()=>real.sample()});
const real=createRealLightingController(store,()=>new Date(),()=>weatherProvider.snapshot());
function refreshWeather(force=false){const n=store.getState().natural;if(n.latitude!==null&&n.longitude!==null)weatherProvider.refresh(n,{force});}

const renderer=new AquariumRenderer($('scene'),real.sample().preset);
for(const p of presets){
  const button=document.createElement('button');button.type='button';button.className='preset';button.dataset.preset=p.id;button.style.setProperty('--tone',p.tone);button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='preset-icon';icon.setAttribute('aria-hidden','true');icon.textContent=p.icon;
  const name=document.createElement('span');name.className='preset-name';name.textContent=p.name;
  const check=document.createElement('span');check.className='check';check.setAttribute('aria-hidden','true');check.textContent='✓';
  button.append(icon,name,check);button.addEventListener('click',()=>store.selectPreset(p.id));$('presets').append(button);
}
function text(id,value){if($(id).textContent!==value)$(id).textContent=value;}
function showWeatherStatus(prefix,api,preset,options={}){
  const status=weatherStatus(api,preset,options);
  text(prefix+'-api',status.api);text(prefix+'-applied',status.applied);
}
function renderReal(output){
  const natural=output.mode==='natural',automatic=output.mode!=='manual',p=output.preset;
  if(automatic)renderer.setLighting(p);else if(renderer.preset.id!==p.id)renderer.setPreset(p);
  text('preset-name',p.name);text('preset-description',p.description);
  $('mode-auto').setAttribute('aria-pressed',String(output.mode==='automatic'));$('mode-natural').setAttribute('aria-pressed',String(natural));$('mode-manual').setAttribute('aria-pressed',String(!automatic));
  $('preview-open').hidden=!automatic;$('manual-status').hidden=automatic;$('cycle-meta').hidden=!automatic;
  $('weather-status').hidden=!automatic;
  const data=weatherProvider.snapshot().data,n=store.getState().natural;
  showWeatherStatus('weather',natural?apiWeatherAt(output.at,data?.key===locationKey(n)?data:null,output.at,{current:true}):null,renderer.preset,{fallback:output.cycle?.weather?.source==='estimated',cached:output.cycle?.weatherStatus==='offline'});
  if(automatic&&!natural)text('cycle-meta',`${output.cycle.brightness===0?'Lights off · ':''}${output.cycle.nextPhase} at ${formatTime(output.cycle.nextTransition)}`);
  if(natural){
    const cycle=output.cycle,sky=cycle.nextAstronomy;
    const time=sky.at?formatTime(zonedParts(sky.at,store.getState().natural.timezone).minutes):'unavailable';
    const source=cycle.weather.source==='estimated'?'Estimated clouds':`${weatherLabel(cycle.weather)}${cycle.weatherStatus==='offline'?' (cached)':''}`;
    text('cycle-meta',`${cycle.policyReason?'Dark period · ':cycle.ramping?'Ramping · ':''}${source} · Sky ${sky.label.toLowerCase()} ${time}${store.getState().natural.moonEnabled&&['Moonlight','Night'].includes(cycle.phase)?' · '+cycle.astronomy.moonLabel+(cycle.astronomy.moonAbove?'':' below horizon'):''}`);
  }
  $('presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!automatic&&b.dataset.preset===p.id)));
}
// The only future hardware subscription point is real.subscribeRealOutput().
// No adapter is installed. Rendering and preview actions never emit commands.
real.subscribeRealOutput(renderReal);
store.subscribe(()=>{real.sample();refreshWeather();text('announcement',`${store.getState().mode==='manual'?getPreset(store.getState().presetId).name:store.getState().mode==='natural'?'Natural mode':'Automatic cycle'} selected.`);});
$('mode-auto').addEventListener('click',()=>store.setMode('automatic'));
$('mode-manual').addEventListener('click',()=>store.setMode('manual'));
real.sample();refreshWeather();setInterval(()=>real.sample(),250);setInterval(()=>refreshWeather(true),15*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)real.sample();});

function dismissOnBackdrop(dialog){dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});}
let activateNaturalAfterSave=false;
$('mode-natural').addEventListener('click',()=>{if(store.getState().natural.latitude===null){$('settings-open').click();activateNaturalAfterSave=true;$('natural-advanced').open=true;text('location-message','Choose the aquarium location before enabling Natural mode.');}else store.setMode('natural');});
const settingsDialog=$('settings-dialog');dismissOnBackdrop(settingsDialog);
function updateSettingLabels(){text('day-brightness-value',`${$('day-brightness').value}%`);text('moon-intensity-value',`${$('moon-intensity').value}%`);$('moon-intensity').disabled=!$('moon-enabled').checked;}
$('settings-open').addEventListener('click',()=>{
  const {schedule:s,cycleSettings:c,natural:n,safety:p}=store.getState();
  $('sunrise-start').value=formatTime(s.sunriseStart);$('sunset-start').value=formatTime(s.sunsetStart);
  $('sunrise-duration').value=s.sunriseDuration;$('sunset-duration').value=s.sunsetDuration;
  $('day-brightness').value=c.dayBrightness*100;$('moon-enabled').checked=c.moonlightEnabled;$('moon-intensity').value=c.moonlightIntensity*100;
  activateNaturalAfterSave=false;
  const values={'n-location':n.locationName,'n-lat':n.latitude??'','n-lon':n.longitude??'','n-timezone':n.timezone,'n-photo':n.photoperiodHours,'n-offset':n.offsetMinutes,'n-rise':n.sunriseMinutes,'n-set':n.sunsetMinutes,'n-bright':n.dayBrightness*100,'n-season':n.seasonalStrength*100,'n-twilight':n.twilightMinutes,'n-moon':n.moonCap*100,'s-photo':p.maxPhotoperiodHours,'s-dark':p.minDarkHours,'s-bright':p.maxBrightness*100,'s-weather':p.minWeatherFactor*100,'s-rate':p.maxChangePerMinute*100,'s-moon':p.moonlightCap*100};
  for(const [id,value] of Object.entries(values))$(id).value=value;
  $('n-moon-enabled').checked=n.moonEnabled;$('n-moon-cloud').checked=n.moonCloudAttenuation;
  text('location-message','');text('schedule-error','');updateSettingLabels();settingsDialog.showModal();
});
$('settings-close').addEventListener('click',()=>settingsDialog.close());
for(const id of ['day-brightness','moon-enabled','moon-intensity'])$(id).addEventListener('input',updateSettingLabels);
const parseTime=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
$('schedule-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    const value=id=>Number($(id).value),optional=id=>$(id).value.trim()===''?null:value(id);
    const natural={locationName:$('n-location').value.trim(),latitude:optional('n-lat'),longitude:optional('n-lon'),timezone:$('n-timezone').value.trim(),photoperiodHours:value('n-photo'),offsetMinutes:value('n-offset'),sunriseMinutes:value('n-rise'),sunsetMinutes:value('n-set'),dayBrightness:value('n-bright')/100,seasonalStrength:value('n-season')/100,moonEnabled:$('n-moon-enabled').checked,moonCap:value('n-moon')/100,moonCloudAttenuation:$('n-moon-cloud').checked,twilightMinutes:value('n-twilight')};
    const safety={maxPhotoperiodHours:value('s-photo'),maxBrightness:value('s-bright')/100,minDarkHours:value('s-dark'),minWeatherFactor:value('s-weather')/100,maxChangePerMinute:value('s-rate')/100,moonlightCap:value('s-moon')/100};
    if(activateNaturalAfterSave&&natural.latitude===null)throw new Error('Choose the aquarium location.');
    store.saveConfiguration({sunriseStart:parseTime($('sunrise-start').value),sunriseDuration:Number($('sunrise-duration').value),sunsetStart:parseTime($('sunset-start').value),sunsetDuration:Number($('sunset-duration').value)},
      {dayBrightness:Number($('day-brightness').value)/100,moonlightEnabled:$('moon-enabled').checked,moonlightIntensity:Number($('moon-intensity').value)/100},natural,safety);
    if(activateNaturalAfterSave)store.setMode('natural');
    settingsDialog.close();text('announcement','Schedule saved.');
  }catch(error){text('schedule-error',error.message);}
});

let searchResults=[];
$('location-find').addEventListener('click',async()=>{
  const name=$('location-search').value.trim();if(name.length<2){text('location-message','Enter at least two characters.');return;}
  $('location-find').disabled=true;
  try{searchResults=await searchLocations(name);$('location-results').replaceChildren(new Option('Choose a location…',''));for(const [i,r] of searchResults.entries())$('location-results').add(new Option(`${r.name}, ${r.admin1||r.country||''} · ${r.country||''}`,String(i)));$('location-results').hidden=!searchResults.length;text('location-message',searchResults.length?'Choose the aquarium location.':'No locations found; enter coordinates manually.');}
  catch(error){text('location-message',error.message);}finally{$('location-find').disabled=false;}
});
function applyLocation(r){$('n-location').value=`${r.name}, ${r.country||''}`.slice(0,100);$('n-lat').value=r.latitude;$('n-lon').value=r.longitude;$('n-timezone').value=r.timezone||'';}
$('location-search').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('location-find').click();}});
$('location-results').addEventListener('change',()=>{if($('location-results').value==='')return;const r=searchResults[Number($('location-results').value)];if(r)applyLocation(r);});
// Preview owns a separate controller, renderer and playback timestamp. It only
// copies schedule configuration from the store and cannot write it or real time.
const previewDialog=$('preview-dialog');dismissOnBackdrop(previewDialog);
let previewWeatherData=null,previewNatural=null,previewWeatherNow=null;
let preview=null,previewRenderer=null,previewFrame=0,previewLast=null,previewDiagnosticsAt=0;
function renderPreview(){
  const state=preview.snapshot();previewRenderer.setLighting(state.preset);
  if(state.date)$('preview-date').value=state.date;
  showWeatherStatus('preview-weather-status',previewWeatherData&&state.date?apiWeatherAt(epochForZoned(state.date,state.minutes,previewNatural.timezone),previewWeatherData,previewWeatherNow):null,previewRenderer.preset,{fallback:state.weather?.source==='estimated',simulation:state.weather?.source==='simulation'});
  $('preview-timeline').value=state.minutes;$('preview-timeline').setAttribute('aria-valuetext',`${formatTime(state.minutes)}, ${state.phase}`);
  text('preview-time',formatTime(state.minutes));text('preview-phase',state.phase+(state.astronomy&&state.phase==='Moonlight'?' · '+state.astronomy.moonLabel:''));
  if(state.weather)text('preview-weather',`${weatherLabel(state.weather)} · ${state.weather.source==='simulation'?'Developer simulation':state.weather.source==='estimated'?'Estimated weather':'Forecast'}${state.phase==='Night'&&state.moonEnabled?' · '+state.astronomy.moonLabel:''}`);
  text('preview-play',state.playing?'Pause':'Play');$('preview-play').setAttribute('aria-pressed',String(state.playing));
}
function renderWeatherDiagnostics(){
  const panel=$('weather-diagnostics');if(!panel||!previewRenderer)return;
  const state=preview.snapshot(),w=state.weather,m=state.weatherLighting,e=state.environment;
  const value=(v,unit='')=>Number.isFinite(v)?`${v.toFixed(unit?1:4)}${unit}`:'unavailable';
  const timestamp=v=>Number.isFinite(v)?new Date(v).toISOString():'unavailable';
  const lighting=previewRenderer.lighting,received=lighting.state,field=lighting.field;
  let min=Infinity,max=-Infinity;
  for(let i=0;i<field.data.length;i+=field.stride){const v=(field.data[i]+field.data[i+1]+field.data[i+2])/3;min=Math.min(min,v);max=Math.max(max,v);}
  panel.querySelector('pre').textContent=[
    `${weatherLabel(w)} · ${w.source} · ${m.radiationSource}`,
    `Selected time ${timestamp(epochForZoned(state.date,state.minutes,store.getState().natural.timezone))}`,
    `Forecast timestamps ${timestamp(w.forecast?.from)} / ${timestamp(w.forecast?.to)}`,
    `Raw cloud ${value(w.forecast?.cloudFrom,'%')} / ${value(w.forecast?.cloudTo,'%')} · interpolation ${value(w.forecast?.fraction)}`,
    `Cloud ${value(w.cloud,'%')} · low ${value(w.low,'%')} / mid ${value(w.mid,'%')} / high ${value(w.high,'%')}`,
    `Direct ${value(w.directRadiation,' W/m²')} · diffuse ${value(w.diffuseRadiation,' W/m²')}`,
    `Wind ${value(w.windSpeed,' m/s')} from ${value(w.windDirection,'°')}`,
    `Continuous cover ${value(e.cloudCoverage)} · optical depth ${value(e.opticalDepth)} (estimated)`,
    `Rain ${value(e.rainIntensity)} · snow ${value(e.snowIntensity)} · haze ${value(e.haze)} (${e.provenance.haze})`,
    `Sun altitude ${value(state.astronomy.sunAltitude*180/Math.PI,'°')}`,
    `Calculated diffuse ${value(m.diffuseIllumination)} · direct ${value(m.directIllumination)} · shadow ${value(m.shadowStrength)}`,
    `Weather attenuation ${value(state.weatherFactor)} · final intensity ${value(state.brightness)}`,
    `Renderer cloud ${value(received?.p.cloudCoverage)} · diffuse ${value(received?.ambient)} · direct ${value(received?.direct)} · blend ${value(lighting.blend)}`,
    `2D field RGB mean min ${value(min)} · max ${value(max)}`,
    'Top-down transmission: left/right · rear (top) / front (bottom)',
  ].join('\n');
  const canvas=panel.querySelector('canvas'),ctx=canvas.getContext('2d');
  // Reuse the renderer field, including its front/rear source projection.
  for(let y=0;y<24;y++)for(let x=0;x<48;x++){
    const v=Math.round(field.sample(x/47,y/23).transmission*255);
    ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x*3,y*3,3,3);
  }
}
function previewTick(now){
  if(preview.snapshot().playing){if(previewLast!==null)preview.advance((now-previewLast)/1000);renderPreview();}if($('weather-diagnostics')&&(previewLast===null||!previewDiagnosticsAt||now-previewDiagnosticsAt>250)){renderWeatherDiagnostics();previewDiagnosticsAt=now;}previewLast=now;previewFrame=requestAnimationFrame(previewTick);
}
$('preview-open').addEventListener('click',()=>{
  const {schedule,cycleSettings,mode,natural,safety}=store.getState(),at=Date.now(),zoned=zonedParts(at,natural.timezone);
  const naturalMode=mode==='natural',data=weatherProvider.snapshot().data;
  previewWeatherData=naturalMode&&data?.key===locationKey(natural)?data:null;previewNatural=natural;previewWeatherNow=at;
  preview=createPreviewController(schedule,cycleSettings,naturalMode?zoned.minutes:localMinutes(new Date()),naturalMode?{natural,safety,data:data?.key===locationKey(natural)?data:null,date:zoned.date,now:at}:null);
  $('preview-natural-row').hidden=!naturalMode;$('preview-date').value=zoned.date;
  // Opt-in developer controls affect only the isolated preview controller.
  if(naturalMode&&new URLSearchParams(location.search).get('devWeather')==='1'){
    const label=document.createElement('label');label.id='developer-weather';label.textContent='Preview weather ';
    const select=document.createElement('select');select.setAttribute('aria-label','Preview weather');
    for(const [value,name] of [['','Live forecast'],['clear','Clear'],['partly-cloudy','Partly cloudy'],['cloudy','Cloudy'],['overcast','Overcast'],['rain','Rain'],['thunderstorm','Thunderstorm']])select.add(new Option(name,value));
    select.addEventListener('change',()=>{preview.setPlaying(false);preview.setWeatherOverride(select.value||null);renderPreview();});
    label.append(select);$('preview-natural-row').append(label);
    const panel=document.createElement('details');panel.id='weather-diagnostics';panel.open=true;panel.style.cssText='max-height:210px;overflow:auto;margin-top:12px';
    const summary=document.createElement('summary');summary.textContent='Weather diagnostics (preview only)';
    const readings=document.createElement('pre');readings.style.cssText='white-space:pre-wrap;font-size:11px';
    const map=document.createElement('canvas');map.width=144;map.height=72;map.style.cssText='position:static;width:144px;height:72px';map.setAttribute('aria-label','Top-down cloud transmission map');
    panel.append(summary,readings,map);$('preview-natural-row').after(panel);
  }
  previewDialog.showModal();renderer.setSuspended(true);
  previewRenderer=new AquariumRenderer($('preview-scene'),preview.snapshot().preset);previewRenderer.scenery=renderer.scenery;
  $('preview-speed').value='360';previewLast=null;renderPreview();previewFrame=requestAnimationFrame(previewTick);
});
$('preview-close').addEventListener('click',()=>previewDialog.close());
previewDialog.addEventListener('close',()=>{$('developer-weather')?.remove();$('weather-diagnostics')?.remove();cancelAnimationFrame(previewFrame);previewRenderer?.destroy();previewRenderer=null;preview=null;previewLast=null;renderer.setSuspended(false);});
$('preview-timeline').addEventListener('input',()=>{preview.scrub(Number($('preview-timeline').value));renderPreview();});
$('preview-play').addEventListener('click',()=>{preview.setPlaying(!preview.snapshot().playing);previewLast=null;renderPreview();});
$('preview-speed').addEventListener('change',()=>{preview.setSpeed(Number($('preview-speed').value));previewLast=null;});
$('preview-now').addEventListener('click',()=>{preview.resetNow();$('preview-date').value=preview.snapshot().date||'';previewLast=null;renderPreview();});
$('preview-date').addEventListener('change',()=>{try{preview.setDate($('preview-date').value);renderPreview();}catch{$('preview-date').value=preview.snapshot().date;}});
document.addEventListener('visibilitychange',()=>{previewLast=null;});
