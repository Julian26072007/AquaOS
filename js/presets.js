// Intent-level lighting definitions. These do not describe electrical LED channels.
export const presets = Object.freeze([
  { id:'sunny', lighting:Object.freeze({ambient:.39,direct:.66,tint:[1,.99,.91],caustics:.055}), name:'Sunny', icon:'☀', tone:'#e2cc85', description:'Bright, natural daylight.', top:[133,189,150], bottom:[15,62,61] },
  { id:'clouds', lighting:Object.freeze({ambient:.44,direct:.68,tint:[.98,1,.96],caustics:.08}), name:'Clouds', icon:'☁', tone:'#bbd1d5', description:'Soft daylight beneath drifting clouds.', top:[109,158,163], bottom:[15,48,59], cloudDensity:.65 },
  { id:'sunrise', lighting:Object.freeze({ambient:.26,direct:.48,tint:[1,.81,.59],caustics:.045}), name:'Sunrise', icon:'◔', tone:'#edbc84', description:'A gentle start in honey and gold.', top:[218,151,98], bottom:[46,64,56] },
  { id:'sunset', lighting:Object.freeze({ambient:.22,direct:.5,tint:[1,.68,.44],caustics:.035}), name:'Sunset', icon:'◒', tone:'#dc968b', description:'The last warm glow of the day.', top:[172,91,100], bottom:[39,34,57] },
  { id:'storm', lighting:Object.freeze({ambient:.19,direct:.29,tint:[.74,.85,1],caustics:.025}), name:'Storm', icon:'ϟ', tone:'#b6afda', description:'Rolling shadows. A distant spark of lightning.', top:[48,66,93], bottom:[10,23,39], cloudDensity:.9 },
  { id:'moonlight', lighting:Object.freeze({ambient:.18,direct:.18,tint:[.55,.71,1],caustics:.03}), name:'Moonlight', icon:'☾', tone:'#9caedb', description:'A quiet world beneath a silver-blue moon.', top:[38,62,112], bottom:[8,18,37] },
  { id:'waves', lighting:Object.freeze({ambient:.36,direct:.65,tint:[.85,.99,1],caustics:.27}), name:'Waves', icon:'≈', tone:'#8cc8c2', description:'Sunlit ripples dancing through the water.', top:[77,166,171], bottom:[12,54,65] },
  { id:'rainbow', lighting:Object.freeze({ambient:.39,direct:.57,tint:[1,1,1],caustics:.045}), name:'Rainbow', icon:'◎', tone:'#d3a9c2', description:'A slow journey through the color spectrum.', top:[139,140,187], bottom:[29,45,64] },
  { id:'sparkle', lighting:Object.freeze({ambient:.37,direct:.62,tint:[.96,1,.88],caustics:.065}), name:'Sparkle', icon:'✧', tone:'#d9d8ac', description:'Little shimmers in a peaceful underwater world.', top:[118,171,150], bottom:[18,55,53] },
].map(p=>Object.freeze(p)));
export const getPreset = id => presets.find(p=>p.id===id);
