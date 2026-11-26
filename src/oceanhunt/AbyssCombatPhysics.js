import { Vector3 } from '../engine/index.js';

const clamp = ( value, min, max ) => Math.min( max, Math.max( min, value ) );

// Exact closest points for two finite 3D segments, including degenerate
// segments. The submarine is represented by its longitudinal hull capsule
// and the moving jaws by a swept segment. No screen-space radius or
// distance-to-monster-center approximation is used for a bite.
export function closestSegmentPoints( a0, a1, b0, b1 ) {
	const u = a1.clone().sub( a0 );
	const v = b1.clone().sub( b0 );
	const w = a0.clone().sub( b0 );
	const aa = u.dot( u ), bb = u.dot( v ), cc = v.dot( v );
	const dd = u.dot( w ), ee = v.dot( w );
	const denom = aa * cc - bb * bb;
	let s = 0, t = 0;
	if ( aa < 1e-8 && cc < 1e-8 ) {
		return { distance: a0.distanceTo( b0 ), mouth: a0.clone(), hull: b0.clone(), mouthT: 0, hullT: 0 };
	}
	if ( aa < 1e-8 ) t = clamp( ee / cc, 0, 1 );
	else if ( cc < 1e-8 ) s = clamp( -dd / aa, 0, 1 );
	else {
		s = clamp( denom > 1e-8 ? ( bb * ee - cc * dd ) / denom : 0, 0, 1 );
		t = ( bb * s + ee ) / cc;
		if ( t < 0 ) { t = 0; s = clamp( -dd / aa, 0, 1 ); }
		if ( t > 1 ) { t = 1; s = clamp( ( bb - dd ) / aa, 0, 1 ); }
	}
	const mouth = a0.clone().addScaledVector( u, s );
	const hull = b0.clone().addScaledVector( v, t );
	return { distance: mouth.distanceTo( hull ), mouth, hull, mouthT: s, hullT: t };
}

export function movingJawHullContact( previousMouth, currentMouth, subCenter, subForward,
	{ mouthRadius = 7.5, hullRadius = 5.3, halfHull = 12.8 } = {} ) {
	const offset = subForward.clone().normalize().multiplyScalar( halfHull );
	const result = closestSegmentPoints( previousMouth, currentMouth,
		subCenter.clone().sub( offset ), subCenter.clone().add( offset ) );
	return { ...result, contact: result.distance <= mouthRadius + hullRadius,
		penetration: Math.max( 0, mouthRadius + hullRadius - result.distance ) };
}

export function leviathanMouthPosition( center, forward, lift = 5.0, nose = 116 ) {
	return center.clone().addScaledVector( forward, nose ).add( new Vector3( 0, lift, 0 ) );
}

// Smooth speed with bounded acceleration, preserves fluid inertia while
// allowing a committed lunge to become genuinely fast in under a second.
export function approachSpeed( current, desired, acceleration, dt ) {
	return current + clamp( desired - current, -acceleration * dt, acceleration * dt );
}
