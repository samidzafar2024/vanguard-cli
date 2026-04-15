import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
	InitSchema,
	InitSchemaChoice,
	InitSchemaGroup,
} from '../../../../../src/application/ports/init-schema-api-client.js'

// ============================================================================
// Module Mocks (must be before imports)
// ============================================================================

vi.mock('@clack/prompts', () => ({
	intro: vi.fn(),
	outro: vi.fn(),
	cancel: vi.fn(),
	note: vi.fn(),
	text: vi.fn(),
	select: vi.fn(),
	confirm: vi.fn(),
	isCancel: vi.fn(() => false),
	log: {
		warn: vi.fn(),
		info: vi.fn(),
		error: vi.fn(),
		success: vi.fn(),
	},
	spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
}))

vi.mock('gradient-string', () => ({
	default: () => ({ multiline: (s: string) => s }),
}))

vi.mock('picocolors', () => ({
	default: {
		bgCyan: (s: string) => s,
		black: (s: string) => s,
		bold: (s: string) => s,
		dim: (s: string) => s,
		cyan: (s: string) => s,
		green: (s: string) => s,
	},
}))

vi.mock('../../../../../src/presentation/cli/utils/require-auth.js', () => ({
	requireAuth: vi.fn(),
}))

vi.mock('../../../../../src/infrastructure/repositories/auth.repository.js', () => ({
	authRepository: {
		getAccessToken: vi.fn().mockResolvedValue('test-token'),
		getApiEndpoint: vi.fn().mockResolvedValue('https://api.test.com'),
		getStatus: vi.fn().mockResolvedValue({ authenticated: true, user: { id: '1' } }),
	},
}))

vi.mock('../../../../../src/infrastructure/api/init-schema.adapter.js', () => ({
	InitSchemaAdapter: vi.fn().mockImplementation(() => ({
		fetch: vi.fn(),
	})),
}))

vi.mock('../../../../../src/application/services/project-registration.service.js', () => ({
	ProjectRegistrationService: vi.fn().mockImplementation(() => ({
		register: vi.fn().mockResolvedValue({
			success: true,
			projectId: 'proj-123',
			orgSlug: 'test-org',
			isNew: true,
		}),
	})),
}))

vi.mock('../../../../../src/application/services/methodology.service.js', () => ({
	MethodologyService: vi.fn().mockImplementation(() => ({
		install: vi.fn().mockResolvedValue({
			filesWritten: 5,
			usedBundle: true,
			contentHash: 'abc123',
			phases: [{ slug: 'discover', name: 'Discover', description: 'Analyze' }],
			executableFiles: [],
		}),
	})),
}))

vi.mock('../../../../../src/infrastructure/api/methodology-bundle.adapter.js', () => ({
	MethodologyBundleAdapter: vi.fn(),
}))

vi.mock('../../../../../src/infrastructure/file-writer.js', () => ({
	FsFileWriter: vi.fn().mockImplementation(() => ({
		writeAll: vi.fn().mockResolvedValue([
			{ success: true, path: { toString: () => 'config.yaml' } },
			{ success: true, path: { toString: () => 'manifest.yaml' } },
		]),
	})),
}))

vi.mock('../../../../../src/infrastructure/file-reader.js', () => ({ FsFileReader: vi.fn() }))

vi.mock('../../../../../src/infrastructure/git.service.js', () => ({
	GitService: vi.fn().mockImplementation(() => ({
		getRemoteUrl: vi.fn().mockReturnValue('https://github.com/test/repo.git'),
		getDefaultBranch: vi.fn().mockReturnValue('main'),
	})),
}))

vi.mock('../../../../../src/infrastructure/project-detector.js', () => ({
	ProjectDetector: vi.fn().mockImplementation(() => ({
		detect: vi.fn().mockReturnValue({
			language: 'typescript',
			framework: 'Next.js',
			stackId: 'nextjs-typescript',
			testFramework: 'vitest',
		}),
	})),
}))

