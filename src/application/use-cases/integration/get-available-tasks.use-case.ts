/**
 * Get Available Tasks Use Case.
 *
 * Retrieves available tasks from the PM tool for selection.
 */

import type { ExternalTask } from '../../../domain/entities/integration.js'
import type { IntegrationRepository } from '../../ports/repositories.js'

/**
 * Options for querying tasks.
 */
export interface TaskQueryOptions {
	readonly status?: string | undefined
	readonly limit?: number | undefined
	readonly assignee?: string | undefined
}

/**
 * Input for getting available tasks.
 */
export interface GetAvailableTasksInput {
	readonly integrationName?: string | undefined
	readonly status?: string | undefined
	readonly limit?: number | undefined
}

/**
 * Output from getting available tasks.
 */
export interface GetAvailableTasksOutput {
	readonly tasks: readonly ExternalTask[]
	readonly totalCount: number
	readonly integrationName: string
}

/**
 * Task query port for fetching tasks from PM tools.
 */
export interface TaskQueryPort {
	getTasks(options?: TaskQueryOptions): Promise<readonly ExternalTask[]>
	getTaskCount(options?: TaskQueryOptions): Promise<number>
}

/**
 * Use case for getting available tasks from PM tool.
 *
 * Responsibilities:
 * - Queries PM tool for tasks with optional filtering
 * - Returns prioritized list of tasks
 * - Provides task count for pagination
 */
export class GetAvailableTasksUseCase {
	constructor(
		private readonly integrationRepository: IntegrationRepository,
		private readonly taskQueryPort: TaskQueryPort,
	) {}

	async execute(input?: GetAvailableTasksInput): Promise<GetAvailableTasksOutput> {
		// Get default integration if not specified
		const integration = input?.integrationName
			? await this.integrationRepository.findByName(input.integrationName)
			: await this.integrationRepository.findDefault()

		if (!integration) {
			return {
				tasks: [],
				totalCount: 0,
				integrationName: '',
			}
		}

		const options: TaskQueryOptions = {
			limit: input?.limit ?? 50,
			status: input?.status,
		}

		const tasks = await this.taskQueryPort.getTasks(options)
		const totalCount = await this.taskQueryPort.getTaskCount(options)

		return {
			tasks,
			totalCount,
			integrationName: integration.name,
		}
	}
}

/**
 * Get Task Details Use Case.
 *
 * Retrieves detailed information about a specific task.
 */
export interface GetTaskDetailsInput {
	readonly taskId: string
	readonly integrationName?: string | undefined
}

export interface GetTaskDetailsOutput {
	readonly task: ExternalTask | undefined
	readonly found: boolean
}

export class GetTaskDetailsUseCase {
	constructor(
		private readonly taskQueryPort: TaskQueryPort & {
			getTask(taskId: string): Promise<ExternalTask | undefined>
		},
	) {}

	async execute(input: GetTaskDetailsInput): Promise<GetTaskDetailsOutput> {
		const task = await this.taskQueryPort.getTask(input.taskId)

		return {
			task,
			found: task !== undefined,
		}
	}
}
