import {restoreUnderground} from './UndergroundLedgerV85.js';
import {FishStockV81} from './FishStockV81.js';
import {FORGE_COSTS,WEAPON_IDS,restoreForge} from './LandForge.js';
import { FISH, fishValue, fishLengthCm } from './FishTable.js';
import { defaultUpgrades, gearStats, nextLevel, UPGRADES, FUEL_PRICE } from './Gear.js';

const SAVE_KEY = 'tidewater.save.v1';

// Everything the player owns: wallet, the fish in the cooler / hold, the fish log and the gear
// levels. Saved to localStorage (per browser) after every change; storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the game runs without it.
export class GameState {

	constructor( storage = safeStorage() ) {

		this.storage = storage;
		this.money = 0;
		this.inventory = []; // { id, species, kg, cm, value, caughtAt (game hours), record }
		this.log = {}; // species -> { count, bestKg, bestCm }
		// the last addFish: { species, kg, cm, value, newSpecies, record, prevBestKg, prevBestCm, kept } (the catch card)
		this.lastCatch = null;
		this.upgrades = defaultUpgrades();
		this.fuel = null; // litres left (null = full tank)
		this._nextId = 1;
		this.listeners = new Set();
		this.catchListeners = new Set();
		this.rewardReceipts = [];
		this.landForge = restoreForge(null);
		this.underground=restoreUnderground(null);
		this.fishStock=new FishStockV81();

	}

	get stats() {

		return gearStats( this.upgrades );

	}

	get holdKg() {

		let kg = 0;
		for ( const f of this.inventory ) kg += f.kg;
		return kg;

	}

	get holdValue() {

		let v = 0;
		for ( const f of this.inventory ) v += f.value;
		return v;

	}

	// room in the cooler / hold for a fish of `kg`?
	fits( kg ) {

		return this.holdKg + kg <= this.stats.holdKg + 1e-6;

	}

	// store a caught fish; returns the entry, or null when the hold is full (it is logged either way).
	// A record beats an earlier catch of the species; the first one of a species is a new species.
	addFish( species, kg, timeOfDay = 12, point=null ) {

		if(!Object.hasOwn(FISH,species)||!Number.isFinite(kg)||kg<=0||kg>10000||!Number.isFinite(timeOfDay)){this.lastCatch=null;return null;}
		const priorLog=this.log[species]?{...this.log[species]}:null,priorId=this._nextId;
		kg = Math.round( kg * 100 ) / 100;
		if(kg<=0){this.lastCatch=null;return null;}
		const cm = Math.round( fishLengthCm( species, kg ) );
		const reservation=point&&this.fits(kg)?this.fishStock.reserve(point.x,point.z):null;
		if(point&&this.fits(kg)&&!reservation){this.lastCatch={species,kg,cm,value:fishValue(species,kg),kept:false,failed:"stock"};return null;}
		const logEntry = this.log[ species ] || ( this.log[ species ] = { count: 0, bestKg: 0 } );
		const newSpecies = logEntry.count === 0;
		const prevBestKg = logEntry.bestKg, prevBestCm = logEntry.bestCm ?? ( prevBestKg > 0 ? Math.round( fishLengthCm( species, prevBestKg ) ) : 0 );
		const record = ! newSpecies && kg > prevBestKg;
		logEntry.count ++;
		if ( kg > prevBestKg ) {

			logEntry.bestKg = kg;
			logEntry.bestCm = cm;

		}

		const value = fishValue( species, kg );
		const kept = this.fits( kg );
		this.lastCatch = { species, kg, cm, value, newSpecies, record, prevBestKg, prevBestCm, kept };
		const f=kept?{id:this._nextId++,species,kg,cm,value,caughtAt:timeOfDay,record}:null;
		if(f)this.inventory.push(f);
		if(this.storage&&!this.save()){if(f)this.inventory.pop();this.fishStock.rollback(reservation);this._nextId=priorId;if(priorLog)this.log[species]=priorLog;else delete this.log[species];this.lastCatch={...this.lastCatch,kept:false,failed:'save',newSpecies:false,record:false};return null;}
		for(const fn of this.catchListeners){try{fn(this.lastCatch);}catch(e){console.error('Catch listener failed',e);}}
		this.emit();
		return f;

	}

