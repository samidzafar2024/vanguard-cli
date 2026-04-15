/**
 * Integration Use Cases.
 *
 * Clean architecture use cases for PM tool integrations.
 */

export {
	ConfigureIntegrationUseCase,
	RemoveIntegrationUseCase,
	ListIntegrationsUseCase,
} from './configure-integration.use-case.js'
export type {
	ConfigureIntegrationInput,
	ConfigureIntegrationOutput,
	IntegrationProviderPort,
} from './configure-integration.use-case.js'

export {
	SyncTaskUseCase,
	AddCommentUseCase,
	UpdateTaskStatusUseCase,
} from './sync-task.use-case.js'
export type {
	SyncTaskInput,
	SyncTaskOutput,
	AddCommentInput,
	UpdateTaskStatusInput,
	TaskProviderPort,
} from './sync-task.use-case.js'

export { GetAvailableTasksUseCase, GetTaskDetailsUseCase } from './get-available-tasks.use-case.js'
export type {
	GetAvailableTasksInput,
	GetAvailableTasksOutput,
	GetTaskDetailsInput,
	GetTaskDetailsOutput,
	TaskQueryPort,
} from './get-available-tasks.use-case.js'
