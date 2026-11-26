// STORMWAKE V57. A single room timeline drives both the sun and procedural
// offshore weather. Pure math is shared by the browser and the Node room host.
import { AUTO_TIME_SPEED } from '../course/HomeLifeLogic.js';

const finite = Number.isFinite;
export const normalizeHour = hour => ( ( hour % 24 ) + 24 ) % 24;

export class RoomClock {
  constructor( now = Date.now() ) {
    this.epoch = now;
    this.hour = 16.2;
    this.day = 1;
    this.speed = AUTO_TIME_SPEED;
    this.azimuth = 0;
    this.weatherSeconds = 0;
    this.revision = 0;
  }
  snapshot( now = Date.now() ) {
    const elapsed = Math.max( 0, ( now - this.epoch ) / 1000 );
    return { hour: normalizeHour( this.hour + elapsed * this.speed ),
      day: this.day + Math.floor( ( this.hour + elapsed * this.speed ) / 24 ), speed: this.speed,
      azimuth: this.azimuth, weatherSeconds: this.weatherSeconds + elapsed,
      revision: this.revision, serverNow: now };
  }
  control( update, now = Date.now() ) {
    const permitted = Object.keys( update ).filter( k => [ 'hour', 'speed', 'azimuth' ].includes( k ) );
    if ( permitted.length === 0 ) return false;
    if ( update.hour !== undefined && ( ! finite( update.hour ) || update.hour < 0 || update.hour > 24 ) ) return false;
    if ( update.speed !== undefined && ( ! finite( update.speed ) || update.speed < 0 || update.speed > 1 ) ) return false;
    if ( update.azimuth !== undefined && ( ! finite( update.azimuth ) || update.azimuth < -180 || update.azimuth > 180 ) ) return false;
    const current = this.snapshot( now );
    this.day = current.day + ( update.hour !== undefined && update.hour < current.hour - 8 ? 1 : 0 );
    this.hour = update.hour === undefined ? current.hour : normalizeHour( update.hour );
    this.speed = update.speed === undefined ? this.speed : update.speed;
    this.azimuth = update.azimuth === undefined ? this.azimuth : update.azimuth;
    this.weatherSeconds = current.weatherSeconds;
    this.epoch = now;
    this.revision ++;
    return true;
  }
}

export class RemoteWorldClock {
  constructor() { this.state = null; this.receivedAt = 0; this.rtt = 0; }
  set( snapshot, receivedAt = Date.now(), rtt = this.rtt ) {
    if ( ! snapshot || ! [ snapshot.hour, snapshot.speed, snapshot.azimuth,
      snapshot.weatherSeconds, snapshot.serverNow, snapshot.day ].every( finite ) ) return false;
    if ( snapshot.hour < 0 || snapshot.hour >= 24 || snapshot.speed < 0 || snapshot.speed > 1 ||
      snapshot.azimuth < -180 || snapshot.azimuth > 180 || snapshot.weatherSeconds < 0 || snapshot.day < 1 ) return false;
    if ( this.state && Number.isInteger( snapshot.revision ) &&
      snapshot.revision < this.state.revision ) return false;
    this.state = { ...snapshot };
    this.receivedAt = receivedAt - Math.max( 0, Math.min( 0.4, rtt / 2000 ) ) * 1000;
    return true;
  }
  get ready() { return !! this.state; }
  sample( now = Date.now() ) {
    if ( ! this.state ) return null;
    const elapsed = Math.max( 0, ( now - this.receivedAt ) / 1000 );
    return { hour: normalizeHour( this.state.hour + elapsed * this.state.speed ),
      day: this.state.day + Math.floor( ( this.state.hour + elapsed * this.state.speed ) / 24 ),
      speed: this.state.speed, azimuth: this.state.azimuth,
      weatherSeconds: this.state.weatherSeconds + elapsed, revision: this.state.revision };
  }
}
