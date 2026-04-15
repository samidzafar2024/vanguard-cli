export { Stack } from './stack.js'
export type {
	Language,
	StackCategory,
	DatabaseType,
	OrmConfig,
	AuthConfig,
	StackLayer,
	CodeExample,
} from './stack.js'

export { Architecture, ArchitectureModule } from './architecture.js'
export type {
	ComplexityLevel,
	ArchitectureLayer,
	AntiPattern,
	StackImplementation,
} from './architecture.js'

export { TestingConfig } from './testing-config.js'
export type { TestCategory, LintCategory, TestFramework, LintTool } from './testing-config.js'

export { Agent } from './agent.js'
export type { AgentRole, CommunicationStyle, AgentContext } from './agent.js'

export { Project } from './project.js'
export type { ProjectType, Track, ProjectConfig } from './project.js'

export { ManifestFactory } from './manifest.js'
export type {
	DocumentStatus,
	TaskStatus,
	ManifestPhase,
	ManifestAgent,
	ManifestDocument,
	ManifestTask,
	ManifestDocuments,
	Manifest,
} from './manifest.js'

export {
	WorkflowStateFactory,
	filterStepsByTrack,
	getWorkflowForTrack,
	TRACK_CHARACTERISTICS,
} from './workflow.js'
export type {
	StepStatus,
	WorkflowStep,
	Workflow,
	WorkflowState,
} from './workflow.js'

export {
	DEFAULT_BRANCH_NAMING,
	generateBranchName,
	extractTaskKeyFromBranch,
} from './integration.js'
export type {
	IntegrationType,
	TaskStatus as IntegrationTaskStatus,
	TaskPriority,
	ExternalTask,
	ExternalProject,
	IntegrationConfig,
	CreateTaskResult,
	UpdateTaskResult,
	TaskComment,
	TaskUpdate,
	TaskCreate,
	BranchNamingConfig,
} from './integration.js'

// Memory entities
export { MemoryItem } from './memory-item.js'
export type { CaptureContext } from './memory-item.js'
export { MemoryConfig } from './memory-config.js'
export type {
	EmbeddingConfig,
	AutoCaptureConfig,
	AutoCaptureExtractConfig,
	SearchConfig,
	HookConfig,
	MemoryConfigParams,
} from './memory-config.js'
