// V30: independent ship telegraph, self-centering rudder and submarine physics.
// The browser renderer is deliberately not coupled to these pure game controls.
export const SUBMARINE_DRIVE = Object.freeze( {
	cruise: 86, flank: 116, reverse: 34,
	acceleration: 78, braking: 112, turnRate: 1.02, mouseTurnRate: 1.58,
	riseSpeed: 36, throttleNotch: .25, throttleHoldRate: 1.15,
} );

const finiteSpeed=v=>Number.isFinite(v)?v:0;
const cap = ( n, a, b ) => Math.max( a, Math.min( b, n ) );
const damp = ( a, b, dt, responsiveness ) => a + ( b - a ) * ( 1 - Math.exp( -dt * responsiveness ) );
const wrap = a => Math.atan2( Math.sin( a ), Math.cos( a ) );

// A mouse motion only changes the desired CAMERA orbit. It is mathematically
// impossible for this function to steer the submarine or alter its throttle.
export function orbitSubmarineCamera( yaw, elevation, mouseX, mouseY, sensitivity = 1, invertX=false, invertY=false ) {
	mouseX *= invertX?-1:1; mouseY *= invertY?-1:1;
	const factor = cap( sensitivity, .5, 1.5 );
	return { yaw: wrap( yaw - cap( mouseX, -150, 150 ) * .0029 * factor ),
		elevation: cap( elevation + cap( mouseY, -120, 120 ) * .0025 * factor, -.40, 1.02 ) };
}

// Open Water-inspired *interaction*: W/S move a persistent engine telegraph;
// a tap changes one notch, holding a key continues increasing/decreasing it.
// The actual speed is updated separately by stepSubmarineDynamics().
export function adjustSubmarineThrottle( vessel, input, dt ) {
	dt = cap( Number.isFinite( dt ) ? dt : 0, 0, .05 );
	if ( input.stop ) { vessel.throttle=0; vessel.throttleHold=0; return 0; }
	if ( input.arcade ) { vessel.throttle=Number(!!input.up)-Number(!!input.down); vessel.throttleHold=0; return vessel.throttle; }
	let throttle = cap( Number.isFinite( vessel.throttle ) ? vessel.throttle : 0, -1, 1 );
	const direction = Number( !!input.up ) - Number( !!input.down );
	if ( direction && ( direction > 0 ? input.upPressed : input.downPressed ) )
		throttle += direction * SUBMARINE_DRIVE.throttleNotch;
	if ( direction ) {
		const before = Math.max( 0, ( vessel.throttleHold || 0 ) - .20 );
		vessel.throttleHold = ( vessel.throttleHold || 0 ) + dt;
		const after = Math.max( 0, vessel.throttleHold - .20 );
		throttle += direction * ( after - before ) * SUBMARINE_DRIVE.throttleHoldRate;
	} else vessel.throttleHold = 0;
	vessel.throttle = cap( throttle, -1, 1 );
	return vessel.throttle;
}

export function stepSubmarineDynamics( vessel, input, dt ) {
	dt = cap( Number.isFinite( dt ) ? dt : 0, 0, .05 );
	const thrust = cap( Number.isFinite(input.thrust)?input.thrust:0, -1, 1 );
	const turn = cap( Number.isFinite(input.turn)?input.turn:0, -1, 1 );
	const ballast = cap( Number.isFinite(input.ballast)?input.ballast:0, -1, 1 );
	const top = input.flank ? SUBMARINE_DRIVE.flank : SUBMARINE_DRIVE.cruise;
	const targetSpeed = thrust >= 0 ? thrust * top : thrust * SUBMARINE_DRIVE.reverse;
    if(input.comfort){vessel.speed=damp(finiteSpeed(vessel.speed),targetSpeed,dt,thrust?2.4:3.4);if(Math.abs(vessel.speed)<.08)vessel.speed=0;}
	const dv = targetSpeed - vessel.speed;
	if(!input.comfort)vessel.speed += cap( dv, -SUBMARINE_DRIVE.braking * dt, SUBMARINE_DRIVE.acceleration * dt );
	// The lever stays put when keys are released; the actual speed approaches it
	// with acceleration/drag. In neutral, the engine gently brakes to a stop.
	// A stationary full-size submarine should not pirouette like a character.
	// Steering grows with actual water flow, but low-speed thrusters retain
	// enough authority to leave a confined canyon safely.
	const authority = input.comfort?.42+.58*Math.min(1,Math.abs(vessel.speed)/32):0.20 + 0.80 * Math.min( 1, Math.abs( vessel.speed ) / 24 );
	const reverse = !input.comfort && vessel.speed < -1 ? -1 : 1;
	// A/D commands rudder deflection. Releasing the key returns the rudder to
	// centre without snapping the hull. This also works when reversing.
	vessel.rudder = damp( vessel.rudder || 0, turn, dt, turn ? 17 : 8 );
	if ( Math.abs( vessel.rudder ) < .0001 ) vessel.rudder = 0;
	// An optional set-course command is retained for scripted/autopilot callers;
	// mouse motion never supplies this heading in normal player gameplay.
	const mouseHelm = Number.isFinite( input.heading );
	const error = mouseHelm ? Math.atan2( Math.sin( input.heading - vessel.yaw ),
		Math.cos( input.heading - vessel.yaw ) ) : 0;
	const yawTarget = mouseHelm ? cap( error * 4.4,
		-SUBMARINE_DRIVE.mouseTurnRate, SUBMARINE_DRIVE.mouseTurnRate ) :
		-vessel.rudder * SUBMARINE_DRIVE.turnRate * authority * reverse * (input.comfort?.82:1);
	vessel.yawRate = damp( vessel.yawRate || 0, yawTarget, dt, mouseHelm ? 12 : 9.5 );
	vessel.yaw += vessel.yawRate * dt;
	vessel.diveVelocity = damp( vessel.diveVelocity || 0, ballast * SUBMARINE_DRIVE.riseSpeed, dt, 4.8 );
	// Pitch/heel are hull visuals only; ballast cannot accidentally change the firing heading.
	vessel.pitch = damp( vessel.pitch || 0, -ballast * .10, dt, 3.8 );
	vessel.subRoll = damp( vessel.subRoll || 0, -vessel.yawRate * .080, dt, 4.6 );
	return vessel;
}
