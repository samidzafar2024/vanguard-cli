import { beforeEach, describe, expect, it } from 'vitest'
import {
	ConfigGeneratorService,
	VanguardGeneratorService,
} from '../../../../src/application/services/vanguard-generator.service.js'
import {
	Architecture,
	type StackImplementation,
} from '../../../../src/domain/entities/architecture.js'
import { createDefaultDeploymentConfig } from '../../../../src/domain/entities/deployment-config.js'
import { Project } from '../../../../src/domain/entities/project.js'
import { type AuthConfig, type OrmConfig, Stack } from '../../../../src/domain/entities/stack.js'
import {
	type LintTool,
	type TestFramework,
	TestingConfig,
} from '../../../../src/domain/entities/testing-config.js'
import { Identifier } from '../../../../src/domain/value-objects/identifier.js'
import { Version } from '../../../../src/domain/value-objects/version.js'

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestStack(): Stack {
	const prismaOrm: OrmConfig = {
		id: Identifier.create('prisma'),
		name: 'Prisma',
		language: 'typescript',
		supportedDatabases: ['postgresql', 'mysql', 'sqlite'],
		migrationTool: 'prisma migrate dev',
	}

	const jwtAuth: AuthConfig = {
		strategy: 'jwt',
		provider: 'custom',
		patterns: ['Bearer token in Authorization header'],
	}

	return Stack.create({
		id: 'nextjs-app-router',
		name: 'Next.js (App Router)',
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
		compatibleOrms: [prismaOrm],
		compatibleAuths: [jwtAuth],
		fileStructure: `src/
├── app/           # Next.js App Router
├── components/    # React components
├── lib/           # Shared utilities
└── types/         # TypeScript types`,
		examples: [
			{
				name: 'API Route Handler',
				description: 'Example of a Next.js API route',
				filename: 'app/api/users/route.ts',
				code: `import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ users: [] })
}`,
			},
		],
		description: 'Full-stack Next.js with App Router',
	})
}

function createTestArchitecture(): Architecture {
	const nextjsImplementation: StackImplementation = {
		stackId: Identifier.create('nextjs-app-router'),
		structure: `src/
├── domain/           # Core business logic
├── application/      # Use cases
├── infrastructure/   # External concerns
└── presentation/     # API routes, components`,
		examples: new Map([
			[
				'Entity',
				`// domain/entities/user.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: string
  ) {}
}`,
			],
			[
				'UseCase',
				`// application/use-cases/create-user.ts
export class CreateUserUseCase {
  constructor(private userRepo: UserRepository) {}

  async execute(input: CreateUserInput) {
    // Implementation
  }
}`,
			],
		]),
	}

	return Architecture.create({
		id: 'clean-architecture',
		name: 'Clean Architecture',
		abbreviation: 'CLEAN',
		complexity: 'high',
		bestFor: ['Complex domains', 'Long-lived applications', 'Large teams'],
		principles: [
			'Dependencies point inward',
			'Business logic is isolated from frameworks',
			'Entities are at the center',
			'Use cases orchestrate business rules',
		],
		layers: [
			{
				name: 'Domain',
				description: 'Core business logic and entities',
				contains: ['entities', 'value-objects', 'domain-services'],
				rules: ['No dependencies on other layers', 'Pure business logic only'],
			},
			{
				name: 'Application',
				description: 'Use cases and application services',
				contains: ['use-cases', 'ports', 'interfaces'],
				rules: ['Depends only on Domain layer', 'Defines port interfaces'],
			},
			{
				name: 'Infrastructure',
				description: 'External concerns and adapters',
				contains: ['repositories', 'external-services', 'adapters'],
				rules: ['Implements port interfaces', 'Database and API integrations'],
			},
			{
				name: 'Presentation',
				description: 'User interface layer',
				contains: ['controllers', 'views', 'api-routes'],
				rules: ['Handles HTTP/UI concerns', 'Input validation'],
			},
		],
		antiPatterns: [
			{
				name: 'Fat Controller',
				description: 'Controllers with too much business logic',
				fix: 'Extract business logic into use cases or services',
			},
			{
				name: 'Anemic Domain Model',
				description: 'Entities that are just data containers',
				fix: 'Move business logic into entity methods',
			},
		],
		implementations: {
			'nextjs-app-router': nextjsImplementation,
		},
		description: 'Clean Architecture pattern for maintainable codebases',
	})
}

