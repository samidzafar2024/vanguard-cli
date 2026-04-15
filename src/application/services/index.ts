export { ManifestGeneratorService } from './manifest-generator.service.js'
export { ConfigGeneratorService, VanguardGeneratorService } from './vanguard-generator.service.js'
export { IntegrationService } from './integration.service.js'
export type { StartTaskResult, ActiveTaskContext } from './integration.service.js'
export { TaskQueueService, DEFAULT_QUEUE_CONFIG } from './task-queue.service.js'
export type { TaskQueueConfig, NextTaskResult } from './task-queue.service.js'
export { ProjectRegistrationService } from './project-registration.service.js'
export type {
	ProjectRegistrationPayload,
	ProjectRegistrationResult,
} from './project-registration.service.js'

export { McpWiringService } from './mcp-wiring.service.js'
export type { McpWiringOptions, McpWiringResult } from './mcp-wiring.service.js'

// Memory services
export { PreTaskHookService } from './pre-task-hook.service.js'
export type { PreTaskHookInput, PreTaskHookOutput } from './pre-task-hook.service.js'

export { SessionStartHookService } from './session-start-hook.service.js'
export type { SessionStartHookInput, SessionStartHookOutput } from './session-start-hook.service.js'

export { PostTaskHookService } from './post-task-hook.service.js'
export type {
	PostTaskHookInput,
	PostTaskHookOutput,
	KnowledgeCandidate,
} from './post-task-hook.service.js'

export { MemoryContextGeneratorService } from './memory-context-generator.service.js'
export type {
	MemoryContextGeneratorInput,
	MemoryContextGeneratorOutput,
} from './memory-context-generator.service.js'
