/**
 * Vanguard Memory API Client Implementation.
 *
 * Communicates with vanguard-web API for:
 * - Semantic search across memory items
 * - Syncing local items to the cloud database
 * - Pre-task context queries for hooks
 */

import type {
	GraphContextOptions,
	GraphContextResult,
	HookQueryOptions,
	HookQueryResult,
	MemoryApiClient,
	MemoryFeedbackOptions,
	MemoryFeedbackResult,
	MemoryPriorityOptions,
	MemoryPriorityResult,
	MemoryPullResult,
	MemorySearchOptions,
	MemorySearchOutput,
	MemorySyncItem,
	MemorySyncResult,
	MemorySyncStatus,
	RemoteMemoryItem,
} from '../../application/ports/memory-api-client.js'
import type { ConfidenceLevel } from '../../domain/value-objects/confidence.js'
import { authRepository } from '../repositories/auth.repository.js'

/**
 * API response types for memory operations.
 */
interface ApiSearchResponse {
	items: Array<{
		id: string
		title: string
		content: string
		domain: string
		topic?: string
		subtopic?: string
		confidence: string
		source: string
		tags: string[]
		relations: string[]
		createdAt: string
		updatedAt: string
		similarity: number
	}>
	relatedItems?: Array<{
		id: string
		title: string
		content: string
		domain: string
		topic?: string
		subtopic?: string
		confidence: string
		source: string
		tags: string[]
		relations: string[]
		createdAt: string
		updatedAt: string
		similarity: number
	}>
	meta: {
		query: string
		totalMatches: number
		searchTimeMs: number
	}
}

interface ApiSyncResponse {
	added: number
	updated: number
	deleted: number
	errors: string[]
}

interface ApiSyncStatusResponse {
	lastSyncAt: string | null
	itemsSynced: number
	pendingChanges: number
}

interface ApiHookResponse {
	context: string
	itemCount: number
	telemetryIds?: string[]
}

interface ApiFeedbackResponse {
	success: boolean
	memoryId: string
	wasHelpful: boolean
	newEffectivenessScore: number
	previousScore: number
}

interface ApiPriorityResponse {
	success: boolean
	memoryId: string
	priority: number
}

interface ApiGraphContextResponse {
	context: string
	tokenEstimate: number
	searchTimeMs: number
}

interface ApiPullResponse {
	items: Array<{
		id: string
		title: string
		content: string
		contentHash: string
		domain: string
		topic?: string
		confidence: string
		tags: string[]
		relations: string[]
		updatedAt: string
		author?: string
	}>
	totalCount: number
	lastSyncAt?: string
}

/**
 * Error thrown when API operations fail.
 */
export class MemoryApiError extends Error {
	constructor(
		message: string,
		public readonly statusCode?: number,
		public readonly cause?: unknown,
	) {
		super(message)
		this.name = 'MemoryApiError'
	}
}

/**
 * Vanguard Memory API client implementation.
 */
export class VanguardMemoryApiClient implements MemoryApiClient {
	private readonly clientVersion: string

	constructor(clientVersion = '0.1.0') {
		this.clientVersion = clientVersion
	}

	async search(options: MemorySearchOptions): Promise<MemorySearchOutput> {
		const { endpoint, token } = await this.getAuthContext()

		const body = {
			query: options.query,
			...(options.domains !== undefined && { domains: options.domains }),
			...(options.confidence !== undefined && { confidence: options.confidence }),
			...(options.tags !== undefined && { tags: options.tags }),
			...(options.limit !== undefined && { limit: options.limit }),
			...(options.threshold !== undefined && { threshold: options.threshold }),
			...(options.includeRelations !== undefined && { includeRelations: options.includeRelations }),
		}

		const response = await this.request<ApiSearchResponse>(
			`${endpoint}/api/memory/search`,
			'POST',
			token,
			body,
		)

		// Transform API response to domain objects
		return {
			items: response.items.map((item) => this.transformSearchResultItem(item)),
			...(response.relatedItems !== undefined && {
				relatedItems: response.relatedItems.map((item) => this.transformSearchResultItem(item)),
			}),
			meta: response.meta,
		}
	}

	async syncItems(items: readonly MemorySyncItem[]): Promise<MemorySyncResult> {
		const { endpoint, token } = await this.getAuthContext()

		const response = await this.request<ApiSyncResponse>(
			`${endpoint}/api/memory/sync`,
			'POST',
			token,
			{ items },
		)

		return {
			added: response.added,
			updated: response.updated,
			deleted: response.deleted,
			errors: response.errors,
		}
	}

	async getSyncStatus(): Promise<MemorySyncStatus> {
		const { endpoint, token } = await this.getAuthContext()

		const response = await this.request<ApiSyncStatusResponse>(
			`${endpoint}/api/memory/sync/status`,
			'GET',
			token,
		)

		return {
			lastSyncAt: response.lastSyncAt ? new Date(response.lastSyncAt) : undefined,
			itemsSynced: response.itemsSynced,
			pendingChanges: response.pendingChanges,
		}
	}

