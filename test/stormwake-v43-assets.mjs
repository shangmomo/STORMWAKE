// Check actual bundled bytes and GLB embedded skin/animation metadata.
// A resource catalogue entry without a real file is not accepted as installed.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
const root=new URL('../public/models/land/',import.meta.url);
const cast=JSON.parse(readFileSync(new URL('v38_pirate_cast_manifest.json',root),'utf8'));
const crew=['resident_watchman','resident_herbalist','resident_apprentice'];
let verified=0;
for(const id of crew){const entry=cast.actors[id];
 assert.ok(entry,`Missing crew ${id} manifest slot`);
 assert.equal(entry.license,'CC0');
 const url=new URL(entry.file,root);assert.ok(existsSync(url),`Missing actual GLB file ${entry.file}`);
 const buffer=readFileSync(url);
 assert.equal(buffer.toString('ascii',0,4),'glTF');assert.equal(buffer.readUInt32LE(4),2);
 assert.equal(buffer.readUInt32LE(8),buffer.length);
 assert.equal(buffer.toString('ascii',16,20),'JSON');
 const len=buffer.readUInt32LE(12),gltf=JSON.parse(buffer.subarray(20,20+len).toString('utf8'));
 assert.ok(gltf.skins?.length>0,`No skeleton in ${entry.file}`);
 assert.ok(gltf.animations?.some(a=>/walk/i.test(a.name)),`No real walk animation in ${entry.file}`);
 assert.ok(gltf.animations?.some(a=>/idle/i.test(a.name)),`No real idle animation in ${entry.file}`);
 assert.ok(gltf.meshes?.length>0);
 verified++;console.log(`PASS ${id} -> ${entry.file}: ${gltf.animations.length} authored clips, ${gltf.skins.length} skin(s), ${(buffer.length/1024).toFixed(0)} KiB`);
}
console.log(`V43 installed CC0 sailor asset checks passed: ${verified}`);
