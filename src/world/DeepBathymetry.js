export const DEEP_TRENCH={x:-3180,z:4900,radius:1500,depth:270};
export function trenchDepthAt(x,z){const r=Math.hypot(x-DEEP_TRENCH.x,z-DEEP_TRENCH.z),t=Math.max(0,Math.min(1,(DEEP_TRENCH.radius-r)/1000));return DEEP_TRENCH.depth*t*t*(3-2*t);}
export const trenchWGSL=`fn deepTrenchDepth(xz:vec2f)->f32{let r=distance(xz,vec2f(-3180.0,4900.0));return 270.0*smoothstep(0.0,1000.0,1500.0-r);}`;
