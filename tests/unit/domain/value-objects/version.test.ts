import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { Version } from '../../../../src/domain/value-objects/version.js'

describe('Version', () => {
	describe('create', () => {
		it('should create a full semver version', () => {
			const v = Version.create('1.2.3')
			expect(v.major).toBe(1)
			expect(v.minor).toBe(2)
			expect(v.patch).toBe(3)
			expect(v.toString()).toBe('1.2.3')
		})

		it('should create a major.minor version', () => {
			const v = Version.create('15.0')
			expect(v.major).toBe(15)
			expect(v.minor).toBe(0)
			expect(v.patch).toBeUndefined()
			expect(v.toString()).toBe('15.0')
		})

		it('should create a major-only version', () => {
			const v = Version.create('3')
			expect(v.major).toBe(3)
			expect(v.minor).toBeUndefined()
			expect(v.patch).toBeUndefined()
		})

		it('should handle caret constraint', () => {
			const v = Version.create('^15.0.0')
			expect(v.constraint).toBe('^')
			expect(v.major).toBe(15)
			expect(v.toString()).toBe('^15.0.0')
		})

		it('should handle tilde constraint', () => {
			const v = Version.create('~2.1.0')
			expect(v.constraint).toBe('~')
			expect(v.major).toBe(2)
		})

		it('should handle >= constraint', () => {
			const v = Version.create('>=3.11')
			expect(v.constraint).toBe('>=')
			expect(v.major).toBe(3)
			expect(v.minor).toBe(11)
		})

		it('should handle + as >= constraint', () => {
			const v = Version.create('0.110+')
			expect(v.constraint).toBe('>=')
			expect(v.major).toBe(0)
			expect(v.minor).toBe(110)
		})

		it('should trim whitespace', () => {
			const v = Version.create('  1.0.0  ')
			expect(v.toString()).toBe('1.0.0')
		})

		it('should reject empty strings', () => {
			expect(() => Version.create('')).toThrow(InvalidValueError)
		})

		it('should reject invalid version formats', () => {
			expect(() => Version.create('v1.0.0')).toThrow(InvalidValueError)
			expect(() => Version.create('1.0.0-beta')).toThrow(InvalidValueError)
			expect(() => Version.create('abc')).toThrow(InvalidValueError)
		})
	})

	describe('latest', () => {
		it('should create a latest version', () => {
			const v = Version.latest()
			expect(v.toString()).toBe('latest')
			expect(v.constraint).toBe('>=')
		})
	})

	describe('satisfies', () => {
		it('should satisfy exact version match', () => {
			const v1 = Version.create('1.2.3')
			const constraint = Version.create('1.2.3')
			expect(v1.satisfies(constraint)).toBe(true)
		})

		it('should not satisfy different versions without constraint', () => {
			const v1 = Version.create('1.2.4')
			const constraint = Version.create('1.2.3')
			expect(v1.satisfies(constraint)).toBe(false)
		})

		it('should satisfy caret constraint with same major', () => {
			const v1 = Version.create('1.5.0')
			const constraint = Version.create('^1.2.0')
			expect(v1.satisfies(constraint)).toBe(true)
		})

		it('should not satisfy caret constraint with different major', () => {
			const v1 = Version.create('2.0.0')
			const constraint = Version.create('^1.2.0')
			expect(v1.satisfies(constraint)).toBe(false)
		})

		it('should satisfy >= constraint', () => {
			const v1 = Version.create('3.12')
			const constraint = Version.create('>=3.11')
			expect(v1.satisfies(constraint)).toBe(true)
		})

		it('should always satisfy latest', () => {
			const v1 = Version.create('1.0.0')
			const constraint = Version.latest()
			expect(v1.satisfies(constraint)).toBe(true)
		})
	})

	describe('equals', () => {
		it('should return true for equal versions', () => {
			const v1 = Version.create('1.2.3')
			const v2 = Version.create('1.2.3')
			expect(v1.equals(v2)).toBe(true)
		})

		it('should return false for different versions', () => {
			const v1 = Version.create('1.2.3')
			const v2 = Version.create('1.2.4')
			expect(v1.equals(v2)).toBe(false)
		})

		it('should compare raw strings including constraints', () => {
			const v1 = Version.create('^1.2.3')
			const v2 = Version.create('1.2.3')
			expect(v1.equals(v2)).toBe(false)
		})
	})
})
