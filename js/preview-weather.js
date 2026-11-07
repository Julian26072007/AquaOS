// Developer fixtures are consumed only by the independent preview controller.
export const PREVIEW_WEATHER=Object.freeze(Object.fromEntries([
  ['clear',5,0,0],['partly-cloudy',45,0,2],['cloudy',72,0,3],
  ['overcast',100,0,3],['rain',95,4,63],['thunderstorm',100,8,95],
].map(([name,cloud,precipitation,code])=>[name,Object.freeze({cloud,low:cloud,mid:cloud,high:cloud,precipitation,rain:precipitation,code,windSpeed:4,windDirection:240,radiation:null,source:'simulation'})])));
