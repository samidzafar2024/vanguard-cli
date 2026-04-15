/**
 * Add Memory Item Use Case.
 *
 * Creates a new memory item and persists it.
 */

import { MemoryItem } from '../../../domain/entities/memory-item.js'
import {
	DuplicateMemoryError,
	MemoryInitializationError,
} from '../../../domain/errors/memory-errors.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { MemorySourceType } from '../../../domain/value-objects/memory-source.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for adding a memory item.
 */
export interface AddMemoryItemInput {
	readonly title: string
	readonly content: string
	readonly domain: string
	readonly topic?: string
	readonly subtopic?: string
	readonly confidence?: ConfidenceLevel
	readonly source?: MemorySourceType
	readonly author?: string
	readonly tags?: readonly string[]
	readonly relations?: readonly string[]
}

/**
 * Output from adding a memory item.
 */
export interface AddMemoryItemOutput {
	readonly item: MemoryItem
	readonly message: string
}

/**
 * Use case for adding a new memory item.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Generates ID from domain/topic/title
 * - Checks for duplicates
 * - Creates and persists the memory item
 */
export class AddMemoryItemUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
	) {}

	async execute(input: AddMemoryItemInput): Promise<AddMemoryItemOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Validate required fields
		if (!input.title.trim()) {
			throw new Error('Title is required')
		}
		if (!input.content.trim()) {
			throw new Error('Content is required')
		}
		if (!input.domain.trim()) {
			throw new Error('Domain is required')
		}

		// Generate ID from title
		const id = MemoryId.generate(input.domain, input.topic, input.title)

		// Check for duplicates
		const exists = await this.memoryRepository.exists(id)
		if (exists) {
			throw new DuplicateMemoryError(id.toString())
		}

		// Create the memory item (only include defined optional properties)
		const item = MemoryItem.create({
			id,
			title: input.title,
			content: input.content,
			domain: input.domain,
			...(input.topic !== undefined && { topic: input.topic }),
			...(input.subtopic !== undefined && { subtopic: input.subtopic }),
			...(input.confidence !== undefined && { confidence: input.confidence }),
			...(input.source !== undefined && { source: input.source }),
			...(input.author !== undefined && { author: input.author }),
			...(input.tags !== undefined && { tags: input.tags }),
			...(input.relations !== undefined && { relations: input.relations }),
		})

		// Persist it
		await this.memoryRepository.save(item)

		return {
			item,
			message: `Memory item created: ${id.toString()}`,
		}
	}
}
