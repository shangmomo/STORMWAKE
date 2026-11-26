import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createGuideMiddleware } from '../server/guideProxy.js';

async function launch( middleware ) {

	const server = createServer( middleware );
	await new Promise( ( resolve ) => server.listen( 0, '127.0.0.1', resolve ) );
	return { server, url: `http://127.0.0.1:${ server.address().port }` };

}

// Disabled/invalid requests must not consume DeepSeek tokens.
{

	const { server, url } = await launch( createGuideMiddleware() );
	try {

		const result = await fetch( url, { method: 'POST', body: '{}' } );
		assert.equal( result.status, 503 );
		assert.match( ( await result.json() ).error, /DEEPSEEK_API_KEY/ );

	} finally { server.close(); }

}

let upstreamCalls = 0;
let request;
const relay = createGuideMiddleware( {
	apiKey: 'test-only',
	fetchImpl: async ( url, options ) => {

		upstreamCalls ++;
		request = { url, ...options };
		return { ok: true, json: async () => ( { choices: [ { message: { content: '你好，探险家！' } } ] } ) };

	},
} );
{

	const { server, url } = await launch( relay );
	try {

		let result = await fetch( url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( {
			message: '现在去哪里', scene: { objective: '珊瑚礁', mode: 'boat', hour: 8, day: 3, home: 'A', nights: 2, progress: '3/8' },
		} ) } );
		assert.equal( result.status, 200 );
		assert.equal( ( await result.json() ).reply, '你好，探险家！' );
		assert.equal( upstreamCalls, 1 );
		assert.equal( request.headers.Authorization, 'Bearer test-only' );
		const payload = JSON.parse( request.body );
		assert.equal( payload.model, 'deepseek-flash' );
		assert.equal( payload.thinking.type, 'disabled' );
		assert.match( payload.messages[ 1 ].content, /珊瑚礁/ );
		assert.match( payload.messages[ 1 ].content, /第 3 天.*家园 A.*已睡 2 晚/ );
		result = await fetch( url, { method: 'POST', body: JSON.stringify( { message: '继续' } ) } );
		assert.equal( result.status, 429, 'rate limiting controls accidental spending' );

	} finally { server.close(); }

}
console.log( 'ok   DeepSeek localhost proxy: no-key fallback, JSON, model, scene, throttling' );

for ( const [ action, expected ] of [ [ 'follow', 200 ], [ 'execute_code', 502 ] ] ) {
	let sent;
	const middleware = createGuideMiddleware( { apiKey: 'test-only', fetchImpl: async ( url, options ) => {
		sent = JSON.parse( options.body );
		return { ok: true, json: async () => ( { choices: [ { message: { content: null, tool_calls: [ { type: 'function', function: { name: 'set_companion_activity', arguments: JSON.stringify( { action, speech: 'Okay!' } ) } } ] } } ] } ) };
	} } );
	const { server, url } = await launch( middleware );
	try {
		const result = await fetch( url, { method: 'POST', body: JSON.stringify( { message: 'Come with me', scene: { language: 'en', companion: { goal: 'explore', energy: 70, bond: 2, memories: [ { type: 'first_fish', day: 1, detail: 'tuna' } ] } } } ) } );
		assert.equal( result.status, expected );
		assert.equal( sent.tools[ 0 ].function.name, 'set_companion_activity' );
		assert.match( sent.messages[ 1 ].content, /first_fish/ );
		if ( expected === 200 ) assert.equal( ( await result.json() ).action, 'follow' );
	} finally { server.close(); }
}
console.log( 'ok   companion AI: memory context and allowed-action validation' );
