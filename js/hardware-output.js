import {mapLightField} from './hardware-mapping.js';
import {validateSafety} from './safety.js';
/** Pure future output gate; never sends commands. Only actual controller output
 * is accepted. Per-channel slew uses real timestamps, never animation/preview dt. */
export function prepareRealHardwareOutput(real,policy,field,capabilities,previous=null){
  if(real?.source!=='real'||real.mode!=='natural'||!real.cycle||!Number.isFinite(real.at))throw new Error('Only real Natural Mode output can pass the safety gate');
  validateSafety(policy);if(previous&&!Number.isFinite(previous.at))throw new Error('Previous output requires a real timestamp');
  const seconds=previous?Math.max(0,Math.min(5,(real.at-previous.at)/1000)):0;
  const step=policy.maxChangePerMinute*seconds/60;
  const cap=Math.min(policy.maxBrightness,real.cycle.phase==='Moonlight'?policy.moonlightCap:1);
  const commands=mapLightField(field,capabilities).map(assembly=>({id:assembly.id,channels:Object.fromEntries(Object.entries(assembly.channels).map(([channel,values])=>{
    const old=previous?.commands?.find(a=>a.id===assembly.id)?.channels?.[channel]||[];
    return [channel,values.map((target,i)=>{
      if(real.cycle.darknessRequired)return 0;
      const before=Number.isFinite(old[i])?old[i]:0;
      return Math.max(0,Math.min(cap,Math.max(before-step,Math.min(before+step,target))));
    })];
  }))}));
  return {source:'real',at:real.at,commands};
}
