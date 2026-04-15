/**
 * List Memory Items Use Case.
 *
 * Lists memory items with optional filtering.
 */

import type { MemoryItem } from '../../../domain/entities/memory-item.js'
import { MemoryInitializationError } from '../../../domain/errors/memory-errors.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import type { MemorySourceType } from '../../../domain/value-objects/memory-source.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for listing memory items.
 */
export interface ListMemoryItemsInput {
	readonly domain?: string
	readonly topic?: string
	readonly tags?: readonly string[]
	readonly confidence?: readonly ConfidenceLevel[]
	readonly source?: readonly MemorySourceType[]
	readonly limit?: number
	readonly offset?: number
}

/**
 * Output from listing memory items.
 */
export interface ListMemoryItemsOutput {
	readonly items: readonly MemoryItem[]
	readonly total: number
	readonly domains: readonly string[]
	readonly tags: readonly string[]
}

/**
 * Use case for listing memory items.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Applies filters
 * - Returns items with metadata
 */
export class ListMemoryItemsUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
	) {}

	async execute(input: ListMemoryItemsInput = {}): Promise<ListMemoryItemsOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Build query options (only include defined properties)
		const queryOptions = {
			...(input.domain !== undefined && { domain: input.domain }),
			...(input.topic !== undefined && { topic: input.topic }),
			...(input.tags !== undefined && { tags: input.tags }),
			...(input.confidence !== undefined && { confidence: input.confidence }),
			...(input.source !== undefined && { source: input.source }),
			...(input.limit !== undefined && { limit: input.limit }),
			...(input.offset !== undefined && { offset: input.offset }),
		}

		// Get items with filters
		const items = await this.memoryRepository.findAll(queryOptions)

		// Get total count (without limit/offset)
		const { limit: _limit, offset: _offset, ...countOptions } = queryOptions
		const total = await this.memoryRepository.count(countOptions)

		// Get available domains and tags for filtering UI
		const domains = await this.memoryRepository.getDomains()
		const tags = await this.memoryRepository.getTags()

		return {
			items,
			total,
			domains,
			tags,
		}
	}
}
