import {validateNatural,naturalPlan} from './natural.js';
import {zonedParts} from './astronomy.js';
/** Serializable draft for a future autonomous controller. No transport/output.
 * Preview-tagged data is deliberately rejected at this future boundary. */
export function buildDevicePlan(realOutput,natural,policy,data=null){
  if(realOutput?.source!=='real'||realOutput.mode!=='natural'||!Number.isFinite(realOutput.at))throw new Error('Device plans require real Natural Mode output');
  validateNatural(natural,policy);
  const date=zonedParts(realOutput.at,natural.timezone).date;
  const windows=[-1,0,1,2].map(days=>{
    const day=new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10),p=naturalPlan(day,natural,policy,data);
    return {date:day,start:p.start,dayEnd:p.dayEnd,end:p.end,twilightMinutes:p.twilight,sunriseMinutes:p.rise,sunsetMinutes:p.set,maxBrightness:p.peak};
  });
  return {schema:'aquaos-natural-plan/1',createdAt:realOutput.at,expiresAt:realOutput.at+48*3600000,timezone:natural.timezone,policy:{...policy},windows,
    startup:'off-and-slew',runtime:{...(realOutput.cycle?.safetyState||{episodeStart:null,darkUntil:0})},onExpiry:'off',onClockFailure:'off',weatherFallback:'bounded-neutral',lightning:false,moonlight:'disabled-until-horizon-aware-firmware'};
}
