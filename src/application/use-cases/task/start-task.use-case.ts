/**
 * Start Task Use Case.
 *
 * Transitions a task from todo to in-progress and optionally
 * creates a feature branch for the work.
 */

import type { TaskEntity, TaskRepository, TaskStatus } from '../../ports/repositories.js'

/**
 * Input for starting a task.
 */
export interface StartTaskInput {
	readonly taskId: string
	readonly branchName?: string | undefined
}

/**
 * Output from starting a task.
 */
export interface StartTaskOutput {
	readonly task: TaskEntity
	readonly previousStatus: TaskStatus
	readonly branchCreated: boolean
}

/**
 * Branch service port for creating git branches.
 */
export interface BranchService {
	create(branchName: string): Promise<void>
	checkout(branchName: string): Promise<void>
	exists(branchName: string): Promise<boolean>
}

/**
 * Use case for starting work on a task.
 *
 * Responsibilities:
 * - Validates task exists and can be started
 * - Creates feature branch if requested
 * - Updates task status to in-progress
 * - Sets task as current active task
 */
export class StartTaskUseCase {
	constructor(
		private readonly taskRepository: TaskRepository,
		private readonly branchService?: BranchService | undefined,
	) {}

	async execute(input: StartTaskInput): Promise<StartTaskOutput> {
		// Find the task
		const task = await this.taskRepository.findById(input.taskId)
		if (!task) {
			throw new Error(`Task not found: ${input.taskId}`)
		}

		// Validate task can be started
		if (task.status === 'in-progress') {
			throw new Error(`Task is already in progress: ${task.title}`)
		}

		if (task.status === 'done') {
			throw new Error(`Cannot start completed task: ${task.title}`)
		}

		const previousStatus = task.status

		// Create branch if requested and service available
		let branchCreated = false
		if (input.branchName && this.branchService) {
			const exists = await this.branchService.exists(input.branchName)
			if (exists) {
				await this.branchService.checkout(input.branchName)
			} else {
				await this.branchService.create(input.branchName)
				branchCreated = true
			}
		}

		// Update task status
		const updatedTask: TaskEntity = {
			...task,
			status: 'in-progress',
			branchName: input.branchName ?? task.branchName,
			updatedAt: new Date().toISOString(),
		}

		await this.taskRepository.save(updatedTask)
		await this.taskRepository.setCurrent(task.id)

		return {
			task: updatedTask,
			previousStatus,
			branchCreated,
		}
	}

	/**
	 * Generate a branch name for a task.
	 */
	static generateBranchName(task: TaskEntity): string {
		const slug = task.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40)

		return `feature/${task.id}-${slug}`
	}
}
