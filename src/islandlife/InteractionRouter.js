// The legacy boat, fishing and vendor actions run first and consume E. This
// router arbitrates the additional nearby objects after those actions.
export function facingPoint( player, target ) {
	const dx = target.x - player.position.x, dz = target.z - player.position.z, distance = Math.hypot( dx, dz );
	return distance < 0.35 || ( - Math.sin( player.yaw ) * dx - Math.cos( player.yaw ) * dz ) / distance > 0.25;
}
export class InteractionRouter {
	constructor() { this.candidates = []; }
	clear() { this.candidates.length = 0; }
	add( candidate ) {
		if ( candidate && typeof candidate.perform === 'function' && Number.isFinite( candidate.distance ) && candidate.distance <= candidate.range && candidate.enabled !== false ) this.candidates.push( candidate );
	}
	select() { return this.candidates.slice().sort( ( a, b ) => ( b.priority || 0 ) - ( a.priority || 0 ) || a.distance - b.distance || String( a.id ).localeCompare( String( b.id ) ) )[ 0 ] || null; }
	dispatch( input, player ) {
		const selected = this.select();
		if ( ! selected || player.prompt?.key === 'E' ) return null;
		player.prompt = { key: 'E', text: selected.label };
		if ( input.consume( 'KeyE' ) ) selected.perform();
		return selected;
	}
}
