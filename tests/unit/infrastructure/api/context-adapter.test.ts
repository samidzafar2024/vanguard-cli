import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	ContextAdapter,
	ContextApiError,
} from '../../../../src/infrastructure/api/context.adapter.js'

// ── Mock auth repository ────────────────────────────────────────────

vi.mock('../../../../src/infrastructure/repositories/auth.repository.js', () => ({
	authRepository: {
		getAccessToken: vi.fn().mockResolvedValue('test-token'),
		getApiEndpoint: vi.fn().mockResolvedValue('https://api.example.com'),
	},
}))

// ── Mock global fetch ───────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => {
	vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────

describe('ContextAdapter', () => {
	let adapter: ContextAdapter

	beforeEach(() => {
		adapter = new ContextAdapter('0.1.0')
	})

	describe('getProjectContext', () => {
		it('sends POST with query and projectId', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						context: '<PROJECT_CONTEXT>test</PROJECT_CONTEXT>',
						tokenEstimate: 42,
						searchTimeMs: 150,
					}),
			})

			const result = await adapter.getProjectContext({
				projectId: 'proj-123',
				query: 'authentication patterns',
			})

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/api/memory/graph/context',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/json',
						Authorization: 'Bearer test-token',
					}),
				}),
			)

			const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
			expect(body.query).toBe('authentication patterns')
			expect(body.projectId).toBe('proj-123')

			expect(result.context).toContain('PROJECT_CONTEXT')
			expect(result.tokenEstimate).toBe(42)
			expect(result.searchTimeMs).toBe(150)
		})

		it('includes persona in POST body when provided', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						context: '',
						tokenEstimate: 0,
						searchTimeMs: 0,
					}),
			})

			await adapter.getProjectContext({
				projectId: 'proj-123',
				query: 'test',
				persona: 'developer',
			})

			const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
			expect(body.persona).toBe('developer')
		})

		it('omits persona from POST body when undefined', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						context: '',
						tokenEstimate: 0,
						searchTimeMs: 0,
					}),
			})

			await adapter.getProjectContext({
				projectId: 'proj-123',
				query: 'test',
			})

			const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
			expect(body).not.toHaveProperty('persona')
		})

		it('includes tokenBudget when provided', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () =>
					Promise.resolve({
						context: '',
						tokenEstimate: 0,
						searchTimeMs: 0,
					}),
			})

			await adapter.getProjectContext({
				projectId: 'proj-123',
				query: 'test',
				tokenBudget: 1500,
			})

			const body = JSON.parse((mockFetch.mock.calls[0][1] as { body: string }).body)
			expect(body.tokenBudget).toBe(1500)
		})

		it('throws ContextApiError on HTTP error', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				json: () => Promise.resolve({ message: 'Internal error' }),
			})

			await expect(
				adapter.getProjectContext({
					projectId: 'proj-123',
					query: 'test',
				}),
			).rejects.toThrow(ContextApiError)
		})

		it('returns defaults for missing response fields', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({}),
			})

			const result = await adapter.getProjectContext({
				projectId: 'proj-123',
				query: 'test',
			})

			expect(result.context).toBe('')
			expect(result.tokenEstimate).toBe(0)
			expect(result.searchTimeMs).toBe(0)
		})
	})

	describe('authentication', () => {
		it('throws ContextApiError when not authenticated', async () => {
			const { authRepository } = await import(
				'../../../../src/infrastructure/repositories/auth.repository.js'
			)
			;(authRepository.getAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null)

			await expect(
				adapter.getProjectContext({
					projectId: 'proj-123',
					query: 'test',
				}),
			).rejects.toThrow('Not authenticated')
		})
	})
})
