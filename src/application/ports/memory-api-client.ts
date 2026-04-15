/**
 * Memory API Client Port.
 *
 * Abstracts communication with vanguard-web API for
 * search, sync, and hook operations.
 */

import type { MemoryItem } from '../../domain/entities/memory-item.js'
import type { ConfidenceLevel } from '../../domain/value-objects/confidence.js'

/**
 * Search result item with similarity score.
 */
export interface MemorySearchResult {
	readonly item: MemoryItem
	readonly similarity: number
}

/**
 * Options for searching memory items.
 */
export interface MemorySearchOptions {
	readonly query: string
	readonly domains?: readonly string[]
	readonly confidence?: readonly ConfidenceLevel[]
	readonly tags?: readonly string[]
	readonly limit?: number
	readonly threshold?: number
	readonly includeRelations?: boolean
}

/**
 * Output from a search operation.
 */
export interface MemorySearchOutput {
	readonly items: readonly MemorySearchResult[]
	readonly relatedItems?: readonly MemorySearchResult[]
	readonly meta: {
		readonly query: string
		readonly totalMatches: number
		readonly searchTimeMs: number
	}
}

/**
 * Result from a sync operation.
 */
export interface MemorySyncResult {
	readonly added: number
	readonly updated: number
	readonly deleted: number
	readonly errors: readonly string[]
}

/**
 * Sync status information.
 */
export interface MemorySyncStatus {
	readonly lastSyncAt: Date | undefined
	readonly itemsSynced: number
	readonly pendingChanges: number
}

/**
 * Item data for syncing to the API.
 */
export interface MemorySyncItem {
	readonly id: string
	readonly projectName: string
	readonly title: string
	readonly content: string
	readonly contentHash: string
	readonly domain: string
	readonly topic?: string
	readonly confidence: ConfidenceLevel
	readonly tags: readonly string[]
	readonly relations: readonly string[]
	readonly embedding?: readonly number[]
}

/**
 * Options for hook context query.
 */
export interface HookQueryOptions {
	readonly prompt: string
	readonly phase?: string
	readonly maxItems?: number
	readonly sessionId?: string
	readonly personaId?: string
	readonly projectName?: string
}

/**
 * Result from a hook context query.
 */
export interface HookQueryResult {
	readonly context: string
	readonly itemCount: number
	readonly telemetryIds?: readonly string[]
}

/**
 * Options for submitting feedback on a memory item.
 */
export interface MemoryFeedbackOptions {
	readonly memoryId: string
	readonly wasHelpful: boolean
	readonly telemetryId?: string
	readonly sessionId?: string
	readonly comment?: string
}

/**
 * Result from submitting feedback.
 */
export interface MemoryFeedbackResult {
	readonly success: boolean
	readonly memoryId: string
	readonly wasHelpful: boolean
	readonly newEffectivenessScore: number
	readonly previousScore: number
}

/**
 * Options for setting memory priority.
 */
export interface MemoryPriorityOptions {
	readonly memoryId: string
	readonly priority: number // 0-5
}

/**
 * Result from setting priority.
 */
export interface MemoryPriorityResult {
	readonly success: boolean
	readonly memoryId: string
	readonly priority: number
}

/**
 * Remote memory item from the API.
 */
export interface RemoteMemoryItem {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly contentHash: string
	readonly domain: string
	readonly topic?: string
	readonly confidence: ConfidenceLevel
	readonly tags: readonly string[]
	readonly relations: readonly string[]
	readonly updatedAt: string
	readonly author?: string
}

/**
 * Result from pulling remote items.
 */
export interface MemoryPullResult {
	readonly items: readonly RemoteMemoryItem[]
	readonly totalCount: number
	readonly lastSyncAt?: string
}

/**
 * Options for querying the Graphiti knowledge graph context.
 */
export interface GraphContextOptions {
	readonly query: string
	readonly projectName?: string
	readonly persona?: string
	readonly tokenBudget?: number
}

/**
 * Result from a Graphiti graph context query.
 */
export interface GraphContextResult {
	readonly context: string
	readonly tokenEstimate: number
	readonly searchTimeMs: number
}

/**
 * Port interface for the Memory API client.
 */
export interface MemoryApiClient {
	/**
	 * Search memory items using semantic search.
	 */
	search(options: MemorySearchOptions): Promise<MemorySearchOutput>

	/**
	 * Sync local memory items to the database.
	 */
	syncItems(items: readonly MemorySyncItem[]): Promise<MemorySyncResult>

	/**
	 * Get the current sync status.
	 */
	getSyncStatus(): Promise<MemorySyncStatus>

	/**
	 * Query for context to inject into a task prompt (pre-task hook).
	 */
	queryForContext(options: HookQueryOptions): Promise<HookQueryResult>

	/**
	 * Query the Graphiti knowledge graph for assembled context.
	 */
	queryForGraphContext(options: GraphContextOptions): Promise<GraphContextResult>

	/**
	 * Pull remote memory items from team context.
	 */
	pullItems(since?: string): Promise<MemoryPullResult>

	/**
	 * Submit feedback for a memory item (helpful/not helpful).
	 */
	submitFeedback(options: MemoryFeedbackOptions): Promise<MemoryFeedbackResult>

	/**
	 * Set priority (0-5 stars) for a memory item.
	 */
	setPriority(options: MemoryPriorityOptions): Promise<MemoryPriorityResult>

	/**
	 * Check if the API is available.
	 */
	isAvailable(): Promise<boolean>
}
