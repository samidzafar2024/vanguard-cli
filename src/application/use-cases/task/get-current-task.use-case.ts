/**
 * Get Current Task Use Case.
 *
 * Retrieves the currently active task being worked on.
 */

import type { TaskEntity, TaskRepository } from '../../ports/repositories.js'

/**
 * Output from getting current task.
 */
export interface GetCurrentTaskOutput {
	readonly task: TaskEntity | undefined
	readonly isActive: boolean
}

/**
 * Use case for getting the current active task.
 *
 * Responsibilities:
 * - Retrieves the task currently marked as in-progress
 * - Returns undefined if no task is active
 */
export class GetCurrentTaskUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(): Promise<GetCurrentTaskOutput> {
		const task = await this.taskRepository.findCurrent()

		return {
			task,
			isActive: task !== undefined,
		}
	}
}

/**
 * Get Task By ID Use Case.
 *
 * Retrieves a specific task by its identifier.
 */
export class GetTaskByIdUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(taskId: string): Promise<TaskEntity | undefined> {
		return this.taskRepository.findById(taskId)
	}
}

/**
 * List Tasks Use Case.
 *
 * Retrieves all tasks with optional filtering.
 */
export interface ListTasksInput {
	readonly status?: 'todo' | 'in-progress' | 'in-review' | 'done' | undefined
}

export interface ListTasksOutput {
	readonly tasks: readonly TaskEntity[]
	readonly stats: {
		readonly todo: number
		readonly inProgress: number
		readonly inReview: number
		readonly done: number
	}
}

export class ListTasksUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input?: ListTasksInput): Promise<ListTasksOutput> {
		let tasks: readonly TaskEntity[]

		if (input?.status) {
			tasks = await this.taskRepository.findByStatus(input.status)
		} else {
			tasks = await this.taskRepository.findAll()
		}

		// Calculate stats
		const allTasks = await this.taskRepository.findAll()
		const stats = {
			todo: allTasks.filter((t) => t.status === 'todo').length,
			inProgress: allTasks.filter((t) => t.status === 'in-progress').length,
			inReview: allTasks.filter((t) => t.status === 'in-review').length,
			done: allTasks.filter((t) => t.status === 'done').length,
		}

		return { tasks, stats }
	}
}
