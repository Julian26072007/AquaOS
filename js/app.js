import {presets,getPreset} from './presets.js';
import {createStore} from './state.js';
import {AquariumRenderer} from './renderer.js';
import {createRealLightingController,createPreviewController} from './controllers.js';
import {formatTime,localMinutes} from './schedule.js';
const $=id=>document.getElementById(id);
let storage;try{storage=window.localStorage;}catch{/* Storage may be blocked. */}
const store=createStore(storage),real=createRealLightingController(store);
const renderer=new AquariumRenderer($('scene'),real.sample().preset);
for(const p of presets){
  const button=document.createElement('button');button.type='button';button.className='preset';button.dataset.preset=p.id;button.style.setProperty('--tone',p.tone);button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='preset-icon';icon.setAttribute('aria-hidden','true');icon.textContent=p.icon;
  const name=document.createElement('span');name.className='preset-name';name.textContent=p.name;
  const check=document.createElement('span');check.className='check';check.setAttribute('aria-hidden','true');check.textContent='✓';
  button.append(icon,name,check);button.addEventListener('click',()=>store.selectPreset(p.id));$('presets').append(button);
}
function text(id,value){if($(id).textContent!==value)$(id).textContent=value;}
function renderReal(output){
  const automatic=output.mode==='automatic',p=output.preset;
  if(automatic)renderer.setLighting(p);else if(renderer.preset.id!==p.id)renderer.setPreset(p);
  text('preset-name',p.name);text('preset-description',p.description);
  $('mode-auto').setAttribute('aria-pressed',String(automatic));$('mode-manual').setAttribute('aria-pressed',String(!automatic));
  $('preview-open').hidden=!automatic;$('manual-status').hidden=automatic;$('cycle-meta').hidden=!automatic;
  if(automatic)text('cycle-meta',`${output.cycle.brightness===0?'Lights off · ':''}${output.cycle.nextPhase} at ${formatTime(output.cycle.nextTransition)}`);
  $('presets').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(!automatic&&b.dataset.preset===p.id)));
}
// The only future hardware subscription point is real.subscribeRealOutput().
// No adapter is installed. Rendering and preview actions never emit commands.
real.subscribeRealOutput(renderReal);
store.subscribe(()=>{real.sample();text('announcement',`${store.getState().mode==='automatic'?'Automatic cycle':getPreset(store.getState().presetId).name} selected.`);});
$('mode-auto').addEventListener('click',()=>store.setMode('automatic'));
$('mode-manual').addEventListener('click',()=>store.setMode('manual'));
real.sample();setInterval(()=>real.sample(),250);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)real.sample();});

function dismissOnBackdrop(dialog){dialog.addEventListener('click',event=>{const r=dialog.getBoundingClientRect();if(event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom))dialog.close();});}
const settingsDialog=$('settings-dialog');dismissOnBackdrop(settingsDialog);
function updateSettingLabels(){text('day-brightness-value',`${$('day-brightness').value}%`);text('moon-intensity-value',`${$('moon-intensity').value}%`);$('moon-intensity').disabled=!$('moon-enabled').checked;}
$('settings-open').addEventListener('click',()=>{
  const {schedule:s,cycleSettings:c}=store.getState();
  $('sunrise-start').value=formatTime(s.sunriseStart);$('sunset-start').value=formatTime(s.sunsetStart);
  $('sunrise-duration').value=s.sunriseDuration;$('sunset-duration').value=s.sunsetDuration;
  $('day-brightness').value=c.dayBrightness*100;$('moon-enabled').checked=c.moonlightEnabled;$('moon-intensity').value=c.moonlightIntensity*100;
  text('schedule-error','');updateSettingLabels();settingsDialog.showModal();
});
$('settings-close').addEventListener('click',()=>settingsDialog.close());
for(const id of ['day-brightness','moon-enabled','moon-intensity'])$(id).addEventListener('input',updateSettingLabels);
const parseTime=value=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
$('schedule-form').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    store.saveSchedule({sunriseStart:parseTime($('sunrise-start').value),sunriseDuration:Number($('sunrise-duration').value),sunsetStart:parseTime($('sunset-start').value),sunsetDuration:Number($('sunset-duration').value)},
      {dayBrightness:Number($('day-brightness').value)/100,moonlightEnabled:$('moon-enabled').checked,moonlightIntensity:Number($('moon-intensity').value)/100});
    settingsDialog.close();text('announcement','Schedule saved.');
  }catch(error){text('schedule-error',error.message);}
});

// Preview owns a separate controller, renderer and playback timestamp. It only
// copies schedule configuration from the store and cannot write it or real time.
const previewDialog=$('preview-dialog');dismissOnBackdrop(previewDialog);
let preview=null,previewRenderer=null,previewFrame=0,previewLast=null;
function renderPreview(){
  const state=preview.snapshot();previewRenderer.setLighting(state.preset);
  $('preview-timeline').value=state.minutes;$('preview-timeline').setAttribute('aria-valuetext',`${formatTime(state.minutes)}, ${state.phase}`);
  text('preview-time',formatTime(state.minutes));text('preview-phase',state.phase);
  text('preview-play',state.playing?'Pause':'Play');$('preview-play').setAttribute('aria-pressed',String(state.playing));
}
function previewTick(now){
  if(preview.snapshot().playing){if(previewLast!==null)preview.advance((now-previewLast)/1000);renderPreview();}previewLast=now;previewFrame=requestAnimationFrame(previewTick);
}
$('preview-open').addEventListener('click',()=>{
  const {schedule,cycleSettings}=store.getState();preview=createPreviewController(schedule,cycleSettings);
  previewDialog.showModal();renderer.setSuspended(true);
  previewRenderer=new AquariumRenderer($('preview-scene'),preview.snapshot().preset);previewRenderer.scenery=renderer.scenery;
  $('preview-speed').value='360';previewLast=null;renderPreview();previewFrame=requestAnimationFrame(previewTick);
});
$('preview-close').addEventListener('click',()=>previewDialog.close());
previewDialog.addEventListener('close',()=>{cancelAnimationFrame(previewFrame);previewRenderer?.destroy();previewRenderer=null;preview=null;previewLast=null;renderer.setSuspended(false);});
$('preview-timeline').addEventListener('input',()=>{preview.scrub(Number($('preview-timeline').value));renderPreview();});
$('preview-play').addEventListener('click',()=>{preview.setPlaying(!preview.snapshot().playing);previewLast=null;renderPreview();});
$('preview-speed').addEventListener('change',()=>{preview.setSpeed(Number($('preview-speed').value));previewLast=null;});
$('preview-now').addEventListener('click',()=>{preview.scrub(localMinutes(new Date()));previewLast=null;renderPreview();});
document.addEventListener('visibilitychange',()=>{previewLast=null;});
