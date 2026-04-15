import { InvalidMemoryRelationError, MemoryContentTooLargeError } from '../errors/memory-errors.js'
import { Confidence, type ConfidenceLevel } from '../value-objects/confidence.js'
import { ContentHash } from '../value-objects/content-hash.js'
import type { MemoryId } from '../value-objects/memory-id.js'
import { MemorySource, type MemorySourceType } from '../value-objects/memory-source.js'

/**
 * Context for auto-captured memory items.
 */
export interface CaptureContext {
	readonly sessionId?: string
	readonly sourceFiles?: readonly string[]
	readonly confidenceScore?: number
}

/**
 * Maximum content size in bytes (50KB as per specification).
 */
const MAX_CONTENT_SIZE = 50 * 1024

/**
 * MemoryItem entity - aggregate root for memory items.
 *
 * Represents a single piece of project knowledge with its metadata,
 * content, and relations to other memory items.
 */
export class MemoryItem {
	private constructor(
		public readonly id: MemoryId,
		public readonly title: string,
		public readonly content: string,
		public readonly contentHash: ContentHash,
		public readonly domain: string,
		public readonly topic: string | undefined,
		public readonly subtopic: string | undefined,
		public readonly confidence: Confidence,
		public readonly source: MemorySource,
		public readonly author: string | undefined,
		public readonly tags: readonly string[],
		public readonly relations: readonly string[],
		public readonly captureContext: CaptureContext | undefined,
		public readonly createdAt: Date,
		public readonly updatedAt: Date,
	) {}

	/**
	 * Create a new MemoryItem.
	 */
	static create(params: {
		id: MemoryId
		title: string
		content: string
		domain: string
		topic?: string
		subtopic?: string
		confidence?: Confidence | ConfidenceLevel
		source?: MemorySource | MemorySourceType
		author?: string
		tags?: readonly string[]
		relations?: readonly string[]
		captureContext?: CaptureContext
	}): MemoryItem {
		const contentBytes = Buffer.byteLength(params.content, 'utf8')
		if (contentBytes > MAX_CONTENT_SIZE) {
			throw new MemoryContentTooLargeError(contentBytes, MAX_CONTENT_SIZE)
		}

		const confidence =
			params.confidence instanceof Confidence
				? params.confidence
				: params.confidence
					? Confidence.create(params.confidence)
					: Confidence.DEFAULT

		const source =
			params.source instanceof MemorySource
				? params.source
				: params.source
					? MemorySource.create(params.source)
					: MemorySource.MANUAL

		const normalizedTags = MemoryItem.normalizeTags(params.tags ?? [])
		const normalizedRelations = MemoryItem.normalizeRelations(params.relations ?? [])

		const now = new Date()

		return new MemoryItem(
			params.id,
			params.title.trim(),
			params.content,
			ContentHash.fromContent(params.content),
			params.domain,
			params.topic,
			params.subtopic,
			confidence,
			source,
			params.author?.trim(),
			normalizedTags,
			normalizedRelations,
			params.captureContext,
			now,
			now,
		)
	}

	/**
	 * Reconstitute a MemoryItem from persisted data (no validation, already validated).
	 */
	static reconstitute(params: {
		id: MemoryId
		title: string
		content: string
		contentHash: ContentHash
		domain: string
		topic?: string
		subtopic?: string
		confidence: Confidence
		source: MemorySource
		author?: string
		tags: readonly string[]
		relations: readonly string[]
		captureContext?: CaptureContext
		createdAt: Date
		updatedAt: Date
	}): MemoryItem {
		return new MemoryItem(
			params.id,
			params.title,
			params.content,
			params.contentHash,
			params.domain,
			params.topic,
			params.subtopic,
			params.confidence,
			params.source,
			params.author,
			params.tags,
			params.relations,
			params.captureContext,
			params.createdAt,
			params.updatedAt,
		)
	}

