/**
 * Update Memory Item Use Case.
 *
 * Updates an existing memory item.
 */

import type { MemoryItem } from '../../../domain/entities/memory-item.js'
import {
	MemoryInitializationError,
	MemoryNotFoundError,
} from '../../../domain/errors/memory-errors.js'
import type { ConfidenceLevel } from '../../../domain/value-objects/confidence.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for updating a memory item.
 */
export interface UpdateMemoryItemInput {
	readonly id: string
	readonly title?: string
	readonly content?: string
	readonly confidence?: ConfidenceLevel
	readonly addTags?: readonly string[]
	readonly removeTags?: readonly string[]
	readonly addRelations?: readonly string[]
	readonly removeRelations?: readonly string[]
}

/**
 * Output from updating a memory item.
 */
export interface UpdateMemoryItemOutput {
	readonly item: MemoryItem
	readonly changes: readonly string[]
	readonly message: string
}

interface UpdateResult {
	item: MemoryItem
	changes: string[]
}

/**
 * Use case for updating a memory item.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Finds existing item
 * - Applies updates immutably
 * - Persists changes
 */
export class UpdateMemoryItemUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
	) {}

	async execute(input: UpdateMemoryItemInput): Promise<UpdateMemoryItemOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Parse the ID and get existing item
		const id = MemoryId.create(input.id)
		const existingItem = await this.memoryRepository.findById(id)
		if (!existingItem) {
			throw new MemoryNotFoundError(input.id)
		}

		// Apply all updates
		const result = this.applyUpdates(existingItem, input)

		// Persist if there were changes
		if (result.changes.length > 0) {
			await this.memoryRepository.save(result.item)
		}

		return {
			item: result.item,
			changes: result.changes,
			message:
				result.changes.length > 0
					? `Updated ${id.toString()}: ${result.changes.length} change(s)`
					: 'No changes made',
		}
	}

	private applyUpdates(item: MemoryItem, input: UpdateMemoryItemInput): UpdateResult {
		const changes: string[] = []
		let current = item

		// Apply basic field updates
		current = this.applyFieldUpdates(current, input, changes)

		// Apply tag updates
		current = this.applyTagUpdates(current, input, changes)

		// Apply relation updates
		current = this.applyRelationUpdates(current, input, changes)

		return { item: current, changes }
	}

	private applyFieldUpdates(
		item: MemoryItem,
		input: UpdateMemoryItemInput,
		changes: string[],
	): MemoryItem {
		let current = item

		if (input.title !== undefined && input.title !== current.title) {
			current = current.updateTitle(input.title)
			changes.push('title')
		}

		if (input.content !== undefined && current.hasContentChanged(input.content)) {
			current = current.updateContent(input.content)
			changes.push('content')
		}

		if (input.confidence !== undefined && input.confidence !== current.confidence.level) {
			current = current.updateConfidence(input.confidence)
			changes.push('confidence')
		}

		return current
	}

	private applyTagUpdates(
		item: MemoryItem,
		input: UpdateMemoryItemInput,
		changes: string[],
	): MemoryItem {
		let current = item

		for (const tag of input.addTags ?? []) {
			if (!current.hasTag(tag)) {
				current = current.addTag(tag)
				changes.push(`added tag: ${tag}`)
			}
		}

		for (const tag of input.removeTags ?? []) {
			if (current.hasTag(tag)) {
				current = current.removeTag(tag)
				changes.push(`removed tag: ${tag}`)
			}
		}

		return current
	}

	private applyRelationUpdates(
		item: MemoryItem,
		input: UpdateMemoryItemInput,
		changes: string[],
	): MemoryItem {
		let current = item

		for (const relation of input.addRelations ?? []) {
			if (!current.hasRelationTo(relation)) {
				current = current.addRelation(relation)
				changes.push(`added relation: ${relation}`)
			}
		}

		for (const relation of input.removeRelations ?? []) {
			if (current.hasRelationTo(relation)) {
				current = current.removeRelation(relation)
				changes.push(`removed relation: ${relation}`)
			}
		}

		return current
	}
}
