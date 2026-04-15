import type { ExternalTask, TaskStatus } from '../../domain/entities/integration.js'
import type { IntegrationService } from './integration.service.js'

/**
 * Configuration for task queue behavior.
 */
export interface TaskQueueConfig {
	/** Status names that indicate "in progress" work */
	readonly inProgressStatuses: readonly string[]
	/** Status names for tasks in review */
	readonly reviewingStatuses: readonly string[]
	/** Status names for tasks ready to be picked up */
	readonly todoStatuses: readonly string[]
	/** Status names for completed tasks */
	readonly doneStatuses: readonly string[]
	/** Default status to set when starting a task */
	readonly defaultInProgressStatus: string
	/** Default status to set when moving to review */
	readonly defaultReviewingStatus: string
	/** Default status to set when completing a task */
	readonly defaultDoneStatus: string
}

/**
 * Default configuration for common ClickUp setups.
 */
export const DEFAULT_QUEUE_CONFIG: TaskQueueConfig = {
	inProgressStatuses: ['in progress', 'doing', 'in development'],
	reviewingStatuses: ['reviewing', 'in review', 'code review'],
	todoStatuses: ['to do', 'todo', 'open', 'ready', 'backlog'],
	doneStatuses: ['done', 'complete', 'closed'],
	defaultInProgressStatus: 'in progress',
	defaultReviewingStatus: 'reviewing',
	defaultDoneStatus: 'done',
}

/**
 * Result of getting the next task.
 */
export interface NextTaskResult {
	readonly task: ExternalTask | undefined
	readonly hasMore: boolean
	readonly totalAvailable: number
}

/**
 * Service for managing the task queue workflow.
 *
 * Uses ClickUp (via IntegrationService) as the source of truth for tasks.
 * Provides high-level operations for the task workflow:
 * - Get current in-progress task
 * - Get next available task
 * - Transition tasks between statuses
 */
export class TaskQueueService {
	private readonly integrationService: IntegrationService
	private readonly config: TaskQueueConfig
	private defaultIntegration: string | undefined

	constructor(
		integrationService: IntegrationService,
		config: TaskQueueConfig = DEFAULT_QUEUE_CONFIG,
	) {
		this.integrationService = integrationService
		this.config = config
	}

	/**
	 * Set the default integration to use for task operations.
	 */
	setDefaultIntegration(name: string): void {
		this.defaultIntegration = name
	}

	/**
	 * Get the current in-progress task.
	 *
	 * Returns the first task found with an "in progress" status.
	 * If multiple tasks are in progress, returns the most recently updated.
	 */
	async getCurrentTask(integrationName?: string): Promise<ExternalTask | undefined> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const config = await this.getIntegrationConfig(name)
		if (!config) {
			throw new Error(`Integration config not found: ${name}`)
		}

		// Query for in-progress tasks
		const tasks = await provider.getTasks(config.projectId, {
			statuses: this.config.inProgressStatuses,
			limit: 10,
		})

		if (tasks.length === 0) {
			return undefined
		}

		// Return the most recently updated task
		return [...tasks].sort(
			(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)[0]
	}

	/**
	 * Check if there's an active task in progress.
	 */
	async isTaskActive(integrationName?: string): Promise<boolean> {
		const task = await this.getCurrentTask(integrationName)
		return task !== undefined
	}

	/**
	 * Get the next available task to work on.
	 *
	 * Returns tasks from "todo" statuses, ordered by priority then by date.
	 */
	async getNextTask(integrationName?: string): Promise<NextTaskResult> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const config = await this.getIntegrationConfig(name)
		if (!config) {
			throw new Error(`Integration config not found: ${name}`)
		}

		// Query for todo tasks
		const tasks = await provider.getTasks(config.projectId, {
			statuses: this.config.todoStatuses,
			limit: 50,
		})

		if (tasks.length === 0) {
			return { task: undefined, hasMore: false, totalAvailable: 0 }
		}

		// Sort by priority (urgent > high > medium > low > none) then by date
		const priorityOrder: Record<string, number> = {
			urgent: 0,
			high: 1,
			medium: 2,
			low: 3,
			none: 4,
		}

		const sorted = [...tasks].sort((a, b) => {
			const priorityDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
			if (priorityDiff !== 0) return priorityDiff
			// Then by creation date (oldest first)
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		})

