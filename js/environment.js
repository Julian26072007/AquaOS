import {calculateNaturalLighting} from './natural.js';
import {OFF,mixChannels,scaleChannels,ease} from './lighting.js';

export function evaluateEnvironment(epoch,natural,safety,data=null,options={}){
  if(!Number.isFinite(epoch))throw new Error('Invalid environment timestamp');
  return calculateNaturalLighting(epoch,natural,safety,data,{current:true,...options});
}

// Manual palettes vary globally. One-shot dawn/dusk use time since selection.
export function evaluateManualLighting(preset,epoch,elapsed=0){
  const seconds=(epoch-Date.UTC(2020,0,1))/1000;
  const effect=preset.effect;
  if(!effect)return preset.channels??OFF;
  const wave=period=>.5+.5*Math.sin(2*Math.PI*seconds/period);
  if(effect==='rainbow'){
    const palette=[preset.channels,...preset.accents];
    const position=((seconds%180+180)%180)/60,index=Math.floor(position);
    return mixChannels(palette[index],palette[(index+1)%palette.length],ease(position-index));
  }
  if(effect==='sunrise')return scaleChannels(preset.channels,1-.65*Math.exp(-elapsed/90));
  if(effect==='sunset')return scaleChannels(preset.channels,.3+.7*Math.exp(-elapsed/100));
  const period={clouds:600,storm:780,waves:45,sparkle:90}[effect];
  return scaleChannels(preset.channels,.91+.09*wave(period));
}
