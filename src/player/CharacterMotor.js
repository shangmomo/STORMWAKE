// Capsule stair negotiation: sweep up, forward and onto measured support.
// A wall without a reachable top and a step without head clearance stay solid.
export function moveDeckCapsule(world,from,to,{radius=.215,height=.96,dynamic=[],grounded=false,stepHeight=.23}={}){
 const body={radius,height,dynamic,step:grounded?stepHeight+.015:.035},normal=world.move(from,to,body);
 const dx=to.x-from.x,dz=to.z-from.z,length=Math.hypot(dx,dz);
 if(!grounded||length<1e-7||to.y>from.y+.02)return normal;
 const blocked=Math.hypot(normal.x-to.x,normal.z-to.z)>.001;
 if(blocked){
   const lifted=world.move(from,{x:from.x,y:from.y+stepHeight,z:from.z},body);
   if(lifted.y>=from.y+stepHeight-.004){
     const forward=world.move(lifted,{x:to.x,y:lifted.y,z:to.z},body);
     const advance=(forward.x-from.x)*dx/length+(forward.z-from.z)*dz/length;
     const original=(normal.x-from.x)*dx/length+(normal.z-from.z)*dz/length;
     const probe={x:forward.x+dx/length*(radius+.02),z:forward.z+dz/length*(radius+.02)};
     const support=world.floorAt(probe.x,probe.z,from.y+stepHeight+.005,from.y-.025);
     if(advance>original+.001&&support!==null&&support>from.y+.025){
       const down=world.move(forward,{x:forward.x,y:support,z:forward.z},{...body,step:stepHeight});
       return {...down,stepped:true,support};
     }
   }
 }
 // A capsule must keep support until its trailing hemisphere clears a tread.
 // Sampling only the centre lowered feet into the preceding vertical riser on
 // descent, producing a t=0 contact loop after several round trips.
 let support=world.footprintFloorAt?.(normal.x,normal.z,radius+.004,from.y+stepHeight,from.y-stepHeight)
   ??world.floorAt(normal.x,normal.z,from.y+.025,from.y-stepHeight);
 if(support!==null&&support>from.y+.025){
   const raised=world.move(normal,{x:normal.x,y:support,z:normal.z},body);
   if(raised.y<support-.004)support=world.footprintFloorAt?.(normal.x,normal.z,radius+.004,from.y+.025,from.y-stepHeight)??null;
 }
 if(support!==null)return {...normal,y:support,stepped:true,support};
 return normal;
}
