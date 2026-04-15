/**
 * Review Task Use Case.
 *
 * Transitions a task to in-review status for code review.
 */

import type { TaskEntity, TaskRepository, TaskStatus } from '../../ports/repositories.js'

/**
 * Input for starting task review.
 */
export interface ReviewTaskInput {
	readonly taskId: string
	readonly comment?: string | undefined
}

/**
 * Output from starting task review.
 */
export interface ReviewTaskOutput {
	readonly task: TaskEntity
	readonly previousStatus: TaskStatus
}

/**
 * Use case for moving a task to review.
 *
 * Responsibilities:
 * - Validates task exists and can be reviewed
 * - Updates task status to in-review
 */
export class ReviewTaskUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input: ReviewTaskInput): Promise<ReviewTaskOutput> {
		// Find the task
		const task = await this.taskRepository.findById(input.taskId)
		if (!task) {
			throw new Error(`Task not found: ${input.taskId}`)
		}

		// Validate task can be reviewed
		if (task.status === 'in-review') {
			throw new Error(`Task is already in review: ${task.title}`)
		}

		if (task.status === 'done') {
			throw new Error(`Cannot review completed task: ${task.title}`)
		}

		if (task.status === 'todo') {
			throw new Error(`Cannot review task that hasn't been started: ${task.title}`)
		}

		const previousStatus = task.status

		// Update task status
		const updatedTask: TaskEntity = {
			...task,
			status: 'in-review',
			updatedAt: new Date().toISOString(),
		}

		await this.taskRepository.save(updatedTask)

		return {
			task: updatedTask,
			previousStatus,
		}
	}
}

/**
 * Approve Review Use Case.
 *
 * Approves a task review and transitions to done.
 */
export class ApproveReviewUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input: ReviewTaskInput): Promise<ReviewTaskOutput> {
		const task = await this.taskRepository.findById(input.taskId)
		if (!task) {
			throw new Error(`Task not found: ${input.taskId}`)
		}

		if (task.status !== 'in-review') {
			throw new Error(`Task is not in review: ${task.title}`)
		}

		const previousStatus = task.status

		const updatedTask: TaskEntity = {
			...task,
			status: 'done',
			updatedAt: new Date().toISOString(),
		}

		await this.taskRepository.save(updatedTask)
		await this.taskRepository.setCurrent(undefined)

		return {
			task: updatedTask,
			previousStatus,
		}
	}
}

/**
 * Request Changes Use Case.
 *
 * Requests changes on a task and moves it back to in-progress.
 */
export class RequestChangesUseCase {
	constructor(private readonly taskRepository: TaskRepository) {}

	async execute(input: ReviewTaskInput & { comment: string }): Promise<ReviewTaskOutput> {
		const task = await this.taskRepository.findById(input.taskId)
		if (!task) {
			throw new Error(`Task not found: ${input.taskId}`)
		}

		if (task.status !== 'in-review') {
			throw new Error(`Task is not in review: ${task.title}`)
		}

		const previousStatus = task.status

		const updatedTask: TaskEntity = {
			...task,
			status: 'in-progress',
			updatedAt: new Date().toISOString(),
		}

		await this.taskRepository.save(updatedTask)

		return {
			task: updatedTask,
			previousStatus,
		}
	}
}
