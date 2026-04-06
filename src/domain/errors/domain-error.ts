/**
 * Base class for all domain errors.
 * Domain errors represent business rule violations.
 */
export abstract class DomainError extends Error {
	public readonly code: string

	constructor(code: string, message: string) {
		super(message)
		this.code = code
		this.name = this.constructor.name
		Error.captureStackTrace(this, this.constructor)
	}
}

export class InvalidValueError extends DomainError {
	constructor(field: string, value: unknown, reason: string) {
		super('INVALID_VALUE', `Invalid ${field}: "${String(value)}". ${reason}`)
	}
}

export class EntityNotFoundError extends DomainError {
	constructor(entityType: string, identifier: string) {
		super('ENTITY_NOT_FOUND', `${entityType} not found: ${identifier}`)
	}
}

export class IncompatibleSelectionError extends DomainError {
	constructor(selection: string, incompatibleWith: string, reason: string) {
		super(
			'INCOMPATIBLE_SELECTION',
			`${selection} is incompatible with ${incompatibleWith}: ${reason}`,
		)
	}
}

export class ConfigurationError extends DomainError {
	constructor(message: string) {
		super('CONFIGURATION_ERROR', message)
	}
}
