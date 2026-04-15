import { InvalidValueError } from '../errors/domain-error.js'

/**
 * Confidence level for memory items.
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high'

const CONFIDENCE_SCORES: Record<ConfidenceLevel, number> = {
	low: 0.3,
	medium: 0.6,
	high: 0.9,
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
	low: 0,
	medium: 1,
	high: 2,
}

/**
 * Confidence value object - represents confidence level with validation and comparison.
 * Used to indicate how reliable a memory item is.
 */
export class Confidence {
	private constructor(public readonly level: ConfidenceLevel) {}

	/**
	 * Create a Confidence from a level string.
	 */
	static create(level: ConfidenceLevel): Confidence {
		if (!['low', 'medium', 'high'].includes(level)) {
			throw new InvalidValueError('confidence', level, 'Must be one of: low, medium, high')
		}
		return new Confidence(level)
	}

	/**
	 * Create Confidence from a numeric score (0-1).
	 * - 0.0 - 0.4: low
	 * - 0.4 - 0.7: medium
	 * - 0.7 - 1.0: high
	 */
	static fromScore(score: number): Confidence {
		if (score < 0 || score > 1) {
			throw new InvalidValueError('confidence score', score, 'Must be between 0 and 1')
		}

		if (score < 0.4) {
			return new Confidence('low')
		}
		if (score < 0.7) {
			return new Confidence('medium')
		}
		return new Confidence('high')
	}

	/**
	 * Default confidence level.
	 */
	static readonly DEFAULT = new Confidence('medium')

	/**
	 * Check if this confidence is higher than another.
	 */
	isHigherThan(other: Confidence): boolean {
		return CONFIDENCE_ORDER[this.level] > CONFIDENCE_ORDER[other.level]
	}

	/**
	 * Check if this confidence is at least the given level.
	 */
	isAtLeast(level: ConfidenceLevel): boolean {
		return CONFIDENCE_ORDER[this.level] >= CONFIDENCE_ORDER[level]
	}

	/**
	 * Convert to a numeric score.
	 */
	toScore(): number {
		return CONFIDENCE_SCORES[this.level]
	}

	/**
	 * Check equality with another Confidence.
	 */
	equals(other: Confidence): boolean {
		return this.level === other.level
	}

	/**
	 * Convert to string representation.
	 */
	toString(): string {
		return this.level
	}
}
