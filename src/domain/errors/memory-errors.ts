import { DomainError } from './domain-error.js'

/**
 * Error thrown when a memory item is not found.
 */
export class MemoryNotFoundError extends DomainError {
	constructor(id: string) {
		super('MEMORY_NOT_FOUND', `Memory item not found: ${id}`)
	}
}

/**
 * Error thrown when a memory ID is invalid.
 */
export class InvalidMemoryIdError extends DomainError {
	constructor(id: string, reason: string) {
		super('INVALID_MEMORY_ID', `Invalid memory ID "${id}": ${reason}`)
	}
}

/**
 * Error thrown when memory content exceeds size limits.
 */
export class MemoryContentTooLargeError extends DomainError {
	constructor(sizeBytes: number, maxBytes: number) {
		super(
			'MEMORY_CONTENT_TOO_LARGE',
			`Memory content exceeds maximum size: ${sizeBytes} bytes (max: ${maxBytes} bytes)`,
		)
	}
}

/**
 * Error thrown when a duplicate memory item is detected.
 */
export class DuplicateMemoryError extends DomainError {
	constructor(id: string) {
		super('DUPLICATE_MEMORY', `Memory item already exists: ${id}`)
	}
}

/**
 * Error thrown when memory configuration is invalid.
 */
export class InvalidMemoryConfigError extends DomainError {
	constructor(reason: string) {
		super('INVALID_MEMORY_CONFIG', `Invalid memory configuration: ${reason}`)
	}
}

/**
 * Error thrown when memory initialization fails.
 */
export class MemoryInitializationError extends DomainError {
	constructor(reason: string) {
		super('MEMORY_INIT_FAILED', `Failed to initialize memory: ${reason}`)
	}
}

/**
 * Error thrown when memory sync fails.
 */
export class MemorySyncError extends DomainError {
	constructor(reason: string) {
		super('MEMORY_SYNC_FAILED', `Memory sync failed: ${reason}`)
	}
}

/**
 * Error thrown when a memory relation is invalid.
 */
export class InvalidMemoryRelationError extends DomainError {
	constructor(fromId: string, toId: string, reason: string) {
		super('INVALID_MEMORY_RELATION', `Invalid relation from "${fromId}" to "${toId}": ${reason}`)
	}
}
