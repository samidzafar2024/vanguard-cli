// Memory Use Cases
export { InitMemoryUseCase } from './init-memory.use-case.js'
export type { InitMemoryInput, InitMemoryOutput } from './init-memory.use-case.js'

export { AddMemoryItemUseCase } from './add-memory-item.use-case.js'
export type { AddMemoryItemInput, AddMemoryItemOutput } from './add-memory-item.use-case.js'

export { ListMemoryItemsUseCase } from './list-memory-items.use-case.js'
export type { ListMemoryItemsInput, ListMemoryItemsOutput } from './list-memory-items.use-case.js'

export { GetMemoryItemUseCase } from './get-memory-item.use-case.js'
export type { GetMemoryItemInput, GetMemoryItemOutput } from './get-memory-item.use-case.js'

export { UpdateMemoryItemUseCase } from './update-memory-item.use-case.js'
export type {
	UpdateMemoryItemInput,
	UpdateMemoryItemOutput,
} from './update-memory-item.use-case.js'

export { DeleteMemoryItemUseCase } from './delete-memory-item.use-case.js'
export type {
	DeleteMemoryItemInput,
	DeleteMemoryItemOutput,
} from './delete-memory-item.use-case.js'

export { PushMemoryUseCase } from './push-memory.use-case.js'
export type {
	PushMemoryInput,
	PushMemoryOutput,
	PushProgressCallback,
} from './push-memory.use-case.js'

export { PullMemoryUseCase } from './pull-memory.use-case.js'
export type {
	PullMemoryInput,
	PullMemoryOutput,
	PullProgressCallback,
} from './pull-memory.use-case.js'

// Legacy alias for backwards compatibility
export { PushMemoryUseCase as SyncMemoryUseCase } from './push-memory.use-case.js'
export type {
	PushMemoryInput as SyncMemoryInput,
	PushMemoryOutput as SyncMemoryOutput,
	PushProgressCallback as SyncProgressCallback,
} from './push-memory.use-case.js'

export { SearchMemoryUseCase } from './search-memory.use-case.js'
export type { SearchMemoryInput, SearchMemoryOutput } from './search-memory.use-case.js'

export { ImportMemoryUseCase } from './import-memory.use-case.js'
export type {
	ImportMemoryInput,
	ImportMemoryOutput,
	ParsedKnowledgeItem,
} from './import-memory.use-case.js'
