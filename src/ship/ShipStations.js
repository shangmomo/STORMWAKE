// V39: one actor, one physical station. All state is ship-relative and serializable.
export const STATION_IDS = Object.freeze([
  'helm', 'sail_main', 'sail_jib', 'anchor', 'anchor_2', 'anchor_3', 'anchor_4', 'cannon_port', 'cannon_starboard', 'repair', 'bucket', 'carry'
]);
const ID = new Set(STATION_IDS);
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
export class ShipStations {
  constructor({cooperativeCapstan=false}={}) {
    this.cooperativeCapstan=cooperativeCapstan;
    this.occupants = new Map(); this.actorStation = new Map();
    this.inputs = new Map(); this.sailMain = 0; this.sailJib = 0;
    this.sailTrim = 0; this.rudder = 0; this.helmThrottle = 0; this.anchorDown = true; this.anchorManual = true; this.anchorTravel = 1; this.anchorTravelReady = true; this.anchorCrankTurns=0; this.anchorHands=0; this.shots = [];
    this.cannon = { cannon_port:{loaded:true,cooldown:0,reloadQueued:false}, cannon_starboard:{loaded:true,cooldown:0,reloadQueued:false} };
    this.onChange = null;
  }
  valid(id) { return ID.has(id); }
  getOccupant(id) { return this.occupants.get(id) ?? null; }
  getStation(actorId) { return this.actorStation.get(actorId) ?? null; }
  claim(id,actorId,{replaceAI=false}={}) {
    if(!this.valid(id) || typeof actorId!=='string' || !actorId || this.actorStation.has(actorId)) return false;
    const owner=this.getOccupant(id);
    if(owner) {
      if(!(replaceAI && owner.startsWith('ai:'))) return false;
      this.release(id,owner);
    }
    this.occupants.set(id,actorId); this.actorStation.set(actorId,id);
    this.onChange?.(id,actorId); return true;
  }
  release(id,actorId) {
    if(this.getOccupant(id)!==actorId) return false;
    this.occupants.delete(id); this.actorStation.delete(actorId); this.inputs.delete(actorId);
    this.onChange?.(id,null); return true;
  }
  releaseActor(actorId) { const id=this.getStation(actorId); return id?this.release(id,actorId):false; }
  setInput(id,actorId,input={}) {
    if(this.getOccupant(id)!==actorId) return false;
    // Network frames and the game simulation tick are not synchronized.
    // Latch one-shot actions until update()/the repair system consumes them;
    // an intervening axis-only packet must never erase a cannon click.
    const old=this.inputs.get(actorId)||{};
    this.inputs.set(actorId,{axis:clamp(Number(input.axis)||0,-1,1),
      throttleAxis:clamp(Number(input.throttleAxis)||0,-1,1),
      trimAxis:clamp(Number(input.trimAxis)||0,-1,1),
      aimYaw:Number.isFinite(input.aimYaw)?input.aimYaw:undefined,
      aimPitch:Number.isFinite(input.aimPitch)?input.aimPitch:undefined,
      fire:!!input.fire||!!old.fire,reload:!!input.reload||!!old.reload,
      repair:!!input.repair,bucket:!!input.bucket||!!old.bucket});
    return true;
  }
  update(dt,inputByActor=null) {
    if(inputByActor) for(const [actor,input] of Object.entries(inputByActor)) {
      const id=this.getStation(actor); if(id)this.setInput(id,actor,input);
    }
    this.shots=[];
    for(const [id,owner] of this.occupants){
      const cmd=this.inputs.get(owner)||{};
      if(id==='helm'){
        this.rudder=clamp(cmd.axis||0,-1,1);
        // Gradual telegraph changes, including astern, rather than a hidden fixed speed.
        this.helmThrottle=clamp(this.helmThrottle+(cmd.throttleAxis||0)*dt*.40,-1,1);
      }
      if(id==='sail_main')this.sailMain=clamp(this.sailMain+(cmd.axis||0)*dt*.45,0,1);
      if(id==='sail_jib')this.sailJib=clamp(this.sailJib+(cmd.axis||0)*dt*.45,0,1);
      if(id==='sail_main'||id==='sail_jib')this.sailTrim=clamp(this.sailTrim+(cmd.trimAxis||0)*dt*.32,-1,1);
      if(id.startsWith('anchor')){
        // W winds chain UP, S feeds chain DOWN. No instant E toggle.
        if(cmd.reload){cmd.reload=false;}
        cmd.fire=false;
      }
      const cannon=this.cannon[id];
      if(cannon){
        // A reload requested during cooldown is queued instead of silently lost.
        if(cmd.reload)cannon.reloadQueued=true;
        if(cannon.reloadQueued && cannon.cooldown<=0){cannon.loaded=true;cannon.reloadQueued=false;}
        if(cmd.fire && cannon.loaded && cannon.cooldown<=0){this.shots.push({stationId:id,actorId:owner,aimYaw:cmd.aimYaw,aimPitch:cmd.aimPitch}); cannon.loaded=false;cannon.cooldown=2.8;}
        // Button edges are single-use. Do not re-fire/reload when the last
        // packet is reused across multiple physics ticks.
        cmd.fire=false;cmd.reload=false;
      }
    }
    // Four simultaneous player-held arms turn the SAME mechanical capstan.
    // Progress is proportional to the number of crew members actually holding W/S.
    if(!this.anchorTravelReady){this.anchorTravel=this.anchorDown?1:0;this.anchorTravelReady=true;}
    let signedHands=0,working=0;
    for(const [id,owner] of this.occupants){
      if(!id.startsWith('anchor'))continue;
      const axis=clamp(this.inputs.get(owner)?.axis||0,-1,1);
      if(Math.abs(axis)>.01){signedHands+=axis;working++;}
    }
    this.anchorHands=working;
    const step=Math.min(Math.max(dt,0),.12);
    if(working){
      this.anchorManual=true;
      // Current Dutch ship: 1 / 1.5 / 2 / 2.5 crew gain; opposite axes
      // cancel before applying the gain. Legacy hull saves keep their curve.
      const effort=this.cooperativeCapstan?signedHands/working*(1+.5*(working-1)):signedHands;
      const previousTravel=this.anchorTravel;
      this.anchorTravel=clamp(this.anchorTravel-effort*step/4.5,0,1);
      // Mechanical end stops: the grips cannot continue orbiting after all
      // chain is stowed/paid out. The current rig turns only with real travel.
      this.anchorCrankTurns+=this.cooperativeCapstan?(previousTravel-this.anchorTravel)*5.4:effort*step*1.2;
      this.anchorDown=this.anchorTravel>.001;
    }else if(!this.anchorManual){
      const target=this.anchorDown?1:0;
      this.anchorTravel=clamp(this.anchorTravel+clamp(target-this.anchorTravel,-step/4.5,step/2.5),0,1);
    }
    if(!this.getOccupant('helm'))this.rudder*=Math.exp(-Math.min(dt,.1)*.9);
    for(const c of Object.values(this.cannon))c.cooldown=Math.max(0,c.cooldown-dt);
    return {rudder:this.rudder,helmThrottle:this.helmThrottle,sailMain:this.sailMain,sailJib:this.sailJib,sailTrim:this.sailTrim,anchorDown:this.anchorDown,anchorHeld:this.anchorTravel>.001,anchorTravel:this.anchorTravel,shots:this.shots.slice()};
  }
  snapshot(){ return {occupants:Object.fromEntries(this.occupants),rudder:this.rudder,helmThrottle:this.helmThrottle,sailMain:this.sailMain,sailJib:this.sailJib,sailTrim:this.sailTrim,anchorDown:this.anchorDown,anchorManual:this.anchorManual,anchorTravel:this.anchorTravel,anchorCrankTurns:this.anchorCrankTurns,anchorHands:this.anchorHands,cannon:structuredClone(this.cannon)}; }
  setRemoteOccupant(id,actorId) {
    if(!this.valid(id))return false;
    const old=this.getOccupant(id);if(old)this.release(id,old);
    if(actorId){const prev=this.getStation(actorId);if(prev)this.release(prev,actorId);return this.claim(id,actorId);}
    return true;
  }
}
