import { describe, expect, it } from 'vitest'
import { buildConfigFromSelections } from '../../../../src/application/services/config-from-selections.js'

describe('buildConfigFromSelections', () => {
	describe('simple string mappings', () => {
		it('should map project-type to config.type', () => {
			const config = buildConfigFromSelections({ 'project-type': 'greenfield' })
			expect(config.type).toBe('greenfield')
		})

		it('should map track, language, database, architecture', () => {
			const config = buildConfigFromSelections({
				track: 'team',
				language: 'typescript',
				database: 'postgresql',
				architecture: 'clean-architecture',
			})

			expect(config.track).toBe('team')
			expect(config.language).toBe('typescript')
			expect(config.database).toBe('postgresql')
			expect(config.architecture).toBe('clean-architecture')
		})

		it('should map deploy-target to deployment object', () => {
			const config = buildConfigFromSelections({ 'deploy-target': 'vercel' })

			expect(config.deployment).toEqual({
				primary: 'vercel',
				targets: ['vercel'],
				environments: ['development', 'production'],
			})
		})

		it('should skip missing selections', () => {
			const config = buildConfigFromSelections({})
			expect(config).toEqual({})
		})
	})

	describe('stack mapping', () => {
		it('should set stackId and stackName for known stacks', () => {
			const config = buildConfigFromSelections({ stack: 'nextjs-app-router' })

			expect(config.stackId).toBe('nextjs-app-router')
			expect(config.stackName).toBe('Next.js (App Router)')
		})

		it('should use slug as stackName for unknown stacks', () => {
			const config = buildConfigFromSelections({ stack: 'unknown-stack' })

			expect(config.stackId).toBe('unknown-stack')
			expect(config.stackName).toBe('unknown-stack')
		})
	})

	describe('ORM mapping', () => {
		it('should map known ORM to object with migrationTool', () => {
			const config = buildConfigFromSelections({ orm: 'prisma' })

			expect(config.orm).toEqual({
				name: 'Prisma',
				migrationTool: 'prisma migrate dev',
			})
		})

		it('should create fallback for unknown ORM', () => {
			const config = buildConfigFromSelections({ orm: 'custom-orm' })

			expect(config.orm).toEqual({
				name: 'custom-orm',
				migrationTool: '',
			})
		})
	})

	describe('auth mapping', () => {
		it('should map known auth strategy', () => {
			const config = buildConfigFromSelections({ 'auth-strategy': 'nextauth' })

			expect(config.auth).toEqual({
				strategy: 'session',
				provider: 'NextAuth.js',
			})
		})

		it('should create fallback for unknown auth strategy', () => {
			const config = buildConfigFromSelections({ 'auth-strategy': 'custom-auth' })

			expect(config.auth).toEqual({ strategy: 'custom-auth' })
		})
	})

	describe('frontend mapping (C20)', () => {
		it('should map frontend framework', () => {
			const config = buildConfigFromSelections({ frontend: 'react' })
			expect(config.frontend).toEqual({ framework: 'react' })
		})

		it('should skip frontend when value is "none"', () => {
			const config = buildConfigFromSelections({ frontend: 'none' })
			expect(config.frontend).toBeUndefined()
		})
	})

	describe('tool group mappings', () => {
		it('should map unit-test to unitTest config key', () => {
			const config = buildConfigFromSelections({ 'unit-test': 'vitest' })

			expect(config.unitTest).toEqual({
				name: 'Vitest',
				command: 'npx vitest run',
			})
		})

		it('should map linter with known metadata', () => {
			const config = buildConfigFromSelections({ linter: 'biome' })

			expect(config.linter).toEqual({
				name: 'Biome',
				command: 'npx biome check .',
			})
		})

		it('should map formatter with known metadata', () => {
			const config = buildConfigFromSelections({ formatter: 'prettier' })

			expect(config.formatter).toEqual({
				name: 'Prettier',
				command: 'npx prettier --check .',
			})
		})

		it('should map e2e-test to e2eTest config key', () => {
			const config = buildConfigFromSelections({ 'e2e-test': 'playwright' })

			expect(config.e2eTest).toEqual({
				name: 'Playwright',
				command: 'npx playwright test',
			})
		})

		it('should create fallback for unknown tool choices', () => {
			const config = buildConfigFromSelections({ 'unit-test': 'custom-runner' })

			expect(config.unitTest).toEqual({
				name: 'custom-runner',
				command: '',
			})
		})
	})

	describe('full selections', () => {
		it('should handle all groups at once', () => {
			const config = buildConfigFromSelections({
				'project-type': 'greenfield',
				track: 'team',
				language: 'typescript',
				stack: 'nextjs-app-router',
				database: 'postgresql',
				orm: 'prisma',
				'auth-strategy': 'jwt',
				frontend: 'react',
				architecture: 'clean-architecture',
				'unit-test': 'vitest',
				linter: 'biome',
				formatter: 'prettier',
				'e2e-test': 'playwright',
				'deploy-target': 'vercel',
			})

			expect(config.type).toBe('greenfield')
			expect(config.track).toBe('team')
			expect(config.stackId).toBe('nextjs-app-router')
			expect(config.stackName).toBe('Next.js (App Router)')
			expect(config.database).toBe('postgresql')
			expect(config.orm).toEqual({ name: 'Prisma', migrationTool: 'prisma migrate dev' })
			expect(config.auth).toEqual({ strategy: 'jwt' })
			expect(config.frontend).toEqual({ framework: 'react' })
			expect(config.unitTest).toBeDefined()
			expect(config.linter).toBeDefined()
			expect(config.formatter).toBeDefined()
			expect(config.e2eTest).toBeDefined()
			expect(config.deployment).toBeDefined()
		})
	})
})
