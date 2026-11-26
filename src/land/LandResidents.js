import { Vector3 } from '../engine/index.js';
import { SkinnedModel } from '../engine/render/Skinning.js';
import { loadGLB } from '../engine/loaders/GLTF.js';
import { createVillageResident } from './LandModels.js';
import { loadLandRig, assignRigActions, playLandRigAction } from './LandRigRuntime.js';
import { installHumanoidMotionFallback } from './LandHumanoidMotion.js';
import { LandVillageNavigator } from './LandVillageNavigator.js';
import { LandFootPlant, followGround } from './LandGrounding.js';
import { attachPirateStyle } from './LandPirateStyle.js';

// The original project already ships two MIT Rocketbox humans (7-9k triangles,
// 7 real authored gesture clips). Reuse these in preference to V31 primitives.
const BASE = ( ( import.meta.env?.BASE_URL ) || '/' );
const BUILTIN_RIGS = [ `${BASE}models/characters/joe.glb`, `${BASE}models/characters/marta.glb` ];
const library = new Map();
function cachedGLB( url ) {
	if ( !library.has( url ) ) library.set( url, loadGLB( url ).catch( e => { library.delete( url ); throw e; } ) );
	return library.get( url );
}

export async function loadResidentRig( url ) {
	const model = await SkinnedModel.create( await cachedGLB( url ) );
	if ( !model.clipNames().includes( 'idle_neutral_01' ) || !model.clipNames().includes( 'wave_01' ) )
		throw new Error( 'Resident rig lacks idle and greet animation clips' );
	for ( const material of model.materials ) material.underwaterLighting = 'lite';
	// The GLB origin is not a reliable foot anchor. The V37 LandFootPlant
	// samples skinned sole vertices after the rig has been attached. Do not
	// pre-lift by one metre here: it caused the village's visible hovering.
	model.group.position.y = 0;
	model.play( 'idle_neutral_01', { fade: .01 } );
	model.update( 0 );
	model.onClipEnd = () => model.play( 'idle_neutral_01', { fade: .35 } );
	return model;
}

