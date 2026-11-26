import { HUNT_RECIPES, HUNT_MATERIALS, HUNT_WEAPONS, SEA_TITANS, TITAN_BY_ID } from './HuntRules.js';

export const HUNT_SAVE_KEY = 'tidewater.hunt.v13';
const integer = n => Number.isSafeInteger( n ) && n >= 0 ? Math.min( n, 99999 ) : 0;
const safeStorage = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };

export function initialHuntSave() {
	return { v: 13, stock: Object.fromEntries( Object.keys( HUNT_MATERIALS ).map( k => [ k, 0 ] ) ),
		crafted: [ 'harpoon', 'spyglass' ], hunts: { ...Object.fromEntries( SEA_TITANS.map( b => [ b.id, 0 ] ) ), sea_god: 0 },
		fishCount: 0, trawlCount: 0, selected: 'harpoon', rewards: [] };
}

export function restoreHuntSave( value ) {
	const data = initialHuntSave();
	if ( ! value || value.v !== 13 ) return data;
	for ( const k of Object.keys( data.stock ) ) data.stock[ k ] = integer( value.stock?.[ k ] );
	data.crafted = [ 'harpoon', 'spyglass', ...new Set( ( Array.isArray( value.crafted ) ? value.crafted : [] ).filter( id => id in HUNT_RECIPES ) ) ];
	for ( const b of SEA_TITANS ) data.hunts[ b.id ] = integer( value.hunts?.[ b.id ] );
	data.hunts.sea_god = integer( value.hunts?.sea_god );
	// V22 players who defeated the hydra before the new unlock should not
	// have to replay an already-completed one-time milestone.
	if ( data.hunts.leviathan > 0 && ! data.crafted.includes( 'abyss_sub' ) && data.stock.abyssHeart === 0 ) data.stock.abyssHeart = 1;
	data.fishCount = integer( value.fishCount ); data.trawlCount = integer( value.trawlCount );
	data.rewards = ( Array.isArray( value.rewards ) ? value.rewards : [] ).filter( x => typeof x === 'string' && x.length < 90 ).slice( -128 );
	// Retain a developer-equipped weapon across reloads. The actual entitlement
	// check belongs to HuntCombat, which can be launched with ?dev=0.
	data.selected = Object.hasOwn( HUNT_WEAPONS, value.selected ) ? value.selected : 'harpoon';
	return data;
}

export class HuntProgress {
	constructor( storage = safeStorage() ) {
		this.storage = storage;
		let raw;
		try { raw = JSON.parse( storage?.getItem( HUNT_SAVE_KEY ) || 'null' ); } catch { raw = null; }
		this.data = restoreHuntSave( raw );
	}
	save() { try { this.storage?.setItem( HUNT_SAVE_KEY, JSON.stringify( this.data ) ); return true; } catch { return false; } }
	owned( id ) { return this.data.crafted.includes( id ); }
	canCraft( id ) {
		const recipe = HUNT_RECIPES[ id ];
		return !! recipe && ! this.owned( id ) && ( id !== 'abyss_sub' || this.data.hunts.leviathan > 0 ) &&
			Object.entries( recipe.cost ).every( ( [ k, n ] ) => this.data.stock[ k ] >= n );
	}
	craft( id ) {
		if ( ! this.canCraft( id ) ) return false;
		for ( const [ k, n ] of Object.entries( HUNT_RECIPES[ id ].cost ) ) this.data.stock[ k ] -= n;
		this.data.crafted.push( id ); this.save(); return true;
	}
	add( items ) {
		for ( const [ k, n ] of Object.entries( items ) ) if ( k in this.data.stock && Number.isSafeInteger( n ) && n > 0 ) this.data.stock[ k ] = Math.min( 99999, this.data.stock[ k ] + n );
		this.save();
	}
	catchFish( event ) {
		if ( ! event?.kept ) return false;
		this.data.fishCount ++;
		// Both line fishing and deepwater trawling feed the weapon industry.
		this.add( { bone: 1 + ( event.kg >= 6 ? 1 : 0 ), oil: this.data.fishCount % 2 ? 1 : 0, scrap: this.data.fishCount % 3 === 0 ? 1 : 0 } );
		return true;
	}
	trawlSalvage() { this.data.trawlCount ++; this.add( { scrap: 2 } ); }
	defeat( id, rewardKey ) {
		const boss = TITAN_BY_ID[ id ];
		if ( ! boss || typeof rewardKey !== 'string' || this.data.rewards.includes( rewardKey ) ) return false;
		this.data.rewards.push( rewardKey ); if ( this.data.rewards.length > 128 ) this.data.rewards.shift();
		this.data.hunts[ id ] ++;
		this.add( boss.loot );
		return true;
	}
	defeatSeaGod( receipt ) {
		if ( typeof receipt !== 'string' || ! receipt.startsWith( 'seagod:' ) || this.data.rewards.includes( receipt ) ) return false;
		this.data.rewards.push( receipt );
		this.data.rewards = this.data.rewards.slice( -128 );
		this.data.hunts.sea_god = integer( this.data.hunts.sea_god + 1 );
		this.add( { seaGodPearl: 1 } );
		return true;
	}
}
