// Two reviewed upper-body motions derived from KinemIQ/Quaternius CC0.
// Retarget source bind-world orientation to the existing CAT skeleton offline.
// Never modify the actor's authored root, legs, mesh, or original idle.
export const CAPTAIN_TALK='V75_Idle_talking',CAPTAIN_INTERACT='V75_Action_interact';
const URL='/models/expedition/v75/captain-motion.json';
const NODES={23:'CATRigSpine1_015',24:'CATRigSpine2_016',25:'CATRigHub002_017',26:'CATRigLArmCollarbone_018',27:'CATRigLArm1_019',28:'CATRigLArm2_020',29:'CATRigLArmPalm_021',45:'CATRigRArmCollarbone_037',46:'CATRigRArm1_038',47:'CATRigRArm2_039',48:'CATRigRArmPalm_040',65:'CATRigSpine2_057',66:'CATRigHub003_058'};
export function appendCaptainMotion(g,data){
 if(g.skins?.[0]?.joints.length!==63||Object.keys(NODES).some(i=>g.nodes[i]?.name!==NODES[i]||data.targetNodes?.[i]!==NODES[i]))throw Error('Captain skeleton mismatch');
 if(data.clips?.length!==2)throw Error('Captain motions incomplete');
 const clips=[];for(const a of data.clips){if(![CAPTAIN_TALK,CAPTAIN_INTERACT].includes(a.name)||clips.some(c=>c.name===a.name)||!Number.isFinite(a.duration)||a.duration<1||a.duration>4||a.channels?.length!==13)throw Error('Captain motion invalid');const used=new Set();const channels=a.channels.map(c=>{
  if(!NODES[c.node]||used.has(c.node)||c.path!=='rotation'||c.times.length<2||c.values.length!==c.times.length*4||c.times.some((v,i)=>!Number.isFinite(v)||(i>0&&v<=c.times[i-1]))||c.times[0]!==0||Math.abs(c.times.at(-1)-a.duration)>.001||c.values.some(v=>!Number.isFinite(v)))throw Error('Invalid motion channel');used.add(c.node);
  for(let i=0;i<c.values.length;i+=4)if(Math.abs(Math.hypot(...c.values.slice(i,i+4))-1)>.002)throw Error('Invalid motion quaternion');return {...c,times:Float32Array.from(c.times),values:Float32Array.from(c.values)};
 });clips.push({...a,channels});}g.animations.push(...clips);return g;
}
export async function loadCaptainMotion(g){try{const res=await fetch(URL);if(!res.ok)throw Error('Motion fetch '+res.status);return appendCaptainMotion(g,await res.json());}catch(e){console.warn('[V75] keep original captain idle:',e);return g;}}
// The greeting is one shot, then two authored talk cycles. No repeated E stacking.
export function beginCaptainConversation(c){if(!c.rig.clipNames().includes(CAPTAIN_INTERACT)||!c.rig.clipNames().includes(CAPTAIN_TALK)||c.conversation>0)return false;c.conversation=2+2*2.9333334;c.rig.play(CAPTAIN_INTERACT,{fade:.32,loop:false});return true;}
export function stepCaptainConversation(c,dt,distance){if(!c.conversation)return;const prev=c.conversation;c.conversation=distance>5?0:Math.max(0,prev-dt);if(c.conversation===0)c.rig.play('Take 001',{fade:.4,loop:true});else if(c.conversation<=2*2.9333334&&c.rig.current!==CAPTAIN_TALK)c.rig.play(CAPTAIN_TALK,{fade:.3,loop:true});}
