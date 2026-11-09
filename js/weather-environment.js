import {createNoise} from './noise.js';

const noise=createNoise(19427),origin=Date.UTC(2020,0,1);
const clamp=x=>Math.max(0,Math.min(1,x));
const finite=(x,fallback)=>Number.isFinite(x)?x:fallback;
/** Central continuous state. All intensities/coverage/variability are [0,1];
 * opticalDepth is dimensionless [0,3], wind m/s and meteorological degrees.
 * Radiation inputs remain horizontal W/m² in the original weather record.
 * Provider data are model estimates/forecasts, never local measurements.
 * Procedural values are separately identified; descriptions never drive them. */
export function continuousWeather(epoch,weather){
  const t=(epoch-origin)/1000,base=clamp(finite(weather.cloud,40)/100);
  const variability=4*base*(1-base);
  const variation=(scale,lane)=>2*noise(t/scale,lane)-1;
  const windSpeed=Math.max(0,Math.min(40,finite(weather.windSpeed,2)));
  const windMix=clamp(windSpeed/20);
  // Wind shifts the balance toward shorter fluctuations on fixed time tracks.
  // Updating wind changes their weights, never their phase or seed.
  const slow=variation(840,3),quick=variation(260,5);
  const coverage=clamp(base+.14*variability*(slow+(quick-slow)*windMix));
  const rainBase=clamp(finite(weather.rain,finite(weather.precipitation,0))/8);
  const snowBase=clamp(finite(weather.snowfall,0)/2); // API cm per interval, 2 cm = full intensity
  const rainIntensity=clamp(rainBase*(1+.18*variation(420,13)));
  const snowIntensity=clamp(snowBase*(1+.1*variation(1200,17)));
  const haze=Number.isFinite(weather.visibility)?clamp(1-weather.visibility/20000):clamp(.08*coverage+.18*rainIntensity+.22*snowIntensity);
  const layers=(finite(weather.low,base*100)*.2+finite(weather.mid,base*100)*.07+finite(weather.high,base*100)*.03)/100;
  const opticalDepth=Math.max(0,Math.min(3,(.7+layers)*(.65+.35*coverage)*(1+.12*variability*variation(1500,9))));
  return {cloudCoverage:coverage,cloudOpacity:1-Math.exp(-opticalDepth),opticalDepth,
    rainIntensity,snowIntensity,haze,variability,windSpeed,
    windDirection:(finite(weather.windDirection,250)%360+360)%360,
    provenance:{cloudCoverage:weather.estimatedFields?.includes('cloud')?'estimated':weather.source??'estimated',opticalDepth:'estimated + procedural',
      rainIntensity:weather.source!=='estimated'&&Number.isFinite(weather.rain)&&!weather.estimatedFields?.includes('rain')?'provider + procedural':'estimated + procedural',
      snowIntensity:Number.isFinite(weather.snowfall)&&!weather.estimatedFields?.includes('snowfall')?'provider + procedural':'estimated',
      haze:Number.isFinite(weather.visibility)?'visibility estimate':'estimated',wind:weather.source!=='estimated'&&Number.isFinite(weather.windSpeed)&&!weather.estimatedFields?.includes('windSpeed')?'provider':'estimated',variability:'procedural'}};
}
