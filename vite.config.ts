import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Load environment variables from .env files
	// https://vitejs.dev/guide/env-and-mode.html
	const env = loadEnv(mode, process.cwd(), '');
	
	return {
		plugins: [sveltekit()],
		define: {
			// Expose environment variables to the client
			// Only expose variables that begin with 'PUBLIC_'
			'process.env.POCKETBASE_URL': JSON.stringify(env.POCKETBASE_URL || 'https://w.zaur.app')
		}
	};
});
