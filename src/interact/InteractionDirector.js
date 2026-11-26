import {interactionDistance} from './InteractionGeometryV79.js';
export class InteractionDirector {
 constructor(){this.candidates=[];this.selected=null;this.context={};this.history=[];this.frame=0;}
 beginFrame(context={}){this.candidates=[];this.selected=null;this.context=context;this.frame++;this.dispatched=false;}
 add(candidate,point){point=point?.position??point;const valid=interactionDistance(candidate,point,3.2,4);if(!valid)return false;
  const {id,label,position,perform}=candidate,{distance:d,range,priority}=valid;
  const context=this.context;
  if(context.occluded?.(position,id))return false;
  const view=context.view,dx=position.x-point.x,dz=position.z-point.z;
  const facing=view&&Number.isFinite(view.x)&&Number.isFinite(view.z)&&d>.05?(view.x*dx+view.z*dz)/(Math.hypot(view.x,view.z)*d||1):0;
  const aimed=facing>.92&&d>.15;
  this.candidates.push({id,label,position,range,priority,perform,distance:d,facing,aimed});return true;}
 select(){this.selected=this.candidates.sort((a,b)=>Number(b.aimed)-Number(a.aimed)||b.priority-a.priority||a.distance-b.distance||a.id.localeCompare(b.id))[0]||null;return this.selected;}
 dispatch(input,owner='voyage'){if(this.dispatched)return false;const selected=this.select();if(!selected)return false;if(!input.consume('KeyE',owner))return false;this.dispatched=true;
  const accepted=selected.perform();this.record({selectedId:selected.id,inputConsumed:true,accepted:accepted!==false,focusOwner:owner});return true;}
 record(event){this.history.push({frame:this.frame,...event});if(this.history.length>80)this.history.shift();}
 trace(){return {frame:this.frame,selectedId:this.selected?.id||null,candidates:this.candidates.map(c=>({id:c.id,distance:c.distance,priority:c.priority,facing:c.facing,aimed:c.aimed})),history:this.history.slice()};}
}
