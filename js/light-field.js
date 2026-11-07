// World coordinates: x = left→right, y = rear→front. Neither is screen height.
// RGB and white channels are conceptual normalized requests, not electrical units.
export const FIELD_CHANNELS=Object.freeze(['r','g','b','red','green','blue','warmWhite','coolWhite','transmission','rear','front','cloudOpening']);
export class LightField {
  constructor(width=96,height=48){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2)throw new RangeError('Field dimensions must be integers >= 2');
    this.width=width;this.height=height;this.stride=FIELD_CHANNELS.length;
    this.data=new Float32Array(width*height*this.stride);this.a={};this.b={};
  }
  update(engine,current,previous=current,blend=1){
    for(let row=0;row<this.height;row++)for(let col=0;col<this.width;col++){
      const x=col/(this.width-1),y=row/(this.height-1);
      const a=engine.sample(current,x,y,1,this.a),b=blend<1?engine.sample(previous,x,y,1,this.b):a;
      const index=(row*this.width+col)*this.stride;
      for(let i=0;i<this.stride;i++){const key=FIELD_CHANNELS[i];this.data[index+i]=b[key]+(a[key]-b[key])*blend;}
    }
    return this;
  }
  sample(x,y,out={},colorOnly=false){
    const px=Math.max(0,Math.min(1,x))*(this.width-1),py=Math.max(0,Math.min(1,y))*(this.height-1);
    const ix=Math.min(this.width-2,Math.floor(px)),iy=Math.min(this.height-2,Math.floor(py)),fx=px-ix,fy=py-iy;
    const i=(iy*this.width+ix)*this.stride,j=i+this.width*this.stride;
    for(let k=0;k<(colorOnly?3:this.stride);k++){
      const a=this.data[i+k]+(this.data[i+this.stride+k]-this.data[i+k])*fx;
      const b=this.data[j+k]+(this.data[j+this.stride+k]-this.data[j+k])*fx;
      out[FIELD_CHANNELS[k]]=a+(b-a)*fy;
    }
    return out;
  }
}
