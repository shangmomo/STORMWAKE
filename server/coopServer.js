import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCoopHub } from './coopHub.js';

const root = resolve( fileURLToPath( new URL( '../dist/', import.meta.url ) ) );
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
	'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.json': 'application/json', '.bin': 'application/octet-stream',
	'.webp': 'image/webp', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg',
	'.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

export function makeCoopServer( { host = '0.0.0.0', port = 5174 } = {} ) {
	const hub = createCoopHub();
	const server = createServer( async ( req, res ) => {
		let url;
		try { url = new URL( req.url, 'http://localhost' ); } catch { res.writeHead( 400 ); res.end(); return; }
		if ( url.pathname === '/api/crew/status' ) {
			res.writeHead( 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } );
			res.end( JSON.stringify( { players: hub.size, readyPlayers: [ ...hub.players.values() ].filter(p=>p.ready).length, maxPlayers: 4, multiplayer: true, world: hub.world.snapshot(hub.now()) } ) ); return;
		}
		let pathname;
		try { pathname = decodeURIComponent( url.pathname ); } catch { res.writeHead( 400 ); res.end(); return; }
		if ( pathname.includes( '\0' ) ) { res.writeHead( 400 ); res.end(); return; }
		let file = resolve( root, '.' + ( pathname === '/' ? '/index.html' : pathname ) );
		if ( file !== root && ! file.startsWith( root + sep ) ) { res.writeHead( 403 ); res.end(); return; }
		try {
			let meta = await stat( file );
			if ( meta.isDirectory() ) { file = resolve( file, 'index.html' ); meta = await stat( file ); }
			if ( ! meta.isFile() ) throw Error( 'not a file' );
			const bytes = await readFile( file );
			res.writeHead( 200, { 'Content-Type': ( mime[ extname( file ).toLowerCase() ] || 'application/octet-stream' ) + ( /\.(html|js|css|json)$/.test( file ) ? '; charset=utf-8' : '' ),
				'Cache-Control': file.endsWith( '.html' ) ? 'no-cache' : 'public, max-age=3600' } );
			res.end( bytes );
		} catch { res.writeHead( 404 ); res.end( 'Not found' ); }
	} );
	hub.attach( server );
	return { server, hub, listen: () => new Promise( resolveReady => server.listen( port, host, () => resolveReady( server.address() ) ) ) };
}

if ( process.argv[ 1 ] && resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
	const port = Number( process.env.TIDEWATER_COOP_PORT || 5174 );
	const { listen } = makeCoopServer( { port } );
	listen().then( () => { console.log( `[STORMWAKE V57] Authoritative room live: http://localhost:${ port }?coop=1` );
		console.log( 'Other computers on the same LAN: http://<host-IP>:' + port + '/?coop=1' ); } );
}
