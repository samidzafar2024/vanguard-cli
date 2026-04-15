/**
 * Delete Memory Item Use Case.
 *
 * Deletes a memory item by ID.
 */

import {
	MemoryInitializationError,
	MemoryNotFoundError,
} from '../../../domain/errors/memory-errors.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for deleting a memory item.
 */
export interface DeleteMemoryItemInput {
	readonly id: string
	readonly force?: boolean
}

/**
 * Output from deleting a memory item.
 */
export interface DeleteMemoryItemOutput {
	readonly deleted: boolean
	readonly id: string
	readonly title: string
	readonly referencedBy: readonly string[]
	readonly message: string
}

/**
 * Use case for deleting a memory item.
 *
 * Responsibilities:
 * - Validates memory is initialized
 * - Checks if item exists
 * - Checks for references from other items
 * - Deletes the item (with force flag to ignore references)
 */
export class DeleteMemoryItemUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
	) {}

	async execute(input: DeleteMemoryItemInput): Promise<DeleteMemoryItemOutput> {
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

		// Check for references from other items
		const allItems = await this.memoryRepository.findAll()
		const referencedBy = allItems
			.filter((other) => other.hasRelationTo(id.toString()))
			.map((other) => other.id.toString())

		// If there are references and force is not set, don't delete
		if (referencedBy.length > 0 && !input.force) {
			return {
				deleted: false,
				id: id.toString(),
				title: item.title,
				referencedBy,
				message: `Cannot delete: ${referencedBy.length} item(s) reference this memory. Use --force to delete anyway.`,
			}
		}

		// Delete the item
		await this.memoryRepository.delete(id)

		return {
			deleted: true,
			id: id.toString(),
			title: item.title,
			referencedBy,
			message: `Deleted memory item: ${item.title}`,
		}
	}
}
