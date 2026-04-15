/**
 * Pull Memory Use Case.
 *
 * Pulls team context from vanguard-web and merges with local memory.
 * Enables team knowledge sharing and synchronization.
 */

import { MemoryItem } from '../../../domain/entities/memory-item.js'
import { MemoryInitializationError } from '../../../domain/errors/memory-errors.js'
import { MemoryId } from '../../../domain/value-objects/memory-id.js'
import type { MemoryApiClient, RemoteMemoryItem } from '../../ports/memory-api-client.js'
import type { MemoryConfigRepository, MemoryRepository } from '../../ports/memory-repository.js'

/**
 * Input for pulling memory.
 */
export interface PullMemoryInput {
	readonly force?: boolean
	readonly since?: string
}

/**
 * Progress callback for pull operations.
 */
export type PullProgressCallback = (progress: {
	phase: 'fetching' | 'merging' | 'saving'
	current: number
	total: number
	message: string
}) => void

/**
 * Output from pulling memory.
 */
export interface PullMemoryOutput {
	readonly added: number
	readonly updated: number
	readonly unchanged: number
	readonly conflicts: number
	readonly errors: readonly string[]
	readonly message: string
}

/**
 * Use case for pulling memory from vanguard-web.
 *
 * Responsibilities:
 * - Fetches team context from the cloud API
 * - Merges remote items with local memory
 * - Handles conflicts (remote wins by default)
 */
export class PullMemoryUseCase {
	constructor(
		private readonly memoryRepository: MemoryRepository,
		private readonly configRepository: MemoryConfigRepository,
		private readonly apiClient: MemoryApiClient,
	) {}

	async execute(
		input: PullMemoryInput = {},
		onProgress?: PullProgressCallback,
	): Promise<PullMemoryOutput> {
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

		// Fetch remote items
		onProgress?.({
			phase: 'fetching',
			current: 0,
			total: 1,
			message: 'Fetching team context...',
		})

		const pullResult = await this.apiClient.pullItems(input.since)

		if (pullResult.items.length === 0) {
			return {
				added: 0,
				updated: 0,
				unchanged: 0,
				conflicts: 0,
				errors: [],
				message: 'No new items in team context.',
			}
		}

		onProgress?.({
			phase: 'fetching',
			current: 1,
			total: 1,
			message: `Fetched ${pullResult.items.length} items from team context`,
		})

		// Load local items for comparison
		const localItems = await this.memoryRepository.findAll()
		const localItemsMap = new Map(localItems.map((item) => [item.id.toString(), item]))

		// Merge remote items
		let added = 0
		let updated = 0
		let unchanged = 0
		let conflicts = 0
		const errors: string[] = []

		for (let i = 0; i < pullResult.items.length; i++) {
			const remoteItem = pullResult.items[i]
			if (!remoteItem) continue

			onProgress?.({
				phase: 'merging',
				current: i + 1,
				total: pullResult.items.length,
				message: `Processing "${remoteItem.title}"...`,
			})

			try {
				const localItem = localItemsMap.get(remoteItem.id)

				if (!localItem) {
					// New item - add it
					const newItem = this.createMemoryItem(remoteItem)
					await this.memoryRepository.save(newItem)
					added++
				} else if (localItem.contentHash.toString() !== remoteItem.contentHash) {
					// Content differs - check if we should update
					if (input.force) {
						// Force update - remote wins
						const updatedItem = this.createMemoryItem(remoteItem)
						await this.memoryRepository.save(updatedItem)
						updated++
					} else {
						// Conflict - remote is newer by default (based on updatedAt)
						const localUpdated = localItem.updatedAt.getTime()
						const remoteUpdated = new Date(remoteItem.updatedAt).getTime()

						if (remoteUpdated > localUpdated) {
							const updatedItem = this.createMemoryItem(remoteItem)
							await this.memoryRepository.save(updatedItem)
							updated++
						} else {
							conflicts++
						}
					}
				} else {
					// Same content - no change needed
					unchanged++
				}
			} catch (err) {
				errors.push(`Failed to process "${remoteItem.title}": ${err}`)
			}
		}

		onProgress?.({
			phase: 'saving',
			current: pullResult.items.length,
			total: pullResult.items.length,
			message: 'Pull complete',
		})

		// Build message
		const parts: string[] = []
		if (added > 0) parts.push(`${added} added`)
		if (updated > 0) parts.push(`${updated} updated`)
		if (unchanged > 0) parts.push(`${unchanged} unchanged`)
		if (conflicts > 0) parts.push(`${conflicts} conflicts (local newer)`)

		const message =
			parts.length > 0
				? `Pulled from team context: ${parts.join(', ')}`
				: 'Team context is in sync.'

		return {
			added,
			updated,
			unchanged,
			conflicts,
			errors,
			message,
		}
	}

	/**
	 * Create a MemoryItem from a remote item.
	 */
	private createMemoryItem(remote: RemoteMemoryItem): MemoryItem {
		const id = MemoryId.create(remote.id)

		return MemoryItem.create({
			id,
			title: remote.title,
			content: remote.content,
			domain: remote.domain,
			...(remote.topic !== undefined && { topic: remote.topic }),
			confidence: remote.confidence,
			source: 'imported',
			...(remote.author !== undefined && { author: remote.author }),
			tags: [...remote.tags],
			relations: [...remote.relations],
		})
	}
}
