import { Vector3 } from '../engine/index.js';
import { LIGHTHOUSE_V34 } from './LandLighthouseV34.js';

const radiusAt = y => 6.09 - 1.55 * Math.min( 1, Math.max( 0, y / 37.8 ) );

// The shell is deliberately a *hollow ring*, not V32's single impenetrable
// cylinder. All positions and dimensions derive from the visible model.
export function installLighthouseV34Colliders( world, tower ) {
    // Non-physical mock scenes used by historical controller tests do not
    // expose box collision. A real game world must provide both primitives.
    if ( !world?.addBox || !world?.addCylinder || !tower?.group ) return null;
    const C = LIGHTHOUSE_V34;
    const { x, y, z } = tower.group.position;
    const colliders = [];
    const addBox = ( xx, yy, zz, hx, hy, hz, yaw, tag, flags = {} ) => {
        const item = world.addBox( new Vector3( x + xx, y + yy, z + zz ),
            new Vector3( hx, hy, hz ), yaw, { tag, ...flags } );
        colliders.push( item ); return item;
    };
    const addCircle = ( r, lower, upper, tag, flags = {} ) => {
        const item = world.addCylinder( x, z, r, y + lower, y + upper, { tag, ...flags } );
        colliders.push( item ); return item;
    };
    addCircle( 6.63, -.4, .4, 'land:v34:lighthouse-foundation', { walkable: true } );
    // The ornamental cap raises the walking surface by 19.5cm only *after*
    // crossing the first foundation; it must never become an invisible wall.
    addCircle( 6.55, .385, .595, 'land:v34:lighthouse-threshold', { walkable: true, solid: false } );
    addCircle( 1.15, .55, 38.3, 'land:v34:lighthouse-center-column' );

    const segments = 40, bands = 8, wallHeight = 37.6 / bands;
    for ( let band = 0; band < bands; band ++ ) {
        const cy = .6 + ( band + .5 ) * wallHeight;
        const radius = radiusAt( cy );
        for ( let j = 0; j < segments; j ++ ) {
            const signed = j <= segments / 2 ? j : j - segments;
            if ( band === 0 && Math.abs( signed ) <= 2 ) continue;
            const a = 2 * Math.PI * j / segments;
            const tangentWidth = radius * ( 2 * Math.PI / segments ) * .59;
            addBox( Math.sin( a ) * radius, cy, Math.cos( a ) * radius,
                tangentWidth, wallHeight * .5 + .02, .44, a,
                'land:v34:lighthouse-wall' );
        }
    }
    for ( const step of tower.steps ) {
        addBox( step.x, step.y - .10, step.z, step.width * .5, .10, step.depth * .5,
            step.yaw, `land:v34:lighthouse-stair-${step.step}`, { walkable: true } );
    }
    for ( let j = 0; j < 48; j ++ ) {
        const a = j * 2 * Math.PI / 48;
        addBox( Math.sin( a ) * 4.45, C.deckHeight - .11, Math.cos( a ) * 4.45,
            .33, .11, .775, a, 'land:v34:lighthouse-gallery', { walkable: true } );
    }
    for ( let i = 0; i < 24; i ++ ) {
        const a = i * 2 * Math.PI / 24;
        addBox( Math.sin( a ) * 5.27, C.deckHeight + .65, Math.cos( a ) * 5.27,
            .75, .64, .11, a, 'land:v34:lighthouse-gallery-rail' );
    }
    addBox( -11, 1.87, 1.1, 3.6, 1.83, 2.6, 0, 'land:v34:keeper-annex' );
    // Closed oak gate is part of the physical world. Opening the gate disables
    // only this one collider; the stone walls remain solid throughout.
    const door = addBox( 0, 2.42, C.doorFront, C.doorHalfWidth, 1.84, .13,
        0, 'land:v34:lighthouse-hinged-door' );
    // The live hinge and its collision use the identical yaw and pivot.
    const pose=angle=>{const h=C.doorHalfWidth,cos=Math.cos(angle),sin=Math.sin(angle);return {x:x+h-h*cos,z:z+C.doorFront+h*sin,cos,sin};};
    const obstructed=(angle,people)=>{const q=pose(angle);return people.some(p=>{if(!p||p.y+1.75<=door.bottom||p.y>=door.top)return false;const dx=p.x-q.x,dz=p.z-q.z,lx=dx*q.cos-dz*q.sin,lz=dx*q.sin+dz*q.cos;return Math.hypot(Math.max(0,Math.abs(lx)-door.half.x),Math.max(0,Math.abs(lz)-door.half.z))<.34;});};
    return { door, colliders, stairs: tower.steps.length, height: C.height,
        setDoorOpen( isOpen ) { door.solid = !isOpen; },
        // Sweep in small angle increments; never move a solid panel through a body.
        advanceDoor(previous,target,people=[]){const count=Math.max(1,Math.ceil(Math.abs(target-previous)/.035));let angle=previous;for(let i=1;i<=count;i++){const next=previous+(target-previous)*i/count;if(obstructed(next,people))break;angle=next;}const q=pose(angle);door.center.x=q.x;door.center.z=q.z;door.rotY=angle;door.cos=q.cos;door.sin=q.sin;door.solid=true;return angle;} };
}
