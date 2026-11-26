// V33: one priority-resolved E press for the entire land chapter.
// Interaction volumes are distinct from render meshes and physical colliders.
import {interactionDistance} from '../interact/InteractionGeometryV79.js';

export class LandInteractionDirector {
	constructor() { this.candidates = []; this.selected = null; }
	beginFrame() { this.candidates.length = 0; this.selected = null; this.dispatched=false; }
	add( candidate, player ) {
		const valid=interactionDistance(candidate,player?.position,3,3.2);
        if(!valid)return false;
        this.candidates.push({...candidate,distance:valid.distance,priority:valid.priority});
		return true;
	}
	select() {
		this.selected = this.candidates.slice().sort( ( a, b ) =>
			( b.priority || 0 ) - ( a.priority || 0 ) || a.distance - b.distance ||
			String( a.id ).localeCompare( String( b.id ) ) )[ 0 ] || null;
		return this.selected;
	}
	dispatch( input, player ) {
		const candidate = this.select();
		if ( !candidate || ( player.prompt?.key === 'E' && player.prompt.source !== 'land' ) ) return null;
		player.prompt = { key: 'E', text: candidate.label, targetId: candidate.id, source: 'land' };
		if ( !this.dispatched && input.consume( 'KeyE', 'land' ) ) {this.dispatched=true;candidate.perform();}
		return candidate;
	}
}
