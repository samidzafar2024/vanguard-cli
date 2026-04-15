import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['tests/unit/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
			thresholds: {
				statements: 80,
				branches: 80,
				functions: 80,
				lines: 80,
			},
		},
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			'@domain': resolve(__dirname, './src/domain'),
			'@application': resolve(__dirname, './src/application'),
			'@infrastructure': resolve(__dirname, './src/infrastructure'),
			'@presentation': resolve(__dirname, './src/presentation'),
		},
	},
})
