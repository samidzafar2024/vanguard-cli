/**
 * Complete Task Use Case.
 *
 * Transitions a task to done status and clears it as the current task.
 */

import type { TaskEntity, TaskRepository, TaskStatus } from '../../ports/repositories.js'

/**
 * Input for completing a task.
 */
export interface CompleteTaskInput {
	readonly taskId: string
}

/**
 * Output from completing a task.
 */
export interface CompleteTaskOutput {
	readonly task: TaskEntity
	readonly previousStatus: TaskStatus
}

/**
 * Use case for completing a task.
 *
 * Responsibilities:
 * - Validates task exists and can be completed
 * - Updates task status to done
 * - Clears task as current active task
 */
export class CompleteTaskUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input: CompleteTaskInput): Promise<CompleteTaskOutput> {
		// Find the task
		const task = await this.taskRepository.findById(input.taskId)
		if (!task) {
			throw new Error(`Task not found: ${input.taskId}`)
		}

		// Validate task can be completed
		if (task.status === 'done') {
			throw new Error(`Task is already completed: ${task.title}`)
		}

		if (task.status === 'todo') {
			throw new Error(`Cannot complete task that hasn't been started: ${task.title}`)
		}

		const previousStatus = task.status

		// Update task status
		const updatedTask: TaskEntity = {
			...task,
			status: 'done',
			updatedAt: new Date().toISOString(),
		}

		await this.taskRepository.save(updatedTask)

		// Clear as current task
		const current = await this.taskRepository.findCurrent()
		if (current?.id === task.id) {
			await this.taskRepository.setCurrent(undefined)
		}

		return {
			task: updatedTask,
			previousStatus,
		}
	}
}
