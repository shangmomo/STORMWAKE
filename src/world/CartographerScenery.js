import {Group,Mesh,Vector3} from '../engine/index.js';
import {box,cylinder,sphere,prepare,mergePrepared,mat4} from './boat/GeoKit.js';
import {landMaterial} from '../land/LandModels.js';
export class CartographerScenery{
 constructor(app,site,islet){this.root=new Group();this.root.name='Cartographer island and floating wreck trail';app.scene.add(this.root);this.site=site;this.app=app;this.islet=islet;
  const pieces=[];for(let i=0;i<9;i++){const angle=i*2.4,r=10+i*1.8,x=islet.x+Math.cos(angle)*r,z=islet.z+Math.sin(angle)*r,y=app.terrainData.heightAt(x,z);pieces.push(prepare(cylinder(.15,.23,4+i%3,8),{color:0x76603a,matrix:mat4(x,y+2+(i%3)*.5,z,0,angle,.09)}));for(let j=0;j<6;j++){const a=j*Math.PI/3;pieces.push(prepare(box(.65,.12,3),{color:0x4e7442,matrix:mat4(x+Math.sin(a),y+4+i%3,z+Math.cos(a),.20,a,.12)}));}}
  for(let i=0;i<8;i++){const a=i*2.2,x=islet.x+Math.sin(a)*28,z=islet.z+Math.cos(a)*27,y=app.terrainData.heightAt(x,z);pieces.push(prepare(sphere(1,8,6),{color:0x74786a,matrix:mat4(x,y+.6,z,0,a,.2,1.3+i%2,.8,1)}));app.colliders.addCylinder(x,z,1.2,y,y+1.8,{tag:'cartographerIsletRock'});}
  this.root.add(new Mesh(mergePrepared(pieces),landMaterial));this.drift=new Group();this.drift.position.set(site.x,site.y,site.z);this.root.add(this.drift);for(let i=0;i<7;i++){const plank=new Mesh(prepare(box(.22,.13,1.3+i%3*.4),{color:0x786343}),landMaterial);plank.position.set(Math.sin(i*8)*5,0,Math.cos(i*3)*5);plank.rotation.y=i;this.drift.add(plank);}
  this.birds=Array.from({length:4},()=>{const bird=new Group();for(const sign of [-1,1]){const wing=new Mesh(prepare(box(.8,.035,.18),{color:0xd9e1da}),landMaterial);wing.position.x=sign*.36;bird.add(wing);}this.root.add(bird);return bird;});
 }
 update(clock,player){this.root.visible=Math.min(Math.hypot(player.x-this.site.x,player.z-this.site.z),Math.hypot(player.x-this.islet.x,player.z-this.islet.z))<1800;if(!this.root.visible)return;this.drift.position.y=this.site.y+Math.sin(clock*.8)*.13;for(let i=0;i<this.birds.length;i++){const b=this.birds[i],angle=clock*.24+i*Math.PI/2;b.position.set(this.site.x+Math.cos(angle)*11,7+i*.5,this.site.z+Math.sin(angle)*11);b.rotation.y=-angle;for(let j=0;j<2;j++)b.children[j].rotation.z=(j?1:-1)*Math.sin(clock*6+i)*.35;}}
}
