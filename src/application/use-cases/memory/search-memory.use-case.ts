/**
 * Search Memory Use Case.
 *
 * Performs semantic search across memory items using the vanguard-web API.
 */

import { MemoryInitializationError } from '../../../domain/errors/memory-errors.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import type {
	MemoryApiClient,
	MemorySearchOutput,
	MemorySearchResult,
} from '../../ports/memory-api-client.js'
import type { MemoryConfigRepository } from '../../ports/memory-repository.js'

/**
 * Input for searching memory.
 */
export interface SearchMemoryInput {
	readonly query: string
	readonly domains?: readonly string[]
	readonly confidence?: readonly ConfidenceLevel[]
	readonly tags?: readonly string[]
	readonly limit?: number
	readonly threshold?: number
	readonly includeRelations?: boolean
}

/**
 * Output from searching memory.
 */
export interface SearchMemoryOutput {
	readonly results: readonly MemorySearchResult[]
	readonly relatedItems: readonly MemorySearchResult[]
	readonly query: string
	readonly totalMatches: number
	readonly searchTimeMs: number
	readonly message: string
}

/**
 * Use case for semantic search across memory items.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Calls the search API with filters
 * - Returns ranked results with similarity scores
 */
export class SearchMemoryUseCase {
	constructor(
		private readonly configRepository: MemoryConfigRepository,
		private readonly apiClient: MemoryApiClient,
	) {}

	async execute(input: SearchMemoryInput): Promise<SearchMemoryOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Check if API is available
		const isAvailable = await this.apiClient.isAvailable()
		if (!isAvailable) {
			throw new Error('Memory API is not available. Check your connection and authentication.')
		}

		// Validate input
		if (!input.query.trim()) {
			throw new Error('Search query cannot be empty.')
		}

		// Load search config defaults
		const config = await this.configRepository.load()
		const searchConfig = config?.search

		// Execute search
		const response = await this.apiClient.search({
			query: input.query,
			...(input.domains !== undefined && { domains: input.domains }),
			...(input.confidence !== undefined && { confidence: input.confidence }),
			...(input.tags !== undefined && { tags: input.tags }),
			limit: input.limit ?? searchConfig?.defaultLimit ?? 5,
			threshold: input.threshold ?? searchConfig?.similarityThreshold ?? 0.6,
			includeRelations: input.includeRelations ?? searchConfig?.includeRelations ?? true,
		})

		const message = this.buildResultMessage(response)

		return {
			results: response.items,
			relatedItems: response.relatedItems ?? [],
			query: response.meta.query,
			totalMatches: response.meta.totalMatches,
			searchTimeMs: response.meta.searchTimeMs,
			message,
		}
	}

	/**
	 * Build a human-readable result message.
	 */
	private buildResultMessage(response: MemorySearchOutput): string {
		const { items, relatedItems, meta } = response

		if (items.length === 0) {
			return 'No matching memory items found.'
		}

		let message = `Found ${meta.totalMatches} result(s) in ${meta.searchTimeMs}ms.`

		if (relatedItems && relatedItems.length > 0) {
			message += ` Also found ${relatedItems.length} related item(s).`
		}

		return message
	}
}
