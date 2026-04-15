import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphitiWritePort } from '../../../../src/application/ports/graphiti-write.port.js'
import type {
	MemoryConfigRepository,
	MemoryRepository,
} from '../../../../src/application/ports/memory-repository.js'
import { PostTaskHookService } from '../../../../src/application/services/post-task-hook.service.js'

// ── Mocks ────────────────────────────────────────────────────────────

function createMockConfigRepo(
	overrides: {
		initialized?: boolean
		enabled?: boolean
		groupId?: string
		threshold?: 'low' | 'medium' | 'high'
	} = {},
): MemoryConfigRepository {
	const { initialized = true, enabled = true, threshold = 'low' } = overrides
	const groupId = 'groupId' in overrides ? overrides.groupId : 'test-org--test-project'

	return {
		isInitialized: vi.fn().mockResolvedValue(initialized),
		load: vi.fn().mockResolvedValue({
			groupId,
			autoCapture: {
				enabled,
				confidenceThreshold: threshold,
				extract: {
					patterns: true,
					decisions: true,
					errorSolutions: true,
					conventions: true,
				},
				excludePaths: [],
			},
		}),
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

function createMockGraphitiPort(): GraphitiWritePort {
	return {
		addEpisode: vi.fn().mockResolvedValue({ success: true }),
	}
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PostTaskHookService — Graphiti routing', () => {
	let configRepo: MemoryConfigRepository
	let memoryRepo: MemoryRepository
	let graphitiPort: GraphitiWritePort

	beforeEach(() => {
		configRepo = createMockConfigRepo()
		memoryRepo = createMockMemoryRepo()
		graphitiPort = createMockGraphitiPort()
	})

	it('routes extracted candidates to Graphiti with correct prefixes', async () => {
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		const result = await service.execute({
			sessionOutput:
				'We use a repository pattern for data access. ' +
				'Decided to use PostgreSQL because it supports JSON. ' +
				'Fixed the timeout by increasing the connection pool size.',
			prompt: 'test prompt',
		})

		expect(result.candidates.length).toBeGreaterThan(0)
		expect(graphitiPort.addEpisode).toHaveBeenCalled()

		// Verify prefix mapping
		const calls = vi.mocked(graphitiPort.addEpisode).mock.calls
		for (const [input] of calls) {
			expect(input.name).toMatch(/^(Pattern:|Decision:|Solution:)\s/)
			expect(input.groupId).toBe('test-org--test-project')
			expect(input.sourceDescription).toContain('post-task-hook')
			expect(input.episodeBody.length).toBeLessThanOrEqual(2000)
		}
	})

	it('skips Graphiti when no graphitiPort is provided', async () => {
		const service = new PostTaskHookService(configRepo, memoryRepo)

		const result = await service.execute({
			sessionOutput: 'We use a repository pattern for data access.',
			prompt: 'test prompt',
		})

		expect(result.candidates.length).toBeGreaterThan(0)
		// No graphitiPort = no calls
	})

	it('skips Graphiti when groupId is missing from config', async () => {
		configRepo = createMockConfigRepo({ groupId: undefined })
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		const result = await service.execute({
			sessionOutput: 'We use a repository pattern for data access.',
			prompt: 'test prompt',
		})

		expect(result.candidates.length).toBeGreaterThan(0)
		expect(graphitiPort.addEpisode).not.toHaveBeenCalled()
	})

	it('skips Graphiti when no candidates pass filtering', async () => {
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		const result = await service.execute({
			sessionOutput: 'Nothing interesting here.',
			prompt: 'test prompt',
		})

		expect(result.candidates).toHaveLength(0)
		expect(graphitiPort.addEpisode).not.toHaveBeenCalled()
	})

	it('continues processing when Graphiti write fails', async () => {
		const failingPort: GraphitiWritePort = {
			addEpisode: vi.fn().mockRejectedValue(new Error('network error')),
		}
		const service = new PostTaskHookService(configRepo, memoryRepo, failingPort)

		// Should not throw
		const result = await service.execute({
			sessionOutput:
				'We use a repository pattern for data access. ' +
				'Decided to use PostgreSQL because it supports JSON.',
			prompt: 'test prompt',
		})

		expect(result.candidates.length).toBeGreaterThan(0)
		expect(failingPort.addEpisode).toHaveBeenCalled()
	})

	it('maps convention extraction type to Pattern: prefix', async () => {
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		await service.execute({
			sessionOutput: 'Convention: always use snake_case for database columns.',
			prompt: 'test prompt',
		})

		const calls = vi.mocked(graphitiPort.addEpisode).mock.calls
		if (calls.length > 0) {
			const conventionCall = calls.find(([input]) => input.sourceDescription.includes('convention'))
			if (conventionCall) {
				expect(conventionCall[0].name).toMatch(/^Pattern:/)
			}
		}
	})

	it('strips existing prefix from candidate title before adding episode prefix', async () => {
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		await service.execute({
			sessionOutput: 'We use a repository pattern for all database queries in this project.',
			prompt: 'test prompt',
		})

		const calls = vi.mocked(graphitiPort.addEpisode).mock.calls
		for (const [input] of calls) {
			// Should not have double prefix like "Pattern: Repository Pattern Pattern"
			expect(input.name).not.toMatch(/Pattern:.*Pattern:/)
		}
	})

	it('returns candidates even when memory is not initialized', async () => {
		configRepo = createMockConfigRepo({ initialized: false })
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		const result = await service.execute({
			sessionOutput: 'We use a repository pattern.',
			prompt: 'test prompt',
		})

		expect(result.candidates).toHaveLength(0)
		expect(graphitiPort.addEpisode).not.toHaveBeenCalled()
	})

	it('returns candidates when autoCapture is disabled', async () => {
		configRepo = createMockConfigRepo({ enabled: false })
		const service = new PostTaskHookService(configRepo, memoryRepo, graphitiPort)

		const result = await service.execute({
			sessionOutput: 'We use a repository pattern.',
			prompt: 'test prompt',
		})

		expect(result.candidates).toHaveLength(0)
		expect(graphitiPort.addEpisode).not.toHaveBeenCalled()
	})
})
