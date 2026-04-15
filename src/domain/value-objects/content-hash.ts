import { createHash } from 'node:crypto'
import { InvalidValueError } from '../errors/domain-error.js'

/**
 * ContentHash value object - SHA256 hash for change detection.
 * Used to track if memory item content has changed.
 */
export class ContentHash {
	private static readonly HASH_PATTERN = /^[a-f0-9]{64}$/

	private constructor(public readonly value: string) {}

	/**
	 * Create a ContentHash from an existing hash string.
	 */
	static create(hash: string): ContentHash {
		const normalized = hash.toLowerCase().trim()

		if (!ContentHash.HASH_PATTERN.test(normalized)) {
			throw new InvalidValueError(
				'content-hash',
				hash,
				'Must be a valid SHA256 hash (64 hex characters)',
			)
		}

		return new ContentHash(normalized)
	}

	/**
	 * Generate a ContentHash from content string.
	 */
	static fromContent(content: string): ContentHash {
		const hash = createHash('sha256').update(content, 'utf8').digest('hex')
		return new ContentHash(hash)
	}

	/**
	 * Check equality with another ContentHash.
	 */
	equals(other: ContentHash): boolean {
		return this.value === other.value
	}

	/**
	 * Convert to string representation.
	 */
	toString(): string {
		return this.value
	}

	/**
	 * Get a short version of the hash (first 8 characters).
	 */
	toShort(): string {
		return this.value.substring(0, 8)
	}
}
