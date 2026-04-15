import type {
	CreateTaskResult,
	ExternalProject,
	ExternalTask,
	IntegrationConfig,
	TaskComment,
	TaskCreate,
	TaskUpdate,
	UpdateTaskResult,
} from '../entities/integration.js'

/**
 * Interface for project management integrations.
 *
 * Each PM tool (ClickUp, Jira, Linear, etc.) implements this interface
 * to provide a consistent API for Vanguard agents.
 */
export interface IntegrationProvider {
	/**
	 * Integration type identifier.
	 */
	readonly type: string

	/**
	 * Test the connection and credentials.
	 */
	testConnection(): Promise<boolean>

	/**
	 * Get available workspaces/organizations.
	 */
	getWorkspaces(): Promise<ReadonlyArray<{ id: string; name: string }>>

	/**
	 * Get projects/lists/boards in a workspace.
	 */
	getProjects(workspaceId: string): Promise<readonly ExternalProject[]>

	/**
	 * Get tasks from a project, optionally filtered.
	 */
	getTasks(
		projectId: string,
		options?: {
			status?: string
			statuses?: readonly string[]
			assignee?: string
			labels?: readonly string[]
			limit?: number
			includeClosed?: boolean
		},
	): Promise<readonly ExternalTask[]>

	/**
	 * Normalize a task ID to the format expected by the API.
	 * Handles display formats like "CU-abc123" → "86abc123"
	 */
	normalizeTaskId(taskId: string): string

	/**
	 * Get a single task by ID.
	 */
	getTask(taskId: string): Promise<ExternalTask | undefined>

	/**
	 * Search tasks by query string.
	 */
	searchTasks(query: string, projectId?: string): Promise<readonly ExternalTask[]>

	/**
	 * Create a new task.
	 */
	createTask(projectId: string, task: TaskCreate): Promise<CreateTaskResult>

	/**
	 * Update an existing task.
	 */
	updateTask(taskId: string, update: TaskUpdate): Promise<UpdateTaskResult>

	/**
	 * Add a comment to a task.
	 */
	addComment(taskId: string, comment: TaskComment): Promise<boolean>

	/**
	 * Get comments on a task.
	 */
	getComments(taskId: string): Promise<
		ReadonlyArray<{
			id: string
			text: string
			author: string
			createdAt: string
		}>
	>

	/**
	 * Get available statuses for a project.
	 */
	getStatuses(projectId: string): Promise<readonly string[]>

	/**
	 * Initialize the provider with configuration.
	 */
	initialize(config: IntegrationConfig): void
}

/**
 * Factory for creating integration providers.
 */
export interface IntegrationProviderFactory {
	/**
	 * Create a provider for the given integration type.
	 */
	create(type: string, config: IntegrationConfig): IntegrationProvider

	/**
	 * Check if a provider type is supported.
	 */
	supports(type: string): boolean

	/**
	 * Get list of supported integration types.
	 */
	getSupportedTypes(): readonly string[]
}
