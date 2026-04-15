import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { ContentHash } from '../../../../src/domain/value-objects/content-hash.js'

describe('ContentHash', () => {
	// Known SHA256 hash for "test content"
	const KNOWN_HASH = '6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72'

	describe('create', () => {
		it('should create from valid hash string', () => {
			const hash = ContentHash.create(KNOWN_HASH)
			expect(hash.value).toBe(KNOWN_HASH)
		})

		it('should normalize to lowercase', () => {
			const hash = ContentHash.create(KNOWN_HASH.toUpperCase())
			expect(hash.value).toBe(KNOWN_HASH)
		})

		it('should trim whitespace', () => {
			const hash = ContentHash.create(`  ${KNOWN_HASH}  `)
			expect(hash.value).toBe(KNOWN_HASH)
		})

		it('should reject invalid hash format', () => {
			expect(() => ContentHash.create('invalid')).toThrow(InvalidValueError)
			expect(() => ContentHash.create('abc123')).toThrow(InvalidValueError)
		})

		it('should reject hash with wrong length', () => {
			const shortHash = 'a'.repeat(63)
			const longHash = 'a'.repeat(65)
			expect(() => ContentHash.create(shortHash)).toThrow(InvalidValueError)
			expect(() => ContentHash.create(longHash)).toThrow(InvalidValueError)
		})

		it('should reject hash with non-hex characters', () => {
			const invalidHash = 'g'.repeat(64) // 'g' is not hex
			expect(() => ContentHash.create(invalidHash)).toThrow(InvalidValueError)
		})
	})

	describe('fromContent', () => {
		it('should generate hash from content', () => {
			const hash = ContentHash.fromContent('test content')
			expect(hash.value).toBe(KNOWN_HASH)
		})

		it('should generate different hashes for different content', () => {
			const hash1 = ContentHash.fromContent('content 1')
			const hash2 = ContentHash.fromContent('content 2')
			expect(hash1.equals(hash2)).toBe(false)
		})

		it('should generate same hash for same content', () => {
			const hash1 = ContentHash.fromContent('same content')
			const hash2 = ContentHash.fromContent('same content')
			expect(hash1.equals(hash2)).toBe(true)
		})

		it('should handle empty content', () => {
			const hash = ContentHash.fromContent('')
			// SHA256 of empty string
			expect(hash.value).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
		})

		it('should handle unicode content', () => {
			const hash = ContentHash.fromContent('こんにちは')
			expect(hash.value).toHaveLength(64)
		})
	})

	describe('equals', () => {
		it('should return true for equal hashes', () => {
			const hash1 = ContentHash.fromContent('test')
			const hash2 = ContentHash.fromContent('test')
			expect(hash1.equals(hash2)).toBe(true)
		})

		it('should return false for different hashes', () => {
			const hash1 = ContentHash.fromContent('test1')
			const hash2 = ContentHash.fromContent('test2')
			expect(hash1.equals(hash2)).toBe(false)
		})
	})

	describe('toString', () => {
		it('should return the full hash', () => {
			const hash = ContentHash.create(KNOWN_HASH)
			expect(hash.toString()).toBe(KNOWN_HASH)
		})
	})

	describe('toShort', () => {
		it('should return first 8 characters', () => {
			const hash = ContentHash.create(KNOWN_HASH)
			expect(hash.toShort()).toBe('6ae8a755')
		})
	})
})
