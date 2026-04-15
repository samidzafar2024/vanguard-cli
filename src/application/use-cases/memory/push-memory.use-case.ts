/**
 * Push Memory Use Case.
 *
 * Pushes local memory items to vanguard-web for team sharing.
 * Generates embeddings and uploads items that have changed.
 */

import { MemoryInitializationError } from '../../../domain/errors/memory-errors.js'
import type { EmbeddingService } from '../../ports/embedding-service.js'
import type { MemoryApiClient, MemorySyncItem } from '../../ports/memory-api-client.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for pushing memory.
 */
export interface PushMemoryInput {
	readonly force?: boolean
}

/**
 * Progress callback for push operations.
 */
export type PushProgressCallback = (progress: {
	phase: 'loading' | 'embedding' | 'pushing'
	current: number
	total: number
	message: string
}) => void

/**
 * Output from pushing memory.
 */
export interface PushMemoryOutput {
	readonly added: number
	readonly updated: number
	readonly deleted: number
	readonly unchanged: number
	readonly errors: readonly string[]
	readonly message: string
}

/**
 * Use case for pushing memory to vanguard-web.
 *
 * Responsibilities:
 * - Loads all local memory items
 * - Generates embeddings for items
 * - Pushes items to the cloud API for team sharing
 */
export class PushMemoryUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
		private readonly embeddingService: EmbeddingService,
		private readonly apiClient: MemoryApiClient,
	) {}

	async execute(
		_input: PushMemoryInput = {},
		onProgress?: PushProgressCallback,
	): Promise<PushMemoryOutput> {
		// Check if memory is initialized
		const isInitialized = await this.configRepository.isInitialized()
		if (!isInitialized) {
			throw new MemoryInitializationError(
				'Memory not initialized. Run "vanguard memory init" first.',
			)
		}

		// Get project configuration
		const config = await this.configRepository.load()
		const projectName = config?.project ?? 'unknown'

		// Check if API is available
		const isAvailable = await this.apiClient.isAvailable()
		if (!isAvailable) {
			throw new Error('Memory API is not available. Check your connection and authentication.')
		}

		// Load all local items
		onProgress?.({
			phase: 'loading',
			current: 0,
			total: 1,
			message: 'Loading local memory items...',
		})

		const items = await this.memoryRepository.findAll()

		if (items.length === 0) {
			return {
				added: 0,
				updated: 0,
				deleted: 0,
				unchanged: 0,
				errors: [],
				message: 'No memory items to push.',
			}
		}

		onProgress?.({
			phase: 'loading',
			current: 1,
			total: 1,
			message: `Loaded ${items.length} items`,
		})

		// Generate embeddings for items
		const syncItems: MemorySyncItem[] = []
		const errors: string[] = []

		for (let i = 0; i < items.length; i++) {
			const item = items[i]
			if (!item) continue

			onProgress?.({
				phase: 'embedding',
				current: i + 1,
				total: items.length,
				message: `Generating embedding for "${item.title}"...`,
			})

			try {
				// Try to generate embedding from title + content
				// If this fails, the server will generate embeddings
				let embedding: readonly number[] | undefined
				try {
					const textToEmbed = `${item.title}\n\n${item.content}`
					embedding = await this.embeddingService.generateEmbedding(textToEmbed)
				} catch (embeddingErr) {
					// Embedding generation failed, but we'll still push the item
					// The server will generate embeddings for items without them
					errors.push(`Failed to embed "${item.title}": ${embeddingErr}`)
				}

				syncItems.push({
					id: item.id.toString(),
					projectName,
					title: item.title,
					content: item.content,
					contentHash: item.contentHash.toString(),
					domain: item.domain,
					...(item.topic !== undefined && { topic: item.topic }),
					confidence: item.confidence.level,
					tags: [...item.tags],
					relations: [...item.relations],
					...(embedding !== undefined && { embedding }),
				})
			} catch (err) {
				errors.push(`Failed to process "${item.title}": ${err}`)
			}
		}

		if (syncItems.length === 0) {
			return {
				added: 0,
				updated: 0,
				deleted: 0,
				unchanged: 0,
				errors,
				message: errors.length > 0 ? 'All items failed to embed.' : 'No items to push.',
			}
		}

		// Push items to API
		onProgress?.({
			phase: 'pushing',
			current: 0,
			total: syncItems.length,
			message: `Pushing ${syncItems.length} items to team context...`,
		})

		const result = await this.apiClient.syncItems(syncItems)

		onProgress?.({
			phase: 'pushing',
			current: syncItems.length,
			total: syncItems.length,
			message: 'Push complete',
		})

		// Combine errors
		const allErrors = [...errors, ...result.errors]

		// Calculate unchanged
		const unchanged = syncItems.length - result.added - result.updated

		const totalChanges = result.added + result.updated + result.deleted
		const message =
			totalChanges > 0
				? `Pushed ${totalChanges} item(s): ${result.added} added, ${result.updated} updated, ${result.deleted} removed`
				: 'All items are up to date with team context.'

		return {
			added: result.added,
			updated: result.updated,
			deleted: result.deleted,
			unchanged: unchanged > 0 ? unchanged : 0,
			errors: allErrors,
			message,
		}
	}
}