vi.mock('../../../../../src/application/services/mcp-wiring.service.js', () => ({
	McpWiringService: vi.fn().mockImplementation(() => ({
		wire: vi.fn().mockResolvedValue({
			mcpJsonWritten: true,
			settingsWritten: true,
			gitignoreUpdated: false,
			connectivityOk: true,
		}),
	})),
}))

vi.mock('../../../../../src/application/services/hook-wiring.service.js', () => ({
	HookWiringService: vi.fn().mockImplementation(() => ({
		wire: vi.fn().mockResolvedValue({ settingsMerged: false, executableCount: 0 }),
	})),
}))

vi.mock('../../../../../src/application/use-cases/memory/init-memory.use-case.js', () => ({
	InitMemoryUseCase: vi.fn().mockImplementation(() => ({
		execute: vi.fn().mockResolvedValue(undefined),
	})),
}))

vi.mock('../../../../../src/infrastructure/repositories/memory-config.repository.js', () => ({
	FileMemoryConfigRepository: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
	const actual = await importOriginal<typeof import('node:fs')>()
	return {
		...actual,
		default: {
			...actual,
			existsSync: vi.fn().mockReturnValue(false),
			readdirSync: vi.fn().mockReturnValue([]),
			readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '0.1.0' })),
		},
		existsSync: vi.fn().mockReturnValue(false),
		readdirSync: vi.fn().mockReturnValue([]),
		readFileSync: vi.fn().mockReturnValue(JSON.stringify({ version: '0.1.0' })),
	}
})

// ============================================================================
// Imports (after mocks)
// ============================================================================

const clack = await import('@clack/prompts')
const { InitSchemaAdapter } = await import(
	'../../../../../src/infrastructure/api/init-schema.adapter.js'
)
const { ProjectRegistrationService } = await import(
	'../../../../../src/application/services/project-registration.service.js'
)
const { MethodologyService } = await import(
	'../../../../../src/application/services/methodology.service.js'
)
const { initCommand } = await import('../../../../../src/presentation/cli/commands/init.js')
const nodeFs = await import('node:fs')

// ============================================================================
// Test Fixtures
// ============================================================================

function makeChoice(slug: string, overrides?: Partial<InitSchemaChoice>): InitSchemaChoice {
	return {
		slug,
		label: slug.charAt(0).toUpperCase() + slug.slice(1),
		description: null,
		icon: null,
		sequence: 1,
		compatibleWithSlugs: [],
		metadata: null,
		orgId: null,
		isBuiltIn: true,
		...overrides,
	}
}

function makeGroup(
	slug: string,
	choices: InitSchemaChoice[],
	overrides?: Partial<InitSchemaGroup>,
): InitSchemaGroup {
	return {
		slug,
		name: slug.charAt(0).toUpperCase() + slug.slice(1),
		description: null,
		selectorType: 'select',
		required: true,
		dependsOnGroupSlug: null,
		choices,
		...overrides,
	}
}

function makeTestSchema(): InitSchema {
	return {
		categories: {
			basics: [
				makeGroup(
					'project-type',
					[
						makeChoice('greenfield', { label: 'Greenfield' }),
						makeChoice('brownfield', { label: 'Brownfield' }),
					],
					{ name: 'Project Type' },
				),
				makeGroup(
					'track',
					[makeChoice('solo', { label: 'Solo' }), makeChoice('team', { label: 'Team' })],
					{
						name: 'Track',
					},
				),
			],
			stack: [
				makeGroup(
					'language',
					[
						makeChoice('typescript', { label: 'TypeScript' }),
						makeChoice('python', { label: 'Python' }),
					],
					{ name: 'Language' },
				),
				makeGroup(
					'stack',
					[
						makeChoice('nextjs-app-router', {
							label: 'Next.js (App Router)',
							compatibleWithSlugs: ['typescript'],
						}),
						makeChoice('express-typescript', {
							label: 'Express',
							compatibleWithSlugs: ['typescript'],
						}),
						makeChoice('fastapi', { label: 'FastAPI', compatibleWithSlugs: ['python'] }),
					],
					{ name: 'Stack', dependsOnGroupSlug: 'language' },
				),
			],
		},
	}
}