		return {
			task: sorted[0],
			hasMore: sorted.length > 1,
			totalAvailable: sorted.length,
		}
	}

	/**
	 * Get multiple next tasks for selection.
	 */
	async getNextTasks(count = 5, integrationName?: string): Promise<readonly ExternalTask[]> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const config = await this.getIntegrationConfig(name)
		if (!config) {
			throw new Error(`Integration config not found: ${name}`)
		}

		// Query for todo tasks
		const tasks = await provider.getTasks(config.projectId, {
			statuses: this.config.todoStatuses,
			limit: 50,
		})

		// Sort by priority then by date
		const priorityOrder: Record<string, number> = {
			urgent: 0,
			high: 1,
			medium: 2,
			low: 3,
			none: 4,
		}

		const sorted = [...tasks].sort((a, b) => {
			const priorityDiff = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
			if (priorityDiff !== 0) return priorityDiff
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		})

		return sorted.slice(0, count)
	}

	/**
	 * Transition a task to a new status.
	 */
	async transitionTask(
		taskId: string,
		status: string,
		integrationName?: string,
	): Promise<{ success: boolean; error?: string }> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			return { success: false, error: 'No integration specified and no default set' }
		}

		return this.integrationService.updateTask(name, taskId, { status })
	}

	/**
	 * Start working on a task - sets status to "in progress".
	 */
	async startTask(
		taskId: string,
		integrationName?: string,
	): Promise<{ success: boolean; error?: string }> {
		return this.transitionTask(taskId, this.config.defaultInProgressStatus, integrationName)
	}

	/**
	 * Complete a task - sets status to "done".
	 */
	async completeTask(
		taskId: string,
		integrationName?: string,
	): Promise<{ success: boolean; error?: string }> {
		return this.transitionTask(taskId, this.config.defaultDoneStatus, integrationName)
	}

	/**
	 * Move a task to review - sets status to "reviewing".
	 *
	 * Optionally adds a comment to the task when review starts.
	 */
	async startReview(
		taskId: string,
		options?: {
			integrationName?: string
			comment?: string
			branchName?: string
		},
	): Promise<{ success: boolean; error?: string }> {
		const integrationName = options?.integrationName ?? this.defaultIntegration
		if (!integrationName) {
			return { success: false, error: 'No integration specified and no default set' }
		}

		// Transition status to reviewing
		const result = await this.transitionTask(
			taskId,
			this.config.defaultReviewingStatus,
			integrationName,
		)

		if (!result.success) {
			return result
		}

		// Add a comment if provided or generate a default one
		const comment =
			options?.comment ??
			`🔍 Code review initiated${options?.branchName ? ` for branch: ${options.branchName}` : ''}`

		await this.integrationService.addComment(integrationName, taskId, comment)

		return { success: true }
	}

	/**
	 * Approve a review - marks task as done with approval comment.
	 */
	async approveReview(
		taskId: string,
		options?: {
			integrationName?: string
			comment?: string
		},
	): Promise<{ success: boolean; error?: string }> {
		const integrationName = options?.integrationName ?? this.defaultIntegration
		if (!integrationName) {
			return { success: false, error: 'No integration specified and no default set' }
		}

		// Add approval comment
		const comment = options?.comment ?? '✅ Code review approved'
		await this.integrationService.addComment(integrationName, taskId, comment)

		// Transition to done
		return this.transitionTask(taskId, this.config.defaultDoneStatus, integrationName)
	}

	/**
	 * Request changes on a review - keeps task in review with feedback comment.
	 */
	async requestChanges(
		taskId: string,
		options: {
			integrationName?: string
			comment: string
		},
	): Promise<{ success: boolean; error?: string }> {
		const integrationName = options.integrationName ?? this.defaultIntegration
		if (!integrationName) {
			return { success: false, error: 'No integration specified and no default set' }
		}

		// Add changes requested comment
		const comment = `⚠️ Changes requested:\n${options.comment}`
		await this.integrationService.addComment(integrationName, taskId, comment)

		// Keep in reviewing status (move back to in-progress for developer to address)
		return this.transitionTask(taskId, this.config.defaultInProgressStatus, integrationName)
	}

	/**
	 * Check if a task is currently in review.
	 */
	async isInReview(taskId: string, integrationName?: string): Promise<boolean> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const task = await provider.getTask(taskId)
		if (!task) {
			return false
		}

		const normalizedStatus = task.status.toLowerCase()
		return this.config.reviewingStatuses.some((s) => s.toLowerCase() === normalizedStatus)
	}

	/**
	 * Get all tasks currently in review.
	 */
	async getTasksInReview(integrationName?: string): Promise<readonly ExternalTask[]> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const config = await this.getIntegrationConfig(name)
		if (!config) {
			throw new Error(`Integration config not found: ${name}`)
		}

		return provider.getTasks(config.projectId, {
			statuses: this.config.reviewingStatuses,
		})
	}

	/**
	 * Get task queue statistics.
	 */
	async getQueueStats(integrationName?: string): Promise<{
		inProgress: number
		reviewing: number
		todo: number
		done: number
	}> {
		const name = integrationName ?? this.defaultIntegration
		if (!name) {
			throw new Error('No integration specified and no default set')
		}

		const provider = this.integrationService.getProvider(name)
		if (!provider) {
			throw new Error(`Integration not found: ${name}`)
		}

		const config = await this.getIntegrationConfig(name)
		if (!config) {
			throw new Error(`Integration config not found: ${name}`)
		}

		// Get counts for each status category
		const [inProgressTasks, reviewingTasks, todoTasks, doneTasks] = await Promise.all([
			provider.getTasks(config.projectId, { statuses: this.config.inProgressStatuses }),
			provider.getTasks(config.projectId, { statuses: this.config.reviewingStatuses }),
			provider.getTasks(config.projectId, { statuses: this.config.todoStatuses }),
			provider.getTasks(config.projectId, {
				statuses: this.config.doneStatuses,
				includeClosed: true,
			}),
		])

		return {
			inProgress: inProgressTasks.length,
			reviewing: reviewingTasks.length,
			todo: todoTasks.length,
			done: doneTasks.length,
		}
	}

	/**
	 * Map a normalized status to the actual status name for the integration.
	 */
	getStatusName(normalizedStatus: TaskStatus): string {
		switch (normalizedStatus) {
			case 'in-progress':
				return this.config.defaultInProgressStatus
			case 'in-review':
				return this.config.defaultReviewingStatus
			case 'done':
				return this.config.defaultDoneStatus
			case 'todo':
				return this.config.todoStatuses[0] ?? 'to do'
			default:
				return normalizedStatus
		}
	}

	// Private helpers

	private async getIntegrationConfig(name: string) {
		const integrations = await this.integrationService.getIntegrations()
		return integrations.find((i) => i.name === name)
	}
}
