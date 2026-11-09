import {CHANNELS,normalizeChannels} from './lighting.js';
import { getPreset } from './presets.js';
import {DEFAULT_NATURAL,validateNatural} from './natural.js';
import {DEFAULT_SAFETY} from './safety.js';
import {DEFAULT_SCHEDULE,DEFAULT_CYCLE_SETTINGS,validateSchedule} from './schedule.js';
const KEY = 'aquaos.settings.v1';
export function createStore(storage) {
  let saved;
  try { saved=JSON.parse(storage?.getItem(KEY)); } catch { /* Private browsing or damaged data: use defaults. */ }
  // Migrate the v0.4 name if it is imported in future.
  const initial = saved?.presetId === 'moon' ? 'moonlight' : saved?.presetId;
  let schedule=DEFAULT_SCHEDULE,cycleSettings=DEFAULT_CYCLE_SETTINGS;
  try{validateSchedule(saved?.schedule,saved?.cycleSettings||DEFAULT_CYCLE_SETTINGS);schedule=Object.freeze({...saved.schedule});cycleSettings=Object.freeze({...DEFAULT_CYCLE_SETTINGS,...saved.cycleSettings});}catch{/* Migrate legacy/invalid settings safely. */}
  let natural=DEFAULT_NATURAL,safety=DEFAULT_SAFETY;
  try{validateNatural(saved?.natural,saved?.safety);natural=Object.freeze({...saved.natural});safety=Object.freeze({...saved.safety});}catch{/* Conservative defaults for missing/invalid natural configuration. */}
  const manualChannels=CHANNELS.every(key=>Number.isFinite(saved?.manualChannels?.[key]))?normalizeChannels(saved.manualChannels):null;
  let state=Object.freeze({natural,safety,manualChannels,presetId:getPreset(initial)?.id || 'sunny',mode:['automatic','natural'].includes(saved?.mode)?saved.mode:'manual',schedule,cycleSettings});
  const listeners=new Set();
  function save(next){state=Object.freeze(next);try{storage?.setItem(KEY,JSON.stringify({version:3,...state}));}catch{}listeners.forEach(fn=>fn(state));}
  return {
    setMode(mode){if(!['manual','automatic','natural'].includes(mode)||mode===state.mode)return;save({...state,mode});},
    saveConfiguration(schedule,cycleSettings,natural,safety){validateSchedule(schedule,cycleSettings);validateNatural(natural,safety);save({...state,schedule:Object.freeze({...schedule}),cycleSettings:Object.freeze({...cycleSettings}),natural:Object.freeze({...natural}),safety:Object.freeze({...safety})});},
    saveSchedule(schedule,cycleSettings){validateSchedule(schedule,cycleSettings);save({...state,schedule:Object.freeze({...schedule}),cycleSettings:Object.freeze({...cycleSettings})});},
    getState:()=>state,
    subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    setManualChannels(values){
      const manualChannels=normalizeChannels(values);
      if(state.mode==='manual'&&CHANNELS.every(key=>manualChannels[key]===state.manualChannels?.[key]))return;
      save({...state,manualChannels,mode:'manual'});
    },
    selectPreset(id){
      if(!getPreset(id)||(id===state.presetId&&state.mode==='manual'&&!state.manualChannels))return;
      save({...state,presetId:id,manualChannels:null,mode:'manual'});
    },
  };
}
