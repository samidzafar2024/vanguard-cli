/**
 * Supported project management integrations.
 */
export type IntegrationType = 'clickup' | 'jira' | 'linear' | 'asana' | 'github'

/**
 * Task status that maps across PM tools.
 */
export type TaskStatus =
	| 'backlog'
	| 'todo'
	| 'in-progress'
	| 'in-review'
	| 'done'
	| 'blocked'
	| 'cancelled'

/**
 * Task priority levels.
 */
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low' | 'none'

/**
 * A task from an external PM tool.
 * This is a normalized representation that works across different PM systems.
 */
export interface ExternalTask {
	/** Unique ID in the PM system (e.g., CU-abc123, JIRA-123) */
	readonly id: string
	/** Human-readable task ID/key */
	readonly key: string
	/** Task title */
	readonly title: string
	/** Full description/body */
	readonly description: string
	/** Normalized status */
	readonly status: TaskStatus
	/** Original status name from PM tool */
	readonly originalStatus: string
	/** Priority level */
	readonly priority: TaskPriority
	/** Assignee username/email */
	readonly assignee?: string | undefined
	/** Labels/tags */
	readonly labels: readonly string[]
	/** Parent task ID if subtask */
	readonly parentId?: string | undefined
	/** URL to task in PM tool */
	readonly url: string
	/** Creation timestamp */
	readonly createdAt: string
	/** Last update timestamp */
	readonly updatedAt: string
	/** Due date if set */
	readonly dueDate?: string | undefined
	/** Custom fields from PM tool */
	readonly customFields: Record<string, unknown>
	/** Raw data from PM API for advanced use */
	readonly raw: unknown
}

/**
 * A project/list/board in the PM tool.
 */
export interface ExternalProject {
	/** Unique ID */
	readonly id: string
	/** Project name */
	readonly name: string
	/** Project description */
	readonly description?: string | undefined
	/** URL to project in PM tool */
	readonly url: string
	/** Available statuses for tasks in this project */
	readonly statuses: readonly string[]
}

/**
 * Integration configuration stored locally.
 */
export interface IntegrationConfig {
	/** Integration type */
	readonly type: IntegrationType
	/** Display name for this integration instance */
	readonly name: string
	/** API token or credentials reference */
	readonly apiToken: string
	/** Base URL for self-hosted instances */
	readonly baseUrl?: string | undefined
	/** Selected workspace/org ID */
	readonly workspaceId: string
	/** Selected project/list/board ID */
	readonly projectId: string
	/** Status mapping from PM tool to normalized status */
	readonly statusMapping: Record<string, TaskStatus>
	/** Whether integration is active */
	readonly enabled: boolean
	/** Last sync timestamp */
	readonly lastSyncAt?: string | undefined
}

/**
 * Result of creating a task in the PM tool.
 */
export interface CreateTaskResult {
	readonly task: ExternalTask
	readonly success: boolean
	readonly error?: string | undefined
}

/**
 * Result of updating a task in the PM tool.
 */
export interface UpdateTaskResult {
	readonly task: ExternalTask
	readonly success: boolean
	readonly error?: string | undefined
}

/**
 * Comment to add to a task.
 */
export interface TaskComment {
	readonly text: string
	readonly isMarkdown?: boolean | undefined
}

/**
 * Task update payload.
 */
export interface TaskUpdate {
	readonly title?: string | undefined
	readonly description?: string | undefined
	readonly status?: string | undefined
	readonly priority?: TaskPriority | undefined
	readonly assignee?: string | undefined
	readonly labels?: readonly string[] | undefined
	readonly dueDate?: string | undefined
	readonly customFields?: Record<string, unknown> | undefined
}

/**
 * Task creation payload.
 */
export interface TaskCreate {
	readonly title: string
	readonly description?: string | undefined
	readonly status?: string | undefined
	readonly priority?: TaskPriority | undefined
	readonly assignee?: string | undefined
	readonly labels?: readonly string[] | undefined
	readonly dueDate?: string | undefined
	readonly parentId?: string | undefined
}

/**
 * Branch naming convention for tasks.
 */
export interface BranchNamingConfig {
	/** Prefix for feature branches */
	readonly featurePrefix: string
	/** Prefix for bugfix branches */
	readonly bugfixPrefix: string
	/** Whether to include task key in branch name */
	readonly includeTaskKey: boolean
	/** Whether to slugify task title */
	readonly slugifyTitle: boolean
	/** Max length for branch name */
	readonly maxLength: number
}

/**
 * Default branch naming configuration.
 */
export const DEFAULT_BRANCH_NAMING: BranchNamingConfig = {
	featurePrefix: 'feature/',
	bugfixPrefix: 'fix/',
	includeTaskKey: true,
	slugifyTitle: true,
	maxLength: 60,
}

/**
 * Generate a git branch name from a task.
 */
export function generateBranchName(
	task: ExternalTask,
	config: BranchNamingConfig = DEFAULT_BRANCH_NAMING,
): string {
	const prefix = task.labels.some((l) => l.toLowerCase().includes('bug'))
		? config.bugfixPrefix
		: config.featurePrefix

	let name = prefix

	if (config.includeTaskKey) {
		name += `${task.key}-`
	}

	if (config.slugifyTitle) {
		const slug = task.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, config.maxLength - name.length)
		name += slug
	}

	return name.slice(0, config.maxLength)
}

/**
 * Extract task key from branch name.
 */
export function extractTaskKeyFromBranch(branchName: string): string | undefined {
	// Common patterns: feature/CU-123-title, fix/JIRA-456-title, CU-789-title
	const patterns = [
		/(?:feature|fix|bugfix|hotfix)\/([A-Z]+-\d+)/i,
		/(?:feature|fix|bugfix|hotfix)\/(\w+-[a-z0-9]+)/i,
		/^([A-Z]+-\d+)/i,
		/^(\w+-[a-z0-9]+)/i,
	]

	for (const pattern of patterns) {
		const match = branchName.match(pattern)
		if (match) {
			return match[1]
		}
	}

	return undefined
}
