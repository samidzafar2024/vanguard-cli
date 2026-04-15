import { InvalidValueError } from '../errors/domain-error.js'

/**
 * Identifier value object - used for slugified identifiers (stack ids, architecture ids, etc.)
 * Follows Unix principle: lowercase, hyphen-separated, alphanumeric only.
 */
export class Identifier {
	private static readonly PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

	private constructor(private readonly value: string) {}

	static create(value: string): Identifier {
		const normalized = value.toLowerCase().trim()

		if (!normalized) {
			throw new InvalidValueError('identifier', value, 'Cannot be empty')
		}

		if (!Identifier.PATTERN.test(normalized)) {
			throw new InvalidValueError(
				'identifier',
				value,
				'Must be lowercase alphanumeric with hyphens (e.g., "nextjs-shadcn")',
			)
		}

		if (normalized.length > 64) {
			throw new InvalidValueError('identifier', value, 'Cannot exceed 64 characters')
		}

		return new Identifier(normalized)
	}

	static fromString(value: string): Identifier {
		// Convert human-readable names to identifiers
		const slugified = value
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')

		return Identifier.create(slugified)
	}

	toString(): string {
		return this.value
	}

	equals(other: Identifier): boolean {
		return this.value === other.value
	}
}
