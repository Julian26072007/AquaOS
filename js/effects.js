import {clampLevel} from './lighting.js';

// Artistic display conversion. Every material sees the same light spectrum;
// gradients in the scene are part of the artwork, not additional light sources.
export class LightingPass {
  prepare({red,green,blue,warmWhite,coolWhite}){
    this.tint=[
      red*.72+warmWhite*.84+coolWhite*.57,
      green*.72+warmWhite*.57+coolWhite*.70,
      blue*.72+warmWhite*.32+coolWhite*.82,
    ].map(clampLevel);
  }
  color(hex){
    const material=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));
    const alpha=hex.length===9?parseInt(hex.slice(7,9),16)/255:1;
    const [r,g,b]=material.map((value,i)=>Math.min(255,Math.round(value*(.035+1.25*this.tint[i]))));
    return `rgba(${r},${g},${b},${alpha})`;
  }
}
