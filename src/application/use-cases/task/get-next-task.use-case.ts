/**
 * Get Next Task Use Case.
 *
 * Retrieves the next prioritized task from the queue.
 */

import type { TaskEntity, TaskRepository } from '../../ports/repositories.js'

/**
 * Input for getting next task.
 */
export interface GetNextTaskInput {
	readonly count?: number | undefined
}

/**
 * Output from getting next task.
 */
export interface GetNextTaskOutput {
	readonly task: TaskEntity | undefined
	readonly hasMore: boolean
	readonly totalAvailable: number
}

/**
 * Output from getting multiple next tasks.
 */
export interface GetNextTasksOutput {
	readonly tasks: readonly TaskEntity[]
	readonly totalAvailable: number
}

/**
 * Use case for getting the next task to work on.
 *
 * Responsibilities:
 * - Queries for available tasks in todo status
 * - Returns highest priority task
 * - Provides queue statistics
 */
export class GetNextTaskUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(_input?: GetNextTaskInput): Promise<GetNextTaskOutput> {
		const todoTasks = await this.taskRepository.findByStatus('todo')

		if (todoTasks.length === 0) {
			return {
				task: undefined,
				hasMore: false,
				totalAvailable: 0,
			}
		}

		// Tasks should already be sorted by priority in repository
		// but we can sort again to ensure consistency
		const sorted = this.sortByPriority([...todoTasks])

		return {
			task: sorted[0],
			hasMore: sorted.length > 1,
			totalAvailable: sorted.length,
		}
	}

	/**
	 * Get multiple next tasks for selection.
	 */
	async executeMultiple(count = 5): Promise<GetNextTasksOutput> {
		const todoTasks = await this.taskRepository.findByStatus('todo')

		if (todoTasks.length === 0) {
			return {
				tasks: [],
				totalAvailable: 0,
			}
		}

		const sorted = this.sortByPriority([...todoTasks])

		return {
			tasks: sorted.slice(0, count),
			totalAvailable: sorted.length,
		}
	}

	private sortByPriority(tasks: TaskEntity[]): TaskEntity[] {
		const priorityOrder: Record<string, number> = {
			urgent: 0,
			high: 1,
			medium: 2,
			low: 3,
			none: 4,
		}

		return tasks.sort((a, b) => {
			const aPriority = priorityOrder[a.priority ?? 'none'] ?? 4
			const bPriority = priorityOrder[b.priority ?? 'none'] ?? 4

			if (aPriority !== bPriority) {
				return aPriority - bPriority
			}

			// Then by creation date (oldest first)
			return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
		})
	}
}
