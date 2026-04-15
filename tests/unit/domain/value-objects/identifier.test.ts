import { describe, expect, it } from 'vitest'
import { InvalidValueError } from '../../../../src/domain/errors/domain-error.js'
import { Identifier } from '../../../../src/domain/value-objects/identifier.js'

describe('Identifier', () => {
	describe('create', () => {
		it('should create a valid identifier from lowercase string', () => {
			const id = Identifier.create('nextjs-shadcn')
			expect(id.toString()).toBe('nextjs-shadcn')
		})

		it('should normalize uppercase to lowercase', () => {
			const id = Identifier.create('NextJS-Shadcn')
			expect(id.toString()).toBe('nextjs-shadcn')
		})

		it('should trim whitespace', () => {
			const id = Identifier.create('  fastapi  ')
			expect(id.toString()).toBe('fastapi')
		})

		it('should accept single word identifiers', () => {
			const id = Identifier.create('python')
			expect(id.toString()).toBe('python')
		})

		it('should accept identifiers with numbers', () => {
			const id = Identifier.create('vue3-composition')
			expect(id.toString()).toBe('vue3-composition')
		})

		it('should reject empty strings', () => {
			expect(() => Identifier.create('')).toThrow(InvalidValueError)
			expect(() => Identifier.create('   ')).toThrow(InvalidValueError)
		})

		it('should reject identifiers starting with numbers', () => {
			expect(() => Identifier.create('3vue')).toThrow(InvalidValueError)
		})

		it('should reject identifiers with special characters', () => {
			expect(() => Identifier.create('next.js')).toThrow(InvalidValueError)
			expect(() => Identifier.create('next_js')).toThrow(InvalidValueError)
			expect(() => Identifier.create('next@js')).toThrow(InvalidValueError)
		})

		it('should reject identifiers with consecutive hyphens', () => {
			expect(() => Identifier.create('next--js')).toThrow(InvalidValueError)
		})

		it('should reject identifiers starting or ending with hyphens', () => {
			expect(() => Identifier.create('-nextjs')).toThrow(InvalidValueError)
			expect(() => Identifier.create('nextjs-')).toThrow(InvalidValueError)
		})

		it('should reject identifiers longer than 64 characters', () => {
			const longId = 'a'.repeat(65)
			expect(() => Identifier.create(longId)).toThrow(InvalidValueError)
		})

		it('should accept identifiers exactly 64 characters', () => {
			const maxId = 'a'.repeat(64)
			const id = Identifier.create(maxId)
			expect(id.toString()).toBe(maxId)
		})
	})

	describe('fromString', () => {
		it('should convert human-readable names to identifiers', () => {
			const id = Identifier.fromString('Next.js + Shadcn')
			expect(id.toString()).toBe('next-js-shadcn')
		})

		it('should handle multiple spaces', () => {
			const id = Identifier.fromString('Python   FastAPI')
			expect(id.toString()).toBe('python-fastapi')
		})

		it('should handle special characters', () => {
			const id = Identifier.fromString('ASP.NET Core (MVC)')
			expect(id.toString()).toBe('asp-net-core-mvc')
		})

		it('should trim leading/trailing hyphens after conversion', () => {
			const id = Identifier.fromString('...Test String...')
			expect(id.toString()).toBe('test-string')
		})
	})

	describe('equals', () => {
		it('should return true for equal identifiers', () => {
			const id1 = Identifier.create('fastapi')
			const id2 = Identifier.create('fastapi')
			expect(id1.equals(id2)).toBe(true)
		})

		it('should return false for different identifiers', () => {
			const id1 = Identifier.create('fastapi')
			const id2 = Identifier.create('django')
			expect(id1.equals(id2)).toBe(false)
		})

		it('should compare normalized values', () => {
			const id1 = Identifier.create('FastAPI')
			const id2 = Identifier.create('fastapi')
			expect(id1.equals(id2)).toBe(true)
		})
	})
})
