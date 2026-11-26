// Pure functions kept independent of WebGPU, DOM and the game renderer.
export const HOME_SAVE_KEY = 'tidewater.course.homelife.v2';
export const GAME_DAY_SECONDS = 24 * 60; // one day of play takes 24 real minutes
export const AUTO_TIME_SPEED = 24 / GAME_DAY_SECONDS;
export const SLEEP_DURATION = 6;
export const SLEEP_MORNING_AT = 3.5;

export function clockLabel( hour ) {

	const h = ( ( Number( hour ) || 0 ) % 24 + 24 ) % 24;
	const hours = Math.floor( h );
	const mins = Math.floor( ( h - hours ) * 60 );
	return `${ String( hours ).padStart( 2, '0' ) }:${ String( mins ).padStart( 2, '0' ) }`;

}

export function dayPeriod( hour ) {

	const h = ( ( Number( hour ) || 0 ) % 24 + 24 ) % 24;
	if ( h < 5.5 ) return '深夜';
	if ( h < 8 ) return '清晨';
	if ( h < 11 ) return '上午';
	if ( h < 14 ) return '午间';
	if ( h < 17.5 ) return '午后';
	if ( h < 19.5 ) return '傍晚';
	return '夜晚';

}

export function nearDoor( position, home, range = 2.1 ) {

	return !! ( position && home && home.door &&
		Math.hypot( position.x - home.door.x, position.z - home.door.z ) <= range &&
		Math.abs( position.y - home.door.y ) < 2.3 );

}

export function nearBed( position, home, range = 1.85 ) {

	return !! ( position && home && home.bed &&
		Math.hypot( position.x - home.bed.x, position.z - home.bed.z ) <= range &&
		Math.abs( position.y - home.floorY ) < 1.4 );

}

export function facingBed( position, yaw, home ) {
	if ( ! nearBed( position, home ) || ! Number.isFinite( yaw ) ) return false;
	const dx = home.bed.x - position.x, dz = home.bed.z - position.z;
	const distance = Math.hypot( dx, dz );
	return distance < 0.1 || ( - Math.sin( yaw ) * dx - Math.cos( yaw ) * dz ) / distance >= 0.65;
}

export function isNewDay( previousHour, currentHour, timeSpeed ) {

	return timeSpeed > 0 && previousHour >= 23.5 && currentHour < 0.5;

}
