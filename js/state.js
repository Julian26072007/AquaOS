import { getPreset } from './presets.js';
import {DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,validateSchedule} from './schedule.js';
const KEY = 'aquaos.settings.v1';
export function createStore(storage) {
  let saved;
  try { saved=JSON.parse(storage?.getItem(KEY)); } catch { /* Private browsing or damaged data: use defaults. */ }
  // Migrate the v0.4 name if it is imported in future.
  const initial = saved?.presetId === 'moon' ? 'moonlight' : saved?.presetId;
  let schedule=DEFAULT_SCHEDULE,cycleSettings=DEFAULT_CYCLE_SETTINGS;
  try{validateSchedule(saved?.schedule,saved?.cycleSettings||DEFAULT_CYCLE_SETTINGS);schedule=Object.freeze({...saved.schedule});cycleSettings=Object.freeze({...DEFAULT_CYCLE_SETTINGS,...saved.cycleSettings});}catch{/* Migrate legacy/invalid settings safely. */}
  let state=Object.freeze({presetId:getPreset(initial)?.id || 'sunny',mode:saved?.mode==='automatic'?'automatic':'manual',schedule,cycleSettings});
  const listeners=new Set();
  function save(next){state=Object.freeze(next);try{storage?.setItem(KEY,JSON.stringify({version:2,...state}));}catch{}listeners.forEach(fn=>fn(state));}
  return {
    setMode(mode){if(!['manual','automatic'].includes(mode)||mode===state.mode)return;save({...state,mode});},
    saveSchedule(schedule,cycleSettings){validateSchedule(schedule,cycleSettings);save({...state,schedule:Object.freeze({...schedule}),cycleSettings:Object.freeze({...cycleSettings})});},
    getState:()=>state,
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    selectPreset(id){
      if(!getPreset(id)||(id===state.presetId&&state.mode==='manual'))return;
      save({...state,presetId:id,mode:'manual'});
    },
  };
}
