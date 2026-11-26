// Wind is a world-space horizontal vector in m/s. Forward is +Z boat-local.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class SailWind {
  constructor({wind={x:0,z:9},sailPower=23}={}){this.wind={...wind};this.sailPower=sailPower;}
  evaluate({heading,velocity={x:0,z:0},sailMain=0,sailJib=0,sailTrim=0}){
    const fw={x:Math.sin(heading),z:Math.cos(heading)};
    const appar={x:this.wind.x-(velocity.x||0),z:this.wind.z-(velocity.z||0)};
    const speed=Math.hypot(appar.x,appar.z);
    const alignment=speed>1e-4?(appar.x*fw.x+appar.z*fw.z)/speed:0;
    // Backwind cannot give forward thrust; close-hauled mode retains a little drive.
    const fromWind=Math.acos(clamp(-alignment,-1,1)),noGo=55*Math.PI/180;
    const efficiency=Math.hypot(this.wind.x,this.wind.z)<.05||fromWind<=noGo?0:Math.sin((fromWind-noGo)/(Math.PI-noGo)*Math.PI/2);
    // Set to windward relative to the hull; wrong trim loses drive but
    // never creates negative thrust. A/D at either sail winch changes trim.
    const cross=speed>1e-4?(appar.x*fw.z-appar.z*fw.x)/speed:0;
    const idealTrim=clamp(cross*1.15,-1,1);
    const trimEfficiency=1-.42*Math.abs(clamp(sailTrim,-1,1)-idealTrim)/2;
    const area=(clamp(sailMain,0,1)+.45*clamp(sailJib,0,1))*trimEfficiency;
    return {thrust:area*speed*speed*this.sailPower*efficiency,efficiency,apparentSpeed:speed,alignment,idealTrim,trimEfficiency,forward:fw};
  }
}
