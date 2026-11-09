import {CHANNELS,normalizeChannels} from './lighting.js';

export const DEFAULT_DMX_MAPPING=Object.freeze({red:1,green:2,blue:3,warmWhite:4,coolWhite:5});

/** Return DMX slot/value pairs. Slot 6 is reserved for the unused output. */
export function mapDmxChannels(output,mapping=DEFAULT_DMX_MAPPING){
  const slots=CHANNELS.map(key=>mapping?.[key]);
  if(new Set(slots).size!==CHANNELS.length||slots.some(slot=>!Number.isInteger(slot)||slot<1||slot>512||slot===6)){
    throw new RangeError('Assign five distinct DMX slots from 1 to 512, excluding unused slot 6.');
  }
  const levels=normalizeChannels(output);
  return Object.freeze(Object.fromEntries(CHANNELS.map((key,index)=>[slots[index],Math.round(levels[key]*255)])));
}
