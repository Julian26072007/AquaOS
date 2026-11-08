import SunCalc from './vendor/suncalc.js';
const formatters=new Map(),dayCache=new Map(),dataIds=new WeakMap();let nextId=1;
export function zonedParts(epoch,timezone){
  if(!formatters.has(timezone))formatters.set(timezone,new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));
  const p=Object.fromEntries(formatters.get(timezone).formatToParts(new Date(epoch)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute)+Number(p.second)/60+((epoch%1000)+1000)%1000/60000};
}
export function epochForZoned(date,minutes,timezone){
  const [year,month,day]=date.split('-').map(Number),wall=Date.UTC(year,month-1,day)+minutes*60000;
  let guess=wall,previous=guess;
  for(let i=0;i<4;i++){
    const parts=zonedParts(guess,timezone),[y,m,d]=parts.date.split('-').map(Number);
    const correction=wall-(Date.UTC(y,m-1,d)+parts.minutes*60000);
    if(Math.abs(correction)<1000)return guess;
    const next=guess+correction;
    if(next===previous)return Math.max(guess,next); // nonexistent DST hour: forward
    previous=guess;guess=next;
  }
  return guess;
}
export function moonName(phase){
  if(phase<.03||phase>.97)return 'New moon';if(Math.abs(phase-.5)<.04)return 'Full moon';
  if(Math.abs(phase-.25)<.035)return 'First quarter';if(Math.abs(phase-.75)<.035)return 'Last quarter';
  return phase<.25?'Waxing crescent':phase<.5?'Waxing gibbous':phase<.75?'Waning gibbous':'Waning crescent';
}
export function astronomyAt(epoch,location,data=null){
  const parts=zonedParts(epoch,location.timezone),configured=Number.isFinite(location.latitude)&&Number.isFinite(location.longitude);
  const lat=configured?location.latitude:0,lon=configured?location.longitude:0;
  if(data&&!dataIds.has(data))dataIds.set(data,nextId++);
  const cacheKey=JSON.stringify([parts.date,configured,lat,lon,location.timezone,data?dataIds.get(data):0]);
  let day=dayCache.get(cacheKey);
  if(!day){
    const noon=epochForZoned(parts.date,720,location.timezone);
    const times=configured?SunCalc.getTimes(new Date(noon),lat,lon):{};
    const daily=data?.daily?.find(d=>d.date===parts.date);
    const valid=v=>Number.isFinite(v)&&v>0&&Math.abs(v-noon)<24*3600000;
    const sunrise=valid(daily?.sunrise)?daily.sunrise:valid(times.sunrise?.getTime())?times.sunrise.getTime():null;
    const sunset=valid(daily?.sunset)?daily.sunset:valid(times.sunset?.getTime())?times.sunset.getTime():null;
    const solarNoon=valid(times.solarNoon?.getTime())?times.solarNoon.getTime():noon;
    let moonrise=daily?.moonrise??null,moonset=daily?.moonset??null;
    if(configured&&(moonrise===null||moonset===null)){
      for(const delta of [-1,0,1]){
        const t=SunCalc.getMoonTimes(new Date(noon+delta*86400000),lat,lon,true);
        if(t.rise&&zonedParts(t.rise.getTime(),location.timezone).date===parts.date)moonrise??=t.rise.getTime();
        if(t.set&&zonedParts(t.set.getTime(),location.timezone).date===parts.date)moonset??=t.set.getTime();
      }
    }
    day={sunrise,sunset,solarNoon,moonrise,moonset,daily};dayCache.set(cacheKey,day);if(dayCache.size>48)dayCache.delete(dayCache.keys().next().value);
  }
  const {sunrise,sunset,solarNoon,moonrise,moonset,daily}=day;
  const illumination=SunCalc.getMoonIllumination(new Date(epoch));
  let phase=Number.isFinite(daily?.moonPhase)?daily.moonPhase:illumination.phase;
  const index=data?.daily?.findIndex(d=>d.date===parts.date),next=data?.daily?.[index+1];
  if(Number.isFinite(daily?.moonPhase)&&Number.isFinite(next?.moonPhase)){const delta=((next.moonPhase-phase+1.5)%1)-.5;phase=(phase+delta*parts.minutes/1440+1)%1;}
  const moonPosition=SunCalc.getMoonPosition(new Date(epoch),lat,lon);
  return {...parts,sunrise,sunset,solarNoon,moonrise,moonset,
    moonPhase:phase,moonFraction:(1-Math.cos(phase*2*Math.PI))/2,moonAbove:configured&&moonPosition.altitude>0,
    moonAltitude:moonPosition.altitude,sunAltitude:configured?SunCalc.getPosition(new Date(epoch),lat,lon).altitude:0,moonLabel:moonName(phase),source:daily?'Open-Meteo + calculated horizon':configured?'Calculated astronomy':'Unconfigured fallback'};
}
