import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { MemorySource } from '../../../../src/domain/value-objects/memory-source.js'

describe('MemorySource', () => {
	describe('create', () => {
		it('should create manual source', () => {
			const source = MemorySource.create('manual')
			expect(source.type).toBe('manual')
		})

		it('should create auto-captured source', () => {
			const source = MemorySource.create('auto-captured')
			expect(source.type).toBe('auto-captured')
		})

		it('should create imported source', () => {
			const source = MemorySource.create('imported')
			expect(source.type).toBe('imported')
		})

		it('should reject invalid source types', () => {
			expect(() => MemorySource.create('invalid' as any)).toThrow(InvalidValueError)
			expect(() => MemorySource.create('auto' as any)).toThrow(InvalidValueError)
		})
	})

	describe('static constants', () => {
		it('should have MANUAL constant', () => {
			expect(MemorySource.MANUAL.type).toBe('manual')
		})

		it('should have AUTO_CAPTURED constant', () => {
			expect(MemorySource.AUTO_CAPTURED.type).toBe('auto-captured')
		})

		it('should have IMPORTED constant', () => {
			expect(MemorySource.IMPORTED.type).toBe('imported')
		})
	})

	describe('type checks', () => {
		it('isManual should return true only for manual', () => {
			expect(MemorySource.MANUAL.isManual()).toBe(true)
			expect(MemorySource.AUTO_CAPTURED.isManual()).toBe(false)
			expect(MemorySource.IMPORTED.isManual()).toBe(false)
		})

		it('isAutoCaptured should return true only for auto-captured', () => {
			expect(MemorySource.MANUAL.isAutoCaptured()).toBe(false)
			expect(MemorySource.AUTO_CAPTURED.isAutoCaptured()).toBe(true)
			expect(MemorySource.IMPORTED.isAutoCaptured()).toBe(false)
		})

		it('isImported should return true only for imported', () => {
			expect(MemorySource.MANUAL.isImported()).toBe(false)
			expect(MemorySource.AUTO_CAPTURED.isImported()).toBe(false)
			expect(MemorySource.IMPORTED.isImported()).toBe(true)
		})
	})

	describe('equals', () => {
		it('should return true for equal sources', () => {
			const s1 = MemorySource.create('manual')
			const s2 = MemorySource.create('manual')
			expect(s1.equals(s2)).toBe(true)
		})

		it('should return false for different sources', () => {
			const s1 = MemorySource.create('manual')
			const s2 = MemorySource.create('imported')
			expect(s1.equals(s2)).toBe(false)
		})
	})

	describe('toString', () => {
		it('should return the type string', () => {
			expect(MemorySource.MANUAL.toString()).toBe('manual')
			expect(MemorySource.AUTO_CAPTURED.toString()).toBe('auto-captured')
			expect(MemorySource.IMPORTED.toString()).toBe('imported')
		})
	})
})
