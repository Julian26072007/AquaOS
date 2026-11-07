import {presets,getPreset} from './presets.js';
import {createStore} from './state.js';
import {AquariumRenderer} from './renderer.js';
// Hardware is intentionally not connected by the UI. A future integration can
// subscribe to the store and pass versioned intents to its verified adapter.
let storage;try{storage=window.localStorage;}catch{/* Storage may be blocked. */}
const store=createStore(storage);
const grid=document.querySelector('#presets');
for(const p of presets){
  const button=document.createElement('button');button.type='button';button.className='preset';button.dataset.preset=p.id;button.style.setProperty('--tone',p.tone);button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='preset-icon';icon.setAttribute('aria-hidden','true');icon.textContent=p.icon;
  const name=document.createElement('span');name.className='preset-name';name.textContent=p.name;
  const check=document.createElement('span');check.className='check';check.setAttribute('aria-hidden','true');check.textContent='✓';
  button.append(icon,name,check);button.addEventListener('click',()=>store.selectPreset(p.id));grid.append(button);
}
const renderer=new AquariumRenderer(document.querySelector('#scene'),getPreset(store.getState().presetId));
function update(state,announce=true){const p=getPreset(state.presetId);document.querySelector('#preset-name').textContent=p.name;document.querySelector('#preset-description').textContent=p.description;grid.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===p.id)));renderer.setPreset(p);if(announce)document.querySelector('#announcement').textContent=`${p.name} preview selected. ${p.description}`;}
store.subscribe(update);update(store.getState(),false);
