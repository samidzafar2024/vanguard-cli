/**
 * Memory Repository Port.
 *
 * Defines how the application layer accesses memory items
 * without depending on infrastructure details (file system, database).
 */

import type { MemoryConfig } from '../../domain/entities/memory-config.js'
import type { MemoryItem } from '../../domain/entities/memory-item.js'
import type { ConfidenceLevel } from '../../domain/value-objects/confidence.js'
import type { ContentHash } from '../../domain/value-objects/content-hash.js'
import type { MemoryId } from '../../domain/value-objects/memory-id.js'
import type { MemorySourceType } from '../../domain/value-objects/memory-source.js'

/**
 * Options for querying memory items.
 */
export interface MemoryQueryOptions {
	readonly domain?: string
	readonly topic?: string
	readonly tags?: readonly string[]
	readonly confidence?: readonly ConfidenceLevel[]
	readonly source?: readonly MemorySourceType[]
	readonly limit?: number
	readonly offset?: number
}

/**
 * Repository port for MemoryItem persistence.
 */
export interface MemoryRepository {
	/**
	 * Save a memory item (create or update).
	 */
	save(item: MemoryItem): Promise<void>

	/**
	 * Find a memory item by its ID.
	 */
	findById(id: MemoryId): Promise<MemoryItem | undefined>

	/**
	 * Find all memory items matching query options.
	 */
	findAll(options?: MemoryQueryOptions): Promise<readonly MemoryItem[]>

	/**
	 * Delete a memory item by its ID.
	 */
	delete(id: MemoryId): Promise<void>

	/**
	 * Check if a memory item exists.
	 */
	exists(id: MemoryId): Promise<boolean>

	/**
	 * Save multiple memory items in batch.
	 */
	saveAll(items: readonly MemoryItem[]): Promise<void>

	/**
	 * Find memory items by domain.
	 */
	findByDomain(domain: string): Promise<readonly MemoryItem[]>

	/**
	 * Find memory items by tag.
	 */
	findByTag(tag: string): Promise<readonly MemoryItem[]>

	/**
	 * Find memory items with at least the specified confidence.
	 */
	findByConfidence(minConfidence: ConfidenceLevel): Promise<readonly MemoryItem[]>

	/**
	 * Get the content hash of a memory item (for change detection).
	 */
	getContentHash(id: MemoryId): Promise<ContentHash | undefined>

	/**
	 * Get all memory item IDs.
	 */
	getAllIds(): Promise<readonly MemoryId[]>

	/**
	 * Get all unique domains.
	 */
	getDomains(): Promise<readonly string[]>

	/**
	 * Get all unique tags.
	 */
	getTags(): Promise<readonly string[]>

	/**
	 * Count total memory items.
	 */
	count(options?: MemoryQueryOptions): Promise<number>
}

/**
 * Repository port for MemoryConfig persistence.
 */
export interface MemoryConfigRepository {
	/**
	 * Load the memory configuration.
	 */
	load(): Promise<MemoryConfig | undefined>

	/**
	 * Save the memory configuration.
	 */
	save(config: MemoryConfig): Promise<void>

	/**
	 * Check if memory is initialized (config exists).
	 */
	isInitialized(): Promise<boolean>
}