const PEOPLE = [
	{ id: 'harbor', name: '港口巡守 · 阿岚', work: [ 76, -91 ], meet: [ 50, -107 ], home: [ 72, -125 ],
		lines: [ '海风一变，码头的绳索就开始无风摇晃。', '今晚最好别离开灯火。', '灯塔亮起来了，航路终于安全了。' ] },
	{ id: 'herbalist', name: '草药师 · 米拉', work: [ -10, -132 ], meet: [ 40, -108 ], home: [ -4, -111 ],
		lines: [ '密林深处有发光的石柱，沿着它们会找到古老遗迹。', '这些紫色孢子只在潮蚀夜晚出现。', '感谢你守住了森林的光。' ] },
	{ id: 'keeper', name: '前灯塔看守 · 洛恩', work: [ 18, -143 ], meet: [ 30, -108 ], home: [ 17, -125 ],
		lines: [ '三面旧式反光镜的角度决定灯塔能否重新点亮。', '那座塔的地下，仿佛有东西在呼吸。', '那束光，是我见过最美的黎明。' ] },
	{ id: 'netmaker', name: '织网匠 · 塔娅', work: [ 65, -102 ], meet: [ 49, -109 ], home: [ 62, -119 ],
		lines: [ '今天的网眼得再细一点，深海鱼长得越来越奇怪。', '你知道吗？老人说风暴前海会突然安静。', '港口重新亮起来以后，大家终于敢出海了。' ] },
	{ id: 'merchant', name: '行商 · 艾文', work: [ 46, -105 ], meet: [ 37, -115 ], home: [ 49, -126 ],
		lines: [ '补给从北岸来，路上的木桥需要维修。', '如果灯塔不亮，商船就会在礁石间迷路。', '今天带来了新鲜货物，愿潮汐照顾你。' ] },
	{ id: 'fisher', name: '老渔夫 · 霍克', work: [ 82, -114 ], meet: [ 65, -105 ], home: [ 74, -130 ],
		lines: [ '好天气要早点检查鱼篓；晚一点海流就变了。', '夜里我看到森林里有三道青光，不像萤火虫。', '多亏你，夜航不再是赌命。' ] },
	{ id: 'baker', name: '面包师 · 莉亚', work: [ 28, -99 ], meet: [ 39, -108 ], home: [ 23, -115 ],
		lines: [ '早晨烤炉最暖和，码头干活的人都来买面包。', '森林里出现怪物后，傍晚很少有人出门。', '灯塔恢复之后，镇上终于又能办集市了。' ] },
	{ id: 'scout', name: '巡林员 · 赛恩', work: [ -1, -122 ], meet: [ 23, -116 ], home: [ 12, -133 ],
		lines: [ '留意路边被踩倒的草，狼群最近往南迁徙。', '石碑附近的地形容易积水，进森林前带好灯。', '旧路安全了，我会重新标记森林入口。' ] },
	{ id: 'medic', name: '医师 · 诺拉', work: [ 17, -117 ], meet: [ 32, -110 ], home: [ 14, -128 ],
		lines: [ '海边的盐雾能保存药草，但腐蚀伤口非常快。', '遭到潮蚀兽袭击记得立刻处理伤口。', '看见灯塔的光，受伤的船员也敢返航了。' ] },
	{ id: 'sailor', name: '年轻水手 · 凯伊', work: [ 55, -94 ], meet: [ 48, -110 ], home: [ 58, -122 ],
		lines: [ '新修的码头很结实，我想攒钱买一艘小船。', '如果我能找到光石，就去试试修好旧灯塔。', '等下一场晴天，我要沿着海岸环岛航行。' ] },
	{ id: 'carpenter', name: '木匠 · 赫克', work: [ 23, -121 ], meet: [ 28, -108 ], home: [ 19, -138 ],
		lines: [ '外墙得用风干的红杉木，潮湿的木梁会在夜里吱吱作响。', '有人偷走了修灯塔的铜铆钉，我正在追查。', '我可以帮灯塔换上更结实的木门。' ] },
	{ id: 'shipwright', name: '造船师 · 瓦伦', work: [ 62, -89 ], meet: [ 53, -106 ], home: [ 70, -110 ],
		lines: [ '每条小船的龙骨都得按它的吃水深度来定。', '深海最近有巨大的东西从木船下方游过。', '灯塔恢复了，修船订单也终于回来了。' ] },
	{ id: 'cartographer', name: '绘图师 · 梅茵', work: [ 39, -123 ], meet: [ 42, -108 ], home: [ 35, -133 ],
		lines: [ '我正在标记密林里的湿地和旧山路。', '旧地图上写着灯塔地下还有第二条通风道。', '现在可以把安全航道画回海图了。' ] },
	{ id: 'watchman', name: '夜间守卫 · 布莱克', work: [ 82, -104 ], meet: [ 65, -110 ], home: [ 88, -134 ],
		lines: [ '我会每两个时辰检查一次村口的警铃。', '夜晚有不属于人的脚印出现在礁石旁。', '新的瞭望点终于能够覆盖整片海湾。' ] },
	{ id: 'teacher', name: '私塾老师 · 苏菲', work: [ 31, -121 ], meet: [ 34, -112 ], home: [ 26, -129 ],
		lines: [ '今天给孩子们讲岛上的航海历史。', '老图书馆里保存着灯塔建造时的手稿。', '等风暴结束，我们要去塔顶观察星星。' ] },
	{ id: 'courier', name: '信使 · 里奥', work: [ 52, -119 ], meet: [ 42, -114 ], home: [ 55, -133 ],
		lines: [ '我负责给每家住户送补给和消息。', '山路附近的路牌经常被怪物撞歪。', '现在终于可以夜里把邮件送到港口了。' ] },
	{ id: 'gardener', name: '园丁 · 芙蕾', work: [ -3, -124 ], meet: [ 18, -122 ], home: [ -7, -145 ],
		lines: [ '潮风浇不活所有的花，得用山里的淡水。', '腐化孢子会把植物的叶脉染成紫色。', '森林恢复后，这里会开满蓝色小花。' ] },
	{ id: 'smith', name: '铁匠 · 达恩', work: [ 71, -128 ], meet: [ 54, -121 ], home: [ 79, -137 ],
		lines: [ '我手里这块钢坯刚从炉里取出来。', '修光学机械可不能只靠锤子，要把齿轮咬合调准。', '灯塔的铜制反射轮已经不会再生锈了。' ] },
	{ id: 'apprentice', name: '学徒 · 菲恩', work: [ 28, -138 ], meet: [ 38, -118 ], home: [ 21, -145 ],
		lines: [ '老师教我画建筑的剖面图，楼梯比想象中难。', '我想去高处看看海，但以前灯塔门一直锁着。', '今天终于能爬到顶层了，我看到了鲸鱼！' ] },
	{ id: 'bellringer', name: '报时员 · 埃利', work: [ 5, -127 ], meet: [ 35, -114 ], home: [ 8, -139 ],
		lines: [ '钟声必须正好穿过海风，不然船员会听不见。', '每当怪物登陆，钟要连续敲响三次。', '你听，灯塔恢复后钟声都更明亮了。' ] },
];

