export type {
	GeneratedFile,
	ConfigGenerator,
	VanguardGenerator,
} from './generator.js'

export type { WriteResult, FileWriter } from './file-writer.js'

export type {
	ProjectRepository,
	ArchitectureRepository,
	StackRepository,
	TaskRepository,
	TaskEntity,
	TaskStatus,
	IntegrationRepository,
	PatternRepository,
	TechPattern,
} from './repositories.js'

// Memory ports
export type {
	MemoryRepository,
	MemoryConfigRepository,
	MemoryQueryOptions,
} from './memory-repository.js'

export type { EmbeddingService } from './embedding-service.js'

export type {
	ContextApiClient,
	ProjectContextRequest,
	ProjectContextResponse,
} from './context-api-client.js'

export type { GitService } from './git-service.js'

export type {
	MemoryApiClient,
	MemorySearchResult,
	MemorySearchOptions,
	MemorySearchOutput,
	MemorySyncResult,
	MemorySyncStatus,
	MemorySyncItem,
	HookQueryOptions,
	HookQueryResult,
	GraphContextOptions,
	GraphContextResult,
	RemoteMemoryItem,
	MemoryPullResult,
} from './memory-api-client.js'

export type {
	InitSchemaApiClient,
	InitSchema,
	InitSchemaGroup,
	InitSchemaChoice,
} from './init-schema-api-client.js'
