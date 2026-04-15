import { describe, expect, it } from 'vitest'
import {
	ConfigurationError,
	DomainError,
	EntityNotFoundError,
	IncompatibleSelectionError,
	InvalidValueError,
} from '../../../../src/domain/errors/domain-error.js'

describe('DomainError', () => {
	describe('InvalidValueError', () => {
		it('should create error with field, value, and reason', () => {
			const error = new InvalidValueError('email', 'invalid', 'Must be a valid email')

			expect(error.code).toBe('INVALID_VALUE')
			expect(error.message).toBe('Invalid email: "invalid". Must be a valid email')
			expect(error.name).toBe('InvalidValueError')
		})

		it('should convert non-string values to strings', () => {
			const error = new InvalidValueError('count', 42, 'Must be positive')

			expect(error.message).toContain('"42"')
		})

		it('should be an instance of Error and DomainError', () => {
			const error = new InvalidValueError('field', 'value', 'reason')

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(DomainError)
		})
	})

	describe('EntityNotFoundError', () => {
		it('should create error with entity type and identifier', () => {
			const error = new EntityNotFoundError('Stack', 'nextjs-shadcn')

			expect(error.code).toBe('ENTITY_NOT_FOUND')
			expect(error.message).toBe('Stack not found: nextjs-shadcn')
			expect(error.name).toBe('EntityNotFoundError')
		})
	})

	describe('IncompatibleSelectionError', () => {
		it('should create error with selection and incompatibility details', () => {
			const error = new IncompatibleSelectionError(
				'Prisma',
				'Python FastAPI',
				'Prisma only supports TypeScript/JavaScript',
			)

			expect(error.code).toBe('INCOMPATIBLE_SELECTION')
			expect(error.message).toBe(
				'Prisma is incompatible with Python FastAPI: Prisma only supports TypeScript/JavaScript',
			)
			expect(error.name).toBe('IncompatibleSelectionError')
		})
	})

	describe('ConfigurationError', () => {
		it('should create error with message', () => {
			const error = new ConfigurationError('Missing required field: stack')

			expect(error.code).toBe('CONFIGURATION_ERROR')
			expect(error.message).toBe('Missing required field: stack')
			expect(error.name).toBe('ConfigurationError')
		})
	})

	describe('Error stack trace', () => {
		it('should have stack trace', () => {
			const error = new InvalidValueError('field', 'value', 'reason')

			expect(error.stack).toBeDefined()
			expect(error.stack).toContain('InvalidValueError')
		})
	})
})
