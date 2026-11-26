// V60: a bottom-aware, boat-local hawse tether. No teleport and no
// velocity overwrite: forces are applied to the rigid-body integrator.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class ShipAnchorTether {
  constructor({maxChain=34,stiffness=12000,damping=5100,holdingForce=50000}={}){
    this.maxChain=maxChain;this.stiffness=stiffness;this.damping=damping;this.holdingForce=holdingForce;
    this.point=null;this.state='STOWED';this.tension=0;this.chain=0;this.bottomDepth=0;
  }
  reset(){this.point=null;this.state='STOWED';this.tension=0;this.chain=0;}
  update({x,z,y=0,vx=0,vz=0,ground=-20,travel=0,dt=1/120}={}){
    const t=clamp(Number.isFinite(travel)?travel:0,0,1);
    this.chain=t*this.maxChain;
    this.bottomDepth=Number.isFinite(ground)?Math.max(0,y-ground):Infinity;
    if(t<=.002){this.reset();return {x:0,z:0,state:this.state,tension:0};}
    if(!this.point)this.point={x,z}; // first contact location, fixed in the world
    if(this.bottomDepth>this.chain || !Number.isFinite(this.bottomDepth)){
      this.state='NO_BOTTOM_CONTACT';this.tension=0;
      // During free-fall the anchor moves with the hull until it touches ground.
      this.point={x,z};return {x:0,z:0,state:this.state,tension:0};
    }
    const dx=x-this.point.x,dz=z-this.point.z,dist=Math.hypot(dx,dz);
    // Longer chain provides more swing radius, but the hawse is never rigidly locked.
    const slack=Math.max(.65,Math.sqrt(Math.max(0,this.chain*this.chain-this.bottomDepth*this.bottomDepth))*.13);
    if(dist<=slack){this.state='HOLDING';this.tension=0;return {x:0,z:0,state:this.state,tension:0};}
    const nx=dx/dist,nz=dz/dist;
    const away=Math.max(0,vx*nx+vz*nz);
    const force=Math.max(0,(dist-slack)*this.stiffness+away*this.damping);
    const capped=Math.min(force,this.holdingForce);
    this.tension=capped;
    if(force>this.holdingForce){
      this.state='DRAGGING';
      const move=Math.min(dist-slack,Math.min(Math.max(dt,0),.12)*.32);
      this.point.x+=nx*move;this.point.z+=nz*move;
    }else this.state='HOLDING';
    return {x:-nx*capped,z:-nz*capped,state:this.state,tension:capped};
  }
  snapshot(){return {state:this.state,chain:this.chain,depth:this.bottomDepth,tension:this.tension,point:this.point?{...this.point}:null};}
}