	async queryForContext(options: HookQueryOptions): Promise<HookQueryResult> {
		const { endpoint, token } = await this.getAuthContext()

		const body = {
			prompt: options.prompt,
			...(options.phase !== undefined && { phase: options.phase }),
			...(options.maxItems !== undefined && { maxItems: options.maxItems }),
			...(options.sessionId !== undefined && { sessionId: options.sessionId }),
			...(options.personaId !== undefined && { personaId: options.personaId }),
			...(options.projectName !== undefined && { projectName: options.projectName }),
		}

		const response = await this.request<ApiHookResponse>(
			`${endpoint}/api/memory/context`,
			'POST',
			token,
			body,
		)

		return {
			context: response.context,
			itemCount: response.itemCount,
			...(response.telemetryIds !== undefined && { telemetryIds: response.telemetryIds }),
		}
	}

	async queryForGraphContext(options: GraphContextOptions): Promise<GraphContextResult> {
		const { endpoint, token } = await this.getAuthContext()

		const body = {
			query: options.query,
			...(options.projectName !== undefined && { projectName: options.projectName }),
			...(options.persona !== undefined && { persona: options.persona }),
			...(options.tokenBudget !== undefined && { tokenBudget: options.tokenBudget }),
		}

		const response = await this.request<ApiGraphContextResponse>(
			`${endpoint}/api/memory/graph/context`,
			'POST',
			token,
			body,
		)

		return {
			context: response.context,
			tokenEstimate: response.tokenEstimate,
			searchTimeMs: response.searchTimeMs,
		}
	}

	async pullItems(since?: string): Promise<MemoryPullResult> {
		const { endpoint, token } = await this.getAuthContext()

		const url = since
			? `${endpoint}/api/memory/pull?since=${encodeURIComponent(since)}`
			: `${endpoint}/api/memory/pull`

		const response = await this.request<ApiPullResponse>(url, 'GET', token)

		// Transform API response to RemoteMemoryItem[]
		const items: RemoteMemoryItem[] = response.items.map((item) => ({
			id: item.id,
			title: item.title,
			content: item.content,
			contentHash: item.contentHash,
			domain: item.domain,
			...(item.topic !== undefined && { topic: item.topic }),
			confidence: item.confidence as ConfidenceLevel,
			tags: item.tags,
			relations: item.relations,
			updatedAt: item.updatedAt,
			...(item.author !== undefined && { author: item.author }),
		}))

		return {
			items,
			totalCount: response.totalCount,
			...(response.lastSyncAt !== undefined && { lastSyncAt: response.lastSyncAt }),
		}
	}

	async submitFeedback(options: MemoryFeedbackOptions): Promise<MemoryFeedbackResult> {
		const { endpoint, token } = await this.getAuthContext()

		const body = {
			wasHelpful: options.wasHelpful,
			...(options.telemetryId !== undefined && { telemetryId: options.telemetryId }),
			...(options.sessionId !== undefined && { sessionId: options.sessionId }),
			...(options.comment !== undefined && { comment: options.comment }),
		}

		const response = await this.request<ApiFeedbackResponse>(
			`${endpoint}/api/memory/${encodeURIComponent(options.memoryId)}/feedback`,
			'POST',
			token,
			body,
		)

		return {
			success: response.success,
			memoryId: response.memoryId,
			wasHelpful: response.wasHelpful,
			newEffectivenessScore: response.newEffectivenessScore,
			previousScore: response.previousScore,
		}
	}

	async setPriority(options: MemoryPriorityOptions): Promise<MemoryPriorityResult> {
		const { endpoint, token } = await this.getAuthContext()

		const response = await this.request<ApiPriorityResponse>(
			`${endpoint}/api/memory/${encodeURIComponent(options.memoryId)}/priority`,
			'PATCH',
			token,
			{ priority: options.priority },
		)

		return {
			success: response.success,
			memoryId: response.memoryId,
			priority: response.priority,
		}
	}

	async isAvailable(): Promise<boolean> {
		try {
			const { endpoint, token } = await this.getAuthContext()
			const response = await fetch(`${endpoint}/api/memory/health`, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
					'User-Agent': `vanguard-cli/${this.clientVersion}`,
				},
			})
			return response.ok
		} catch {
			return false
		}
	}

	/**
	 * Get authentication context (endpoint and token).
	 */
	private async getAuthContext(): Promise<{ endpoint: string; token: string }> {
		const token = await authRepository.getAccessToken()
		const endpoint = await authRepository.getApiEndpoint()

		if (!token || !endpoint) {
			throw new MemoryApiError('Not authenticated. Run "vanguard login" first.')
		}

		return { endpoint, token }
	}

	/**
	 * Make an authenticated API request.
	 */
	private async request<T>(
		url: string,
		method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
		token: string,
		body?: unknown,
	): Promise<T> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${token}`,
			'User-Agent': `vanguard-cli/${this.clientVersion}`,
			'Content-Type': 'application/json',
		}

		const response = await fetch(url, {
			method,
			headers,
			...(body !== undefined && { body: JSON.stringify(body) }),
		})

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { message?: string }
			throw new MemoryApiError(
				errorData.message ?? `API request failed: ${response.status}`,
				response.status,
			)
		}

		return (await response.json()) as T
	}

	/**
	 * Transform an API search result item to a MemorySearchResult.
	 * Note: We return a simplified structure since we can't easily reconstruct
	 * the full MemoryItem entity from API data without value object reconstruction.
	 */
	private transformSearchResultItem(item: ApiSearchResponse['items'][0]) {
		// Import dynamically to avoid circular dependencies
		// In the actual implementation, we would reconstruct the full MemoryItem
		// For now, we return the raw data with the similarity score
		return {
			item: item as unknown as import('../../domain/entities/memory-item.js').MemoryItem,
			similarity: item.similarity,
		}
	}
}
