import { Vector3 } from '../engine/index.js';
import { RECIPES } from './IslandLifeState.js';
import { homeSlots, insideHome, validDecorPlacement } from './HomeDecorLogic.js';

const HEIGHTS = { chair: 1.05, table: 0.8, shelf: 1.45, lamp: 0.7, chime: 1.05, frame: 0.65 };
export class HomeDecor {
	constructor( app, state, models ) { this.app = app; this.state = state; this.models = models; this.active = null; this.objects = []; this.preview = null; this.dirty = true; }
	getHome() { return this.app.village.homes.find( h => h.name === this.app.homeLife?.saveState?.home ) || null; }
	currentRoom() { return this.app.village.homes.find( h => insideHome( h, this.app.player.position ) ) || null; }
	inside() { const home = this.getHome(); return !! home && insideHome( home, this.app.player.position ); }
	slots( home = this.getHome() ) { return homeSlots( home ); }
	valid( home, slot, itemId, rotation, ignoreId = null ) {
		if ( ! slot || ! RECIPES[ itemId ] ) return false;
		const player = this.app.player.position, clearance = Math.max( ...RECIPES[ itemId ].size ) + 0.32;
		if ( Math.abs( player.y - home.floorY ) < 1.4 && Math.hypot( player.x - slot.x, player.z - slot.z ) < clearance ) return false;
		return validDecorPlacement( home, slot, itemId, rotation, this.state.data.placements[ home.name ] || [], this.app.colliders, ignoreId );
	}
	clear() {
		for ( const item of this.objects ) {
			this.app.scene.remove( item.mesh );
			const i = this.app.colliders.boxes.indexOf( item.collider ); if ( i >= 0 ) this.app.colliders.boxes.splice( i, 1 );
		}
		this.objects.length = 0; this.active = null;
	}
	sync() {
		const home = this.getHome(), p = this.app.player.position;
		const active = home && Math.hypot( p.x - home.x, p.z - home.z ) < 40 ? home : null;
		if ( ! this.dirty && this.active?.name === active?.name ) return;
		this.clear(); this.dirty = false; if ( ! active ) return;
		this.active = active; const slots = this.slots( active );
		for ( const item of this.state.data.placements[ active.name ] || [] ) {
			const slot = slots.find( s => s.id === item.slotId ), recipe = RECIPES[ item.itemId ];
			if ( ! slot || ! recipe ) continue;
			const yaw = active.yaw + item.rotation * Math.PI / 2, mesh = this.models.mesh( item.itemId );
			mesh.position.set( slot.x, active.floorY, slot.z ); mesh.rotation.y = yaw; this.app.scene.add( mesh );
			const height = HEIGHTS[ item.itemId ], collider = this.app.colliders.addBox( new Vector3( slot.x, active.floorY + height / 2, slot.z ), new Vector3( recipe.size[ 0 ], height / 2, recipe.size[ 1 ] ), yaw, { tag: 'lifeFurniture' } );
			this.objects.push( { mesh, collider, item } );
		}
	}
	showPreview( home, slot, itemId, rotation ) {
		this.hidePreview(); if ( ! home || ! slot || ! RECIPES[ itemId ] ) return;
		this.preview = this.models.mesh( itemId ); this.preview.position.set( slot.x, home.floorY + 0.08, slot.z ); this.preview.rotation.y = home.yaw + rotation * Math.PI / 2;
		this.app.scene.add( this.preview );
		// While the editor owns input, turn the player's view toward the selected
		// world-space preview so it is visible as positions change.
		const camera = this.app.camera, player = this.app.player;
		if ( camera?.position && player ) {
			const dx = slot.x - camera.position.x, dz = slot.z - camera.position.z, dy = home.floorY + 0.55 - camera.position.y;
			if ( Math.hypot( dx, dz ) > 0.05 ) { player.yaw = Math.atan2( - dx, - dz ); player.pitch = Math.max( - 1.3, Math.min( 1.0, Math.atan2( dy, Math.hypot( dx, dz ) ) ) ); }
		}
	}
	hidePreview() { if ( this.preview ) this.app.scene.remove( this.preview ); this.preview = null; }
	place( itemId, slotId, rotation, movingId = null ) {
		const home = this.getHome(); if ( ! home || ! this.inside() ) return false;
		const slot = this.slots( home ).find( s => s.id === slotId );
		const valid = this.valid( home, slot, itemId, rotation, movingId );
		const ok = movingId ? this.state.move( home.name, movingId, slotId, rotation, valid ) : !! this.state.place( home.name, itemId, slotId, rotation, valid );
		if ( ok ) { this.dirty = true; this.sync(); } return ok;
	}
	remove( instanceId ) { const home = this.getHome(); if ( ! home || ! this.inside() || ! this.state.remove( home.name, instanceId ) ) return false; this.dirty = true; this.sync(); return true; }
}
