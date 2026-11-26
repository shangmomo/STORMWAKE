import { SEA_TITANS } from './HuntRules.js';
import { WORLD } from '../world/WorldLayout.js';

// The owner is actively developing the game: quality-of-life debug controls
// are enabled by default. Add ?dev=0 to test the original progression rules.
export function developerAccessEnabled( query = typeof location === 'undefined' ? '' : location.search ) {
	return new URLSearchParams( query ).get( 'dev' ) !== '0';
}

export function bossTeleportDestination( boss, terrain ) {
	if ( ! boss || ! Number.isFinite( boss.brain?.x ) || ! Number.isFinite( boss.brain?.z ) ) return null;
	const distance = Math.max( 55, Math.min(boss.detection*.72, boss.attackRange + 32) );
	const behind = boss.brain.heading + Math.PI;
	const angles = [ 0, 0.4, - 0.4, 0.9, - 0.9, Math.PI ];
	for ( const offset of angles ) {
		const theta = behind + offset;
		const x = boss.brain.x + Math.sin( theta ) * distance;
		const z = boss.brain.z + Math.cos( theta ) * distance;
		// Never put the boat onto the island, a shoal or an exposed seamount.
		if ( terrain?.heightAt && ( ! Number.isFinite( terrain.heightAt( x, z ) ) || terrain.heightAt( x, z ) > - 8 ) ) continue;
		return { x, z, heading: Math.atan2( boss.brain.x - x, boss.brain.z - z ), distance };
	}
	return null;
}

export function teleportCaptainAndShip( app, id ) {
	if ( ! SEA_TITANS.some( b => b.id === id ) || (app.crew?.connected && !app.voyageM1?.net.isHost) ) return null;
	const boss = app.hunt?.bosses.get( id );
	const arrival = bossTeleportDestination( boss, app.terrainData );
	if ( ! arrival || ! app.boatCtl?.teleportTo?.( arrival.x, arrival.z, arrival.heading ) ) return null;
	const player = app.player;
	if(app.voyageM1){
        if(player.stationId)app.voyageM1.leaveStation();
        if(player.mode!=='deck'){player.boardBoat();}
        player.deckYaw=0;player.deckToWorld();player.deckVel.set(0,0,0);
        app.voyageM1.combatWarpTarget=id;app.oceanChart?.clearNavigation?.();app.voyageM1.navigationStopping=false;app.voyageM1.navArrived=false;app.voyageM1.navDestination=null;
        if(!app.crew?.connected){boss.brain.alert=1;boss.brain.targetId='local';boss.brain.state='chase';boss.brain.lost=0;boss.brain.cooldown=Math.min(boss.brain.cooldown,1.5);}
    } else if ( player.mode !== 'boat' && player.mode !== 'deck' ) player.enterBoat();
	else if ( player.mode === 'deck' ) {
		player.deckToWorld();
		player.deckVel.set( 0, 0, 0 );
	} else {
		app.boatCtl.toWorld( app.boatCtl.model.helmEye, player.position );
		player.position.y -= 1.62;
	}
	player._camY = null;
	player.camInit = false;
	player.orbitYaw = arrival.heading + Math.PI;
	player.velocity.set( 0, 0, 0 );
	app.marineExpedition.targetZone = `boss:${ id }`;
	if ( app.crew ) app.crew.networkClock = 0; // immediate co-op position sync
    if(app.voyageM1?.net)app.voyageM1.net.lastStateSent=0;
	return arrival;
}

// The final chapter offers a real, player-facing return journey. Pick a
// navigable deep-water berth outside the pier, not the dry island spawn or a
// dock vertex that would strand the physics hull inside the sea floor.
export function mainIslandHarborArrival( terrain ) {
	const dock = WORLD.boatDock.position;
	const candidates = [
		[ dock.x + 3, dock.z + 62 ], [ dock.x + 16, dock.z + 78 ],
		[ dock.x - 14, dock.z + 85 ], [ dock.x + 33, dock.z + 107 ],
		[ dock.x - 22, dock.z + 126 ], [ dock.x + 45, dock.z + 142 ],
	];
	for ( const [ x, z ] of candidates ) {
		const depth = terrain?.heightAt?.( x, z );
		if ( ! Number.isFinite( depth ) || depth > -8 ) continue;
		return { x, z, heading: Math.atan2( WORLD.pier.x - x, WORLD.pier.zEnd - z ) };
	}
	return null;
}

export function returnCaptainToMainIsland( app ) {
	const arrival = mainIslandHarborArrival( app.terrainData );
	if ( ! arrival || ! app.boatCtl?.teleportTo?.( arrival.x, arrival.z, arrival.heading ) ) return null;
	const player = app.player;
	if(app.voyageM1){
        if(player.stationId)app.voyageM1.leaveStation();
        if(player.mode!=='deck'){player.boardBoat();}
        player.deckYaw=0;player.deckToWorld();player.deckVel.set(0,0,0);
        app.voyageM1.combatWarpTarget=null;app.oceanChart?.clearNavigation?.();app.voyageM1.navigationStopping=false;app.voyageM1.navArrived=false;app.voyageM1.navDestination=null;
    } else if ( player.mode !== 'boat' && player.mode !== 'deck' ) player.enterBoat();
	else if ( player.mode === 'deck' ) {
		player.deckVel.set( 0, 0, 0 );
		player.deckToWorld();
	} else {
		app.boatCtl.toWorld( app.boatCtl.model.helmEye, player.position );
		player.position.y -= 1.62;
	}
	player.camInit = false;
	player._camY = null;
	player.orbitYaw = arrival.heading + Math.PI;
	player.velocity.set( 0, 0, 0 );
	if ( app.marineExpedition ) app.marineExpedition.targetZone = null;
	if ( app.crew ) app.crew.networkClock = 0;
	return arrival;
}
