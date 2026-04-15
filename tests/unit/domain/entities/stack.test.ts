import { describe, expect, it } from 'vitest'
import { Stack } from '../../../../src/domain/entities/stack.js'
import type { AuthConfig, OrmConfig } from '../../../../src/domain/entities/stack.js'
import { Identifier } from '../../../../src/domain/value-objects/identifier.js'
import { Version } from '../../../../src/domain/value-objects/version.js'

describe('Stack', () => {
	const createPrismaOrm = (): OrmConfig => ({
		id: Identifier.create('prisma'),
		name: 'Prisma',
		language: 'typescript',
		supportedDatabases: ['postgresql', 'mysql', 'sqlite'],
		migrationTool: 'prisma migrate',
	})

	const createSqlalchemyOrm = (): OrmConfig => ({
		id: Identifier.create('sqlalchemy'),
		name: 'SQLAlchemy',
		language: 'python',
		supportedDatabases: ['postgresql', 'mysql', 'sqlite'],
		migrationTool: 'alembic',
	})

	const createJwtAuth = (): AuthConfig => ({
		strategy: 'jwt',
		provider: 'custom',
		patterns: ['bearer-token'],
	})

	const createNextjsStack = () =>
		Stack.create({
			id: 'nextjs-shadcn',
			name: 'Next.js + Shadcn',
			category: 'fullstack',
			language: 'typescript',
			version: '^15.0.0',
			layers: {
				frontend: {
					framework: 'next',
					version: Version.create('^15.0.0'),
					dependencies: ['react', 'react-dom'],
				},
				backend: {
					framework: 'next-api-routes',
					version: Version.create('^15.0.0'),
					dependencies: ['zod'],
				},
			},
			compatibleOrms: [createPrismaOrm()],
			compatibleAuths: [createJwtAuth()],
			fileStructure: 'src/app/',
			examples: [
				{
					name: 'api-route',
					description: 'API route example',
					filename: 'route.ts',
					code: 'export async function GET() {}',
				},
			],
			description: 'Full-stack Next.js with Shadcn UI',
		})

	const createFastApiStack = () =>
		Stack.create({
			id: 'python-fastapi',
			name: 'Python FastAPI',
			category: 'backend',
			language: 'python',
			version: '>=0.110',
			layers: {
				backend: {
					framework: 'fastapi',
					version: Version.create('>=0.110'),
					dependencies: ['pydantic', 'uvicorn'],
				},
			},
			compatibleOrms: [createSqlalchemyOrm()],
			compatibleAuths: [createJwtAuth()],
			fileStructure: 'src/app/',
			examples: [],
			description: 'Python FastAPI backend',
		})

	describe('create', () => {
		it('should create a valid stack', () => {
			const stack = createNextjsStack()

			expect(stack.id.toString()).toBe('nextjs-shadcn')
			expect(stack.name).toBe('Next.js + Shadcn')
			expect(stack.category).toBe('fullstack')
			expect(stack.language).toBe('typescript')
			expect(stack.version.major).toBe(15)
		})

		it('should store layers as a Map', () => {
			const stack = createNextjsStack()

			expect(stack.layers.has('frontend')).toBe(true)
			expect(stack.layers.has('backend')).toBe(true)
			expect(stack.layers.get('frontend')?.framework).toBe('next')
		})
	})

	describe('isOrmCompatible', () => {
		it('should return true for compatible ORM', () => {
			const stack = createNextjsStack()
			const prismaId = Identifier.create('prisma')

			expect(stack.isOrmCompatible(prismaId)).toBe(true)
		})

		it('should return false for incompatible ORM', () => {
			const stack = createNextjsStack()
			const sqlalchemyId = Identifier.create('sqlalchemy')

			expect(stack.isOrmCompatible(sqlalchemyId)).toBe(false)
		})
	})

	describe('supportsDatabaseType', () => {
		it('should return true for supported database', () => {
			const stack = createNextjsStack()

			expect(stack.supportsDatabaseType('postgresql')).toBe(true)
			expect(stack.supportsDatabaseType('mysql')).toBe(true)
		})

		it('should return false for unsupported database', () => {
			const stack = createNextjsStack()

			expect(stack.supportsDatabaseType('mongodb')).toBe(false)
		})
	})

	describe('getDefaultOrm', () => {
		it('should return the first compatible ORM', () => {
			const stack = createNextjsStack()
			const defaultOrm = stack.getDefaultOrm()

			expect(defaultOrm?.name).toBe('Prisma')
		})

		it('should return undefined if no ORMs configured', () => {
			const stack = Stack.create({
				id: 'minimal',
				name: 'Minimal',
				category: 'backend',
				language: 'typescript',
				version: '1.0.0',
				layers: {},
				compatibleOrms: [],
				compatibleAuths: [],
				fileStructure: '',
				examples: [],
				description: 'Minimal stack',
			})

			expect(stack.getDefaultOrm()).toBeUndefined()
		})
	})

	describe('hasFrontend / hasBackend', () => {
		it('should identify fullstack as having both', () => {
			const stack = createNextjsStack()

			expect(stack.hasFrontend()).toBe(true)
			expect(stack.hasBackend()).toBe(true)
		})

		it('should identify backend-only stack', () => {
			const stack = createFastApiStack()

			expect(stack.hasFrontend()).toBe(false)
			expect(stack.hasBackend()).toBe(true)
		})
	})

	describe('getExamplesByPattern', () => {
		it('should filter examples by pattern', () => {
			const stack = createNextjsStack()
			const apiExamples = stack.getExamplesByPattern('api')

			expect(apiExamples.length).toBe(1)
			expect(apiExamples[0]?.name).toBe('api-route')
		})

		it('should return empty array for no matches', () => {
			const stack = createNextjsStack()
			const noMatches = stack.getExamplesByPattern('nonexistent')

			expect(noMatches.length).toBe(0)
		})
	})
})
