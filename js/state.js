import { getPreset } from './presets.js';
const KEY = 'aquaos.settings.v1';
export function createStore(storage) {
  let saved;
  try { saved=JSON.parse(storage?.getItem(KEY)); } catch { /* Private browsing or damaged data: use defaults. */ }
  // Migrate the v0.4 name if it is imported in future.
  const initial = saved?.presetId === 'moon' ? 'moonlight' : saved?.presetId;
  let state=Object.freeze({presetId:getPreset(initial)?.id || 'sunny'});
  const listeners=new Set();
  return {
    getState:()=>state,
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    selectPreset(id){
      if(!getPreset(id) || id===state.presetId)return;
      state=Object.freeze({...state,presetId:id});
      try {storage?.setItem(KEY,JSON.stringify({version:1,...state}));} catch { /* Selection still works without persistence. */ }
      listeners.forEach(fn=>fn(state));
    },
  };
}
