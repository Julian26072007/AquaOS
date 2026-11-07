// Visible simulation time uses actual elapsed timestamps, never frame counts.
// Pausing the tab resets the timestamp so hidden time is intentionally excluded.
export class AnimationClock {
  constructor(){this.elapsed=0;this.last=null;}
  reset(){this.last=null;}
  advance(now){
    if(this.last!==null)this.elapsed+=Math.max(0,(now-this.last)/1000);
    this.last=now;return this.elapsed;
  }
}
export function createLightning(seed=1987){
  let state=seed>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  let next=5+random()*8;
  const events=[];
  return t=>{
    while(next<t+30){
      const duration=.08+random()*.12;
      events.push({at:next,duration,strength:.35+random()*.35});
      if(random()>.45)events.push({at:next+.22+random()*.25,duration:duration*.7,strength:.25+random()*.3});
      next+=11+random()*24;
    }
    let flash=0;
    // Binary search keeps sampling cheap even after days of continuous use.
    let lo=0,hi=events.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(events[mid].at<=t)lo=mid+1;else hi=mid;}
    for(let i=Math.max(0,lo-2);i<lo;i++){const e=events[i],phase=(t-e.at)/e.duration;if(phase>=0&&phase<1)flash=Math.max(flash,e.strength*Math.sin(Math.PI*phase));}
    return flash;
  };
}
