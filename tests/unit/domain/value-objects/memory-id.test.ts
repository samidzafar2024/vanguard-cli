import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { MemoryId } from '../../../../src/domain/value-objects/memory-id.js'

describe('MemoryId', () => {
	describe('create', () => {
		it('should create from domain/slug format', () => {
			const id = MemoryId.create('patterns/api-errors')
			expect(id.domain).toBe('patterns')
			expect(id.topic).toBeUndefined()
			expect(id.slug).toBe('api-errors')
			expect(id.toString()).toBe('patterns/api-errors')
		})

		it('should create from domain/topic/slug format', () => {
			const id = MemoryId.create('patterns/error-handling/api-errors')
			expect(id.domain).toBe('patterns')
			expect(id.topic).toBe('error-handling')
			expect(id.slug).toBe('api-errors')
			expect(id.toString()).toBe('patterns/error-handling/api-errors')
		})

		it('should normalize to lowercase', () => {
			const id = MemoryId.create('Patterns/ERROR-Handling/API-Errors')
			expect(id.domain).toBe('patterns')
			expect(id.topic).toBe('error-handling')
			expect(id.slug).toBe('api-errors')
		})

		it('should trim whitespace', () => {
			const id = MemoryId.create('  patterns / api-errors  ')
			expect(id.domain).toBe('patterns')
			expect(id.slug).toBe('api-errors')
		})

		it('should reject empty strings', () => {
			expect(() => MemoryId.create('')).toThrow(InvalidValueError)
			expect(() => MemoryId.create('   ')).toThrow(InvalidValueError)
		})

		it('should reject single segment', () => {
			expect(() => MemoryId.create('patterns')).toThrow(InvalidValueError)
		})

		it('should reject more than 3 segments', () => {
			expect(() => MemoryId.create('a/b/c/d')).toThrow(InvalidValueError)
		})

		it('should reject empty segments', () => {
			expect(() => MemoryId.create('patterns//slug')).toThrow(InvalidValueError)
			expect(() => MemoryId.create('/patterns/slug')).toThrow(InvalidValueError)
			expect(() => MemoryId.create('patterns/slug/')).toThrow(InvalidValueError)
		})
	})

	describe('fromParts', () => {
		it('should create from individual parts without topic', () => {
			const id = MemoryId.fromParts('decisions', undefined, 'auth-strategy')
			expect(id.toString()).toBe('decisions/auth-strategy')
		})

		it('should create from individual parts with topic', () => {
			const id = MemoryId.fromParts('patterns', 'error-handling', 'api-errors')
			expect(id.toString()).toBe('patterns/error-handling/api-errors')
		})

		it('should reject invalid domain format', () => {
			expect(() => MemoryId.fromParts('123invalid', undefined, 'slug')).toThrow(InvalidValueError)
			expect(() => MemoryId.fromParts('with_underscore', undefined, 'slug')).toThrow(
				InvalidValueError,
			)
		})

		it('should reject invalid topic format', () => {
			expect(() => MemoryId.fromParts('domain', 'with spaces', 'slug')).toThrow(InvalidValueError)
		})

		it('should reject invalid slug format', () => {
			// Slugs can start with numbers (e.g., "003-auth-strategy")
			// But special characters are not allowed
			expect(() => MemoryId.fromParts('domain', undefined, 'with spaces')).toThrow(
				InvalidValueError,
			)
			expect(() => MemoryId.fromParts('domain', undefined, 'with_underscore')).toThrow(
				InvalidValueError,
			)
		})

		it('should reject domain longer than 32 characters', () => {
			const longDomain = 'a'.repeat(33)
			expect(() => MemoryId.fromParts(longDomain, undefined, 'slug')).toThrow(InvalidValueError)
		})

		it('should reject topic longer than 32 characters', () => {
			const longTopic = 'a'.repeat(33)
			expect(() => MemoryId.fromParts('domain', longTopic, 'slug')).toThrow(InvalidValueError)
		})

		it('should reject slug longer than 64 characters', () => {
			const longSlug = 'a'.repeat(65)
			expect(() => MemoryId.fromParts('domain', undefined, longSlug)).toThrow(InvalidValueError)
		})
	})

	describe('generate', () => {
		it('should generate slug from title', () => {
			const id = MemoryId.generate('patterns', undefined, 'API Error Handling')
			expect(id.domain).toBe('patterns')
			expect(id.slug).toBe('api-error-handling')
		})

		it('should generate slug with topic', () => {
			const id = MemoryId.generate('patterns', 'errors', 'API Error Handling')
			expect(id.toString()).toBe('patterns/errors/api-error-handling')
		})

		it('should handle special characters in title', () => {
			const id = MemoryId.generate('decisions', undefined, 'Use JWT (not sessions) for auth!')
			expect(id.slug).toBe('use-jwt-not-sessions-for-auth')
		})

		it('should truncate long titles', () => {
			const longTitle = 'A'.repeat(100)
			const id = MemoryId.generate('patterns', undefined, longTitle)
			expect(id.slug.length).toBeLessThanOrEqual(64)
		})

		it('should reject empty titles', () => {
			expect(() => MemoryId.generate('patterns', undefined, '')).toThrow(InvalidValueError)
			expect(() => MemoryId.generate('patterns', undefined, '   ')).toThrow(InvalidValueError)
		})

		it('should reject titles that become empty after slugification', () => {
			expect(() => MemoryId.generate('patterns', undefined, '!!!###')).toThrow(InvalidValueError)
		})
	})

	describe('equals', () => {
		it('should return true for equal IDs', () => {
			const id1 = MemoryId.create('patterns/api-errors')
			const id2 = MemoryId.create('patterns/api-errors')
			expect(id1.equals(id2)).toBe(true)
		})

		it('should return true for equal IDs with topic', () => {
			const id1 = MemoryId.create('patterns/errors/api-errors')
			const id2 = MemoryId.create('patterns/errors/api-errors')
			expect(id1.equals(id2)).toBe(true)
		})

		it('should return false for different domains', () => {
			const id1 = MemoryId.create('patterns/api-errors')
			const id2 = MemoryId.create('decisions/api-errors')
			expect(id1.equals(id2)).toBe(false)
		})

		it('should return false for different topics', () => {
			const id1 = MemoryId.create('patterns/a/api-errors')
			const id2 = MemoryId.create('patterns/b/api-errors')
			expect(id1.equals(id2)).toBe(false)
		})

		it('should return false for different slugs', () => {
			const id1 = MemoryId.create('patterns/api-errors')
			const id2 = MemoryId.create('patterns/db-errors')
			expect(id1.equals(id2)).toBe(false)
		})
	})

	describe('getFilePath', () => {
		it('should return correct path without topic', () => {
			const id = MemoryId.create('patterns/api-errors')
			expect(id.getFilePath('/base')).toBe('/base/patterns/api-errors.md')
		})

		it('should return correct path with topic', () => {
			const id = MemoryId.create('patterns/errors/api-errors')
			expect(id.getFilePath('/base')).toBe('/base/patterns/errors/api-errors.md')
		})

		it('should handle Windows-style paths', () => {
			const id = MemoryId.create('patterns/api-errors')
			expect(id.getFilePath('C:\\base')).toBe('C:\\base\\patterns\\api-errors.md')
		})
	})

	describe('getDirectory', () => {
		it('should return correct directory without topic', () => {
			const id = MemoryId.create('patterns/api-errors')
			expect(id.getDirectory('/base')).toBe('/base/patterns')
		})

		it('should return correct directory with topic', () => {
			const id = MemoryId.create('patterns/errors/api-errors')
			expect(id.getDirectory('/base')).toBe('/base/patterns/errors')
		})
	})
})
