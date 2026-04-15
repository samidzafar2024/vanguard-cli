import { InvalidValueError } from '../errors/domain-error.js'

/**
 * SemVer version value object with optional constraint support.
 * Examples: "1.0.0", "^15.0.0", ">=3.11", "0.110+"
 */
export class Version {
	private static readonly SEMVER_PATTERN = /^(\^|~|>=|<=|>|<)?(\d+)(?:\.(\d+))?(?:\.(\d+))?(\+)?$/

	private constructor(
		public readonly major: number,
		public readonly minor: number | undefined,
		public readonly patch: number | undefined,
		public readonly constraint: string | undefined,
		public readonly raw: string,
	) {}

	static create(value: string): Version {
		const trimmed = value.trim()

		if (!trimmed) {
			throw new InvalidValueError('version', value, 'Cannot be empty')
		}

		const match = Version.SEMVER_PATTERN.exec(trimmed)
		if (!match) {
			throw new InvalidValueError(
				'version',
				value,
				'Must be a valid semver (e.g., "1.0.0", "^15.0", ">=3.11")',
			)
		}

		const [, constraint, major, minor, patch, plus] = match

		return new Version(
			Number.parseInt(major ?? '0', 10),
			minor !== undefined ? Number.parseInt(minor, 10) : undefined,
			patch !== undefined ? Number.parseInt(patch, 10) : undefined,
			constraint ?? (plus ? '>=' : undefined),
			trimmed,
		)
	}

	static latest(): Version {
		return new Version(0, 0, 0, '>=', 'latest')
	}

	toString(): string {
		return this.raw
	}

	/**
	 * Check if this version satisfies a constraint.
	 * Simplified implementation - in production would use semver library.
	 */
	satisfies(constraint: Version): boolean {
		if (constraint.raw === 'latest') return true

		const thisNum = this.toNumber()
		const constraintNum = constraint.toNumber()

		switch (constraint.constraint) {
			case '^':
				return this.major === constraint.major && thisNum >= constraintNum
			case '~':
				return (
					this.major === constraint.major &&
					this.minor === constraint.minor &&
					thisNum >= constraintNum
				)
			case '>=':
				return thisNum >= constraintNum
			case '<=':
				return thisNum <= constraintNum
			case '>':
				return thisNum > constraintNum
			case '<':
				return thisNum < constraintNum
			default:
				return thisNum === constraintNum
		}
	}

	private toNumber(): number {
		return this.major * 10000 + (this.minor ?? 0) * 100 + (this.patch ?? 0)
	}

	equals(other: Version): boolean {
		return this.raw === other.raw
	}
}
