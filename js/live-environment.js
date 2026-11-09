import {evaluateEnvironment} from './environment.js';
import {ease,mix,mixChannels,scaleChannels} from './lighting.js';

const REFRESH_TRANSITION_MS=60000;

/** A provider revision replaces forecast inputs discretely. Crossfade the old
 * and new outputs at the same simulation time, including after interruptions. */
export function createLiveEnvironmentEvaluator(){
  let dataRef,revision,previous,transition;
  const apply=(target,epoch)=>{
    if(!transition||target.darknessRequired)return target;
    const progress=ease((epoch-transition.at)/REFRESH_TRANSITION_MS);
    if(progress===1){transition=null;return target;}
    const from=transition.from;
    // Carry the acquisition correction through the same day/moon envelope.
    // An update near dusk cannot keep light on beyond the scheduled fade.
    const sameWindow=(from.phase==='Moonlight')===(target.phase==='Moonlight');
    const scale=sameWindow&&from.windowLevel>0?target.windowLevel/from.windowLevel:0;
    const brightness=mix(from.brightness*scale,target.brightness,progress);
    const channels=mixChannels(scaleChannels(from.channels,scale),target.channels,progress);
    return {...target,brightness,channels,preset:{...target.preset,cloudCoverage:mix(from.preset.cloudCoverage,target.preset.cloudCoverage,progress)}};
  };
  return (epoch,natural,safety,data)=>{
    const key=JSON.stringify([natural,safety]);
    const evaluate=input=>evaluateEnvironment(epoch,natural,safety,input,{now:epoch,current:true});
    const target=evaluate(data);
    const estimated=target.weather.source==='estimated';
    if(data!==dataRef){
      dataRef=data;
      revision=JSON.stringify([data?.hourly,data?.daily,data?.current]);
    }
    if(!previous||previous.key!==key){transition=null;}
    else if(revision!==previous.revision||estimated!==previous.estimated){
      // Expiry invalidates the old forecast at this timestamp. Retain its last
      // applied output; valid replacements can evaluate both at the same time.
      const from=estimated!==previous.estimated?previous.output:apply(evaluate(previous.data),epoch);
      transition={at:epoch,from};
    }
    const output=apply(target,epoch);
    previous={data,key,revision,estimated,output};
    return output;
  };
}
