import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
	GraphContextResult,
	HookQueryResult,
	MemoryApiClient,
} from '../../../../src/application/ports/memory-api-client.js'
import type {
	MemoryConfigRepository,
	MemoryRepository,
} from '../../../../src/application/ports/memory-repository.js'
import {
	PreTaskHookService,
	detectPersona,
} from '../../../../src/application/services/pre-task-hook.service.js'

// ── Mocks ────────────────────────────────────────────────────────────

function createMockConfigRepo(initialized = true): MemoryConfigRepository {
	return {
		isInitialized: vi.fn().mockResolvedValue(initialized),
		load: vi.fn().mockResolvedValue({ search: { defaultLimit: 5 } }),
		save: vi.fn(),
		getProjectRoot: vi.fn(),
	} as unknown as MemoryConfigRepository
}

function createMockMemoryRepo(): MemoryRepository {
	return {
		findAll: vi.fn().mockResolvedValue([]),
		findById: vi.fn(),
		save: vi.fn(),
		delete: vi.fn(),
	} as unknown as MemoryRepository
}

function createMockApiClient(overrides: Partial<MemoryApiClient> = {}): MemoryApiClient {
	return {
		isAvailable: vi.fn().mockResolvedValue(true),
		queryForGraphContext: vi.fn().mockResolvedValue({
			context: '<PROJECT_CONTEXT>graph results</PROJECT_CONTEXT>',
			tokenEstimate: 50,
			searchTimeMs: 120,
		} satisfies GraphContextResult),
		queryForContext: vi.fn().mockResolvedValue({
			context: '## pgvector results',
			itemCount: 3,
		} satisfies HookQueryResult),
		search: vi.fn(),
		syncItems: vi.fn(),
		getSyncStatus: vi.fn(),
		pullItems: vi.fn(),
		submitFeedback: vi.fn(),
		setPriority: vi.fn(),
		...overrides,
	} as unknown as MemoryApiClient
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PreTaskHookService', () => {
	let configRepo: MemoryConfigRepository
	let memoryRepo: MemoryRepository
	let apiClient: MemoryApiClient
	let service: PreTaskHookService

	beforeEach(() => {
		configRepo = createMockConfigRepo()
		memoryRepo = createMockMemoryRepo()
		apiClient = createMockApiClient()
		service = new PreTaskHookService(configRepo, memoryRepo, apiClient)
	})

	describe('graph context (primary path)', () => {
		it('returns graph context when available', async () => {
			const result = await service.execute({ prompt: 'add authentication' })

			expect(result.source).toBe('graph')
			expect(result.context).toContain('graph results')
			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ query: 'add authentication' }),
			)
		})

		it('passes persona and projectName to graph context', async () => {
			await service.execute({
				prompt: 'test',
				personaId: 'architect',
				projectName: 'my-project',
			})

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith({
				query: 'test',
				persona: 'architect',
				projectName: 'my-project',
			})
		})

		it('skips graph context when API is unavailable', async () => {
			;(apiClient.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false)
			;(configRepo.isInitialized as ReturnType<typeof vi.fn>).mockResolvedValue(false)

			const result = await service.execute({ prompt: 'test' })

			expect(result.source).toBe('local')
			expect(result.context).toBe('')
		})

		it('falls through when graph context returns empty string', async () => {
			;(apiClient.queryForGraphContext as ReturnType<typeof vi.fn>).mockResolvedValue({
				context: '',
				tokenEstimate: 0,
				searchTimeMs: 50,
			})

			const result = await service.execute({ prompt: 'test' })

			// Should fall through to pgvector
			expect(result.source).toBe('api')
			expect(apiClient.queryForContext).toHaveBeenCalled()
		})

		it('falls through when graph context throws', async () => {
			;(apiClient.queryForGraphContext as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Graphiti down'),
			)

			const result = await service.execute({ prompt: 'test' })

			// Should fall through to pgvector
			expect(result.source).toBe('api')
		})
	})

	describe('pgvector fallback (secondary path)', () => {
		beforeEach(() => {
			// Disable graph context so we test pgvector path
			;(apiClient.queryForGraphContext as ReturnType<typeof vi.fn>).mockResolvedValue({
				context: '',
				tokenEstimate: 0,
				searchTimeMs: 0,
			})
		})

		it('uses pgvector when graph returns empty', async () => {
			const result = await service.execute({ prompt: 'authentication' })

			expect(result.source).toBe('api')
			expect(result.context).toContain('pgvector results')
			expect(result.itemCount).toBe(3)
		})

		it('requires local memory to be initialized', async () => {
			;(configRepo.isInitialized as ReturnType<typeof vi.fn>).mockResolvedValue(false)

			const result = await service.execute({ prompt: 'test' })

			expect(result.source).toBe('local')
			expect(result.context).toBe('')
			expect(apiClient.queryForContext).not.toHaveBeenCalled()
		})
	})

	describe('local fallback (tertiary path)', () => {
		beforeEach(() => {
			// Disable both API paths
			;(apiClient.queryForGraphContext as ReturnType<typeof vi.fn>).mockResolvedValue({
				context: '',
				tokenEstimate: 0,
				searchTimeMs: 0,
			})
			;(apiClient.queryForContext as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('API down'),
			)
		})

		it('falls back to local search when all API paths fail', async () => {
			const result = await service.execute({ prompt: 'authentication' })

			expect(result.source).toBe('local')
			expect(memoryRepo.findAll).toHaveBeenCalled()
		})
	})

	describe('without API client', () => {
		it('uses local search when no API client provided', async () => {
			const serviceNoApi = new PreTaskHookService(configRepo, memoryRepo)

			const result = await serviceNoApi.execute({ prompt: 'test' })

			expect(result.source).toBe('local')
		})
	})

	describe('output shape', () => {
		it('includes searchTimeMs', async () => {
			const result = await service.execute({ prompt: 'test' })
			expect(result.searchTimeMs).toBeGreaterThanOrEqual(0)
		})

		it('graph source sets itemCount to 0', async () => {
			const result = await service.execute({ prompt: 'test' })
			expect(result.source).toBe('graph')
			expect(result.itemCount).toBe(0)
		})
	})

	describe('persona detection from env var', () => {
		const originalEnv = process.env.VANGUARD_PERSONA

		afterEach(() => {
			if (originalEnv === undefined) {
				process.env.VANGUARD_PERSONA = undefined
			} else {
				process.env.VANGUARD_PERSONA = originalEnv
			}
		})

		it('uses VANGUARD_PERSONA when input.personaId is not set', async () => {
			process.env.VANGUARD_PERSONA = 'architect'

			await service.execute({ prompt: 'test' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ persona: 'architect' }),
			)
		})

		it('input.personaId takes precedence over VANGUARD_PERSONA', async () => {
			process.env.VANGUARD_PERSONA = 'developer'

			await service.execute({ prompt: 'test', personaId: 'architect' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ persona: 'architect' }),
			)
		})

		it('omits persona when neither input nor env var is set', async () => {
			Reflect.deleteProperty(process.env, 'VANGUARD_PERSONA')

			await service.execute({ prompt: 'test' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith({
				query: 'test',
			})
		})

		it('normalizes env var to lowercase trimmed', async () => {
			process.env.VANGUARD_PERSONA = '  Developer  '

			await service.execute({ prompt: 'test' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ persona: 'developer' }),
			)
		})

		it('treats empty env var as unset', async () => {
			process.env.VANGUARD_PERSONA = ''

			await service.execute({ prompt: 'test' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith({
				query: 'test',
			})
		})
	})
})

// ── detectPersona unit tests ────────────────────────────────────────

describe('detectPersona', () => {
	const originalEnv = process.env.VANGUARD_PERSONA

	afterEach(() => {
		if (originalEnv === undefined) {
			process.env.VANGUARD_PERSONA = undefined
		} else {
			process.env.VANGUARD_PERSONA = originalEnv
		}
	})

	it('returns persona when VANGUARD_PERSONA is set', () => {
		process.env.VANGUARD_PERSONA = 'architect'
		expect(detectPersona()).toBe('architect')
	})

	it('trims and lowercases the value', () => {
		process.env.VANGUARD_PERSONA = '  Developer  '
		expect(detectPersona()).toBe('developer')
	})

	it('returns undefined when not set', () => {
		Reflect.deleteProperty(process.env, 'VANGUARD_PERSONA')
		expect(detectPersona()).toBeUndefined()
	})

	it('returns undefined when empty string', () => {
		process.env.VANGUARD_PERSONA = ''
		expect(detectPersona()).toBeUndefined()
	})

	it('returns undefined when whitespace only', () => {
		process.env.VANGUARD_PERSONA = '   '
		expect(detectPersona()).toBeUndefined()
	})
})
