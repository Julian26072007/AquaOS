import {normalizeChannels} from './lighting.js';
import {mapDmxChannels} from './hardware-mapping.js';
import {validateSafety} from './safety.js';

/** Future output boundary. Only real Natural output can use the safety gate.
 * The normalized values retain full precision between calls for slew limiting. */
export function prepareRealHardwareOutput(real,policy,mapping,previous=null){
  if(real?.source!=='real'||real.mode!=='natural'||!real.cycle||!Number.isFinite(real.at))throw new Error('Only real Natural Mode output can pass the safety gate');
  validateSafety(policy);
  if(previous&&!Number.isFinite(previous.at))throw new Error('Previous output requires a real timestamp');
  const seconds=previous?Math.max(0,Math.min(5,(real.at-previous.at)/1000)):0;
  const step=policy.maxChangePerMinute*seconds/60;
  const cap=real.cycle.darknessRequired?0:Math.min(policy.maxBrightness,real.cycle.phase==='Moonlight'?policy.moonlightCap:1);
  const target=normalizeChannels(real.channels),old=normalizeChannels(previous?.channels);
  const channels=normalizeChannels(Object.fromEntries(Object.entries(target).map(([key,value])=>[
    key,Math.min(cap,Math.max(old[key]-step,Math.min(old[key]+step,value))),
  ])));
  // Rounding must never produce a DMX value above a policy ceiling.
  const maxByte=Math.floor(cap*255);
  const dmx=Object.freeze(Object.fromEntries(Object.entries(mapDmxChannels(channels,mapping)).map(([slot,value])=>[slot,Math.min(maxByte,value)])));
  return {source:'real',at:real.at,channels,dmx};
}
