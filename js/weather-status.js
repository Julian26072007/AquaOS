import {weatherAt} from './weather.js';

// Read-only presentation: never feed these observations back into lighting.
export function apiWeatherAt(epoch,data,now,{current=false}={}){
  const weather=weatherAt(epoch,data,now,{current});
  if(weather.source==='estimated')return null;
  // weatherAt supplies simulation defaults for missing provider fields. Do not
  // present those defaults as API measurements.
  const rows=data.hourly.filter(r=>r.at===weather.forecast.from||r.at===weather.forecast.to);
  const currentRow=weather.source==='current'?data.current:null;
  return {...weather,
    cloud:Number.isFinite(currentRow?.cloud)?currentRow.cloud:rows.some(r=>Number.isFinite(r.cloud))?weather.cloud:null,
    code:Number.isFinite(currentRow?.code)?currentRow.code:rows.some(r=>Number.isFinite(r.code))?weather.code:null};
}
function providerLabel(code){
  if(!Number.isFinite(code))return 'Unavailable';
  if(code===0)return 'Clear';
  if(code===1)return 'Mainly clear';
  if(code===2)return 'Partly cloudy';
  if(code===3)return 'Overcast';
  if(code>=95)return 'Storm';
  if(code>=71&&code<=77||code===85||code===86)return 'Snow';
  if(code>=51&&code<=67||code>=80&&code<=82)return 'Rain';
  if(code===45||code===48)return 'Fog';
  return `Weather code ${code}`;
}
export function weatherStatus(api,preset,{fallback=false,simulation=false,cached=false}={}){
  const apiText=api?`${providerLabel(api.code)}${Number.isFinite(api.cloud)?` · ${Math.round(api.cloud)}% clouds`:''} · ${api.source==='current'?'Current':'Forecast'}${cached?' (cached)':''}`:'Unavailable';
  // Natural presets carry the condition description and coverage used by
  // the global lighting model. Scheduled presets have no weather condition contract.
  const applied=preset?.id==='natural'&&typeof preset.description==='string'?preset.description.split(' · ')[0]:'Unavailable';
  const coverage=Number.isFinite(preset?.cloudCoverage)?` · ${Math.round(preset.cloudCoverage*100)}% clouds`:'';
  return {api:`API: ${apiText}`,applied:`Applied: ${applied}${coverage}${simulation?' · Developer simulation':fallback?' · Fallback (estimated)':''}`};
}