export function residentShift( hour, raid = false ) {
	if ( raid ) return 'shelter';
	const t = ( ( Number(hour) || 0 ) % 24 + 24 ) % 24;
	return t >= 6 && t < 18 ? 'work' : t >= 18 && t < 21 ? 'meet' : 'home';
}

export class LandResidents {
	constructor( app ) {
		this.app = app;
		this.t = 0;
		this.navigator = new LandVillageNavigator( app.terrainData, app.colliders );
		this.residents = PEOPLE.map( ( data, index ) => {
			const model = createVillageResident( index ), x = data.work[ 0 ], z = data.work[ 1 ];
			model.group.position.set( x, app.terrainData.heightAt( x, z ), z );
			app.scene.add( model.group );
			return { ...data, x, z, model, index, phase: 'work', greeted: false,
				goalKey: '', path: [], pathIndex: 0, walking: false, pathRetry: 0 };
		} );
		if ( typeof document !== 'undefined' ) {
			for ( const p of this.residents ) {
				const url = BUILTIN_RIGS[ p.index % BUILTIN_RIGS.length ];
				loadLandRig( `resident_${p.id}` ).then( async actor => {
					if ( !actor ) {
						const rig = await loadResidentRig( url );
						actor = { rig, actions: assignRigActions( rig.clipNames() ), slot: 'rocketbox-' + p.id };
					}
					// Keep the low-cost fallback in the tree, but don't draw it.
					p.model.main.visible = false;
					p.model.group.add( actor.rig.group );
					p.rig = actor.rig;
					p.rig.group.scale.multiplyScalar( .95 + ( p.index % 5 ) * .024 );
					// Legacy 1m lifts are a source of floating. Calibrate from skinned soles.
					p.footPlant = new LandFootPlant( p.rig );
					p.footPlant.update( 0 );
					p.pirateStyle=attachPirateStyle(actor,p.index);
					p.actor = actor;
					if ( !actor.actions.walk ) installHumanoidMotionFallback( actor );
				} ).catch( error => console.warn( '[Tidewater] resident rig unavailable, using fallback:', p.id, error ) );
			}
		}
	}