	// sell the given fish ids (all when omitted); returns the money made
	sell( ids = null ) {

		const keep = [], sold = [];
		for ( const f of this.inventory ) ( ids === null || ids.includes( f.id ) ? sold : keep ).push( f );
		let total = 0;
		for ( const f of sold ) total += f.value;
		if(!sold.length)return {total:0,count:0};
        if(!Number.isSafeInteger(total)||total<0||!Number.isFinite(this.money))return {total:0,count:0};
        const previousInventory=this.inventory,previousMoney=this.money;
        this.inventory = keep;
		this.money += total;
		if(this.storage&&!this.save()){this.inventory=previousInventory;this.money=previousMoney;return {total:0,count:0};}
		this.emit();
		return { total, count: sold.length };

	}

	release( id ) {

		const previous=this.inventory;
        this.inventory = this.inventory.filter( ( f ) => f.id !== id );
		if(this.storage&&!this.save()){this.inventory=previous;return false;}
		this.emit();

	}

	// spend money (upgrade shop); false when it can't be afforded
	grantMoney( amount, transactionId ) {
		if ( ! Number.isSafeInteger( amount ) || amount <= 0 || !Number.isFinite(this.money) || this.money+amount>Number.MAX_SAFE_INTEGER || typeof transactionId !== 'string' || ! transactionId || transactionId.length > 120 || this.rewardReceipts.includes( transactionId ) ) return false;
		this.money += amount;
		this.rewardReceipts.push( transactionId );
		// Wallet and receipt must commit together. If an available storage
		// backend rejects the write, leave the quest claim retryable.
		if ( this.storage && ! this.save() ) { this.money -= amount; this.rewardReceipts.pop(); return false; }
		this.emit();
		return true;
	}

	onCatch( fn ) {
		this.catchListeners.add( fn );
		return () => this.catchListeners.delete( fn );
	}

	spend( amount ) {

		if ( !Number.isFinite(amount)||amount<0||!Number.isFinite(this.money)||amount>this.money ) return false;
		this.money -= amount;
		if(this.storage&&!this.save()){this.money+=amount;return false;}
		this.emit();
		return true;

	}

    // Commit wallet and weapon level in the same save record; roll both back on failure.
    buyLandForge(id) {
        if(!WEAPON_IDS.includes(id))return {ok:false,reason:'invalid'};
        const level=this.landForge[id],cost=FORGE_COSTS[level];
        if(!cost)return {ok:false,reason:'max'};
        if(!Number.isFinite(this.money)||this.money<cost)return {ok:false,reason:'funds'};
        this.money-=cost;this.landForge[id]=level+1;
        if(this.storage&&!this.save()){this.money+=cost;this.landForge[id]=level;return {ok:false,reason:'save'};}
        this.emit();return {ok:true,level:level+1,cost};
    }
    payLandService(cost){
        if(!Number.isSafeInteger(cost)||cost<=0||!Number.isFinite(this.money)||this.money<cost)return false;
        this.money-=cost;if(this.storage&&!this.save()){this.money+=cost;return false;}this.emit();return true;
    }

	// buy the next level of an upgrade track; returns the new level entry or null
	buy( key ) {

		if ( ! Object.hasOwn(UPGRADES,key) || !Number.isFinite(this.money) ) return null;
		const next = nextLevel( this.upgrades, key );
		if ( ! next || next.cost > this.money ) return null;
		const oldLevel=this.upgrades[key],oldFuel=this.fuel;
        this.money -= next.cost;
		this.upgrades[ key ] = next.index;
		if ( key === 'fuel' ) this.fuel = null; // a new tank comes full
		if(this.storage&&!this.save()){this.money+=next.cost;this.upgrades[key]=oldLevel;this.fuel=oldFuel;return null;}
		this.emit();
		return next;

	}

	get fuelL() {

		return this.fuel === null ? this.stats.fuelL : Math.min( this.fuel, this.stats.fuelL );

	}

