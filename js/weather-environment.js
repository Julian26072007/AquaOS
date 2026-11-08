import {createNoise} from './noise.js';

const noise=createNoise(19427),origin=Date.UTC(2020,0,1);
const clamp=x=>Math.max(0,Math.min(1,x));
const finite=(x,fallback)=>Number.isFinite(x)?x:fallback;
export function windVelocity(weather){
  const speed=Math.max(0,Math.min(40,finite(weather.windSpeed,2)));
  const bearing=finite(weather.windDirection,250)*Math.PI/180;
  // Tank widths per simulation second; wind is meteorological FROM bearing.
  const rate=.000025+.00011*Math.sqrt(speed/20);
  return {x:-Math.sin(bearing)*rate,y:-Math.cos(bearing)*rate};
}
/** Integrate forecast wind, rather than multiplying the current velocity by
 * absolute time (which teleports clouds when wind changes). Smoothstep endpoint
 * velocities have an analytic integral. No frame history or midnight reset.
 * Before the forecast begins use a fixed reference wind, independent of it. */
function integrateWind(epoch,data,weather){
  const baseline=windVelocity({windSpeed:2,windDirection:250});
  const rows=data?.hourly;
  if(!rows?.length){const v=windVelocity(weather),t=(epoch-origin)/1000;return {x:v.x*t,y:v.y*t};}
  const start=rows[0].at,t=(Math.min(epoch,start)-origin)/1000;
  const result={x:baseline.x*t,y:baseline.y*t};
  for(let i=0;i<rows.length-1&&epoch>rows[i].at;i++){
    const a=rows[i],b=rows[i+1],duration=(b.at-a.at)/1000;
    const u=clamp((epoch-a.at)/(b.at-a.at)),integral=u*u*u-.5*u*u*u*u;
    const av=windVelocity(a),bv=windVelocity(b);
    for(const axis of ['x','y'])result[axis]+=duration*(av[axis]*u+(bv[axis]-av[axis])*integral);
  }
  if(epoch>rows.at(-1).at){const v=windVelocity(rows.at(-1)),dt=(epoch-rows.at(-1).at)/1000;result.x+=v.x*dt;result.y+=v.y*dt;}
  return result;
}
/** Provider refreshes carry a trajectory anchor, preserving the cloud position
 * at acquisition while allowing the new forecast to change future velocity. */
export function cloudDisplacement(epoch,data,weather){
  const position=integrateWind(epoch,data,weather),anchor=data?.windAnchor;
  if(anchor&&[anchor.at,anchor.x,anchor.y].every(Number.isFinite)){
    const reference=integrateWind(anchor.at,data,weather);
    position.x+=anchor.x-reference.x;position.y+=anchor.y-reference.y;
  }
  return position;
}
/** Central continuous state. All intensities/coverage/variability are [0,1];
 * opticalDepth is dimensionless [0,3], wind m/s and meteorological degrees.
 * Radiation inputs remain horizontal W/m² in the original weather record.
 * Provider data are model estimates/forecasts, never local measurements.
 * Procedural values are separately identified; descriptions never drive them. */
export function continuousWeather(epoch,weather,data=null){
  const t=(epoch-origin)/1000,base=clamp(finite(weather.cloud,40)/100);
  const variability=4*base*(1-base);
  const variation=(scale,lane)=>2*noise(t/scale,lane)-1;
  const coverage=clamp(base+.055*variability*variation(900,3));
  const rainBase=clamp(finite(weather.rain,finite(weather.precipitation,0))/8);
  const snowBase=clamp(finite(weather.snowfall,0)/2); // API cm per interval, 2 cm = full intensity
  const rainIntensity=clamp(rainBase*(1+.18*variation(420,13)));
  const snowIntensity=clamp(snowBase*(1+.1*variation(1200,17)));
  const haze=Number.isFinite(weather.visibility)?clamp(1-weather.visibility/20000):clamp(.08*coverage+.18*rainIntensity+.22*snowIntensity);
  const layers=(finite(weather.low,base*100)*.2+finite(weather.mid,base*100)*.07+finite(weather.high,base*100)*.03)/100;
  const opticalDepth=Math.max(0,Math.min(3,(.7+layers)*(.65+.35*coverage)*(1+.12*variability*variation(1500,9))));
  return {cloudCoverage:coverage,cloudOpacity:1-Math.exp(-opticalDepth),opticalDepth,
    rainIntensity,snowIntensity,haze,variability,windSpeed:Math.max(0,Math.min(40,finite(weather.windSpeed,2))),
    windDirection:(finite(weather.windDirection,250)%360+360)%360,
    cloudMotion:cloudDisplacement(epoch,data,weather),shimmerEnergy:clamp(finite(weather.windSpeed,2)/20),
    provenance:{cloudCoverage:weather.estimatedFields?.includes('cloud')?'estimated':weather.source??'estimated',opticalDepth:'estimated + procedural',
      rainIntensity:weather.source!=='estimated'&&Number.isFinite(weather.rain)&&!weather.estimatedFields?.includes('rain')?'provider + procedural':'estimated + procedural',
      snowIntensity:Number.isFinite(weather.snowfall)&&!weather.estimatedFields?.includes('snowfall')?'provider + procedural':'estimated',
      haze:Number.isFinite(weather.visibility)?'visibility estimate':'estimated',wind:weather.source!=='estimated'&&Number.isFinite(weather.windSpeed)&&!weather.estimatedFields?.includes('windSpeed')?'provider':'estimated',variability:'procedural'}};
}
