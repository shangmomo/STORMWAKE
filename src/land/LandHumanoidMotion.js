// The bundled MIT Rocketbox people have genuine idle/talk/wave clips, but no
// walk or attack. This small additive skeleton overlay prevents footless
// gliding until a complete authored character pack is installed. It is a
// fallback only; existing imported clips always take precedence.

function turnX( r, angle ) {
	const s = Math.sin( angle / 2 ), c = Math.cos( angle / 2 );
	const [ x, y, z, w ] = r;
	r[ 0 ] = x * c + w * s;
	r[ 1 ] = y * c + z * s;
	r[ 2 ] = z * c - y * s;
	r[ 3 ] = w * c - x * s;
}

export function installHumanoidMotionFallback( actor ) {
	const rig = actor?.rig;
	if ( !rig?.gltf?.nodes || rig.poseModifier ) return null;
	const lookup = new Map( rig.gltf.nodes.map( ( node, i ) => [ String( node.name ).toLowerCase(), i ] ) );
	const bone = name => lookup.get( `bip01 ${name}` );
	const bones = Object.fromEntries( [ 'l thigh', 'r thigh', 'l calf', 'r calf',
		'l upperarm', 'r upperarm', 'l forearm', 'r forearm', 'spine', 'spine1', 'head' ]
		.map( name => [ name, bone( name ) ] ) );
	if ( bones[ 'l thigh' ] == null || bones[ 'r thigh' ] == null ) return null;
	const motion = { state: 'idle', t: 0, blend: 0, strike: null, strikeClock: 0 };
	const apply = ( local, name, angle ) => {
		const i = bones[ name ];
		if ( i != null && Number.isFinite( angle ) ) turnX( local[ i ].r, angle );
	};
	rig.poseModifier = local => {
		const sprint = motion.state === 'run';
		const amplitude = motion.blend * ( sprint ? .68 : .39 );
		const stride = Math.sin( motion.t * ( sprint ? 10.8 : 7.2 ) );
		const follow = Math.sin( motion.t * ( sprint ? 10.8 : 7.2 ) + Math.PI / 2 );
		apply( local, 'l thigh', amplitude * stride );
		apply( local, 'r thigh', -amplitude * stride );
		apply( local, 'l calf', amplitude * .59 * Math.max( 0, -follow ) );
		apply( local, 'r calf', amplitude * .59 * Math.max( 0, follow ) );
		apply( local, 'l upperarm', -amplitude * .65 * stride );
		apply( local, 'r upperarm', amplitude * .65 * stride );
		apply( local, 'spine', sprint ? -.10 * motion.blend : -.035 * motion.blend );
		// A short anticipation → contact → follow-through pose, always finite.
		if ( motion.strikeClock > 0 ) {
			const t = 1 - motion.strikeClock / ( motion.strike === 'dodge' ? .34 : .46 );
			const envelope = Math.sin( Math.max( 0, Math.min( 1, t ) ) * Math.PI );
			if ( motion.strike === 'dodge' ) {
				apply( local, 'spine1', -.44 * envelope );
				apply( local, 'l thigh', .57 * envelope );
				apply( local, 'r thigh', .57 * envelope );
			} else {
				apply( local, 'r upperarm', -( motion.strike === 'heavy' ? 2.0 : 1.5 ) * envelope );
				apply( local, 'r forearm', -.75 * envelope );
				apply( local, 'spine1', -.16 * envelope );
				apply( local, 'l upperarm', -.22 * envelope );
			}
		}
	};
	motion.update = ( dt, state ) => {
		motion.state = state;
		motion.t += dt;
		const target = state === 'walk' || state === 'run' ? 1 : 0;
		motion.blend += ( target - motion.blend ) * ( 1 - Math.exp( -dt * 14 ) );
		motion.strikeClock = Math.max( 0, motion.strikeClock - dt );
	};
	motion.trigger = kind => {
		if ( ![ 'light', 'heavy', 'dodge' ].includes( kind ) ) return false;
		motion.strike = kind;
		motion.strikeClock = kind === 'dodge' ? .34 : .46;
		return true;
	};
	actor.fallbackMotion = motion;
	return motion;
}