	// burn litres (no save: that happens when the boat stops or at the next sale / purchase)
	burn( litres ) {

		this.fuel = Math.max( 0, this.fuelL - litres );
		return this.fuel;

	}

	refuelCost() {

		return Math.ceil( ( this.stats.fuelL - this.fuelL ) * FUEL_PRICE );

	}

	// fill up as far as the money goes; returns litres bought
	refuel() {

		const missing = this.stats.fuelL - this.fuelL;
		const litres = Math.min( missing, Math.floor( this.money / FUEL_PRICE ) );
		if ( litres <= 0 ) return 0;
		if(!Number.isFinite(litres)||!Number.isFinite(this.money))return 0;
        const oldMoney=this.money,oldFuel=this.fuel;
        this.money -= Math.ceil( litres * FUEL_PRICE );
		this.fuel = this.fuelL + litres;
		if ( this.fuel >= this.stats.fuelL - 1e-3 ) this.fuel = null;
		if(this.storage&&!this.save()){this.money=oldMoney;this.fuel=oldFuel;return 0;}
		this.emit();
		return litres;

	}

	onChange( fn ) {

		this.listeners.add( fn );
		return () => this.listeners.delete( fn );

	}

	emit() {

		for ( const fn of this.listeners ) {try{fn(this);}catch(e){console.error("Game state listener failed",e);}}

	}

	toJSON() {

		return { v: 1, money: this.money, inventory: this.inventory, log: this.log, upgrades: this.upgrades, fuel: this.fuel, nextId: this._nextId, rewardReceipts: this.rewardReceipts, landForge:this.landForge,underground:this.underground,fishStock:this.fishStock.toJSON() };

	}

	fromJSON( d ) {

		if ( ! d || d.v !== 1 ) return false;
		this.money = Number.isFinite( d.money ) ? d.money : 0;
		this.landForge=restoreForge(d.landForge);
		this.underground=restoreUnderground(d.underground);
		this.fishStock.restore(d.fishStock);
		this.rewardReceipts = Array.isArray( d.rewardReceipts ) ? [ ...new Set( d.rewardReceipts.filter( id => typeof id === 'string' && id.length <= 120 ) ) ] : [];
		this.inventory = Array.isArray( d.inventory ) ? d.inventory.filter( ( f ) => f && FISH[ f.species ] && Number.isFinite( f.kg ) ) : [];
		// saves from before lengths were recorded
		for ( const f of this.inventory ) if ( ! Number.isFinite( f.cm ) ) f.cm = Math.round( fishLengthCm( f.species, f.kg ) );
		this.log = d.log && typeof d.log === 'object' ? d.log : {};
		for ( const [ k, v ] of Object.entries( this.log ) ) if ( FISH[ k ] && v && v.bestKg > 0 && ! Number.isFinite( v.bestCm ) ) v.bestCm = Math.round( fishLengthCm( k, v.bestKg ) );
		this.upgrades = { ...defaultUpgrades(), ...( d.upgrades || {} ) };
		this.fuel = Number.isFinite( d.fuel ) ? d.fuel : null;
		this._nextId = Math.max( d.nextId | 0, ...this.inventory.map( ( f ) => f.id + 1 ), 1 );
		return true;

	}

	save() {

		if ( ! this.storage ) return false;
		try {

			this.storage.setItem( SAVE_KEY, JSON.stringify( this.toJSON() ) );
			return true;

		} catch ( e ) { return false; /* storage full or blocked: keep playing */ }

	}

	load() {

		if ( ! this.storage ) return false;
		try {

			const raw = this.storage.getItem( SAVE_KEY );
			return raw ? this.fromJSON( JSON.parse( raw ) ) : false;

		} catch ( e ) {

			return false;

		}

	}

	reset() {
		this.underground=restoreUnderground(null);
		this.fishStock=new FishStockV81();

		this.money = 0;
		this.inventory = [];
		this.log = {};
		this.upgrades = defaultUpgrades();
		this.fuel = null;
		this.save();
		this.emit();

	}

}

function safeStorage() {

	try {

		return typeof localStorage !== 'undefined' ? localStorage : null;

	} catch ( e ) {

		return null;

	}

}