	update( dt, { raid = false, missionComplete = false, interactions = null, onConversation = null } = {} ) {
		const app = this.app, player = app.player, phase = residentShift( app.settings.timeOfDay, raid );
		this.t += dt;
		this.navigator.passCache.clear();
		for ( const p of this.residents ) {
			const d = Math.hypot( player.position.x - p.x, player.position.z - p.z );
			if ( raid && d > 25 ) { p.model.group.visible = false; p.phase = phase; continue; }
			// Residents remain physically present in the evening instead of all
			// disappearing at 21:00. Far-away actors are culled for performance.
			p.model.group.visible = d < 85;
			if ( !p.model.group.visible ) { p.phase = phase; continue; }
			const beat = Math.floor( ( this.t + p.index * 12 ) / 40 ) % 3;
			const anchor = phase === 'shelter' ? p.home : phase === 'home' ? p.home :
				phase === 'meet' ? ( beat === 2 ? p.home : p.meet ) :
				beat === 1 ? p.meet : p.work;
			const goalKey = `${phase}:${beat}:${anchor[ 0 ]}:${anchor[ 1 ]}`;
			if ( goalKey !== p.goalKey || ( !p.path.length && this.t > p.pathRetry ) ) {
				p.goalKey = goalKey;
				p.path = this.navigator.findPath( [ p.x, p.z ], anchor );
				p.pathIndex = 0;
				p.pathRetry = this.t + 15;
			}
			const dest = p.path[ p.pathIndex ] || [ p.x, p.z ];
			const dx = dest[ 0 ] - p.x, dz = dest[ 1 ] - p.z, len = Math.hypot( dx, dz );
			let walking = false;
			const oldX=p.x,oldZ=p.z;const turnTo=a=>{const r=p.model.group.rotation;const diff=Math.atan2(Math.sin(a-r.y),Math.cos(a-r.y));r.y+=Math.max(-3.5*dt,Math.min(3.5*dt,diff));};
			if ( !p.conversing && len < .3 && p.pathIndex < p.path.length ) p.pathIndex ++;
			else if ( !p.conversing && d > .85 && len > .20 ) {
				const step = Math.min( len, dt * ( raid ? 2 : 1.2 ) );
				p.x += dx / len * step; p.z += dz / len * step; walking = true;
				turnTo(Math.atan2(dx,dz));
			}
			if ( p.conversing ) turnTo(Math.atan2(player.position.x-p.x,player.position.z-p.z));
			const y = this.navigator.groundAt( p.x, p.z, p.model.group.position.y );
			const pos = p.model.group.position;
			pos.set( p.x, followGround( pos.y, y, dt ), p.z );
			app.colliders?.resolveCapsule?.( pos, .24, 1.8, .3 );
			// Collision response is retained in AI state, avoiding walking through walls.
			p.x = pos.x; p.z = pos.z;
			walking=walking&&Math.hypot(p.x-oldX,p.z-oldZ)>dt*.06;
			// A dynamic blocker or new scan collider can invalidate an existing path.
            // Replan only after sustained obstruction instead of walking in place.
            if(!p.conversing && d>.85 && len>.3 && !walking){
                p.blockedTime=(p.blockedTime||0)+dt;
                if(p.blockedTime>1.1){p.path=[];p.pathIndex=0;p.pathRetry=this.t+.25;p.blockedTime=0;}
            }else p.blockedTime=0;
            p.walking = walking;
			p.model.main.position.y = Math.sin( this.t * ( walking ? 8 : 1.5 ) + p.index ) * ( walking ? .035 : .012 );
			if ( p.rig ) {
				// The bundled Rocketbox rigs provide actual idles/talk/waves, but
				// no authored walk cycle. Don't pretend a bob is a walking clip.
				const wanted = walking ? 'walk' : p.conversing ? 'talk' : 'idle';
				if ( p.rig.current !== p.actor.actions.greet ) playLandRigAction( p.actor, wanted, { fade: .5 } );
				p.actor.fallbackMotion?.update( dt, walking ? 'walk' : 'idle' );
				p.rig.update( dt );
				p.footPlant?.update( dt, { moving:walking, locomotion: !p.conversing, root:p.model.group.position, yaw:p.model.group.rotation.y, groundProbe:(x,z,y)=>this.navigator.groundAt(x,z,y) } );
				p.pirateStyle?.update();
			}
			for ( let i = 0; i < 2; i ++ ) {
				p.model.arms[ i ].rotation.x = Math.sin( this.t * ( walking ? 8 : 1.6 ) + i * Math.PI + p.index ) * ( walking ? .33 : .065 );
				p.model.legs[ i ].rotation.x = Math.sin( this.t * 8 + i * Math.PI ) * ( walking ? .32 : 0 );
			}
			if ( phase === 'shelter' && len < 1.5 ) p.model.group.visible = false;
			if ( !raid && d < 3 && player.mode === 'walk' && !app.freeCam && !app.hunt?.abyss?.active ) {
				const speak = () => {
					if ( p.actor?.actions.greet ) playLandRigAction( p.actor, 'greet', { oneShot: true, fade: .2 } );
					const line = p.lines[ missionComplete ? 2 : phase === 'meet' ? 1 : 0 ];
					return { speaker: p.name, line };
				};
				if ( interactions ) {
					interactions.add( {
						id: `land:resident-${p.id}`, position: p.model.group.position,
						range: 3, priority: 35, label: `✦ ${p.name} · E 交谈`,
						perform: () => { const result = speak(); onConversation?.( result, p ); },
					}, player );
				} else if ( !player.prompt?.key && app.input.consume( 'KeyE', 'land' ) ) {
					return speak();
				} else if ( !player.prompt ) {
					player.prompt = { key: 'E', text: `与 ${p.name} 交谈` };
				}
			}
			p.phase = phase;
		}
		// Close-range reciprocal separation. Neither duplicated spawn coordinates
		// nor an evening gathering should make two residents occupy one body.
		for ( let i = 0; i < this.residents.length; i ++ ) {
			const a = this.residents[ i ];
			if ( !a.model.group.visible || a.conversing ) continue;
			for ( let j = i + 1; j < this.residents.length; j ++ ) {
				const b = this.residents[ j ];
				if ( !b.model.group.visible || b.conversing ) continue;
				let dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot( dx, dz );
				if ( distance >= .76 ) continue;
				if ( distance < .0001 ) { dx = ( ( i + j ) & 1 ) ? 1 : -1; dz = .3; distance = Math.hypot( dx, dz ); }
				const offset = Math.min( .07, ( .76 - distance ) * .5 ) / distance;
				const stepX = dx * offset, stepZ = dz * offset;
				const ax = a.x - stepX, az = a.z - stepZ, bx = b.x + stepX, bz = b.z + stepZ;
				if ( this.navigator.passable( ax, az ) ) { a.x = ax; a.z = az; }
				if ( this.navigator.passable( bx, bz ) ) { b.x = bx; b.z = bz; }
				a.model.group.position.set( a.x, followGround(a.model.group.position.y,this.navigator.groundAt( a.x, a.z, a.model.group.position.y ),dt), a.z );
				b.model.group.position.set( b.x, followGround(b.model.group.position.y,this.navigator.groundAt( b.x, b.z, b.model.group.position.y ),dt), b.z );
			}
		}
		return null;
	}
}
