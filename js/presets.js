import {normalizeChannels} from './lighting.js';

export const presets=Object.freeze([
  ['sunny','Sunny','☀','#e2cc85','Bright, natural daylight.',[.22,.28,.21,.49,.88]],
  ['clouds','Clouds','☁','#bbd1d5','Soft daylight that gently dims and returns.',[.15,.21,.25,.36,.69],'clouds'],
  ['sunrise','Sunrise','◔','#edbc84','A gentle glow in honey and gold.',[.42,.13,.025,.64,.05],'sunrise'],
  ['sunset','Sunset','◒','#dc968b','The last warm glow of the day.',[.43,.065,.10,.42,.035],'sunset'],
  ['storm','Storm','ϟ','#b6afda','Dim, cool daylight under heavy clouds.',[.11,.13,.25,.12,.36],'storm'],
  ['moonlight','Moonlight','☾','#9caedb','A quiet world beneath a silver-blue moon.',[.001,.004,.032,0,.012]],
  ['waves','Waves','≈','#8cc8c2','A slow pulse of cool, sunlit color.',[.12,.31,.32,.38,.77],'waves'],
  ['rainbow','Rainbow','◎','#d3a9c2','A slow blend of aquarium-wide colors.',[.45,.15,.24,.27,.39],'rainbow'],
  ['sparkle','Sparkle','✧','#d9d8ac','A gentle ebb and return of daylight.',[.23,.29,.16,.53,.75],'sparkle'],
].map(([id,name,icon,tone,description,levels,effect])=>{
  const [red,green,blue,warmWhite,coolWhite]=levels;
  return Object.freeze({id,name,icon,tone,description,effect,
    channels:normalizeChannels({red,green,blue,warmWhite,coolWhite}),
    ...(effect==='rainbow'?{accents:Object.freeze([
      normalizeChannels({red:.12,green:.44,blue:.18,warmWhite:.34,coolWhite:.32}),
      normalizeChannels({red:.16,green:.19,blue:.50,warmWhite:.16,coolWhite:.46}),
    ])}:{}),
  });
}));
export const getPreset=id=>presets.find(p=>p.id===id);
export const customPreset=Object.freeze({id:'custom',name:'Manual channels',description:'Five global channel levels.'});