function mockSchemaFetch(schema: InitSchema): void {
	vi.mocked(InitSchemaAdapter).mockImplementation(
		() => ({ fetch: vi.fn().mockResolvedValue(schema) }) as never,
	)
}

function mockSchemaFetchError(error: Error): void {
	vi.mocked(InitSchemaAdapter).mockImplementation(
		() => ({ fetch: vi.fn().mockRejectedValue(error) }) as never,
	)
}

/**
 * Run the init command via commander's parseAsync.
 * Uses exitOverride() so commander throws instead of calling process.exit.
 */
async function runInitAction(flags: string[] = []): Promise<void> {
	initCommand.exitOverride()
	await initCommand.parseAsync(flags, { from: 'user' })
}

// ============================================================================
// Tests
// ============================================================================

describe('init command (dynamic flow)', () => {
	beforeEach(() => {
		vi.clearAllMocks()

		// Default: greenfield (no indicators found)
		vi.mocked(nodeFs.existsSync).mockReturnValue(false)
		vi.mocked(nodeFs.readdirSync).mockReturnValue([])
		vi.mocked(nodeFs.readFileSync).mockReturnValue(JSON.stringify({ version: '0.1.0' }))

		// Default: schema returns successfully
		mockSchemaFetch(makeTestSchema())

		// Default: interactive prompts return first choice
		vi.mocked(clack.select).mockResolvedValue('greenfield')
		vi.mocked(clack.text).mockResolvedValue('test-project')
		vi.mocked(clack.confirm).mockResolvedValue(true)

		// Default: registration succeeds
		vi.mocked(ProjectRegistrationService).mockImplementation(
			() =>
				({
					register: vi.fn().mockResolvedValue({
						success: true,
						projectId: 'proj-123',
						orgSlug: 'test-org',
						isNew: true,
					}),
				}) as never,
		)

		// Default: methodology install succeeds
		vi.mocked(MethodologyService).mockImplementation(
			() =>
				({
					install: vi.fn().mockResolvedValue({
						filesWritten: 5,
						usedBundle: true,
						contentHash: 'abc123',
						phases: [{ slug: 'discover', name: 'Discover', description: 'Analyze' }],
						executableFiles: [],
					}),
				}) as never,
		)

		// Suppress process.exit to prevent test runner from exiting
		vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('process.exit called')
		}) as never)
	})

	describe('full interactive flow', () => {
		it('should fetch schema, render prompts, register, and generate files', async () => {
			vi.mocked(clack.text).mockResolvedValueOnce('my-app')
			vi.mocked(clack.select)
				.mockResolvedValueOnce('greenfield')
				.mockResolvedValueOnce('team')
				.mockResolvedValueOnce('typescript')
				.mockResolvedValueOnce('nextjs-app-router')
			vi.mocked(clack.confirm).mockResolvedValueOnce(true)

			await runInitAction()

			expect(InitSchemaAdapter).toHaveBeenCalled()

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			expect(regInstance.register).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'my-app',
					selections: expect.objectContaining({
						'project-type': 'greenfield',
						track: 'team',
						language: 'typescript',
						stack: 'nextjs-app-router',
					}),
				}),
			)

			expect(clack.confirm).toHaveBeenCalled()
			expect(clack.outro).toHaveBeenCalled()
		})
	})

	describe('auto-accept (-y) on greenfield', () => {
		it('should auto-select first choices and register with selections', async () => {
			await runInitAction(['-y'])

			expect(clack.select).not.toHaveBeenCalled()
			expect(clack.text).not.toHaveBeenCalled()
			expect(clack.confirm).not.toHaveBeenCalled()

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			expect(regInstance.register).toHaveBeenCalledWith(
				expect.objectContaining({
					selections: expect.objectContaining({
						'project-type': 'greenfield',
						track: 'solo',
						language: 'typescript',
					}),
				}),
			)

			expect(clack.outro).toHaveBeenCalled()
		})
	})

	describe('auto-accept (-y) on brownfield', () => {
		it('should run smart detection and use detected values', async () => {
			vi.mocked(nodeFs.existsSync).mockImplementation((p) => {
				if (typeof p === 'string' && p.endsWith('package.json')) return true
				return false
			})

			await runInitAction(['-y'])

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			expect(regInstance.register).toHaveBeenCalledWith(
				expect.objectContaining({
					selections: expect.objectContaining({
						language: 'typescript',
					}),
				}),
			)

			expect(clack.outro).toHaveBeenCalled()
		})
	})

	describe('flag override --stack', () => {
		it('should use --stack value when it matches a valid choice', async () => {
			await runInitAction(['-y', '--stack', 'express-typescript'])

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			expect(regInstance.register).toHaveBeenCalledWith(
				expect.objectContaining({
					selections: expect.objectContaining({
						stack: 'express-typescript',
					}),
				}),
			)
		})
	})

	describe('invalid --stack flag', () => {
		it('should warn and fall through to prompt when slug is invalid', async () => {
			vi.mocked(clack.text).mockResolvedValueOnce('my-app')
			vi.mocked(clack.select)
				.mockResolvedValueOnce('greenfield')
				.mockResolvedValueOnce('team')
				.mockResolvedValueOnce('typescript')
				.mockResolvedValueOnce('nextjs-app-router')
			vi.mocked(clack.confirm).mockResolvedValueOnce(true)

			await runInitAction(['--stack', 'invalid-slug'])

			expect(clack.log.warn).toHaveBeenCalled()

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			expect(regInstance.register).toHaveBeenCalledWith(
				expect.objectContaining({
					selections: expect.objectContaining({
						stack: 'nextjs-app-router',
					}),
				}),
			)
		})
	})

	describe('schema fetch failure (network error)', () => {
		it('should display error and exit non-zero', async () => {
			mockSchemaFetchError(new Error('Network timeout'))

			await expect(runInitAction(['-y'])).rejects.toThrow('process.exit called')

			expect(process.exit).toHaveBeenCalledWith(1)
			expect(clack.log.error).toHaveBeenCalledWith(expect.stringContaining('Network timeout'))
		})
	})

	describe('schema fetch failure (401)', () => {
		it('should display auth error and exit non-zero', async () => {
			mockSchemaFetchError(new Error('Failed to fetch init schema (401)'))

			await expect(runInitAction(['-y'])).rejects.toThrow('process.exit called')

			expect(process.exit).toHaveBeenCalledWith(1)
			expect(clack.log.error).toHaveBeenCalledWith(expect.stringContaining('401'))
		})
	})

	describe('unknown selectorType', () => {
		it('should skip group with unknown selectorType and continue init', async () => {
			const schema: InitSchema = {
				categories: {
					basics: [
						makeGroup('project-type', [makeChoice('greenfield')], { name: 'Project Type' }),
						makeGroup('track', [makeChoice('team')], { name: 'Track' }),
					],
					custom: [
						makeGroup('multi-pick', [makeChoice('option-a')], {
							name: 'Multi Pick',
							selectorType: 'multi-select',
						}),
					],
				},
			}
			mockSchemaFetch(schema)

			await runInitAction(['-y'])

			expect(clack.log.warn).toHaveBeenCalled()
			expect(clack.outro).toHaveBeenCalled()

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			const callArgs = vi.mocked(regInstance.register).mock.calls[0]?.[0]
			expect(callArgs.selections).not.toHaveProperty('multi-pick')
		})
	})

	describe('registration payload format', () => {
		it('should send selections field (not vanguardConfig)', async () => {
			await runInitAction(['-y'])

			const regInstance = vi.mocked(ProjectRegistrationService).mock.results[0]?.value
			const callArgs = vi.mocked(regInstance.register).mock.calls[0]?.[0]

			expect(callArgs).toHaveProperty('selections')
			expect(typeof callArgs.selections).toBe('object')
			expect(callArgs).not.toHaveProperty('vanguardConfig')
		})
	})
})
