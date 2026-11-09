export const CHANNELS=Object.freeze(['red','green','blue','warmWhite','coolWhite']);
export const CHANNEL_LABELS=Object.freeze({red:'Red',green:'Green',blue:'Blue',warmWhite:'Warm White',coolWhite:'Cool White'});
export const clampLevel=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
export const mix=(a,b,k)=>a+(b-a)*k;
export const ease=value=>{const k=clampLevel(value);return k*k*(3-2*k);};
const channels=callback=>Object.freeze(Object.fromEntries(CHANNELS.map(key=>[key,clampLevel(callback(key))])));
export const OFF=channels(()=>0);
export const normalizeChannels=values=>channels(key=>values?.[key]);
export const scaleChannels=(values,level)=>channels(key=>values[key]*level);
export const mixChannels=(a,b,k)=>channels(key=>mix(a[key],b[key],k));

export const DAWN=normalizeChannels({red:.22,green:.06,blue:.01,warmWhite:1,coolWhite:.06});
export const DAY=normalizeChannels({red:.37,green:.35,blue:.34,warmWhite:.61,coolWhite:1});
export const MOON=normalizeChannels({red:.02,green:.13,blue:1,warmWhite:0,coolWhite:.28});
