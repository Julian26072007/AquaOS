// Intent-level lighting definitions. These do not describe electrical LED channels.
export const presets = Object.freeze([
  { id:'sunny', name:'Sunny', icon:'☀', tone:'#e2cc85', description:'Bright, natural daylight.', top:[133,189,150], bottom:[15,62,61], brightness:1, speed:.3 },
  { id:'clouds', name:'Clouds', icon:'☁', tone:'#bbd1d5', description:'Soft daylight beneath drifting clouds.', top:[109,158,163], bottom:[15,48,59], brightness:.8, speed:.22, cloudDensity:.65 },
  { id:'sunrise', name:'Sunrise', icon:'◔', tone:'#edbc84', description:'A gentle start in honey and gold.', top:[218,151,98], bottom:[46,64,56], brightness:.75, speed:.2 },
  { id:'sunset', name:'Sunset', icon:'◒', tone:'#dc968b', description:'The last warm glow of the day.', top:[172,91,100], bottom:[39,34,57], brightness:.6, speed:.18 },
  { id:'storm', name:'Storm', icon:'ϟ', tone:'#b6afda', description:'Rolling shadows. A distant spark of lightning.', top:[48,66,93], bottom:[10,23,39], brightness:.35, speed:.45, cloudDensity:.9 },
  { id:'moonlight', name:'Moonlight', icon:'☾', tone:'#9caedb', description:'A quiet world beneath a silver-blue moon.', top:[38,62,112], bottom:[8,18,37], brightness:.22, speed:.12 },
  { id:'waves', name:'Waves', icon:'≈', tone:'#8cc8c2', description:'Sunlit ripples dancing through the water.', top:[77,166,171], bottom:[12,54,65], brightness:.9, speed:.65 },
  { id:'rainbow', name:'Rainbow', icon:'◎', tone:'#d3a9c2', description:'A slow journey through the color spectrum.', top:[139,140,187], bottom:[29,45,64], brightness:.8, speed:.25 },
  { id:'sparkle', name:'Sparkle', icon:'✧', tone:'#d9d8ac', description:'Little shimmers in a peaceful underwater world.', top:[118,171,150], bottom:[18,55,53], brightness:.8, speed:.4 },
].map(p=>Object.freeze(p)));
export const getPreset = id => presets.find(p=>p.id===id);
