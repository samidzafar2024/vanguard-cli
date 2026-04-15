import { InvalidValueError } from '../errors/domain-error.js'

/**
 * Source type for memory items - how they were created.
 */
export type MemorySourceType = 'manual' | 'auto-captured' | 'imported'

/**
 * MemorySource value object - represents the origin of a memory item.
 *
 * - manual: Created directly by user via CLI
 * - auto-captured: Extracted automatically from sessions
 * - imported: Imported from external sources (CLAUDE.md, ADRs, specs)
 */
export class MemorySource {
	private constructor(public readonly type: MemorySourceType) {}

	/**
	 * Create a MemorySource from a type string.
	 */
	static create(type: MemorySourceType): MemorySource {
		if (!['manual', 'auto-captured', 'imported'].includes(type)) {
			throw new InvalidValueError(
				'memory-source',
				type,
				'Must be one of: manual, auto-captured, imported',
			)
		}
		return new MemorySource(type)
	}

	/**
	 * Predefined source constants.
	 */
	static readonly MANUAL = new MemorySource('manual')
	static readonly AUTO_CAPTURED = new MemorySource('auto-captured')
	static readonly IMPORTED = new MemorySource('imported')

	/**
	 * Check if this is a manually created item.
	 */
	isManual(): boolean {
		return this.type === 'manual'
	}

	/**
	 * Check if this was auto-captured from a session.
	 */
	isAutoCaptured(): boolean {
		return this.type === 'auto-captured'
	}

	/**
	 * Check if this was imported from an external source.
	 */
	isImported(): boolean {
		return this.type === 'imported'
	}

	/**
	 * Check equality with another MemorySource.
	 */
	equals(other: MemorySource): boolean {
		return this.type === other.type
	}

	/**
	 * Convert to string representation.
	 */
	toString(): string {
		return this.type
	}
}
