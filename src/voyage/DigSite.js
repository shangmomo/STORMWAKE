export class DigSite {
 constructor({duration=4}={}){this.duration=duration;this.progress=new Map();this.completed=new Set();}
 advance(actorId,dt,near=true,id='moss_01'){if(this.completed.has(id))return {complete:true,progress:1,justCompleted:false};if(!near){this.progress.delete(actorId);return {complete:false,progress:0,justCompleted:false};}
  const t=Math.max(0,(this.progress.get(actorId)||0)+Math.max(0,Math.min(.2,dt)));this.progress.set(actorId,t);
  if(t+1e-6>=this.duration){this.completed.add(id);this.progress.delete(actorId);return {complete:true,progress:1,justCompleted:true};}
  return {complete:false,progress:Math.min(1,t/this.duration),justCompleted:false};}
}
