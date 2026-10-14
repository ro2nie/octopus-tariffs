import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
	{
		ignores: ['.svelte-kit/**', 'build/**', 'coverage/**', '.wrangler/**', 'node_modules/**']
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tseslint.parser
			}
		}
	},
	{
		// Runes-in-module files (e.g. Svelte stores) use the Svelte parser too.
		files: ['**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: tseslint.parser }
		}
	},
	{
		// Test files may use non-null assertions and loose typing for fixtures.
		files: ['**/*.{test,spec}.{ts,js}', '**/*.svelte.test.ts', 'src/test/**'],
		rules: {
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-explicit-any': 'off'
		}
	}
);
