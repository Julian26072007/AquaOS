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
