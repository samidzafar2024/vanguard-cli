/**
 * Unified Task Repository Implementation.
 *
 * Provides a single interface for accessing tasks from either
 * local storage or PM integrations (ClickUp, etc.).
 */

import type {
	TaskEntity,
	TaskRepository,
	TaskStatus,
} from '../../application/ports/repositories.js'
import type { IntegrationService } from '../../application/services/integration.service.js'
import type { LocalTaskService } from '../../application/services/local-task.service.js'

/**
 * Task repository that unifies local and PM-integrated tasks.
 *
 * Strategy:
 * - If PM integration is configured, use it as primary source
 * - Otherwise, fall back to local task storage
 * - Provides consistent interface regardless of source
 *
 * Dependencies are injected via constructor (DDD port/adapter pattern).
 */
export class UnifiedTaskRepository implements TaskRepository {
	private integrationName: string | undefined
	private initialized = false

	constructor(
		private readonly localService: LocalTaskService,
		private readonly integrationService: IntegrationService,
	) {}

	/**
	 * Initialize the repository - detect integration or use local.
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initialized) return

		try {
			await this.integrationService.initialize()
			const integrations = await this.integrationService.getIntegrations()

			if (integrations.length > 0 && integrations[0]) {
				this.integrationName = integrations[0].name
			}
		} catch {
			// No integrations configured, use local
		}

		this.initialized = true
	}

	/**
	 * Check if using PM integration or local storage.
	 * Returns the integration name if using integration, undefined otherwise.
	 */
	private async getIntegrationNameIfUsing(): Promise<string | undefined> {
		await this.ensureInitialized()
		return this.integrationName
	}

	async findById(id: string): Promise<TaskEntity | undefined> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			const task = await this.integrationService.getTask(integrationName, id)
			return task ? this.mapExternalTask(task) : undefined
		}

		const localTask = await this.localService.getTask(id)
		return localTask ? this.mapLocalTask(localTask) : undefined
	}

	async findAll(): Promise<readonly TaskEntity[]> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			const tasks = await this.integrationService.getAvailableTasks(integrationName, {
				limit: 100,
			})
			return tasks.map((t) => this.mapExternalTask(t))
		}

		const tasks = await this.localService.getTasks()
		return tasks.map((t) => this.mapLocalTask(t))
	}

	async findByStatus(status: TaskStatus): Promise<readonly TaskEntity[]> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			// Map our status to PM status
			const pmStatus = this.mapStatusToPM(status)
			const tasks = await this.integrationService.getAvailableTasks(integrationName, {
				status: pmStatus,
				limit: 100,
			})
			return tasks.map((t) => this.mapExternalTask(t))
		}

		const tasks = await this.localService.getTasksByStatus(status)
		return tasks.map((t) => this.mapLocalTask(t))
	}

	async findCurrent(): Promise<TaskEntity | undefined> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			const active = await this.integrationService.getActiveTask()
			if (active) {
				return this.mapExternalTask(active.task)
			}
			return undefined
		}

		const current = await this.localService.getCurrentTask()
		return current ? this.mapLocalTask(current) : undefined
	}

	async findNext(): Promise<TaskEntity | undefined> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			const tasks = await this.integrationService.getAvailableTasks(integrationName, {
				status: 'Open',
				limit: 1,
			})
			return tasks[0] ? this.mapExternalTask(tasks[0]) : undefined
		}

		const next = await this.localService.getNextTask()
		return next ? this.mapLocalTask(next) : undefined
	}

	async save(task: TaskEntity): Promise<void> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (task.source === 'integration' && integrationName) {
			// Update via integration service
			const pmStatus = this.mapStatusToPM(task.status)
			await this.integrationService.updateTask(integrationName, task.id, {
				status: pmStatus,
			})
		} else {
			// Update local task
			await this.localService.updateStatus(task.id, task.status)
		}
	}

	async setCurrent(taskId: string | undefined): Promise<void> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			// Integration service manages active task internally
			// This is handled by startTask/completeTask
			return
		}

		if (taskId) {
			// Start the task locally
			await this.localService.startTask(taskId)
		} else {
			// Clear current - complete the current task
			const current = await this.localService.getCurrentTask()
			if (current) {
				await this.localService.completeTask(current.id)
			}
		}
	}

	/**
	 * Create a new local task.
	 */
	async createLocal(title: string, description = ''): Promise<TaskEntity> {
		const task = await this.localService.createTask(title, description)
		return this.mapLocalTask(task)
	}

	/**
	 * Get repository statistics.
	 */
	async getStats(): Promise<{
		todo: number
		inProgress: number
		inReview: number
		done: number
		source: 'local' | 'integration'
	}> {
		const integrationName = await this.getIntegrationNameIfUsing()
		if (integrationName) {
			// Would need to fetch counts from PM - simplified for now
			const tasks = await this.findAll()
			return {
				todo: tasks.filter((t) => t.status === 'todo').length,
				inProgress: tasks.filter((t) => t.status === 'in-progress').length,
				inReview: tasks.filter((t) => t.status === 'in-review').length,
				done: tasks.filter((t) => t.status === 'done').length,
				source: 'integration',
			}
		}

		const stats = await this.localService.getStats()
		return { ...stats, source: 'local' }
	}

	// Mapping helpers

	private mapLocalTask(task: {
		id: string
		title: string
		description: string
		status: string
		branchName?: string | undefined
		createdAt: string
		updatedAt: string
	}): TaskEntity {
		const entity: TaskEntity = {
			id: task.id,
			title: task.title,
			description: task.description,
			status: task.status as TaskStatus,
			source: 'local',
			createdAt: task.createdAt,
			updatedAt: task.updatedAt,
		}

		if (task.branchName !== undefined) {
			return { ...entity, branchName: task.branchName }
		}

		return entity
	}

	private mapExternalTask(task: {
		id: string
		title: string
		description: string
		status: string
		url: string
		priority: string
	}): TaskEntity {
		return {
			id: task.id,
			title: task.title,
			description: task.description,
			status: this.mapPMStatusToLocal(task.status),
			source: 'integration',
			integrationName: this.integrationName,
			url: task.url,
			priority: task.priority as TaskEntity['priority'],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}
	}

	private mapStatusToPM(status: TaskStatus): string {
		switch (status) {
			case 'todo':
				return 'Open'
			case 'in-progress':
				return 'in progress'
			case 'in-review':
				return 'review'
			case 'done':
				return 'Closed'
			default:
				return status
		}
	}

	private mapPMStatusToLocal(pmStatus: string): TaskStatus {
		const lower = pmStatus.toLowerCase()
		if (lower.includes('progress') || lower.includes('doing')) return 'in-progress'
		if (lower.includes('review')) return 'in-review'
		if (lower.includes('done') || lower.includes('closed') || lower.includes('complete'))
			return 'done'
		return 'todo'
	}
}
