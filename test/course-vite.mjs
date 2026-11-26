import assert from 'node:assert/strict';
import { createServer } from 'vite';

// Same-process HTTP smoke test: no GPU required, but verifies Vite middleware
// and the actual module URL that Windows Chrome/Edge will request.
const server = await createServer( {
	configFile: 'vite.config.js',
	server: { host: '127.0.0.1', port: 0, strictPort: false },
	logLevel: 'error',
} );
try {

	await server.listen();
	const url = server.resolvedUrls.local[ 0 ];
	const status = await fetch( url + 'api/guide/status' );
	assert.equal( status.status, 200 );
	assert.equal( ( await status.json() ).configured, false );
	const guide = await fetch( url + 'api/guide', { method: 'POST', body: JSON.stringify( { message: '你好' } ) } );
	assert.equal( guide.status, 503 );
	const module = await fetch( url + 'src/course/IslandCompanion.js' );
	assert.equal( module.status, 200 );
	assert.match( await module.text(), /class IslandCompanion/ );
	const preview = await fetch( url + 'test/course-ui.html' );
	assert.equal( preview.status, 200 );
	console.log( 'ok   Vite dev server: course UI module, DeepSeek status and no-key fallback' );

} finally { await server.close(); }