function createTestTestingConfig(): TestingConfig {
	const vitest: TestFramework = {
		id: Identifier.create('vitest'),
		name: 'Vitest',
		category: 'unit',
		language: 'typescript',
		command: 'npm test',
		configFile: 'vitest.config.ts',
		description: 'Vite-native unit testing framework',
	}

	const playwright: TestFramework = {
		id: Identifier.create('playwright'),
		name: 'Playwright',
		category: 'e2e',
		language: 'typescript',
		command: 'npm run test:e2e',
		configFile: 'playwright.config.ts',
		description: 'Cross-browser E2E testing',
	}

	const biome: LintTool = {
		id: Identifier.create('biome'),
		name: 'Biome',
		category: 'linter',
		language: 'typescript',
		command: 'npx biome check .',
		configFile: 'biome.json',
		description: 'Fast unified linter and formatter',
	}

	const biomeFormatter: LintTool = {
		id: Identifier.create('biome'),
		name: 'Biome',
		category: 'formatter',
		language: 'typescript',
		command: 'npx biome format --write .',
		configFile: 'biome.json',
		description: 'Fast unified formatter',
	}

	const tsc: LintTool = {
		id: Identifier.create('tsc'),
		name: 'TypeScript',
		category: 'type-checker',
		language: 'typescript',
		command: 'npx tsc --noEmit',
		configFile: 'tsconfig.json',
		description: 'TypeScript type checker',
	}

	return TestingConfig.create({
		language: 'typescript',
		unitFramework: vitest,
		e2eFramework: playwright,
		linter: biome,
		formatter: biomeFormatter,
		typeChecker: tsc,
	})
}

function createTestProject(): Project {
	const stack = createTestStack()
	const architecture = createTestArchitecture()
	const testing = createTestTestingConfig()

	return Project.create({
		name: 'test-project',
		type: 'greenfield',
		track: 'team',
		rootPath: '/tmp/test-project',
		stack,
		orm: stack.getDefaultOrm() ?? '',
		database: 'postgresql',
		auth: stack.compatibleAuths[0] ?? '',
		architecture,
		modules: [],
		testing,
		deployment: createDefaultDeploymentConfig(),
	})
}

// ============================================================================
// Config Generator Tests
// ============================================================================

describe('ConfigGeneratorService', () => {
	let generator: ConfigGeneratorService
	let project: Project

	beforeEach(() => {
		generator = new ConfigGeneratorService()
		project = createTestProject()
	})

	describe('generate', () => {
		it('should create config.yaml in .vanguard directory', () => {
			const file = generator.generate(project)

			expect(file.path.toString()).toContain('.vanguard/config.yaml')
		})

		it('should include header comment', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('# Vanguard Configuration')
			expect(file.content).toContain('# Generated:')
		})

		it('should include project section', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('project:')
			expect(file.content).toContain('name: test-project')
			expect(file.content).toContain('type: greenfield')
			expect(file.content).toContain('track: team')
		})

		it('should include stack section', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('stack:')
			expect(file.content).toContain('id: nextjs-app-router')
			expect(file.content).toContain('language: typescript')
		})

		it('should include database configuration', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('database:')
			expect(file.content).toContain('type: postgresql')
			expect(file.content).toContain('orm: prisma')
			expect(file.content).toContain('migrations: prisma migrate dev')
		})

		it('should include auth configuration', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('auth:')
			expect(file.content).toContain('strategy: jwt')
			expect(file.content).toContain('provider: custom')
		})

		it('should include architecture section', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('architecture:')
			expect(file.content).toContain('primary: clean-architecture')
		})

		it('should include testing section', () => {
			const file = generator.generate(project)

			expect(file.content).toContain('testing:')
			expect(file.content).toContain('unit: vitest')
			expect(file.content).toContain('e2e: playwright')
			expect(file.content).toContain('linter: biome')
			expect(file.content).toContain('formatter: biome')
			expect(file.content).toContain('typeChecker: tsc')
		})
	})
})

// ============================================================================
// Vanguard Generator Service Tests (Integration)
// ============================================================================

describe('VanguardGeneratorService', () => {
	let generator: VanguardGeneratorService
	let project: Project

	beforeEach(() => {
		generator = new VanguardGeneratorService()
		project = createTestProject()
	})

	describe('generateAll', () => {
		it('should generate local-only files (manifest, config)', () => {
			const files = generator.generateAll(project)

			expect(files).toHaveLength(2)
		})

		it('should include manifest', () => {
			const files = generator.generateAll(project)
			const manifest = files.find((f) => f.path.basename() === 'vanguard.manifest.yaml')

			expect(manifest).toBeDefined()
		})

		it('should include config.yaml', () => {
			const files = generator.generateAll(project)
			const configFile = files.find((f) => f.path.basename() === 'config.yaml')

			expect(configFile).toBeDefined()
		})

		it('should have consistent project context across all files', () => {
			const files = generator.generateAll(project)

			const filesWithProjectName = files.filter((f) => f.content.includes('test-project'))
			expect(filesWithProjectName.length).toBeGreaterThan(0)
		})
	})

	describe('generateLocalFiles', () => {
		it('should return same results as generateAll', () => {
			const allFiles = generator.generateAll(project)
			const localFiles = generator.generateLocalFiles(project)

			expect(allFiles).toHaveLength(localFiles.length)
			expect(allFiles.map((f) => f.path.toString())).toEqual(
				localFiles.map((f) => f.path.toString()),
			)
		})
	})
})
