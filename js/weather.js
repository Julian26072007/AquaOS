import {zonedParts} from './astronomy.js';
export const WEATHER_TTL=15*60*1000,MAX_WEATHER_AGE=24*60*60*1000;
export const CURRENT_FIELDS=['cloud_cover','precipitation','rain','weather_code','wind_speed_10m','wind_direction_10m'];
export const HOURLY_FIELDS=[...CURRENT_FIELDS,'cloud_cover_low','cloud_cover_mid','cloud_cover_high','shortwave_radiation','direct_radiation','diffuse_radiation'];
export const DAILY_FIELDS=['sunrise','sunset','moonrise','moonset','moon_phase'];
export function locationKey(l){return JSON.stringify([l.latitude,l.longitude,l.timezone]);}
export function forecastUrl(l){
  const p=new URLSearchParams({latitude:l.latitude,longitude:l.longitude,timezone:l.timezone,timeformat:'unixtime',forecast_days:'7',past_days:'1',wind_speed_unit:'ms',current:CURRENT_FIELDS.join(','),hourly:HOURLY_FIELDS.join(','),daily:DAILY_FIELDS.join(',')});
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}
const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):null;
function weatherRow(block,index=null){
  const value=key=>index===null?block?.[key]:block?.[key]?.[index];
  return {cloud:number(value('cloud_cover'),0,100),low:number(value('cloud_cover_low'),0,100),mid:number(value('cloud_cover_mid'),0,100),high:number(value('cloud_cover_high'),0,100),rain:number(value('rain'),0,300),precipitation:number(value('precipitation'),0,300),code:number(value('weather_code'),0,99),windSpeed:number(value('wind_speed_10m'),0,100),windDirection:number(value('wind_direction_10m'),0,360),radiation:number(value('shortwave_radiation'),0,1500),directRadiation:number(value('direct_radiation'),0,1500),diffuseRadiation:number(value('diffuse_radiation'),0,1500)};
}
export function normalizeForecast(raw,location,fetchedAt){
  if(!Array.isArray(raw?.hourly?.time)||raw.hourly.time.length<2)throw new Error('Weather forecast has no hourly timeline');
  const hourly=raw.hourly.time.map((t,i)=>({at:typeof t==='number'?t*1000:NaN,...weatherRow(raw.hourly,i)})).filter(r=>Number.isFinite(r.at));
  if(hourly.length<2||hourly.some((r,i)=>i&&r.at<=hourly[i-1].at))throw new Error('Invalid weather timestamps');
  const daily=(raw.daily?.time||[]).map((t,i)=>{
    const timestamp=key=>{const v=raw.daily?.[key]?.[i];return typeof v==='number'&&v>0?v*1000:null;};
    return {date:zonedParts(t*1000,location.timezone).date,sunrise:timestamp('sunrise'),sunset:timestamp('sunset'),moonrise:timestamp('moonrise'),moonset:timestamp('moonset'),moonPhase:number(raw.daily.moon_phase?.[i],0,1)};
  });
  return {schema:1,key:locationKey(location),fetchedAt,hourly,daily,current:Number.isFinite(raw.current?.time)?{at:raw.current.time*1000,...weatherRow(raw.current)}:null};
}
export const FALLBACK_WEATHER=Object.freeze({cloud:40,low:30,mid:20,high:20,rain:0,precipitation:0,code:null,windSpeed:2,windDirection:250,radiation:null,directRadiation:null,diffuseRadiation:null,source:'estimated'});
export function weatherAt(epoch,data,now=epoch,{current=false}={}){
  if(!data||now-data.fetchedAt>MAX_WEATHER_AGE||data.fetchedAt>now+3600000)return {...FALLBACK_WEATHER};
  const rows=data.hourly;
  if(!Array.isArray(rows)||rows.length<2||!rows.every((r,i)=>Number.isFinite(r?.at)&&(!i||r.at>rows[i-1].at))||epoch<rows[0].at||epoch>rows.at(-1).at)return {...FALLBACK_WEATHER};
  let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>>1;if(rows[m].at>epoch)hi=m;else lo=m;}
  const a=rows[lo],b=rows[hi],f=Math.max(0,Math.min(1,(epoch-a.at)/(b.at-a.at))),k=f*f*(3-2*f),out={source:'forecast'};
  for(const key of Object.keys(FALLBACK_WEATHER).filter(k=>k!=='source')){
    const valid=v=>typeof v==='number'&&Number.isFinite(v);
    const av=valid(a[key])?a[key]:valid(b[key])?b[key]:(['low','mid','high'].includes(key)?null:FALLBACK_WEATHER[key]),bv=valid(b[key])?b[key]:valid(a[key])?a[key]:(['low','mid','high'].includes(key)?null:FALLBACK_WEATHER[key]);
    if(key==='code')out[key]=k<.5?av:bv;
    else if(key==='windDirection')out[key]=(av+(((bv-av+540)%360)-180)*k+360)%360;
    else out[key]=av===null?null:av+(bv-av)*k;
  }
  if(current&&data.current&&Math.abs(epoch-data.current.at)<30*60000){for(const key of CURRENT_FIELDS){const names={cloud_cover:'cloud',precipitation:'precipitation',rain:'rain',weather_code:'code',wind_speed_10m:'windSpeed',wind_direction_10m:'windDirection'};const name=names[key],value=data.current[name];if(typeof value==='number'&&Number.isFinite(value))out[name]=value;}out.source='current';}
  return out;
}
export function weatherLabel(w){return w.code>=95?'Storm':w.precipitation>.1?'Rain':w.cloud>85?'Overcast':w.cloud>60?'Cloudy':w.cloud>15?'Partly cloudy':'Clear';}
function validCache(c,key,now){
  if(c?.schema!==1||c.key!==key||!Number.isFinite(c.fetchedAt)||now-c.fetchedAt< -60000||now-c.fetchedAt>=MAX_WEATHER_AGE||!Array.isArray(c.daily)||!Array.isArray(c.hourly)||c.hourly.length<2)return false;
  if(!c.hourly.every((r,i)=>Number.isFinite(r?.at)&&(!i||r.at>c.hourly[i-1].at)&&Object.keys(FALLBACK_WEATHER).filter(k=>k!=='source').every(k=>r[k]===null||r[k]===undefined||typeof r[k]==='number'&&Number.isFinite(r[k]))))return false;
  return c.daily.every(d=>typeof d?.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)&&['sunrise','sunset','moonrise','moonset'].every(k=>d[k]===null||d[k]===undefined||Number.isFinite(d[k]))&&(d.moonPhase===null||d.moonPhase===undefined||Number.isFinite(d.moonPhase)&&d.moonPhase>=0&&d.moonPhase<=1));
}
/** Only configured coordinates are sent. No GPS, credentials or backend. */
export function createWeatherProvider({fetcher=fetch,storage,now=Date.now,onChange=()=>{}}={}){
  let active=null,generation=0,inflight=null,abort=null,snapshot={status:'unconfigured',data:null};
  function publish(next){snapshot=next;onChange(snapshot);}
  return {
    snapshot:()=>snapshot,
    async refresh(location,{force=false}={}){
      const key=locationKey(location),changed=active!==key;
      if(changed){active=key;generation++;abort?.abort();inflight=null;let cached=null;try{const c=JSON.parse(storage?.getItem('aquaos.weather.v1:'+key));if(validCache(c,key,now()))cached=c;}catch{}
        publish({status:cached?'cached':'loading',data:cached});}
      if(!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude)){publish({status:'unconfigured',data:null});return snapshot;}
      if(!force&&snapshot.data&&now()-snapshot.data.fetchedAt>=0&&now()-snapshot.data.fetchedAt<WEATHER_TTL)return snapshot;
      if(inflight)return inflight;
      const token=generation;abort=new AbortController();const requestAbort=abort;
      inflight=(async()=>{
        const timeout=setTimeout(()=>requestAbort.abort(),10000);
        try{
          let response=await fetcher(forecastUrl(location),{signal:requestAbort.signal});
          // Older deployments may not yet offer lunar daily fields.
          if(response.status===400){const url=new URL(forecastUrl(location));url.searchParams.set('daily','sunrise,sunset');response=await fetcher(url,{signal:requestAbort.signal});}
          if(!response.ok)throw new Error(`Weather HTTP ${response.status}`);
          const data=normalizeForecast(await response.json(),location,now());if(token!==generation)return snapshot;
          try{storage?.setItem('aquaos.weather.v1:'+key,JSON.stringify(data));}catch{}
          publish({status:'fresh',data});
        }catch{if(token===generation)publish({status:'offline',data:snapshot.data});}
        finally{clearTimeout(timeout);}
        return snapshot;
      })().finally(()=>{if(token===generation)inflight=null;});return inflight;
    },
  };
}
export async function searchLocations(name,fetcher=fetch){
  const p=new URLSearchParams({name,count:'5',language:'en',format:'json'});
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);
  try{const response=await fetcher(`https://geocoding-api.open-meteo.com/v1/search?${p}`,{signal:abort.signal});
    if(!response.ok)throw new Error('Location lookup unavailable; enter coordinates manually.');
    return (await response.json()).results||[];
  }finally{clearTimeout(timeout);}
}
export function smoothWeather(previous,target,seconds){
  if(!previous)return {...target};
  const k=1-Math.exp(-Math.max(0,Math.min(5,seconds))/60),out={...target};
  for(const key of ['cloud','low','mid','high','rain','precipitation','windSpeed','windDirection','radiation','directRadiation','diffuseRadiation']){
    const a=previous[key],b=target[key];if(!Number.isFinite(a)||!Number.isFinite(b))continue;
    out[key]=key==='windDirection'?(a+(((b-a+540)%360)-180)*k+360)%360:a+(b-a)*k;
  }
  return out;
}
