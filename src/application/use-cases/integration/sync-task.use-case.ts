/**
 * Sync Task Use Case.
 *
 * Synchronizes a task between Vanguard and the PM tool.
 */

import type { ExternalTask, TaskStatus, TaskUpdate } from '../../../domain/entities/integration.js'

/**
 * Input for syncing a task.
 */
export interface SyncTaskInput {
	readonly taskId: string
	readonly integrationName?: string | undefined
	readonly update?: TaskUpdate | undefined
}

/**
 * Output from syncing a task.
 */
export interface SyncTaskOutput {
	readonly success: boolean
	readonly task?: ExternalTask | undefined
	readonly error?: string | undefined
}

/**
 * Integration provider port for task operations.
 */
export interface TaskProviderPort {
	getTask(taskId: string): Promise<ExternalTask | undefined>
	updateTask(taskId: string, update: TaskUpdate): Promise<{ success: boolean; error?: string }>
	addComment(taskId: string, comment: string): Promise<{ success: boolean; error?: string }>
}

/**
 * Use case for syncing a task with the PM tool.
 *
 * Responsibilities:
 * - Fetches current task state from PM tool
 * - Optionally updates task status/fields
 * - Returns synchronized task data
 */
export class SyncTaskUseCase {
	constructor(private readonly taskProvider: TaskProviderPort) {}

	async execute(input: SyncTaskInput): Promise<SyncTaskOutput> {
		// Get current task from PM tool
		const task = await this.taskProvider.getTask(input.taskId)
		if (!task) {
			return {
				success: false,
				error: `Task not found: ${input.taskId}`,
			}
		}

		// Apply update if provided
		if (input.update) {
			const result = await this.taskProvider.updateTask(input.taskId, input.update)
			if (!result.success) {
				return {
					success: false,
					error: result.error ?? 'Failed to update task',
				}
			}

			// Fetch updated task
			const updatedTask = await this.taskProvider.getTask(input.taskId)
			return {
				success: true,
				task: updatedTask ?? task,
			}
		}

		return {
			success: true,
			task,
		}
	}
}

/**
 * Add Comment Use Case.
 *
 * Adds a comment to a task in the PM tool.
 */
export interface AddCommentInput {
	readonly taskId: string
	readonly comment: string
	readonly integrationName?: string | undefined
}

export class AddCommentUseCase {
	constructor(private readonly taskProvider: TaskProviderPort) {}

	async execute(input: AddCommentInput): Promise<{ success: boolean; error?: string | undefined }> {
		if (!input.comment.trim()) {
			return {
				success: false,
				error: 'Comment cannot be empty',
			}
		}

		return this.taskProvider.addComment(input.taskId, input.comment)
	}
}

/**
 * Update Task Status Use Case.
 *
 * Updates a task's status in the PM tool.
 */
export interface UpdateTaskStatusInput {
	readonly taskId: string
	readonly status: TaskStatus
	readonly integrationName?: string | undefined
}

export class UpdateTaskStatusUseCase {
	constructor(private readonly taskProvider: TaskProviderPort) {}

	async execute(
		input: UpdateTaskStatusInput,
	): Promise<{ success: boolean; error?: string | undefined }> {
		return this.taskProvider.updateTask(input.taskId, { status: input.status })
	}
}
