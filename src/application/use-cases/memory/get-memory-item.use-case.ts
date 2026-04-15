/**
 * Get Memory Item Use Case.
 *
 * Retrieves a single memory item by ID.
 */

import type { MemoryItem } from '../../../domain/entities/memory-item.js'
import {
	MemoryInitializationError,
	MemoryNotFoundError,
} from '../../../domain/errors/memory-errors.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for getting a memory item.
 */
export interface GetMemoryItemInput {
	readonly id: string
}

/**
 * Output from getting a memory item.
 */
export interface GetMemoryItemOutput {
	readonly item: MemoryItem
	readonly relatedItems: readonly MemoryItem[]
}

/**
 * Use case for getting a single memory item.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Parses and validates ID
 * - Retrieves item and its related items
 */
export class GetMemoryItemUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
	) {}

	async execute(input: GetMemoryItemInput): Promise<GetMemoryItemOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Parse the ID
		const id = MemoryId.create(input.id)

		// Get the item
		const item = await this.memoryRepository.findById(id)
		if (!item) {
			throw new MemoryNotFoundError(input.id)
		}

		// Get related items
		const relatedItems: MemoryItem[] = []
		for (const relationId of item.relations) {
			try {
				const relatedId = MemoryId.create(relationId)
				const related = await this.memoryRepository.findById(relatedId)
				if (related) {
					relatedItems.push(related)
				}
			} catch {
				// Skip invalid relation IDs
			}
		}

		return {
			item,
			relatedItems,
		}
	}
}
