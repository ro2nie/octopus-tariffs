import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	resolve: {
		// Use the browser build of Svelte & friends under jsdom component tests.
		conditions: ['browser']
	},
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{ts,js}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/lib/**/*.{ts,svelte}'],
			exclude: ['src/lib/**/*.{test,spec}.ts', 'src/lib/assets/**']
		}
	}
});
