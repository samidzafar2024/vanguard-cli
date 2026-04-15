/**
 * Repository implementations.
 */

export { UnifiedTaskRepository } from './task.repository.js'
export { FileIntegrationRepository } from './integration.repository.js'
export { ExtensibleArchitectureRepository } from './architecture.repository.js'
export type { BuiltInArchitectureSource } from './architecture.repository.js'
export { ExtensibleStackRepository } from './stack.repository.js'
export type { BuiltInStackSource } from './stack.repository.js'
export { ExtensiblePatternRepository } from './pattern.repository.js'
export type { BuiltInPatternSource } from './pattern.repository.js'

// Memory Repositories
export { FileMemoryRepository } from './memory.repository.js'
export { FileMemoryConfigRepository } from './memory-config.repository.js'
