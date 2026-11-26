// V28: additive anatomical rig for the licensed 66-joint Leviathan.
// Unlike free-floating animated props, each new joint gets a *real* inverse
// bind matrix and skin weights.  The original authored swim/charge clips still
// drive the complete spine, while fin/caudal/jaw joints get a procedural layer.

const clamp = ( x, a, b ) => Math.max( a, Math.min( b, x ) );
const fade = ( a, b, x ) => { const t = clamp( ( x - a ) / ( b - a ), 0, 1 ); return t * t * ( 3 - 2 * t ); };

const anatomy = [
	{ name: 'Pectoral_L', n: 12, origin: [ -.019, .15, .046 ], axis: 'x', min: .019, max: .056, side: -1, action: 'fin' },
	{ name: 'Pectoral_R', n: 12, origin: [ .019, .15, .046 ], axis: 'x', min: .019, max: .056, side: 1, action: 'fin' },
	{ name: 'Dorsal', n: 10, origin: [ 0, .18, -.018 ], axis: 'z', min: -.049, max: .026, action: 'dorsal' },
	{ name: 'Caudal_L', n: 10, origin: [ -.013, .125, -.108 ], axis: 'x', min: .012, max: .052, side: -1, action: 'tail' },
	{ name: 'Caudal_R', n: 10, origin: [ .013, .125, -.108 ], axis: 'x', min: .012, max: .052, side: 1, action: 'tail' },
	{ name: 'Mandible', n: 8, origin: [ 0, .156, .091 ], axis: 'z', min: .077, max: .126, action: 'jaw' },
	{ name: 'Gill_L', n: 4, origin: [ -.018, .164, .058 ], axis: 'z', min: .036, max: .077, side: -1, action: 'gill' },
	{ name: 'Gill_R', n: 4, origin: [ .018, .164, .058 ], axis: 'z', min: .036, max: .077, side: 1, action: 'gill' },
];

function region( part, x, y, z ) {
	const sideX = x * ( part.side || 1 );
	if ( part.action === 'fin' ) return fade( .019, .038, sideX ) * ( 1 - fade( .075, .099, z ) ) * fade( .004, .020, z );
	if ( part.action === 'tail' ) return fade( .012, .031, sideX ) * ( 1 - fade( -.080, -.060, z ) ) * fade( -.128, -.106, z );
	if ( part.action === 'dorsal' ) return fade( .174, .195, y ) * ( 1 - fade( .016, .032, Math.abs( x ) ) ) * fade( -.060, -.030, z ) * (1 - fade( .022, .039, z ));
	if ( part.action === 'jaw' ) return fade( .070, .105, z ) * ( 1 - fade( .157, .170, y ) );
	return fade( .011, .020, sideX ) * (1 - fade( .026, .038, sideX ) ) * fade( .029, .043, z ) * (1 - fade( .077, .088, z ));
}

function convertWeights( attr ) {
	const data = attr.array;
	if ( data instanceof Float32Array ) return data;
	const divisor = attr.normalized ? ( { 5121: 255, 5123: 65535, 5120: 127, 5122: 32767 }[ attr.componentType ] || 1 ) : 1;
	return Float32Array.from( data, v => Math.max( 0, v / divisor ) );
}

