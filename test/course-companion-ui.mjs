// Exercise the actual chat handler with the local command controller.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer( { configFile: false, server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' } );
try {
	const { IslandCompanion } = await vite.ssrLoadModule( '/src/course/IslandCompanion.js' );
	const calls = [], messages = [];
	const ui = Object.create( IslandCompanion.prototype );
	Object.assign( ui, { language: 'zh', busy: false, input: { value: '' },
		app: { player: { mode: 'walk' }, companionActor: { command( command ) { calls.push( command ); return command !== 'home'; } } },
		_tab() {}, _renderActorStatus() {}, _message( who, text ) { messages.push( { who, text } ); } } );
	for ( const [ message, expected ] of [ [ '小汐，跟我走', 'follow' ], [ '你等我一下', 'wait' ], [ '请坐下', 'sit' ], [ '站起来', 'stand' ], [ '跳一下', 'jump' ], [ '挥挥手', 'wave' ], [ '跳一个舞', 'dance' ], [ '转一圈', 'spin' ], [ '你睡觉吧', 'sleep' ], [ '回家吧', 'home' ] ] ) {
		await ui.ask( message );
		assert.equal( calls.at( - 1 ), expected, `chat instruction ${ message }` );
	}
	assert.match( messages.at( - 1 ).text, /先在小屋床边选择家园/ );
	console.log( 'ok companion chat: common instructions reach the actor and unavailable home is reported' );
} finally { await vite.close(); }
