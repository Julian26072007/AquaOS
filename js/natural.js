import {calculateLightingAtTime,formatTime} from './schedule.js';
import {astronomyAt,zonedParts,epochForZoned} from './astronomy.js';
import {DEFAULT_SAFETY,validateSafety,safeBudget,constrainTarget} from './safety.js';
import {weatherAt,weatherLabel} from './weather.js';
export const DEFAULT_NATURAL=Object.freeze({locationName:'',latitude:null,longitude:null,timezone:'UTC',photoperiodHours:9,offsetMinutes:0,sunriseMinutes:60,sunsetMinutes:60,dayBrightness:.8,seasonalStrength:.25,moonEnabled:false,moonCap:.001,moonCloudAttenuation:true,twilightMinutes:0});
const validTimezones=new Set();
export function validateNatural(n,policy=DEFAULT_SAFETY){
  validateSafety(policy);
  if(!n||typeof n.locationName!=='string'||n.locationName.length>100)throw new Error('Enter a short aquarium location name.');
  const missing=n.latitude===null&&n.longitude===null;
  if(!missing&&(!Number.isFinite(n.latitude)||Math.abs(n.latitude)>90||!Number.isFinite(n.longitude)||Math.abs(n.longitude)>180))throw new Error('Enter valid aquarium latitude and longitude.');
  if(typeof n.timezone!=='string'||!n.timezone)throw new Error('Enter the aquarium timezone.');
  if(!validTimezones.has(n.timezone)){try{new Intl.DateTimeFormat('en',{timeZone:n.timezone}).format();validTimezones.add(n.timezone);}catch{throw new Error('Enter a valid IANA timezone, such as Europe/Vienna.');}}
  const ranges={photoperiodHours:[1,16],offsetMinutes:[-360,360],sunriseMinutes:[5,240],sunsetMinutes:[5,240],dayBrightness:[0,1],seasonalStrength:[0,1],moonCap:[0,.01],twilightMinutes:[0,30]};
  for(const [key,[min,max]] of Object.entries(ranges))if(!Number.isFinite(n[key])||n[key]<min||n[key]>max)throw new Error(`Invalid natural setting: ${key}`);
  if(typeof n.moonEnabled!=='boolean'||typeof n.moonCloudAttenuation!=='boolean')throw new Error('Invalid moonlight settings.');
  return true;
}
const dateShift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const ease=x=>{const k=Math.max(0,Math.min(1,x));return k*k*(3-2*k);};
function anchorFor(date,n,data){
  const a=astronomyAt(epochForZoned(date,720,n.timezone),n,data);
  const center=a.sunrise!==null&&a.sunset!==null&&(a.sunset-a.sunrise)>0?(a.sunrise+a.sunset)/2:a.solarNoon;
  return {at:center+n.offsetMinutes*60000,astronomy:a};
}
function buildPlan(date,n,policy,data=null){
  const center=anchorFor(date,n,data),previous=anchorFor(dateShift(date,-1),n,data),next=anchorFor(dateShift(date,1),n,data);
  const sun=center.astronomy,solarHours=sun.sunrise!==null&&sun.sunset!==null?(sun.sunset-sun.sunrise)/3600000:12;
  const budget=safeBudget(n,policy,solarHours);
  // Absolute-time spacing protects the dark interval even on 23/25-hour days.
  const spacing=Math.min(center.at-previous.at,next.at-center.at)/3600000;
  const total=Math.max(0,Math.floor(Math.min(budget.total,(spacing-policy.minDarkHours)*60)));
  const moon=n.moonEnabled?Math.min(60,Math.floor(total*.15)):0,day=total-moon;
  const twilight=Math.min(Math.floor(n.twilightMinutes),Math.floor(day*.1));
  const available=Math.max(3,day-twilight-1),rampMin=Math.ceil(1.5*Math.min(n.dayBrightness,policy.maxBrightness)/policy.maxChangePerMinute);
  let rise=Math.max(n.sunriseMinutes,rampMin),set=Math.max(n.sunsetMinutes,rampMin);
  const scale=Math.min(1,available/(rise+set));rise=Math.max(1,Math.floor(rise*scale));set=Math.max(1,Math.floor(set*scale));
  const peak=Math.max(0,Math.min(n.dayBrightness,policy.maxBrightness,Math.min(rise,set)*policy.maxChangePerMinute/1.5));
  const start=Math.round(center.at-total*30000);
  const dayEnd=start+day*60000,moonSky=moon?astronomyAt(dayEnd,n,data):null;
  const moonEligible=Boolean(moonSky?.moonAbove&&moonSky.sunAltitude<-.0145);
  return {date,start,end:start+total*60000,dayEnd,total,day,moon,moonEligible,twilight,rise,set,peak,sun};
}
const planCache=new Map(),dataIds=new WeakMap();let dataId=1;
export function naturalPlan(date,n,policy,data=null){
  if(data&&!dataIds.has(data))dataIds.set(data,dataId++);
  const key=JSON.stringify([date,n,policy,data?dataIds.get(data):0]);
  if(!planCache.has(key)){const p=buildPlan(date,n,policy,data);planCache.set(key,Object.freeze({...p,sun:Object.freeze({...p.sun})}));if(planCache.size>48)planCache.delete(planCache.keys().next().value);}
  return planCache.get(key);
}
/** Pure bounded target calculation. Weather has no authority over the window. */
export function calculateNaturalLighting(epoch,n=DEFAULT_NATURAL,policy=DEFAULT_SAFETY,data=null,{now=epoch,current=false,weatherOverride=null}={}){
  validateNatural(n,policy);
  const at=astronomyAt(epoch,n,data),weather=weatherOverride||weatherAt(epoch,data,now,{current});
  const plans=[-1,0,1].map(d=>naturalPlan(dateShift(at.date,d),n,policy,data));
  const plan=plans.find(p=>epoch>=p.start&&epoch<p.end)||plans[1];
  const elapsed=(epoch-plan.start)/60000,inside=epoch>=plan.start&&epoch<plan.end;
  const cloud=Math.max(0,Math.min(1,(Number.isFinite(weather.cloud)?weather.cloud:40)/100));
  const rain=Math.max(0,Math.min(1,(Number.isFinite(weather.precipitation)?weather.precipitation:0)/8));
  const solar=weather.radiation===null||!Number.isFinite(weather.radiation)?1:.95+.05*Math.max(0,Math.min(1,weather.radiation/700));
  const weatherFactor=Math.max(policy.minWeatherFactor,Math.min(1,(1-.25*cloud-.08*rain-(weather.code>=95?.08:0))*solar));
  const schedule={sunriseStart:plan.twilight,sunriseDuration:plan.rise,sunsetStart:Math.max(plan.twilight+plan.rise+1,plan.day-plan.set),sunsetDuration:plan.set};
  let cycle=calculateLightingAtTime(Math.max(0,Math.min(1439,elapsed)),schedule,{dayBrightness:plan.peak*weatherFactor,moonlightEnabled:false,moonlightIntensity:0});
  if(!inside||elapsed>=plan.day)cycle={...cycle,phase:'Night',brightness:0,progress:0};
  if(inside&&elapsed<plan.twilight){cycle={...cycle,phase:'Twilight',brightness:Math.min(.003,plan.peak)*ease(elapsed/plan.twilight),progress:0};}
  else if(inside&&cycle.phase==='Sunrise'&&plan.twilight){cycle.brightness+=Math.min(.003,plan.peak)*(1-cycle.progress);}
  if(inside&&elapsed>=plan.day&&n.moonEnabled&&plan.moonEligible&&at.moonAbove&&at.sunAltitude<-.0145){
    const horizon=ease(at.moonAltitude*180/Math.PI/8),solarDarkness=ease((-at.sunAltitude*180/Math.PI-.833)/6),moonCloud=n.moonCloudAttenuation?1-cloud*.65:1;
    const envelope=ease((elapsed-plan.day)/5)*ease((plan.total-elapsed)/5);
    cycle={...cycle,phase:'Moonlight',brightness:Math.min(n.moonCap,policy.moonlightCap)*at.moonFraction*horizon*solarDarkness*moonCloud*envelope,progress:0};
  }
  const night=cycle.phase==='Night',moon=cycle.phase==='Moonlight',twilight=cycle.phase==='Twilight';
  const tint=moon?[.80,.85,.9]:twilight?[.85,.60,.42]:cycle.preset.lighting.tint;
  // Transfer direct energy to diffuse sky light as cloud cover closes. Keep the
  // unshadowed energy approximately constant before bounded weather dimming.
  const diffuse=night||moon||twilight?0:cloud*cloud*.9,ambient=.44+.66*diffuse,direct=.68*(1-diffuse);
  // Conservative RGB energy envelope (including clear-water caustics) reserves
  // the configured daylight floor while allowing the remaining direct light to move.
  const transmissionFloor=Math.max(.18,Math.min(1,((.44+.68*1.02)*policy.minWeatherFactor/weatherFactor-ambient)/(direct*.94)));
  const windSpeed=Math.max(0,Math.min(20,Number.isFinite(weather.windSpeed)?weather.windSpeed:2));
  const bearing=(Number.isFinite(weather.windDirection)?weather.windDirection:250)*Math.PI/180;
  const drift=.003+.025*Math.sqrt(windSpeed/20);
  const nextPlan=plans.find(p=>p.start>epoch)||naturalPlan(dateShift(at.date,2),n,policy,data);
  const tomorrow=astronomyAt(epochForZoned(dateShift(at.date,1),720,n.timezone),n,data);
  const nextAstro=[{label:'Sunrise',at:at.sunrise},{label:'Sunset',at:at.sunset},{label:'Sunrise',at:tomorrow.sunrise},{label:'Sunset',at:tomorrow.sunset}].filter(event=>Number.isFinite(event.at)&&event.at>epoch).sort((a,b)=>a.at-b.at)[0]||{label:'Sunrise',at:null};
  const preset={...cycle.preset,id:'natural',name:cycle.phase,cloudDensity:night||moon?0:cloud*(.7+(weather.low??cloud*100)/100*.2+(weather.mid??cloud*100)/100*.1)*.95,cloudCoverage:cloud,cloudTransmissionFloor:transmissionFloor,shaftStrength:night||moon||twilight?0:.018*4*cloud*(1-cloud)*(1-rain),allowLightning:false,
    wind:{x:-Math.sin(bearing)*drift,y:-Math.cos(bearing)*drift},rgbGain:moon?.2:cycle.preset.rgbGain,whiteBalance:moon?.5:(cycle.preset.whiteBalance??.48)-rain*.12,
    lighting:{...cycle.preset.lighting,tint,ambient:cycle.brightness*ambient,direct:cycle.brightness*direct,caustics:night||moon?0:.06*(1-cloud)**2}};
  const next=inside?(elapsed<plan.twilight?plan.start+plan.twilight*60000:elapsed<plan.twilight+plan.rise?plan.start+(plan.twilight+plan.rise)*60000:elapsed<plan.day-plan.set?plan.dayEnd-plan.set*60000:elapsed<plan.day?plan.dayEnd:plan.end):nextPlan.start;
  const description=`${weatherLabel(weather)} · ${cycle.phase}`;
  preset.description=description;
  return constrainTarget({...cycle,minutes:at.minutes,preset,astronomy:at,weather,weatherFactor,plan,description,moonEnabled:n.moonEnabled,nextTransition:next,nextPhase:'Transition',nextAstronomy:nextAstro,darknessRequired:night},policy);
}
