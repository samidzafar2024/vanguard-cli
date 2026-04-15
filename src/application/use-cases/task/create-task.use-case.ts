/**
 * Create Task Use Case.
 *
 * Creates a new local task in the todo queue.
 */

import type { UnifiedTaskRepository } from '../../../infrastructure/repositories/task.repository.js'
import type { TaskEntity, TaskRepository } from '../../ports/repositories.js'

/**
 * Input for creating a task.
 */
export interface CreateTaskInput {
	readonly title: string
	readonly description?: string | undefined
}

/**
 * Output from creating a task.
 */
export interface CreateTaskOutput {
	readonly task: TaskEntity
}

/**
 * Use case for creating a new local task.
 *
 * Responsibilities:
 * - Validates task input
 * - Creates task in todo status
 * - Returns the created task entity
 */
export class CreateTaskUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input: CreateTaskInput): Promise<CreateTaskOutput> {
		if (!input.title.trim()) {
			throw new Error('Task title is required')
		}

		// Type guard to check if repository supports local task creation
		const repo = this.taskRepository as UnifiedTaskRepository
		if (typeof repo.createLocal !== 'function') {
			throw new Error('Task repository does not support local task creation')
		}

		const task = await repo.createLocal(input.title.trim(), input.description?.trim() ?? '')

		return { task }
	}
}
