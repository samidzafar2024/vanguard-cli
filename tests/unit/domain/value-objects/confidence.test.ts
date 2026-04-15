import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { Confidence } from '../../../../src/domain/value-objects/confidence.js'

describe('Confidence', () => {
	describe('create', () => {
		it('should create low confidence', () => {
			const confidence = Confidence.create('low')
			expect(confidence.level).toBe('low')
		})

		it('should create medium confidence', () => {
			const confidence = Confidence.create('medium')
			expect(confidence.level).toBe('medium')
		})

		it('should create high confidence', () => {
			const confidence = Confidence.create('high')
			expect(confidence.level).toBe('high')
		})

		it('should reject invalid confidence levels', () => {
			expect(() => Confidence.create('invalid' as any)).toThrow(InvalidValueError)
			expect(() => Confidence.create('very-high' as any)).toThrow(InvalidValueError)
		})
	})

	describe('fromScore', () => {
		it('should return low for scores 0.0-0.39', () => {
			expect(Confidence.fromScore(0).level).toBe('low')
			expect(Confidence.fromScore(0.2).level).toBe('low')
			expect(Confidence.fromScore(0.39).level).toBe('low')
		})

		it('should return medium for scores 0.4-0.69', () => {
			expect(Confidence.fromScore(0.4).level).toBe('medium')
			expect(Confidence.fromScore(0.5).level).toBe('medium')
			expect(Confidence.fromScore(0.69).level).toBe('medium')
		})

		it('should return high for scores 0.7-1.0', () => {
			expect(Confidence.fromScore(0.7).level).toBe('high')
			expect(Confidence.fromScore(0.9).level).toBe('high')
			expect(Confidence.fromScore(1.0).level).toBe('high')
		})

		it('should reject scores below 0', () => {
			expect(() => Confidence.fromScore(-0.1)).toThrow(InvalidValueError)
		})

		it('should reject scores above 1', () => {
			expect(() => Confidence.fromScore(1.1)).toThrow(InvalidValueError)
		})
	})

	describe('DEFAULT', () => {
		it('should be medium', () => {
			expect(Confidence.DEFAULT.level).toBe('medium')
		})
	})

	describe('isHigherThan', () => {
		it('should return true when higher', () => {
			const high = Confidence.create('high')
			const medium = Confidence.create('medium')
			const low = Confidence.create('low')

			expect(high.isHigherThan(medium)).toBe(true)
			expect(high.isHigherThan(low)).toBe(true)
			expect(medium.isHigherThan(low)).toBe(true)
		})

		it('should return false when equal', () => {
			const high1 = Confidence.create('high')
			const high2 = Confidence.create('high')

			expect(high1.isHigherThan(high2)).toBe(false)
		})

		it('should return false when lower', () => {
			const low = Confidence.create('low')
			const medium = Confidence.create('medium')
			const high = Confidence.create('high')

			expect(low.isHigherThan(medium)).toBe(false)
			expect(low.isHigherThan(high)).toBe(false)
			expect(medium.isHigherThan(high)).toBe(false)
		})
	})

	describe('isAtLeast', () => {
		it('should return true when at or above level', () => {
			const high = Confidence.create('high')
			const medium = Confidence.create('medium')
			const low = Confidence.create('low')

			expect(high.isAtLeast('high')).toBe(true)
			expect(high.isAtLeast('medium')).toBe(true)
			expect(high.isAtLeast('low')).toBe(true)

			expect(medium.isAtLeast('medium')).toBe(true)
			expect(medium.isAtLeast('low')).toBe(true)

			expect(low.isAtLeast('low')).toBe(true)
		})

		it('should return false when below level', () => {
			const low = Confidence.create('low')
			const medium = Confidence.create('medium')

			expect(low.isAtLeast('medium')).toBe(false)
			expect(low.isAtLeast('high')).toBe(false)
			expect(medium.isAtLeast('high')).toBe(false)
		})
	})

	describe('toScore', () => {
		it('should return 0.3 for low', () => {
			expect(Confidence.create('low').toScore()).toBe(0.3)
		})

		it('should return 0.6 for medium', () => {
			expect(Confidence.create('medium').toScore()).toBe(0.6)
		})

		it('should return 0.9 for high', () => {
			expect(Confidence.create('high').toScore()).toBe(0.9)
		})
	})

	describe('equals', () => {
		it('should return true for equal confidences', () => {
			const c1 = Confidence.create('high')
			const c2 = Confidence.create('high')
			expect(c1.equals(c2)).toBe(true)
		})

		it('should return false for different confidences', () => {
			const c1 = Confidence.create('high')
			const c2 = Confidence.create('low')
			expect(c1.equals(c2)).toBe(false)
		})
	})

	describe('toString', () => {
		it('should return the level string', () => {
			expect(Confidence.create('low').toString()).toBe('low')
			expect(Confidence.create('medium').toString()).toBe('medium')
			expect(Confidence.create('high').toString()).toBe('high')
		})
	})
})
