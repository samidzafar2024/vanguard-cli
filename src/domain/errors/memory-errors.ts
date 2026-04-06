import { DomainError } from './domain-error.js'

export class MemoryContentTooLargeError extends DomainError {
	constructor(actualBytes: number, maxBytes: number) {
		super(
			'MEMORY_CONTENT_TOO_LARGE',
			`Memory item content is ${actualBytes} bytes, maximum is ${maxBytes} bytes (${Math.round(maxBytes / 1024)}KB)`,
		)
	}
}

export class InvalidMemoryRelationError extends DomainError {
	constructor(itemId: string, targetId: string, reason: string) {
		super(
			'INVALID_MEMORY_RELATION',
			`Cannot create relation from ${itemId} to ${targetId}: ${reason}`,
		)
	}
}

export class MemoryItemNotFoundError extends DomainError {
	constructor(id: string) {
		super('MEMORY_ITEM_NOT_FOUND', `Memory item not found: ${id}`)
	}
}