	/**
	 * Update the content of this memory item.
	 * Returns a new MemoryItem with updated content and hash.
	 */
	updateContent(content: string): MemoryItem {
		const contentBytes = Buffer.byteLength(content, 'utf8')
		if (contentBytes > MAX_CONTENT_SIZE) {
			throw new MemoryContentTooLargeError(contentBytes, MAX_CONTENT_SIZE)
		}

		return new MemoryItem(
			this.id,
			this.title,
			content,
			ContentHash.fromContent(content),
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			this.tags,
			this.relations,
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Update the title of this memory item.
	 */
	updateTitle(title: string): MemoryItem {
		return new MemoryItem(
			this.id,
			title.trim(),
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			this.tags,
			this.relations,
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Update the confidence level.
	 */
	updateConfidence(confidence: Confidence | ConfidenceLevel): MemoryItem {
		const newConfidence =
			confidence instanceof Confidence ? confidence : Confidence.create(confidence)

		return new MemoryItem(
			this.id,
			this.title,
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			newConfidence,
			this.source,
			this.author,
			this.tags,
			this.relations,
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Add a tag to this memory item.
	 */
	addTag(tag: string): MemoryItem {
		const normalizedTag = tag.toLowerCase().trim()
		if (this.tags.includes(normalizedTag)) {
			return this
		}

		return new MemoryItem(
			this.id,
			this.title,
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			[...this.tags, normalizedTag],
			this.relations,
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Remove a tag from this memory item.
	 */
	removeTag(tag: string): MemoryItem {
		const normalizedTag = tag.toLowerCase().trim()
		if (!this.tags.includes(normalizedTag)) {
			return this
		}

		return new MemoryItem(
			this.id,
			this.title,
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			this.tags.filter((t) => t !== normalizedTag),
			this.relations,
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Add a relation to another memory item.
	 */
	addRelation(itemId: string): MemoryItem {
		const normalizedId = itemId.toLowerCase().trim()

		if (normalizedId === this.id.toString()) {
			throw new InvalidMemoryRelationError(this.id.toString(), itemId, 'Cannot relate to itself')
		}

		if (this.relations.includes(normalizedId)) {
			return this
		}

		return new MemoryItem(
			this.id,
			this.title,
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			this.tags,
			[...this.relations, normalizedId],
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Remove a relation to another memory item.
	 */
	removeRelation(itemId: string): MemoryItem {
		const normalizedId = itemId.toLowerCase().trim()
		if (!this.relations.includes(normalizedId)) {
			return this
		}

		return new MemoryItem(
			this.id,
			this.title,
			this.content,
			this.contentHash,
			this.domain,
			this.topic,
			this.subtopic,
			this.confidence,
			this.source,
			this.author,
			this.tags,
			this.relations.filter((r) => r !== normalizedId),
			this.captureContext,
			this.createdAt,
			new Date(),
		)
	}

	/**
	 * Check if this item has a relation to another item.
	 */
	hasRelationTo(itemId: string): boolean {
		return this.relations.includes(itemId.toLowerCase().trim())
	}

	/**
	 * Check if this item matches a domain filter.
	 */
	matchesDomain(domain: string): boolean {
		return this.domain === domain.toLowerCase().trim()
	}

	/**
	 * Check if this item has a specific tag.
	 */
	hasTag(tag: string): boolean {
		return this.tags.includes(tag.toLowerCase().trim())
	}

	/**
	 * Check if content has changed (hash differs).
	 */
	hasContentChanged(newContent: string): boolean {
		const newHash = ContentHash.fromContent(newContent)
		return !this.contentHash.equals(newHash)
	}

	/**
	 * Get the full hierarchy path (domain/topic/subtopic).
	 */
	getHierarchyPath(): string {
		const parts = [this.domain]
		if (this.topic) parts.push(this.topic)
		if (this.subtopic) parts.push(this.subtopic)
		return parts.join('/')
	}

	private static normalizeTags(tags: readonly string[]): readonly string[] {
		const normalized = tags.map((t) => t.toLowerCase().trim()).filter((t) => t.length > 0)

		return [...new Set(normalized)]
	}

	private static normalizeRelations(relations: readonly string[]): readonly string[] {
		const normalized = relations.map((r) => r.toLowerCase().trim()).filter((r) => r.length > 0)

		return [...new Set(normalized)]
	}
}
