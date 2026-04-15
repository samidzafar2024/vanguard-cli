import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
	GraphContextResult,
	MemoryApiClient,
} from '../../../../src/application/ports/memory-api-client.js'
import { SessionStartHookService } from '../../../../src/application/services/session-start-hook.service.js'

// ── Mocks ────────────────────────────────────────────────────────────

function createMockApiClient(overrides: Partial<MemoryApiClient> = {}): MemoryApiClient {
	return {
		isAvailable: vi.fn().mockResolvedValue(true),
		queryForGraphContext: vi.fn().mockResolvedValue({
			context: '<PROJECT_CONTEXT>decisions and entities</PROJECT_CONTEXT>',
			tokenEstimate: 80,
			searchTimeMs: 150,
		} satisfies GraphContextResult),
		queryForContext: vi.fn(),
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

describe('SessionStartHookService', () => {
	let apiClient: MemoryApiClient
	let service: SessionStartHookService

	beforeEach(() => {
		apiClient = createMockApiClient()
		service = new SessionStartHookService(apiClient)
	})

	describe('successful retrieval', () => {
		it('returns context from graph', async () => {
			const result = await service.execute({})

			expect(result.context).toContain('decisions and entities')
			expect(result.tokenEstimate).toBe(80)
		})

		it('uses a default broad query', async () => {
			await service.execute({})

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({
					query: expect.stringContaining('architecture'),
				}),
			)
		})

		it('passes projectName when provided', async () => {
			await service.execute({ projectName: 'symphony-rails' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ projectName: 'symphony-rails' }),
			)
		})

		it('passes persona when provided', async () => {
			await service.execute({ persona: 'architect' })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ persona: 'architect' }),
			)
		})

		it('uses default token budget of 1500', async () => {
			await service.execute({})

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ tokenBudget: 1500 }),
			)
		})

		it('respects custom token budget', async () => {
			await service.execute({ tokenBudget: 500 })

			expect(apiClient.queryForGraphContext).toHaveBeenCalledWith(
				expect.objectContaining({ tokenBudget: 500 }),
			)
		})
	})

	describe('graceful degradation', () => {
		it('returns empty when API is unavailable', async () => {
			;(apiClient.isAvailable as ReturnType<typeof vi.fn>).mockResolvedValue(false)

			const result = await service.execute({})

			expect(result.context).toBe('')
			expect(result.tokenEstimate).toBe(0)
			expect(apiClient.queryForGraphContext).not.toHaveBeenCalled()
		})

		it('returns empty when graph query throws', async () => {
			;(apiClient.queryForGraphContext as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Graphiti unavailable'),
			)

			const result = await service.execute({})

			expect(result.context).toBe('')
			expect(result.tokenEstimate).toBe(0)
		})

		it('returns empty when isAvailable throws', async () => {
			;(apiClient.isAvailable as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error('Network error'),
			)

			const result = await service.execute({})

			expect(result.context).toBe('')
		})
	})

	describe('output shape', () => {
		it('includes searchTimeMs', async () => {
			const result = await service.execute({})
			expect(result.searchTimeMs).toBeGreaterThanOrEqual(0)
		})

		it('returns all expected fields', async () => {
			const result = await service.execute({})

			expect(result).toHaveProperty('context')
			expect(result).toHaveProperty('tokenEstimate')
			expect(result).toHaveProperty('searchTimeMs')
		})
	})
})
