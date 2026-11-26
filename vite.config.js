import { defineConfig, loadEnv } from 'vite';
import { createGuideMiddleware } from './server/guideProxy.js';

export default defineConfig( ( { mode } ) => {
	const env = loadEnv( mode, process.cwd(), '' );
	const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY || '';
	return {
	// relative asset paths: the build runs from any sub-path (GitHub Pages serves it under /tidewater/)
	base: './',
	build: { target: 'esnext', chunkSizeWarningLimit: 4000 },
	// Keep the game local to this computer. If 5173 is occupied, Vite picks
	// the next free port and prints the exact URL in the startup window.
	server: { host: 'localhost', port: 5173, strictPort: false },
	plugins: [ {
		name: 'course-island-guide',
		configureServer( server ) {
			server.middlewares.use( '/api/guide/status', ( req, res ) => {
				res.writeHead( 200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } );
				res.end( JSON.stringify( { configured: !! apiKey, model: 'deepseek-flash' } ) );
			} );
			server.middlewares.use( '/api/guide', createGuideMiddleware( { apiKey } ) );
		},
	} ],
	};
} );
