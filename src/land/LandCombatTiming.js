// V36 CPU attack timing and swept horizontal blade capsule. Renderer-independent.
// Damage begins after anticipation, only while the authored strike passes through
// the opponent. Supports enemies entering the blade path mid-swing.
export function makeStrikeWindow( heavy = false ) {
    return heavy ? { windup: .17, activeEnd: .41, window: .49, sweep: .88 } :
        { windup: .105, activeEnd: .27, window: .33, sweep: .66 };
}
export function strikeActive( swing ) {
    if ( !swing ) return false;
    const a = swing.previousAge ?? swing.age ?? 0;
    const b = swing.age ?? 0;
    return b >= swing.windup && a <= swing.activeEnd && b <= swing.window;
}
function distanceToSegmentSquared( x, z, a, b ) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = dx * dx + dz * dz;
    const u = d > 1e-8 ? Math.max( 0, Math.min( 1, ( ( x - a.x ) * dx + ( z - a.z ) * dz ) / d ) ) : 0;
    return ( x - a.x - dx * u ) ** 2 + ( z - a.z - dz * u ) ** 2;
}
export function sweptBladeContact( swing, attacker, direction, victim, radius = .68 ) {
    if ( !strikeActive( swing ) ) return false;
    const dy = ( attacker.y ?? 0 ) - ( victim.y ?? 0 );
    if ( Math.abs( dy ) > ( swing.heavy ? 3.5 : 3 ) ) return false;
    const dx = direction.x, dz = direction.z;
    const mag = Math.hypot( dx, dz );
    if ( mag < 1e-6 ) return false;
    const heading = Math.atan2( dx, dz );
    const start = Math.max( swing.previousAge ?? 0, swing.windup );
    const end = Math.min( swing.age ?? 0, swing.activeEnd );
    if ( start > end ) return false;
    const samples = Math.max( 2, Math.ceil( ( end - start ) / .012 ) + 1 );
    for ( let i = 0; i < samples; i++ ) {
        const t = start + ( end - start ) * i / ( samples - 1 );
        const phase = ( t - swing.windup ) / ( swing.activeEnd - swing.windup );
        const headingAtContact = heading + ( phase * 2 - 1 ) * swing.sweep;
        const tip = { x: attacker.x + Math.sin( headingAtContact ) * swing.reach,
            z: attacker.z + Math.cos( headingAtContact ) * swing.reach };
        if ( distanceToSegmentSquared( victim.x, victim.z, attacker, tip ) < radius * radius ) return true;
    }
    return false;
}

// Do not award a melee hit through solid lighthouse walls, rocks or gate posts.
// The shared world raycaster covers oriented boxes; cylinders are evaluated
// separately because the camera raycaster intentionally ignores them.
export function strikeLineBlocked( colliders, origin, target, hitPadding = .32 ) {
    if ( !colliders ) return false;
    const delta = { x: target.x-origin.x, y: (target.y??0)-(origin.y??0), z: target.z-origin.z };
    const dist = Math.hypot( delta.x, delta.y, delta.z );
    if ( dist < .01 ) return false;
    const ray = { x:delta.x/dist, y:delta.y/dist, z:delta.z/dist };
    const limit = Math.max( 0, dist-hitPadding );
    if ( colliders.raycast && colliders.raycast(origin,ray,limit) < limit-1e-4 ) return true;
    for ( const c of colliders.cylinders || [] ) {
        if ( c.solid === false ) continue;
        const ox=origin.x-c.x, oz=origin.z-c.z, a=ray.x*ray.x+ray.z*ray.z;
        if ( a<1e-8 ) continue;
        const b=2*(ox*ray.x+oz*ray.z), d=b*b-4*a*(ox*ox+oz*oz-c.radius*c.radius);
        if (d<0) continue;
        const t1=(-b-Math.sqrt(d))/(2*a), t2=(-b+Math.sqrt(d))/(2*a);
        const first=Math.max(0,t1),last=Math.min(limit,t2);
        if(first>=last) continue;
        const ya=(origin.y??0)+ray.y*first, yb=(origin.y??0)+ray.y*last;
        if(Math.max(ya,yb)>=c.yMin && Math.min(ya,yb)<=c.yMax) return true;
    }
    const end={x:origin.x+ray.x*limit,y:(origin.y??0)+ray.y*limit,z:origin.z+ray.z*limit};
    for(const world of colliders.triangleWorlds||[]){if(world.segmentHit?.(origin,end))return true;}
    return false;
}
