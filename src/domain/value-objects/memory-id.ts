import { InvalidValueError } from '../errors/domain-error.js'

/**
 * MemoryId value object - hierarchical identifier for memory items.
 * Format: domain/topic/slug or domain/slug
 *
 * Examples:
 * - patterns/error-handling/api-errors
 * - decisions/003-auth-strategy
 * - conventions/naming
 */
export class MemoryId {
	private static readonly SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
	private static readonly DOMAIN_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

	private constructor(
		public readonly domain: string,
		public readonly topic: string | undefined,
		public readonly slug: string,
	) {}

	/**
	 * Create from a full ID string (e.g., "patterns/error-handling/api-errors").
	 */
	static create(id: string): MemoryId {
		const trimmed = id.trim().toLowerCase()

		if (!trimmed) {
			throw new InvalidValueError('memory-id', id, 'Cannot be empty')
		}

		const parts = trimmed.split('/')

		if (parts.length < 2 || parts.length > 3) {
			throw new InvalidValueError(
				'memory-id',
				id,
				'Must be in format domain/slug or domain/topic/slug',
			)
		}

		if (parts.some((part) => !part)) {
			throw new InvalidValueError('memory-id', id, 'Cannot contain empty segments')
		}

		const [domain, ...rest] = parts as [string, ...string[]]
		const slug = rest.pop() as string
		const topic = rest.length > 0 ? rest[0] : undefined

		return MemoryId.fromParts(domain as string, topic, slug)
	}

	/**
	 * Create from individual parts.
	 */
	static fromParts(domain: string, topic: string | undefined, slug: string): MemoryId {
		const normalizedDomain = domain.toLowerCase().trim()
		const normalizedTopic = topic?.toLowerCase().trim()
		const normalizedSlug = slug.toLowerCase().trim()

		if (!MemoryId.DOMAIN_PATTERN.test(normalizedDomain)) {
			throw new InvalidValueError(
				'memory-id domain',
				domain,
				'Must be lowercase alphanumeric with optional hyphens (e.g., "patterns", "error-handling")',
			)
		}

		if (normalizedTopic && !MemoryId.DOMAIN_PATTERN.test(normalizedTopic)) {
			throw new InvalidValueError(
				'memory-id topic',
				topic,
				'Must be lowercase alphanumeric with optional hyphens',
			)
		}

		if (!MemoryId.SLUG_PATTERN.test(normalizedSlug)) {
			throw new InvalidValueError(
				'memory-id slug',
				slug,
				'Must be lowercase alphanumeric with optional hyphens (e.g., "api-errors")',
			)
		}

		if (normalizedDomain.length > 32) {
			throw new InvalidValueError('memory-id domain', domain, 'Cannot exceed 32 characters')
		}

		if (normalizedTopic && normalizedTopic.length > 32) {
			throw new InvalidValueError('memory-id topic', topic, 'Cannot exceed 32 characters')
		}

		if (normalizedSlug.length > 64) {
			throw new InvalidValueError('memory-id slug', slug, 'Cannot exceed 64 characters')
		}

		return new MemoryId(normalizedDomain, normalizedTopic, normalizedSlug)
	}

	/**
	 * Generate a MemoryId from a title (slugifies the title).
	 */
	static generate(domain: string, topic: string | undefined, title: string): MemoryId {
		const slug = title
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.substring(0, 64)

		if (!slug) {
			throw new InvalidValueError('memory-id title', title, 'Cannot generate slug from empty title')
		}

		return MemoryId.fromParts(domain, topic, slug)
	}

	/**
	 * Convert to string representation.
	 */
	toString(): string {
		if (this.topic) {
			return `${this.domain}/${this.topic}/${this.slug}`
		}
		return `${this.domain}/${this.slug}`
	}

	/**
	 * Check equality with another MemoryId.
	 */
	equals(other: MemoryId): boolean {
		return this.domain === other.domain && this.topic === other.topic && this.slug === other.slug
	}

	/**
	 * Get the file path for this memory item relative to a base path.
	 */
	getFilePath(basePath: string): string {
		const separator = basePath.includes('\\') ? '\\' : '/'
		if (this.topic) {
			return `${basePath}${separator}${this.domain}${separator}${this.topic}${separator}${this.slug}.md`
		}
		return `${basePath}${separator}${this.domain}${separator}${this.slug}.md`
	}

	/**
	 * Get the directory path for this memory item relative to a base path.
	 */
	getDirectory(basePath: string): string {
		const separator = basePath.includes('\\') ? '\\' : '/'
		if (this.topic) {
			return `${basePath}${separator}${this.domain}${separator}${this.topic}`
		}
		return `${basePath}${separator}${this.domain}`
	}
}