// Exported for regression/geometry inspection. The glTF object is a fresh parse
// and is never shared with any other spawn or enemy.
export function upgradeLeviathanRig( gltf ) {
	const skin = gltf.skins?.[ 0 ];
	if ( !skin || skin.joints.length < 60 ) return null;
	const parent = skin.joints[ 0 ];
	const base = gltf.nodes[ parent ];
	if ( !base?.name?.startsWith( 'GodSpine' ) ) return null;
	const oldCount = skin.joints.length;
	const originalIBM = skin.inverseBindMatrices;
	const ibm = new Float32Array( ( oldCount + anatomy.reduce( ( s, p ) => s + p.n, 0 ) ) * 16 );
	ibm.set( originalIBM );
	const parts = [];
	for ( const part of anatomy ) {
		const bones = [];
		for ( let s = 0; s < part.n; s ++ ) {
			const u = ( s + .5 ) / part.n;
			const anchor = part.origin.slice();
			if ( part.axis === 'x' ) anchor[ 0 ] = ( part.side || 1 ) * ( part.min + (part.max - part.min) * u );
			else anchor[ 2 ] = part.min + (part.max - part.min) * u;
			// Attach every fin segment to the nearest point of the *original*
			// 66-joint animated spine. Tail fin bones now inherit the genuine
			// caudal undulation instead of appearing rigidly attached to the head.
			const parentJoint = clamp( Math.round( (base.t[2] - anchor[2]) / .002348485 ), 0, oldCount - 1 );
			const parentNode = skin.joints[ parentJoint ];
			const parentBindZ = originalIBM[ parentJoint * 16 + 13 ];
			// The artist root has an X=-90-degree bind rotation; inverse maps
			// world (x,y,z) -> local (x,-z,y) relative to its rest translation.
			const hinge = [ anchor[0] - base.t[0], -(anchor[2] - parentBindZ), anchor[1] - base.t[1] ];
			const node = gltf.nodes.length;
			gltf.nodes.push( { name: `V28_${ part.name }_${ String(s).padStart(2, '0') }`,
				children: [], t: hinge, r: [ 0, 0, 0, 1 ], s: [ 1, 1, 1 ], mesh: undefined, skin: undefined } );
			gltf.nodes[ parentNode ].children.push( node );
			const joint = skin.joints.length;
			skin.joints.push( node );
			const offset = joint * 16;
			ibm.set( originalIBM.subarray( parentJoint*16, parentJoint*16+16 ), offset );
			ibm[ offset + 12 ] -= hinge[0];
			ibm[ offset + 13 ] -= hinge[1];
			ibm[ offset + 14 ] -= hinge[2];
			bones.push( { node, joint, u, action: part.action, side: part.side || 0 } );
		}
		parts.push( { ...part, bones } );
	}
	skin.inverseBindMatrices = ibm;
	let influencedVertices = 0;
	for ( const node of gltf.nodes ) if ( node.skin === 0 && node.mesh !== undefined ) {
		for ( const primitive of gltf.meshes[ node.mesh ] ) {
			const a = primitive.attributes;
			if ( ! a.POSITION || !a.JOINTS_0 || !a.WEIGHTS_0 ) continue;
			const P = a.POSITION.array, oldJ = a.JOINTS_0.array, oldW = convertWeights( a.WEIGHTS_0 );
			const J = new Uint16Array( oldJ.length ), W = new Float32Array( oldW.length );
			for ( let i = 0; i < P.length / 3; i ++ ) {
				const x = P[ 3*i ], y = P[ 3*i+1 ], z = P[ 3*i+2 ];
				let pick = null, strength = 0;
				for ( const part of parts ) {
					const score = region( part, x, y, z );
					if ( score > strength ) { strength = score; pick = part; }
				}
				const o = i * 4;
				if ( !pick || strength < .005 ) {
					for ( let k = 0; k < 4; k ++ ) { J[o+k] = oldJ[o+k]; W[o+k] = oldW[o+k]; }
					continue;
				}
				const dimension = pick.axis === 'x' ? Math.abs( x ) : z;
				const indexFloat = ( (dimension - pick.min) / (pick.max - pick.min) ) * pick.n - .5;
				const low = clamp( Math.floor( indexFloat ), 0, pick.n - 1 );
				const high = clamp( low + 1, 0, pick.n - 1 );
				const blend = clamp( indexFloat - low, 0, 1 );
				const newWeight = .66 * clamp( strength, 0, 1 );
				const original = [ 0, 1, 2, 3 ].sort( ( k, m ) => oldW[o+m] - oldW[o+k] );
				const total = oldW[o+original[0]] + oldW[o+original[1]] || 1;
				J[o] = oldJ[o+original[0]]; W[o] = (1-newWeight) * oldW[o+original[0]] / total;
				J[o+1] = oldJ[o+original[1]]; W[o+1] = (1-newWeight) * oldW[o+original[1]] / total;
				J[o+2] = pick.bones[low].joint; W[o+2] = newWeight * (1-blend);
				J[o+3] = pick.bones[high].joint; W[o+3] = newWeight * blend;
				influencedVertices ++;
			}
			a.JOINTS_0 = { array: J, itemSize: 4, normalized: false, componentType: 5123 };
			a.WEIGHTS_0 = { array: W, itemSize: 4, normalized: false, componentType: 5126 };
		}
	}
	return { baseBones: oldCount, totalBones: skin.joints.length, addedBones: skin.joints.length - oldCount,
		influencedVertices, parts };
}

export function animateLeviathanRig( skeleton, rig, time, speed = 20, state = 'stalk', jawOpen = 0, bank = 0 ) {
	if ( !rig ) return;
	const effort = clamp( speed / 32, .45, 2.1 );
	const cycle = time * ( 2.5 + effort * 2.15 );
	const intensity = state === 'charge' ? 1.52 : state === 'windup' ? .65 : 1;
	skeleton.poseModifier = ( local ) => {
		for ( const part of rig.parts ) for ( const bone of part.bones ) {
			const phase = cycle - bone.u * 3.6;
			const p = bone.u;
			let x = 0, y = 0, z = 0;
			if ( bone.action === 'fin' ) y = bone.side * ( .19 * Math.sin( phase + bone.side * .34 ) * intensity + bank * .28 ) * ( .45 + p*.55 );
			else if ( bone.action === 'tail' ) z = .23 * Math.sin( phase * .88 + p * 1.65 ) * intensity * ( .45 + p * .5 );
			else if ( bone.action === 'dorsal' ) z = .11 * Math.sin( phase * .7 + p ) * intensity;
			else if ( bone.action === 'jaw' ) x = -.29 * jawOpen * (.65+p*.35) + .018 * Math.sin( phase*.45 );
			else if ( bone.action === 'gill' ) y = bone.side * .07 * Math.sin( phase * .64 + p * 2.0 );
			// Euler XYZ expressed as a unit quaternion, small angles avoid exploding
			// the adjacent artist skin weights at high swimming frequency.
			const sx = Math.sin(x*.5), cx = Math.cos(x*.5);
			const sy = Math.sin(y*.5), cy = Math.cos(y*.5);
			const sz = Math.sin(z*.5), cz = Math.cos(z*.5);
			local[bone.node].r.set( [ sx*cy*cz + cx*sy*sz,
				cx*sy*cz - sx*cy*sz, cx*cy*sz + sx*sy*cz,
				cx*cy*cz - sx*sy*sz ] );
		}
	};
}
