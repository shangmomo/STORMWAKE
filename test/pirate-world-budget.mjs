import assert from 'node:assert/strict';
import { Village } from '../src/world/Village.js';
import { Colliders } from '../src/world/Colliders.js';
import { WORLD } from '../src/world/WorldLayout.js';

// No graphics adapter is required to inspect complete procedural geometry.
Village.prototype._assemble = function() {

	this.shadowTriangles = this.B.triangles;
	this.meshes = [];

};
const terrain = {
	heightAt( x, z ) { return z > 0 ? - 2.8 : 1.0; },
	flatten() {},
};
const colliders = new Colliders();
const village = new Village( { terrain, colliders, scene: { add() {} } } );
assert.equal( village.homes.length, 17 );
assert.ok( village.shadowTriangles < 215000,
	`V8 exceeded static geometry budget: ${ village.shadowTriangles }` );
assert.ok( village.shadowTriangles > 165000, 'missing village geometry' );
assert.equal( WORLD.pier.headOffsetX, 3.8 );
assert.ok( WORLD.pier.width > 3.3 );
assert.ok( WORLD.boatDock.position.x > WORLD.pier.x + WORLD.pier.headOffsetX + WORLD.pier.headWidth / 2 );
console.log( `V9 world: PASS ${ village.shadowTriangles } static triangles, 17 homes, moved boat berth` );
