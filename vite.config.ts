import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

function getBasePath(): '' | `/${string}` {
	const basePath = process.env.BASE_PATH?.trim() ?? '';

	if (basePath === '') return '';

	if (!basePath.startsWith('/') || basePath.endsWith('/')) {
		throw new Error(
			'BASE_PATH must be empty or start with / and not end with /. Example: /alkotype'
		);
	}

	return basePath as `/${string}`;
}

const basePath = getBasePath();

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			paths: { base: basePath },
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '200.html' })
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
